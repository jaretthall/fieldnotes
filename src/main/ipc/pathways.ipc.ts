import { ipcMain } from 'electron';
import { eq, and } from 'drizzle-orm';
import { getDb, getSqlite } from '../db';
import { pathways, prompts } from '../db/schema';
import type { Pathway, Prompt } from '../../../shared/types';
import { seedPathwaysIfEmpty } from '../db/seed-pathways';

// Convert DB row to Pathway type
function rowToPathway(row: typeof pathways.$inferSelect): Pathway {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    durationWeeks: row.durationWeeks,
    condition: row.condition,
    isActive: row.isActive === 1,
    startedAt: row.startedAt,
    currentDay: row.currentDay ?? 1,
    completedAt: row.completedAt,
  };
}

// Convert DB row to Prompt type
function rowToPrompt(row: typeof prompts.$inferSelect): Prompt {
  return {
    id: row.id,
    pathwayId: row.pathwayId!,
    dayNumber: row.dayNumber,
    phase: row.phase as Prompt['phase'],
    actProcess: row.actProcess as Prompt['actProcess'],
    integratedModality: row.integratedModality,
    anchorPrompt: row.anchorPrompt,
    corePrompt: row.corePrompt,
    microPractice: row.microPractice,
    estimatedMinutes: row.estimatedMinutes ?? 12,
  };
}

export function registerPathwayHandlers(): void {
  // Seed pathways on first list (idempotent)
  ipcMain.handle('pathways:list', async (): Promise<Pathway[]> => {
    const db = getDb();
    seedPathwaysIfEmpty(getSqlite());
    const rows = await db.select().from(pathways);
    return rows.map(rowToPathway);
  });

  ipcMain.handle('pathways:activate', async (_event, id: string): Promise<Pathway> => {
    const db = getDb();
    const sqlite = getSqlite();
    seedPathwaysIfEmpty(sqlite);

    // Deactivate any currently active pathway
    await db
      .update(pathways)
      .set({ isActive: 0, startedAt: null, currentDay: 1, completedAt: null })
      .where(eq(pathways.isActive, 1));

    // Activate this pathway
    const now = new Date().toISOString();
    await db
      .update(pathways)
      .set({ isActive: 1, startedAt: now, currentDay: 1, completedAt: null })
      .where(eq(pathways.id, id));

    const [row] = await db.select().from(pathways).where(eq(pathways.id, id));
    if (!row) throw new Error(`Pathway not found: ${id}`);
    return rowToPathway(row);
  });

  ipcMain.handle('pathways:getCurrentPrompt', async (_event, pathwayId: string): Promise<Prompt | null> => {
    const db = getDb();
    const [pathway] = await db.select().from(pathways).where(eq(pathways.id, pathwayId));
    if (!pathway || pathway.isActive !== 1) return null;

    const day = pathway.currentDay ?? 1;
    const [promptRow] = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.pathwayId, pathwayId), eq(prompts.dayNumber, day)));

    return promptRow ? rowToPrompt(promptRow) : null;
  });

  ipcMain.handle('pathways:completeDay', async (_event, pathwayId: string, _entryId: string): Promise<void> => {
    const db = getDb();
    const [pathway] = await db.select().from(pathways).where(eq(pathways.id, pathwayId));
    if (!pathway) return;

    const currentDay = pathway.currentDay ?? 1;
    const nextDay = currentDay + 1;

    if (currentDay === 8) {
      // Enjoy the View completed → pathway fully done
      const now = new Date().toISOString();
      await db
        .update(pathways)
        .set({ completedAt: now, isActive: 0 })
        .where(eq(pathways.id, pathwayId));
    } else if (currentDay === 7) {
      // Day 7 completed → transition to Enjoy the View (day 8)
      await db
        .update(pathways)
        .set({ currentDay: 8 })
        .where(eq(pathways.id, pathwayId));
    } else {
      // Days 1–6 → advance to next day
      await db
        .update(pathways)
        .set({ currentDay: nextDay })
        .where(eq(pathways.id, pathwayId));
    }
  });

  ipcMain.handle('pathways:deactivate', async (_event, pathwayId: string): Promise<void> => {
    const db = getDb();
    await db
      .update(pathways)
      .set({ isActive: 0, startedAt: null, currentDay: 1, completedAt: null })
      .where(eq(pathways.id, pathwayId));
  });

  ipcMain.handle('pathways:getActive', async (): Promise<Pathway | null> => {
    const db = getDb();
    const [row] = await db.select().from(pathways).where(eq(pathways.isActive, 1));
    return row ? rowToPathway(row) : null;
  });
}
