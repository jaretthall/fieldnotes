import { useEffect, useState } from 'react';
import { useEntriesStore } from '../../stores/entries.store';
import type { Entry } from '../../../../shared/types';
import TagBadge from '../journal/TagBadge';

const MOOD_COLORS: Record<string, string> = {
  positive: '#4CAF50',
  negative: '#E57373',
  mixed: '#FFB74D',
  neutral: '#90A4AE',
};

interface DayGroup {
  date: string;
  label: string;
  entries: Entry[];
}

function groupEntriesByDay(entries: Entry[]): DayGroup[] {
  const groups = new Map<string, Entry[]>();

  entries.forEach((entry) => {
    const date = new Date(entry.createdAt).toISOString().split('T')[0];
    const existing = groups.get(date) || [];
    existing.push(entry);
    groups.set(date, existing);
  });

  return Array.from(groups.entries()).map(([date, entries]) => ({
    date,
    label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    entries,
  }));
}

export default function Timeline() {
  const entries = useEntriesStore((s) => s.entries);
  const selectEntry = useEntriesStore((s) => s.selectEntry);
  const loadEntries = useEntriesStore((s) => s.loadEntries);

  useEffect(() => {
    loadEntries({ limit: 100, sortBy: 'created_at', sortOrder: 'desc' });
  }, [loadEntries]);

  const dayGroups = groupEntriesByDay(entries);

  if (entries.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-parchment-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-graphite-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-ink-900 mb-2">Your Timeline</h2>
        <p className="text-graphite-600 max-w-sm">
          Create entries to see your journal journey visualized over time.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <h2 className="text-xl font-semibold text-ink-900 mb-6">Your Journey</h2>

      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-mist-200" />

        {dayGroups.map((group) => (
          <div key={group.date} className="relative mb-8">
            {/* Date label */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-parchment-50 border-2 border-mist-200
                              flex items-center justify-center z-10 relative">
                <span className="text-xs font-bold text-graphite-600">
                  {new Date(group.date + 'T12:00:00').getDate()}
                </span>
              </div>
              <h3 className="text-sm font-medium text-graphite-600">{group.label}</h3>
            </div>

            {/* Entries for this day */}
            <div className="ml-12 space-y-2">
              {group.entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => selectEntry(entry.id)}
                  className="w-full text-left p-3 rounded-lg bg-white border border-mist-200
                             hover:border-sage-400 hover:shadow-sm transition-all duration-150"
                >
                  <div className="flex items-start gap-3">
                    {/* Mood dot */}
                    <div
                      className="w-3 h-3 rounded-full shrink-0 mt-1"
                      style={{
                        backgroundColor: MOOD_COLORS[entry.moodValence || 'neutral'],
                      }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-medium text-ink-900 truncate">
                          {entry.title || 'Untitled'}
                        </h4>
                        <span className="text-xs text-graphite-400 font-mono shrink-0">
                          {new Date(entry.createdAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-graphite-500 line-clamp-1">
                        {entry.summary || entry.transcription.slice(0, 100)}
                      </p>

                      {entry.lifeDomains.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {entry.lifeDomains.slice(0, 2).map((d) => (
                            <TagBadge key={d} label={d} variant="domain" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
