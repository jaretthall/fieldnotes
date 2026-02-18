import type { LifeDomain, MoodValence, MoodGranular, ActProcess, PathwayPhase } from './constants';

// === Core Data Types ===

export interface Entry {
  id: string;
  createdAt: string;
  updatedAt: string;
  transcription: string;
  title: string | null;
  summary: string | null;
  inputType: 'voice' | 'text' | 'quick_check';
  audioDuration: number | null;
  audioPath: string | null;
  moodValence: MoodValence | null;
  moodGranular: string[];
  lifeDomains: string[];
  entities: EntityRef[];
  keywords: string[];
  pathwayId: string | null;
  pathwayDay: number | null;
  promptId: string | null;
  userTags: string[];
  pinned: boolean;
  archived: boolean;
}

export interface EntityRef {
  name: string;
  type: 'person' | 'place' | 'concept';
}

export interface QuickCheck {
  id: string;
  entryId: string;
  createdAt: string;
  moodScore: number | null;
  unusualEvent: boolean;
  unusualDescription: string | null;
  towardMove: boolean;
  towardDescription: string | null;
  valuesRating: number | null;
}

export interface Pathway {
  id: string;
  name: string;
  slug: string;
  description: string;
  durationWeeks: number;
  condition: string | null;
  isActive: boolean;
  startedAt: string | null;
  currentDay: number;
  completedAt: string | null;
}

export interface Prompt {
  id: string;
  pathwayId: string;
  dayNumber: number;
  phase: PathwayPhase;
  actProcess: ActProcess;
  integratedModality: string | null;
  anchorPrompt: string;
  corePrompt: string;
  microPractice: string | null;
  estimatedMinutes: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

// === IPC Contracts ===

export interface CreateEntryInput {
  transcription: string;
  inputType: 'voice' | 'text' | 'quick_check';
  audioPath?: string;
  audioDuration?: number;
  pathwayId?: string;
  promptId?: string;
  /** Custom title (pathway entries default to "Day X of {pathwayName}" if not set) */
  title?: string | null;
  /** User-added tags for searchability (pathway entries also get auto-tags) */
  userTags?: string[];
  /** Pathway name for auto-title and auto-tags (required when pathwayId is set) */
  pathwayName?: string;
  /** Day number in pathway (required when pathwayId is set, for auto-tags) */
  pathwayDay?: number;
}

export interface AICategorization {
  moodValence: MoodValence;
  moodGranular: string[];
  lifeDomains: string[];
  entities: EntityRef[];
  keywords: string[];
  title: string;
  summary: string;
}

export interface ListEntriesOpts {
  limit?: number;
  offset?: number;
  domain?: string;
  mood?: string;
  startDate?: string;
  endDate?: string;
  pathwayId?: string;
  sortBy?: 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

export interface SearchOpts {
  limit?: number;
  domain?: string;
  mood?: string;
  startDate?: string;
  endDate?: string;
}

export interface SearchResult {
  entry: Entry;
  highlights: string[];
  score: number;
}

export interface WhisperStatus {
  ready: boolean;
  cliFound: boolean;
  modelFound: boolean;
  cliPath: string;
  modelPath: string | null;
  remediation: string;
}

export interface WhisperInstallResult {
  installed: boolean;
  cliPath: string | null;
  modelPath: string | null;
  message: string;
  status: WhisperStatus;
}

export type PrivacyMode = 'local_only' | 'allow_cloud';
export type InputMode = 'text_only' | 'voice_text';
export type AIProvider = 'off' | 'ollama' | 'cloud';

export interface AppSettings {
  privacyMode: PrivacyMode;
  inputMode: InputMode;
  aiProvider: AIProvider;
  ollamaModel: string;
  cloudProvider: 'openai_compatible';
  cloudEndpoint: string | null;
  cloudModel: string | null;
  cloudApiKey: string | null;
  /** Enable the faster-whisper real-time transcription pipeline */
  realtimeTranscription: boolean;
  /** faster-whisper model size used for real-time dictation */
  realtimeWhisperModel: string;
}

/** Voice recording result: either transcription text or fallback when Whisper is unavailable */
export type VoiceResult =
  | { transcription: string }
  | { transcriptionUnavailable: true; audioPath: string; duration: number };

// === IPC API Interface ===

export interface IpcApi {
  // Entries
  'entries:create': (input: CreateEntryInput) => Promise<Entry>;
  'entries:update': (id: string, patch: Partial<Entry>) => Promise<Entry>;
  'entries:delete': (id: string) => Promise<void>;
  'entries:getById': (id: string) => Promise<Entry | null>;
  'entries:list': (opts: ListEntriesOpts) => Promise<PaginatedResult<Entry>>;

  // Audio
  'audio:startRecording': (preferredExtension?: 'wav' | 'ogg' | 'webm') => Promise<{ tempPath: string; recordingId: string }>;
  'audio:stopRecording': (audioData: ArrayBuffer, recordingId: string) => Promise<{ audioPath: string; duration: number }>;
  'audio:transcribe': (audioPath: string, recordingId: string) => Promise<{ text: string; segments: TranscriptSegment[] }>;
  'audio:checkWhisperStatus': () => Promise<WhisperStatus>;
  'audio:installWhisperRuntime': () => Promise<WhisperInstallResult>;

  // AI
  'ai:categorize': (text: string) => Promise<AICategorization>;
  'ai:generateTitle': (text: string) => Promise<string>;
  'ai:generateSummary': (text: string) => Promise<string>;
  'ai:checkOllamaStatus': (model?: string) => Promise<{ available: boolean; model: string }>;

  // Settings
  'settings:get': () => Promise<AppSettings>;
  'settings:update': (patch: Partial<AppSettings>) => Promise<AppSettings>;

  // Search
  'search:fullText': (query: string, opts?: SearchOpts) => Promise<SearchResult[]>;
  'search:byTag': (tag: string) => Promise<Entry[]>;
  'search:byDateRange': (start: string, end: string) => Promise<Entry[]>;
  'search:byMood': (mood: string) => Promise<Entry[]>;

  // Pathways
  'pathways:list': () => Promise<Pathway[]>;
  'pathways:activate': (id: string) => Promise<Pathway>;
  'pathways:deactivate': (pathwayId: string) => Promise<void>;
  'pathways:getActive': () => Promise<Pathway | null>;
  'pathways:getCurrentPrompt': (pathwayId: string) => Promise<Prompt | null>;
  'pathways:completeDay': (pathwayId: string, entryId: string) => Promise<void>;

  // Real-time transcription
  'realtime:getStatus': () => Promise<RealtimeState>;
  'realtime:isInstalled': () => Promise<boolean>;
  'realtime:start': () => Promise<RealtimeState>;
  'realtime:stop': () => Promise<void>;
  'realtime:installBackend': () => Promise<RealtimeInstallResult>;
}

export interface RealtimeState {
  status: 'not_installed' | 'starting' | 'ready' | 'error' | 'installing';
  port: number | null;
  wsUrl: string | null;
  error: string | null;
}

export interface RealtimeInstallResult {
  success: boolean;
  error?: string;
  state?: RealtimeState;
}

// Push-event channels sent from main → renderer
export interface PushEvents {
  'realtime:stateChanged': RealtimeState;
  'realtime:installProgress': { percent: number; message: string };
}

// Expose the API type for the renderer's window object
declare global {
  interface Window {
    api: {
      invoke: <K extends keyof IpcApi>(channel: K, ...args: Parameters<IpcApi[K]>) => ReturnType<IpcApi[K]>;
      on: <K extends keyof PushEvents>(channel: K, callback: (data: PushEvents[K]) => void) => () => void;
    };
  }
}
