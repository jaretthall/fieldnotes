import { useState, useRef, useEffect } from 'react';
import { useSearchStore } from '../../stores/search.store';

export default function SearchBar() {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const search = useSearchStore((s) => s.search);
  const loading = useSearchStore((s) => s.loading);
  const clearSearch = useSearchStore((s) => s.clearSearch);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search();
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl border border-mist-200
                      focus-within:border-forest-600 focus-within:shadow-sm transition-all duration-150">
        <svg className="w-5 h-5 text-graphite-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entries by text, mood, topic..."
          className="flex-1 text-sm text-ink-900 placeholder-graphite-400 bg-transparent outline-none"
        />
        {loading && (
          <div className="w-4 h-4 border-2 border-forest-600 border-t-transparent rounded-full animate-spin" />
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={clearSearch}
            className="text-graphite-400 hover:text-ink-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
