import type { Entry } from '../../../../shared/types';

interface EntryCardProps {
  entry: Entry;
  isSelected: boolean;
  onClick: () => void;
}

export default function EntryCard({ entry, isSelected, onClick }: EntryCardProps) {
  const dateStr = new Date(entry.createdAt).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 border-b border-[#E8E5DD] transition-all hover:bg-white group ${
        isSelected ? 'bg-white shadow-[inset_4px_0_0_0_#2B5F3F]' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="font-mono text-[9px] text-[#4A4A5A] uppercase tracking-wider">
          {dateStr}
        </span>
        {entry.moodValence === 'positive' && (
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        )}
        {entry.moodValence === 'negative' && (
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        )}
      </div>
      <h3
        className={`text-sm font-bold mb-1 truncate ${
          isSelected ? 'text-[#1A1A2E]' : 'text-[#4A4A5A] group-hover:text-[#1A1A2E]'
        }`}
      >
        {entry.title || 'Untitled Entry'}
      </h3>
      <p className="text-xs text-[#4A4A5A] line-clamp-2 leading-relaxed opacity-70">
        {entry.transcription}
      </p>
      <div className="mt-2 flex gap-1 flex-wrap">
        {[...(entry.userTags ?? []), ...(entry.lifeDomains ?? [])].slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-[9px] px-1.5 py-0.5 rounded bg-[#F7F5F0] border border-[#E8E5DD] font-medium uppercase text-[#5B8C6E]"
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}
