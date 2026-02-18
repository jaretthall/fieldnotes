import { BookOpen, Search, Calendar, Compass, LayoutDashboard, Settings } from 'lucide-react';
import { usePathwaysStore } from '../../stores/pathways.store';
import PathwayProgressCircles from '../pathways/PathwayProgressCircles';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeView: string;
  onViewChange: (view: string) => void;
  onQuickCheckIn?: () => void;
}

const NAV_ITEMS = [
  { id: 'journal', label: 'All Entries', icon: BookOpen },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'timeline', label: 'Timeline', icon: Calendar },
  { id: 'pathways', label: 'Pathways', icon: Compass },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function SidebarItem({
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A2E] ${
        active ? 'bg-[#2B5F3F] text-white' : 'text-[#4A4A5A] hover:bg-white/5 hover:text-[#E8E5DD]'
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.5 : 2} />
      {!collapsed && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

export default function Sidebar({
  collapsed,
  onToggle,
  activeView,
  onViewChange,
}: SidebarProps) {
  const activePathway = usePathwaysStore((s) => s.activePathway);

  return (
    <aside
      className={`bg-[#1A1A2E] text-[#E8E5DD] transition-all duration-300 flex flex-col ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="p-6 flex items-center justify-between">
        {!collapsed && (
          <h1 className="font-bold text-xl tracking-tight text-white">Fieldnotes</h1>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="text-[#5B8C6E] hover:text-white transition-colors p-1 rounded hover:bg-white/5"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <LayoutDashboard size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 mt-4 space-y-1">
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <SidebarItem
            key={id}
            icon={icon}
            label={label}
            active={activeView === id}
            collapsed={collapsed}
            onClick={() => onViewChange(id)}
          />
        ))}
      </nav>

      {/* Active Pathway card — Gemini style */}
      <div className="p-4 border-t border-white/10">
        <div className="bg-[#2B5F3F]/20 rounded-xl p-3 border border-[#2B5F3F]/30">
          {!collapsed ? (
            <>
              <div className="text-[10px] font-bold text-[#5B8C6E] uppercase mb-1">
                Active Pathway
              </div>
              <div className="text-xs font-semibold text-white truncate">
                {activePathway ? activePathway.name : 'None'}
              </div>
              <div className="mt-2 flex justify-center">
                {activePathway ? (
                  <PathwayProgressCircles
                    totalDays={7}
                    currentDay={activePathway.currentDay}
                    hasEnjoyTheView
                    compact
                  />
                ) : (
                  <div className="w-full bg-[#1A1A2E] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#D4A853] h-full w-0" />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={`w-2 h-2 rounded-full mx-auto ${activePathway ? 'bg-[#D4A853] animate-pulse' : 'bg-white/30'}`} />
          )}
        </div>
      </div>
    </aside>
  );
}
