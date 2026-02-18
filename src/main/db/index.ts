import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as schema from './schema';

let db: ReturnType<typeof drizzle>;
let sqlite: Database.Database;
type SqliteDb = Database.Database;

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  const dbDir = join(userDataPath, 'data');

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  return join(dbDir, 'fieldnotes.db');
}

export function initializeDatabase(): ReturnType<typeof drizzle> {
  if (db) return db;

  const dbPath = getDbPath();
  console.log('[DB] Initializing database at:', dbPath);

  sqlite = new Database(dbPath);

  // Enable WAL mode for better concurrent read/write and crash resilience
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  db = drizzle(sqlite, { schema });

  // Run migrations (create tables if they don't exist)
  runMigrations(sqlite);

  console.log('[DB] Database initialized successfully');
  return db;
}

function runMigrations(sqlite: Database.Database): void {
  console.log('[DB] Running migrations...');

  // Create entries table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      transcription TEXT NOT NULL,
      title TEXT,
      summary TEXT,
      input_type TEXT NOT NULL,
      audio_duration INTEGER,
      audio_path TEXT,
      mood_valence TEXT,
      mood_granular TEXT,
      life_domains TEXT,
      entities TEXT,
      keywords TEXT,
      pathway_id TEXT,
      pathway_day INTEGER,
      prompt_id TEXT,
      user_tags TEXT,
      pinned INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0
    );
  `);

  // Create quick_checks table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS quick_checks (
      id TEXT PRIMARY KEY,
      entry_id TEXT REFERENCES entries(id),
      created_at TEXT NOT NULL,
      mood_score INTEGER,
      unusual_event INTEGER,
      unusual_description TEXT,
      toward_move INTEGER,
      toward_description TEXT,
      values_rating INTEGER
    );
  `);

  // Create pathways table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS pathways (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT NOT NULL,
      duration_weeks INTEGER NOT NULL,
      condition TEXT,
      is_active INTEGER DEFAULT 0,
      started_at TEXT,
      current_day INTEGER DEFAULT 1,
      completed_at TEXT
    );
  `);

  // Create prompts table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      pathway_id TEXT REFERENCES pathways(id),
      day_number INTEGER NOT NULL,
      phase TEXT NOT NULL,
      act_process TEXT NOT NULL,
      integrated_modality TEXT,
      anchor_prompt TEXT NOT NULL,
      core_prompt TEXT NOT NULL,
      micro_practice TEXT,
      estimated_minutes INTEGER DEFAULT 12
    );
  `);

  // Create FTS5 virtual table for full-text search
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
      title, transcription, summary, keywords,
      content=entries, content_rowid=rowid
    );
  `);

  // Create triggers to keep FTS in sync
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
      INSERT INTO entries_fts(rowid, title, transcription, summary, keywords)
      VALUES (new.rowid, new.title, new.transcription, new.summary, new.keywords);
    END;
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
      INSERT INTO entries_fts(entries_fts, rowid, title, transcription, summary, keywords)
      VALUES ('delete', old.rowid, old.title, old.transcription, old.summary, old.keywords);
    END;
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
      INSERT INTO entries_fts(entries_fts, rowid, title, transcription, summary, keywords)
      VALUES ('delete', old.rowid, old.title, old.transcription, old.summary, old.keywords);
      INSERT INTO entries_fts(rowid, title, transcription, summary, keywords)
      VALUES (new.rowid, new.title, new.transcription, new.summary, new.keywords);
    END;
  `);

  console.log('[DB] Migrations complete');
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function getSqlite(): SqliteDb {
  if (!sqlite) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return sqlite;
}

export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close();
    console.log('[DB] Database closed');
  }
}
