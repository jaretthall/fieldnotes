import { ipcMain } from 'electron';
import { eq } from 'drizzle-orm';
import { checkOllamaStatus, categorizeEntry, categorizeFallback, DEFAULT_OLLAMA_MODEL } from '../services/ollama.service';
import { categorizeWithCloud } from '../services/cloud-ai.service';
import { getAppSettings } from '../services/settings.service';
import { getDb } from '../db';
import { entries } from '../db/schema';
import type { AICategorization } from '../../../shared/types';

async function categorizeWithSelectedProvider(text: string): Promise<AICategorization> {
  const settings = getAppSettings();

  if (settings.aiProvider === 'off') {
    return categorizeFallback(text);
  }

  if (settings.aiProvider === 'cloud') {
    if (settings.privacyMode !== 'allow_cloud') {
      console.warn('[AI] Cloud provider selected, but privacy mode is local_only. Using local fallback.');
      return categorizeFallback(text);
    }
    if (!settings.cloudApiKey || !settings.cloudEndpoint || !settings.cloudModel) {
      console.warn('[AI] Cloud provider selected, but cloud credentials are incomplete. Using local fallback.');
      return categorizeFallback(text);
    }
    return categorizeWithCloud(text, {
      endpoint: settings.cloudEndpoint,
      model: settings.cloudModel,
      apiKey: settings.cloudApiKey,
    });
  }

  return categorizeEntry(text, settings.ollamaModel || DEFAULT_OLLAMA_MODEL);
}

export function registerAIHandlers(): void {
  // Check Ollama availability
  ipcMain.handle('ai:checkOllamaStatus', async (_event, model?: string) => {
    const selectedModel = model || getAppSettings().ollamaModel || DEFAULT_OLLAMA_MODEL;
    const status = await checkOllamaStatus(selectedModel);
    console.log('[AI] Ollama status:', status);
    return status;
  });

  // Categorize text
  ipcMain.handle('ai:categorize', async (_event, text: string): Promise<AICategorization> => {
    console.log('[AI] Categorizing entry...');
    const result = await categorizeWithSelectedProvider(text);
    console.log('[AI] Categorization complete:', result.title);
    return result;
  });

  // Generate title
  ipcMain.handle('ai:generateTitle', async (_event, text: string): Promise<string> => {
    const result = await categorizeWithSelectedProvider(text);
    return result.title;
  });

  // Generate summary
  ipcMain.handle('ai:generateSummary', async (_event, text: string): Promise<string> => {
    const result = await categorizeWithSelectedProvider(text);
    return result.summary;
  });
}

// Auto-categorize an entry after creation (called from entries.ipc.ts)
// Preserves existing title and userTags (e.g. pathway auto-titles) - only fills in when null
export async function autoCategorizeEntry(entryId: string, text: string): Promise<void> {
  try {
    if (getAppSettings().aiProvider === 'off') {
      console.log('[AI] Auto-categorization disabled by settings.');
      return;
    }
    console.log('[AI] Auto-categorizing entry:', entryId);
    const categorization = await categorizeWithSelectedProvider(text);

    const db = getDb();
    const [row] = await db.select().from(entries).where(eq(entries.id, entryId));
    if (!row) return;

    const updates: Record<string, unknown> = {
      summary: row.summary ?? categorization.summary,
      moodValence: categorization.moodValence,
      moodGranular: JSON.stringify(categorization.moodGranular),
      lifeDomains: JSON.stringify(categorization.lifeDomains),
      entities: JSON.stringify(categorization.entities),
      keywords: JSON.stringify(categorization.keywords),
      updatedAt: new Date().toISOString(),
    };

    // Only set AI title if entry has no title (pathway entries get auto-titles)
    if (row.title == null || row.title === '') {
      updates.title = categorization.title;
    }

    await db.update(entries).set(updates).where(eq(entries.id, entryId));

    console.log('[AI] Entry categorized');
  } catch (err) {
    console.error('[AI] Auto-categorization failed:', (err as Error).message);
  }
}

// Re-categorize an entry after edit - treats content like a brand new entry
// Full overwrite of AI fields so the entry is reintegrated into timeline/life view
export async function reCategorizeEntry(entryId: string, text: string): Promise<void> {
  try {
    if (getAppSettings().aiProvider === 'off') {
      console.log('[AI] Re-categorization disabled by settings.');
      return;
    }
    console.log('[AI] Re-categorizing edited entry:', entryId);
    const categorization = await categorizeWithSelectedProvider(text);

    const db = getDb();
    await db.update(entries).set({
      title: categorization.title,
      summary: categorization.summary,
      moodValence: categorization.moodValence,
      moodGranular: JSON.stringify(categorization.moodGranular),
      lifeDomains: JSON.stringify(categorization.lifeDomains),
      entities: JSON.stringify(categorization.entities),
      keywords: JSON.stringify(categorization.keywords),
      updatedAt: new Date().toISOString(),
    }).where(eq(entries.id, entryId));

    console.log('[AI] Entry re-categorized and reintegrated');
  } catch (err) {
    console.error('[AI] Re-categorization failed:', (err as Error).message);
  }
}
