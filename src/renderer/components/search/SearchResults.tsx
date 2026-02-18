import { useSearchStore } from '../../stores/search.store';
import { useEntriesStore } from '../../stores/entries.store';
import TagBadge from '../journal/TagBadge';

export default function SearchResults() {
  const results = useSearchStore((s) => s.results);
  const query = useSearchStore((s) => s.query);
  const loading = useSearchStore((s) => s.loading);
  const selectEntry = useEntriesStore((s) => s.selectEntry);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-forest-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!query) {
    return (
      <div className="text-center py-12">
        <p className="text-graphite-500 text-sm">Type to search your entries</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-graphite-500 text-sm">No results found for &ldquo;{query}&rdquo;</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-graphite-400 mb-4">
        {results.length} result{results.length !== 1 ? 's' : ''}
      </p>
      {results.map(({ entry, highlights }) => (
        <button
          key={entry.id}
          onClick={() => selectEntry(entry.id)}
          className="w-full text-left p-4 bg-white rounded-xl border border-mist-200
                     hover:border-sage-400 hover:shadow-sm transition-all duration-150"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-medium text-ink-900">
              {entry.title || 'Untitled Entry'}
            </h4>
            <span className="text-xs text-graphite-400 font-mono shrink-0">
              {new Date(entry.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* Highlighted text */}
          {highlights.length > 0 && highlights[0] ? (
            <p
              className="text-xs text-graphite-600 line-clamp-2 mb-2"
              dangerouslySetInnerHTML={{ __html: highlights[0].slice(0, 200) }}
            />
          ) : (
            <p className="text-xs text-graphite-600 line-clamp-2 mb-2">
              {entry.transcription.slice(0, 200)}
            </p>
          )}

          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {entry.moodValence && (
              <TagBadge label={entry.moodValence} variant="mood" />
            )}
            {entry.lifeDomains.slice(0, 2).map((domain) => (
              <TagBadge key={domain} label={domain} variant="domain" />
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
