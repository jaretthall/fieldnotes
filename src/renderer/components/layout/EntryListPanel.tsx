import { useState, useMemo } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { useEntriesStore } from '../../stores/entries.store';
import EntryList from '../journal/EntryList';

export default function EntryListPanel() {
  const entries = useEntriesStore((s) => s.entries);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.transcription.toLowerCase().includes(q) ||
        (e.title && e.title.toLowerCase().includes(q)) ||
        e.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  return (
    <div className="w-80 border-r border-[#E8E5DD] flex flex-col bg-[#F7F5F0]">
      <div className="p-4 border-b border-[#E8E5DD]">
        <div className="relative group">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A4A5A]"
            size={14}
          />
          <input
            type="text"
            placeholder="Search fieldnotes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#E8E5DD] rounded-lg py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-[#2B5F3F] focus:border-[#2B5F3F] transition-all outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <EntryList entriesOverride={filteredEntries} />
        {filteredEntries.length === 0 && (
          <div className="p-8 text-center mt-10">
            <BookOpen className="mx-auto text-[#E8E5DD] mb-3 opacity-20" size={32} />
            <p className="text-xs text-[#4A4A5A] font-medium">
              {entries.length === 0 ? 'No notes yet.' : 'No matches.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
