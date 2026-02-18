import { useEffect } from 'react';
import { useEntriesStore } from '../../stores/entries.store';
import EntryCard from './EntryCard';
import type { Entry } from '../../../../shared/types';

interface EntryListProps {
  /** When provided, show this list instead of store entries (e.g. filtered) */
  entriesOverride?: Entry[] | null;
}

export default function EntryList({ entriesOverride = null }: EntryListProps) {
  const storeEntries = useEntriesStore((s) => s.entries);
  const selectedEntryId = useEntriesStore((s) => s.selectedEntryId);
  const loading = useEntriesStore((s) => s.loading);
  const loadEntries = useEntriesStore((s) => s.loadEntries);
  const selectEntry = useEntriesStore((s) => s.selectEntry);

  const entries = entriesOverride !== null ? entriesOverride : storeEntries;

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  if (loading && storeEntries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-[#2B5F3F] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-[#4A4A5A]">Loading entries...</p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <>
      {entries.map((entry) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          isSelected={entry.id === selectedEntryId}
          onClick={() => selectEntry(entry.id)}
        />
      ))}
    </>
  );
}
