import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import EntryListPanel from './EntryListPanel';
import MainPanel from './MainPanel';
import { usePathwaysStore } from '../../stores/pathways.store';

const VIEW_TITLES: Record<string, { title: string; subtitle?: string }> = {
  journal: { title: 'Journal', subtitle: 'Your entries' },
  search: { title: 'Search', subtitle: 'Find anything' },
  timeline: { title: 'Timeline', subtitle: 'Your journey' },
  pathways: { title: 'Pathways', subtitle: 'Guided reflection' },
  settings: { title: 'Settings', subtitle: 'App configuration' },
};

export default function Shell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState('journal');
  const loadPathways = usePathwaysStore((s) => s.loadPathways);
  const loadActivePathway = usePathwaysStore((s) => s.loadActivePathway);

  useEffect(() => {
    loadPathways();
    loadActivePathway();
  }, [loadPathways, loadActivePathway]);

  const viewInfo = VIEW_TITLES[activeView] || { title: 'Fieldnotes' };

  return (
    <div className="flex h-screen bg-[#F7F5F0]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {activeView === 'journal' && <EntryListPanel />}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeView !== 'journal' && (
          <TopBar
            title={viewInfo.title}
            subtitle={viewInfo.subtitle}
            onSearchClick={() => setActiveView('search')}
          />
        )}
        <MainPanel activeView={activeView} />
        <footer className="h-5 shrink-0 flex items-center justify-center border-t border-[#E8E5DD] bg-[#EFECE4]">
          <span className="text-[10px] font-mono text-[#4A4A5A]">Fieldnotes v1.0.17</span>
        </footer>
      </div>
    </div>
  );
}
