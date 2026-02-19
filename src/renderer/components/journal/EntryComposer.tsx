import { useState, useRef, useEffect } from 'react';
import { useEntriesStore } from '../../stores/entries.store';
import VoiceRecorder from './VoiceRecorder';
import LiveTranscriptionPanel from './LiveTranscriptionPanel';
import type { Entry } from '../../../../shared/types';

const DAY_ORDINALS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
function ordinalDay(n: number): string {
  return DAY_ORDINALS[n] ?? String(n);
}

interface EntryComposerProps {
  onEntryCreated?: (entry: Entry) => void;
  pathwayId?: string;
  promptId?: string;
  pathwayName?: string;
  pathwayDay?: number;
  compact?: boolean;
  /** Allow the batch voice recorder (Whisper CLI record-then-transcribe) */
  allowVoice?: boolean;
  /** Show the real-time dictation panel instead of the batch voice recorder */
  allowRealtime?: boolean;
  realtimeModel?: string;
}

export default function EntryComposer({
  onEntryCreated,
  pathwayId,
  promptId,
  pathwayName,
  pathwayDay,
  compact = false,
  allowVoice = false,
  allowRealtime = false,
  realtimeModel = 'tiny.en',
}: EntryComposerProps) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const createEntry = useEntriesStore((s) => s.createEntry);

  const defaultPathwayTitle = pathwayName != null && pathwayDay != null
    ? pathwayDay === 8
      ? `Enjoy the View: ${pathwayName}`
      : `Day ${ordinalDay(pathwayDay)} of ${pathwayName}`
    : '';
  const effectiveTitle = title.trim() || (pathwayId ? defaultPathwayTitle : null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
    }
  }, [text]);

  const parseTags = (s: string): string[] =>
    s.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);

  const buildCreateInput = () => {
    const base = {
      transcription: text.trim(),
      inputType: 'text' as const,
      pathwayId,
      promptId,
    };
    if (pathwayId && pathwayName != null && pathwayDay != null) {
      return {
        ...base,
        title: effectiveTitle || undefined,
        userTags: parseTags(tagsInput),
        pathwayName,
        pathwayDay,
      };
    }
    return {
      ...base,
      title: title.trim() || undefined,
      userTags: parseTags(tagsInput),
    };
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const entry = await createEntry(buildCreateInput());
      setText('');
      setTitle('');
      setTagsInput('');
      onEntryCreated?.(entry);
    } catch (err) {
      console.error('Failed to create entry:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceTranscription = (transcription: string) => {
    setText((prev) => prev + (prev ? '\n' : '') + transcription);
  };

  const showTitleAndTags = !compact || pathwayId != null;
  const isPathway = pathwayId != null && pathwayName != null && pathwayDay != null;

  return (
    <div className="bg-white rounded-xl border border-mist-200 shadow-sm overflow-hidden">
      {showTitleAndTags && (
        <div className="px-4 pt-3 pb-2 border-b border-mist-100 space-y-2">
          <div>
            <label htmlFor="entry-title" className="block text-[10px] font-bold text-graphite-500 uppercase tracking-wider mb-1">
              Title {isPathway && <span className="font-normal text-graphite-400">(optional—defaults to Day X of {pathwayName})</span>}
            </label>
            <input
              id="entry-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isPathway ? defaultPathwayTitle : 'e.g. My 48th birthday, Work stress, Spiritual retreat'}
              className="w-full px-3 py-2 text-sm border border-mist-200 rounded-lg
                         text-ink-900 placeholder-graphite-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="entry-tags" className="block text-[10px] font-bold text-graphite-500 uppercase tracking-wider mb-1">
              Tags <span className="font-normal text-graphite-400">(comma-separated, for search)</span>
            </label>
            <input
              id="entry-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. vacation, spirituality, work stress"
              className="w-full px-3 py-2 text-sm border border-mist-200 rounded-lg
                         text-ink-900 placeholder-graphite-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
              disabled={isSubmitting}
            />
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What's on your mind?"
        className="w-full px-4 py-3 text-sm text-ink-900 placeholder-graphite-400
                   resize-none bg-transparent border-none outline-none
                   min-h-[60px] max-h-[300px] leading-relaxed"
        rows={2}
        disabled={isSubmitting}
      />

      {/* Real-time transcription panel (when enabled) */}
      {!compact && allowRealtime && (
        <div className="px-4 pb-2 border-b border-mist-100">
          <LiveTranscriptionPanel
            model={realtimeModel}
            onCommit={(transcript) => setText((prev) => prev + (prev ? '\n' : '') + transcript)}
          />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-mist-100">
        <div className="flex items-center gap-2">
          {allowVoice && !allowRealtime && (
            <VoiceRecorder compact onTranscription={handleVoiceTranscription} />
          )}
          <span className="text-xs text-graphite-400">
            {text.length > 0 ? `${text.length} chars` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <kbd className="text-xs font-mono text-graphite-400 bg-parchment-50 px-1.5 py-0.5 rounded hidden sm:inline">
            Ctrl+Enter
          </kbd>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isSubmitting}
            className="px-3 py-1.5 rounded-lg text-sm font-medium
                       bg-forest-600 text-white
                       hover:bg-forest-500 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-150"
          >
            {isSubmitting ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
