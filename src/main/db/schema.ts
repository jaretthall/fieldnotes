import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const entries = sqliteTable('entries', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),

  // Content
  transcription: text('transcription').notNull(),
  title: text('title'),
  summary: text('summary'),

  // Input metadata
  inputType: text('input_type').notNull(), // "voice" | "text" | "quick_check"
  audioDuration: integer('audio_duration'),
  audioPath: text('audio_path'),

  // AI-generated categorization (stored as JSON strings)
  moodValence: text('mood_valence'),
  moodGranular: text('mood_granular'), // JSON array
  lifeDomains: text('life_domains'), // JSON array
  entities: text('entities'),         // JSON array
  keywords: text('keywords'),         // JSON array

  // Pathway association
  pathwayId: text('pathway_id'),
  pathwayDay: integer('pathway_day'),
  promptId: text('prompt_id'),

  // User overrides
  userTags: text('user_tags'), // JSON array
  pinned: integer('pinned').default(0),
  archived: integer('archived').default(0),
});

export const quickChecks = sqliteTable('quick_checks', {
  id: text('id').primaryKey(),
  entryId: text('entry_id').references(() => entries.id),
  createdAt: text('created_at').notNull(),
  moodScore: integer('mood_score'),
  unusualEvent: integer('unusual_event'),
  unusualDescription: text('unusual_description'),
  towardMove: integer('toward_move'),
  towardDescription: text('toward_description'),
  valuesRating: integer('values_rating'),
});

export const pathways = sqliteTable('pathways', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull(),
  durationWeeks: integer('duration_weeks').notNull(),
  condition: text('condition'),
  isActive: integer('is_active').default(0),
  startedAt: text('started_at'),
  currentDay: integer('current_day').default(1),
  completedAt: text('completed_at'),
});

export const prompts = sqliteTable('prompts', {
  id: text('id').primaryKey(),
  pathwayId: text('pathway_id').references(() => pathways.id),
  dayNumber: integer('day_number').notNull(),
  phase: text('phase').notNull(),
  actProcess: text('act_process').notNull(),
  integratedModality: text('integrated_modality'),
  anchorPrompt: text('anchor_prompt').notNull(),
  corePrompt: text('core_prompt').notNull(),
  microPractice: text('micro_practice'),
  estimatedMinutes: integer('estimated_minutes').default(12),
});
