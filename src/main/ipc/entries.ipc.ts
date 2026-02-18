import { ipcMain } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { eq, desc, asc, and, like, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { entries } from '../db/schema';
import type { CreateEntryInput, ListEntriesOpts, Entry, PaginatedResult } from '../../../shared/types';
import { autoCategorizeEntry, reCategorizeEntry } from './ai.ipc';

const DAY_ORDINALS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

function ordinalDay(n: number): string {
  return DAY_ORDINALS[n] ?? String(n);
}

function pathwayTagForDay(day: number, pathwayName: string): string {
  return day === 8 ? `Enjoy the View: ${pathwayName}` : `Day ${ordinalDay(day)} of ${pathwayName}`;
}

// Helper to convert DB row to Entry type
function rowToEntry(row: typeof entries.$inferSelect): Entry {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    transcription: row.transcription,
    title: row.title,
    summary: row.summary,
    inputType: row.inputType as Entry['inputType'],
    audioDuration: row.audioDuration,
    audioPath: row.audioPath,
    moodValence: row.moodValence as Entry['moodValence'],
    moodGranular: row.moodGranular ? JSON.parse(row.moodGranular) : [],
    lifeDomains: row.lifeDomains ? JSON.parse(row.lifeDomains) : [],
    entities: row.entities ? JSON.parse(row.entities) : [],
    keywords: row.keywords ? JSON.parse(row.keywords) : [],
    pathwayId: row.pathwayId,
    pathwayDay: row.pathwayDay,
    promptId: row.promptId,
    userTags: row.userTags ? JSON.parse(row.userTags) : [],
    pinned: row.pinned === 1,
    archived: row.archived === 1,
  };
}

export function registerEntryHandlers(): void {
  // Create entry
  ipcMain.handle('entries:create', async (_event, input: CreateEntryInput): Promise<Entry> => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = uuidv7();

    // Pathway entries: auto-title and auto-tags
    let title: string | null = input.title ?? null;
    let pathwayDay: number | null = input.pathwayDay ?? null;
    let userTags: string[] = input.userTags ?? [];

    if (input.pathwayId && input.pathwayName != null && input.pathwayDay != null) {
      pathwayDay = input.pathwayDay;
      const pathwayTag = pathwayTagForDay(input.pathwayDay, input.pathwayName);
      if (title == null || title === '') {
        title = pathwayTag;
      }
      const autoTags = input.pathwayDay === 8
        ? [pathwayTag, input.pathwayName, 'Enjoy the View']
        : [pathwayTag, input.pathwayName];
      userTags = [...new Set([...autoTags, ...userTags])];
    }

    const newEntry = {
      id,
      createdAt: now,
      updatedAt: now,
      transcription: input.transcription,
      title,
      summary: null,
      inputType: input.inputType,
      audioDuration: input.audioDuration ?? null,
      audioPath: input.audioPath ?? null,
      moodValence: null,
      moodGranular: null,
      lifeDomains: null,
      entities: null,
      keywords: null,
      pathwayId: input.pathwayId ?? null,
      pathwayDay,
      promptId: input.promptId ?? null,
      userTags: userTags.length > 0 ? JSON.stringify(userTags) : null,
      pinned: 0,
      archived: 0,
    };

    await db.insert(entries).values(newEntry);

    const [row] = await db.select().from(entries).where(eq(entries.id, id));
    const entry = rowToEntry(row);

    // Trigger async AI categorization (non-blocking; preserves title if set)
    autoCategorizeEntry(id, input.transcription).catch(err => {
      console.error('[Entries] Auto-categorization failed:', err);
    });

    return entry;
  });

  // Update entry
  // When transcription changes, triggers AI re-categorization (edit = reintegrate like new entry)
  ipcMain.handle('entries:update', async (_event, id: string, patch: Partial<Entry>): Promise<Entry> => {
    const db = getDb();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = { updatedAt: now };

    if (patch.transcription !== undefined) updateData.transcription = patch.transcription;
    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.summary !== undefined) updateData.summary = patch.summary;
    if (patch.pathwayDay !== undefined) updateData.pathwayDay = patch.pathwayDay;
    if (patch.moodValence !== undefined) updateData.moodValence = patch.moodValence;
    if (patch.moodGranular !== undefined) updateData.moodGranular = JSON.stringify(patch.moodGranular);
    if (patch.lifeDomains !== undefined) updateData.lifeDomains = JSON.stringify(patch.lifeDomains);
    if (patch.entities !== undefined) updateData.entities = JSON.stringify(patch.entities);
    if (patch.keywords !== undefined) updateData.keywords = JSON.stringify(patch.keywords);
    if (patch.userTags !== undefined) updateData.userTags = JSON.stringify(patch.userTags);
    if (patch.pinned !== undefined) updateData.pinned = patch.pinned ? 1 : 0;
    if (patch.archived !== undefined) updateData.archived = patch.archived ? 1 : 0;

    await db.update(entries).set(updateData).where(eq(entries.id, id));

    const [row] = await db.select().from(entries).where(eq(entries.id, id));
    if (!row) throw new Error(`Entry not found: ${id}`);

    // If content changed, re-run AI categorization so entry is reintegrated into timeline
    const transcriptionChanged = patch.transcription !== undefined;
    if (transcriptionChanged) {
      reCategorizeEntry(id, patch.transcription as string).catch((err) => {
        console.error('[Entries] Re-categorization failed:', err);
      });
    }

    return rowToEntry(row);
  });

  // Delete entry
  ipcMain.handle('entries:delete', async (_event, id: string): Promise<void> => {
    const db = getDb();
    await db.delete(entries).where(eq(entries.id, id));
  });

  // Get entry by ID
  ipcMain.handle('entries:getById', async (_event, id: string): Promise<Entry | null> => {
    const db = getDb();
    const [row] = await db.select().from(entries).where(eq(entries.id, id));
    return row ? rowToEntry(row) : null;
  });

  // List entries with pagination and filtering
  ipcMain.handle('entries:list', async (_event, opts: ListEntriesOpts): Promise<PaginatedResult<Entry>> => {
    const db = getDb();
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const sortOrder = opts.sortOrder === 'asc' ? asc : desc;
    const sortCol = opts.sortBy === 'updated_at' ? entries.updatedAt : entries.createdAt;

    // Build conditions
    const conditions = [];
    conditions.push(eq(entries.archived, 0));

    if (opts.domain) {
      conditions.push(like(entries.lifeDomains, `%"${opts.domain}"%`));
    }
    if (opts.mood) {
      conditions.push(eq(entries.moodValence, opts.mood));
    }
    if (opts.startDate) {
      conditions.push(sql`${entries.createdAt} >= ${opts.startDate}`);
    }
    if (opts.endDate) {
      conditions.push(sql`${entries.createdAt} <= ${opts.endDate}`);
    }
    if (opts.pathwayId) {
      conditions.push(eq(entries.pathwayId, opts.pathwayId));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db
      .select()
      .from(entries)
      .where(whereClause)
      .orderBy(sortOrder(sortCol))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(entries)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    return {
      data: rows.map(rowToEntry),
      total,
      hasMore: offset + limit < total,
    };
  });
}
