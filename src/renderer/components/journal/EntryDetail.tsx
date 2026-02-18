import { useState, useEffect } from 'react';
import { Trash2, MoreVertical, ChevronLeft, Pencil, Save, X } from 'lucide-react';
import type { Entry } from '../../../../shared/types';
import TagBadge from './TagBadge';
import { CheckCircle2 } from 'lucide-react';
import { useEntriesStore } from '../../stores/entries.store';

interface EntryDetailProps {
  entry: Entry;
  onBack?: () => void;
  onDelete?: () => void;
  variant?: 'default' | 'gemini';
}

function formatDateShort(isoString: string): string {
  return new Date(isoString).toLocaleDateString();
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseTags(tags: string[]): string {
  return tags?.join(', ') ?? '';
}

function parseTagsInput(s: string): string[] {
  return s.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
}

export default function EntryDetail({
  entry,
  onBack,
  onDelete,
  variant = 'default',
}: EntryDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(entry.title ?? '');
  const [editTranscription, setEditTranscription] = useState(entry.transcription);
  const [editTags, setEditTags] = useState(parseTags(entry.userTags ?? []));
  const [isSaving, setIsSaving] = useState(false);
  const [aiUpdating, setAiUpdating] = useState(false);

  const updateEntry = useEntriesStore((s) => s.updateEntry);
  const refreshSelectedEntry = useEntriesStore((s) => s.refreshSelectedEntry);

  useEffect(() => {
    setEditTitle(entry.title ?? '');
    setEditTranscription(entry.transcription);
    setEditTags(parseTags(entry.userTags ?? []));
  }, [entry.id, entry.title, entry.transcription, entry.userTags]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const transcriptionChanged = editTranscription !== entry.transcription;
      await updateEntry(entry.id, {
        title: editTitle.trim() || null,
        transcription: editTranscription,
        userTags: parseTagsInput(editTags),
      });
      setIsEditing(false);
      if (transcriptionChanged) {
        setAiUpdating(true);
        setTimeout(() => {
          refreshSelectedEntry();
          setAiUpdating(false);
        }, 6000);
      }
    } catch (err) {
      console.error('Failed to save entry:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(entry.title ?? '');
    setEditTranscription(entry.transcription);
    setEditTags(parseTags(entry.userTags ?? []));
    setIsEditing(false);
  };

  if (variant === 'gemini') {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="p-8 border-b border-[#F7F5F0] flex justify-between items-start shrink-0">
          <div className="flex-1 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm text-[#4A4A5A] hover:text-[#1A1A2E] mb-3"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-[10px] text-[#4A4A5A] bg-[#F7F5F0] px-2 py-0.5 rounded border border-[#E8E5DD]">
                {formatDateShort(entry.createdAt)} at {formatTime(entry.createdAt)}
              </span>
              {aiUpdating && (
                <span className="text-[10px] text-[#5B8C6E] italic">AI updating tags…</span>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full px-3 py-2 text-xl font-bold border border-[#E8E5DD] rounded-lg
                             text-[#1A1A2E] placeholder-graphite-400 focus:outline-none focus:ring-2 focus:ring-[#2B5F3F]/30"
                  disabled={isSaving}
                />
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="Tags (comma-separated)"
                  className="w-full px-3 py-2 text-sm border border-[#E8E5DD] rounded-lg
                             text-[#1A1A2E] placeholder-graphite-400 focus:outline-none focus:ring-2 focus:ring-[#2B5F3F]/30"
                  disabled={isSaving}
                />
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-[#1A1A2E] leading-tight mb-4">
                  {entry.title || 'New Note'}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {entry.userTags?.map((t) => (
                    <TagBadge key={t} label={t} variant="user" />
                  ))}
                  {entry.lifeDomains?.map((d) => (
                    <TagBadge key={d} label={d} variant="domain" />
                  ))}
                  {entry.moodGranular?.map((m) => (
                    <TagBadge key={m} label={m} variant="mood" />
                  ))}
                  {entry.keywords?.map((k) => (
                    <TagBadge key={k} label={k} variant="keyword" />
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onDelete && !isEditing && (
              <button
                type="button"
                onClick={onDelete}
                className="p-2 text-[#4A4A5A] hover:text-red-600 transition-colors"
                title="Delete entry"
              >
                <Trash2 size={18} />
              </button>
            )}
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="p-2 text-[#4A4A5A] hover:text-[#1A1A2E]"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="p-2 text-[#2B5F3F] hover:text-[#1A1A2E]"
                  title="Save"
                >
                  <Save size={18} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-2 text-[#4A4A5A] hover:text-[#1A1A2E]"
                title="Edit entry"
              >
                <Pencil size={18} />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 max-w-4xl">
          {isEditing ? (
            <textarea
              value={editTranscription}
              onChange={(e) => setEditTranscription(e.target.value)}
              placeholder="What's on your mind?"
              disabled={isSaving}
              className="w-full min-h-[200px] px-4 py-3 text-lg text-[#4A4A5A] leading-relaxed
                         font-serif whitespace-pre-wrap resize-none border border-[#E8E5DD] rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-[#2B5F3F]/30"
            />
          ) : (
            <div className="prose prose-sm">
              <p className="text-[#4A4A5A] leading-relaxed text-lg whitespace-pre-wrap font-serif">
                {entry.transcription}
              </p>
            </div>
          )}

          {!isEditing && entry.summary && (
            <div className="mt-12 p-6 bg-[#F7F5F0] rounded-2xl border border-[#E8E5DD] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#D4A853]/5 blur-3xl rounded-full" />
              <div className="text-[10px] font-bold text-[#5B8C6E] uppercase tracking-widest mb-2 flex items-center gap-1">
                <CheckCircle2 size={12} /> AI Summary
              </div>
              <p className="text-sm text-[#1A1A2E] font-medium leading-relaxed italic">
                {entry.summary}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default variant (original layout)
  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#4A4A5A] hover:text-[#1A1A2E] mb-4"
        >
          <ChevronLeft size={16} />
          Back
        </button>
      )}
      <div className="mb-6 flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-[#1A1A2E] mb-2">
            {entry.title || 'Untitled Entry'}
          </h1>
          <div className="flex items-center gap-3 text-sm text-[#4A4A5A]">
            <span className="font-mono text-xs">{formatDateShort(entry.createdAt)}</span>
            <span className="font-mono text-xs">{formatTime(entry.createdAt)}</span>
            {aiUpdating && <span className="text-xs text-[#5B8C6E] italic">AI updating tags…</span>}
          </div>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="p-2 text-[#4A4A5A] hover:text-[#1A1A2E] shrink-0"
            title="Edit entry"
          >
            <Pencil size={18} />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-4 mb-8">
          <div>
            <label htmlFor="edit-title-default" className="block text-xs font-medium text-[#4A4A5A] mb-1">Title</label>
            <input
              id="edit-title-default"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Entry title"
              className="w-full px-3 py-2 border border-[#E8E5DD] rounded-lg"
              disabled={isSaving}
            />
          </div>
          <div>
            <label htmlFor="edit-content-default" className="block text-xs font-medium text-[#4A4A5A] mb-1">Content</label>
            <textarea
              id="edit-content-default"
              value={editTranscription}
              onChange={(e) => setEditTranscription(e.target.value)}
              placeholder="Entry content"
              className="w-full min-h-[150px] px-3 py-2 border border-[#E8E5DD] rounded-lg resize-none"
              disabled={isSaving}
            />
          </div>
          <div>
            <label htmlFor="edit-tags-default" className="block text-xs font-medium text-[#4A4A5A] mb-1">Tags</label>
            <input
              id="edit-tags-default"
              type="text"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="Comma-separated"
              className="w-full px-3 py-2 border border-[#E8E5DD] rounded-lg"
              disabled={isSaving}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-[#2B5F3F] text-white rounded-lg text-sm font-medium"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 border border-[#E8E5DD] rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {entry.summary && (
            <div className="mb-6 p-4 bg-[#F7F5F0] rounded-xl border border-[#E8E5DD]">
              <p className="text-sm text-[#4A4A5A] italic leading-relaxed">{entry.summary}</p>
            </div>
          )}
          <div className="mb-8">
            <p className="text-base text-[#1A1A2E] leading-relaxed whitespace-pre-wrap">
              {entry.transcription}
            </p>
          </div>
          <div className="border-t border-[#E8E5DD] pt-6 flex flex-wrap gap-2">
            {entry.userTags?.map((t) => (
              <TagBadge key={t} label={t} variant="user" />
            ))}
            {entry.lifeDomains?.map((d) => (
              <TagBadge key={d} label={d} variant="domain" />
            ))}
            {entry.moodGranular?.map((m) => (
              <TagBadge key={m} label={m} variant="mood" />
            ))}
            {entry.keywords?.map((k) => (
              <TagBadge key={k} label={k} variant="keyword" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
