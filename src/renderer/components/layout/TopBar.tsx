interface TopBarProps {
  title: string;
  subtitle?: string;
  onSearchClick?: () => void;
}

export default function TopBar({ title, subtitle, onSearchClick }: TopBarProps) {
  return (
    <header className="h-12 bg-white border-b border-mist-200 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        {subtitle && (
          <span className="text-sm text-graphite-600">{subtitle}</span>
        )}
      </div>

      {/* Search shortcut — click to go to Search view */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSearchClick}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer
                    bg-parchment-50 border border-mist-200
                    text-sm text-graphite-500 hover:border-sage-400 hover:bg-parchment-100
                    active:scale-[0.98] transition-all duration-150
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span>Search entries...</span>
          <kbd className="text-xs font-mono text-graphite-400 bg-mist-200 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
}
