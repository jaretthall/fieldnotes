import { usePathwaysStore } from '../../stores/pathways.store';
import PathwayProgressCircles from './PathwayProgressCircles';

interface PathwayBrowserProps {
  onPathwayStarted?: () => void;
}

export default function PathwayBrowser({ onPathwayStarted }: PathwayBrowserProps) {
  const pathways = usePathwaysStore((s) => s.pathways);
  const activePathway = usePathwaysStore((s) => s.activePathway);
  const activatePathway = usePathwaysStore((s) => s.activatePathway);
  const loading = usePathwaysStore((s) => s.loading);

  const handleStart = async (pathwayId: string) => {
    try {
      await activatePathway(pathwayId);
      onPathwayStarted?.();
    } catch (err) {
      console.error('Failed to activate pathway:', err);
    }
  };

  if (loading && pathways.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-8">
        <p className="text-[#4A4A5A]">Loading pathways...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-ink-900 mb-2">Guided Pathways</h2>
        <p className="text-graphite-600 text-sm">
          Structured reflection journeys based on evidence-based therapeutic approaches.
          Each pathway guides you through daily prompts designed for growth and insight.
        </p>
      </div>

      <div className="space-y-4">
        {pathways.map((pathway) => {
          const isActive = activePathway?.id === pathway.id;

          return (
            <div
              key={pathway.id}
              className="bg-white rounded-xl border border-mist-200 p-5
                         hover:border-sage-400 hover:shadow-sm transition-all duration-150"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-medium text-ink-900 mb-1">{pathway.name}</h3>
                  <p className="text-sm text-graphite-600 mb-3">{pathway.description}</p>
                  <div className="flex items-center gap-3 text-xs text-graphite-400">
                    <span>{pathway.durationWeeks} weeks</span>
                    <span className="text-mist-300">&bull;</span>
                    <span className="capitalize">{pathway.condition}</span>
                    {isActive && <span className="text-forest-600 font-medium">Active</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleStart(pathway.id)}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm font-medium shrink-0
                             bg-forest-600 text-white hover:bg-forest-500 disabled:opacity-50 disabled:cursor-not-allowed
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2
                             transition-colors duration-150"
                >
                  {isActive ? 'Continue' : 'Start'}
                </button>
              </div>

              <div className="mt-4 flex justify-center">
                <PathwayProgressCircles
                  totalDays={7}
                  currentDay={pathway.currentDay}
                  hasEnjoyTheView
                  compact
                />
              </div>
            </div>
          );
        })}
      </div>

      {pathways.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-xs text-graphite-400 font-mono">
            More pathways coming soon
          </p>
        </div>
      )}
    </div>
  );
}
