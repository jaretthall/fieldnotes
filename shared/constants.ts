export const LIFE_DOMAINS = [
  "work", "relationships", "health", "personal-growth",
  "family", "finances", "creativity", "spirituality",
  "recreation", "community", "education", "uncategorized"
] as const;

export const MOOD_VALENCE = ["positive", "negative", "mixed", "neutral"] as const;

export const MOOD_GRANULAR = [
  "anxious", "calm", "frustrated", "grateful", "hopeful",
  "sad", "angry", "content", "overwhelmed", "energized",
  "lonely", "connected", "confused", "clear", "grief",
  "excited", "bored", "tender", "resilient", "stuck"
] as const;

export const ACT_PROCESSES = [
  "defusion", "acceptance", "present-moment",
  "self-as-context", "values", "committed-action"
] as const;

export const PATHWAY_PHASES = [
  "foundation", "opening", "engaging", "acting"
] as const;

export type LifeDomain = typeof LIFE_DOMAINS[number];
export type MoodValence = typeof MOOD_VALENCE[number];
export type MoodGranular = typeof MOOD_GRANULAR[number];
export type ActProcess = typeof ACT_PROCESSES[number];
export type PathwayPhase = typeof PATHWAY_PHASES[number];
