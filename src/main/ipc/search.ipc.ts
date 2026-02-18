import { ipcMain } from 'electron';
import { eq, and, like, sql, desc } from 'drizzle-orm';
import { getDb, getSqlite } from '../db';
import { entries } from '../db/schema';
import type { Entry, SearchOpts, SearchResult } from '../../../shared/types';

// Reuse the rowToEntry helper
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

export function registerSearchHandlers(): void {
  // Full-text search using FTS5
  ipcMain.handle('search:fullText', async (_event, query: string, opts?: SearchOpts): Promise<SearchResult[]> => {
    const sqlite = getSqlite();
    const limit = opts?.limit ?? 20;

    // Use FTS5 search with highlighting
    const results = sqlite.prepare(`
      SELECT entries.*,
             highlight(entries_fts, 1, '<mark>', '</mark>') as highlighted_text,
             rank
      FROM entries_fts
      JOIN entries ON entries.rowid = entries_fts.rowid
      WHERE entries_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit) as (typeof entries.$inferSelect & { highlighted_text: string; rank: number })[];

    return results.map(row => ({
      entry: rowToEntry(row),
      highlights: [row.highlighted_text],
      score: Math.abs(row.rank),
    }));
  });

  // Search by tag (userTags, keywords, lifeDomains, title)
  ipcMain.handle('search:byTag', async (_event, tag: string): Promise<Entry[]> => {
    const db = getDb();
    const escaped = tag.replace(/"/g, '""');
    const jsonPattern = `%"${escaped}"%`;
    const titlePattern = `%${tag.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    const rows = await db.select().from(entries)
      .where(sql`(
        (${entries.userTags} IS NOT NULL AND ${entries.userTags} LIKE ${jsonPattern})
        OR (${entries.keywords} IS NOT NULL AND ${entries.keywords} LIKE ${jsonPattern})
        OR (${entries.lifeDomains} IS NOT NULL AND ${entries.lifeDomains} LIKE ${jsonPattern})
        OR (${entries.title} IS NOT NULL AND ${entries.title} LIKE ${titlePattern})
      )`)
      .orderBy(desc(entries.createdAt))
      .limit(50);
    return rows.map(rowToEntry);
  });

  // Search by date range
  ipcMain.handle('search:byDateRange', async (_event, start: string, end: string): Promise<Entry[]> => {
    const db = getDb();
    const rows = await db.select().from(entries)
      .where(and(
        sql`${entries.createdAt} >= ${start}`,
        sql`${entries.createdAt} <= ${end}`
      ))
      .orderBy(desc(entries.createdAt))
      .limit(100);
    return rows.map(rowToEntry);
  });

  // Search by mood
  ipcMain.handle('search:byMood', async (_event, mood: string): Promise<Entry[]> => {
    const db = getDb();
    const rows = await db.select().from(entries)
      .where(eq(entries.moodValence, mood))
      .orderBy(desc(entries.createdAt))
      .limit(50);
    return rows.map(rowToEntry);
  });
}
