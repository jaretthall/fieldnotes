import type { Entry } from '../../../../shared/types';

interface PatternCardProps {
  entries: Entry[];
}

export default function PatternCard({ entries }: PatternCardProps) {
  if (entries.length === 0) return null;

  // Compute basic patterns from recent entries
  const recentEntries = entries.slice(0, 20);

  // Most common domains
  const domainCounts = new Map<string, number>();
  recentEntries.forEach((e) => {
    e.lifeDomains.forEach((d) => {
      domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
    });
  });
  const topDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Mood distribution
  const moodCounts = new Map<string, number>();
  recentEntries.forEach((e) => {
    if (e.moodValence) {
      moodCounts.set(e.moodValence, (moodCounts.get(e.moodValence) || 0) + 1);
    }
  });

  // Entry frequency
  const thisWeek = recentEntries.filter((e) => {
    const diff = Date.now() - new Date(e.createdAt).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  });

  return (
    <div className="space-y-4">
      {/* Entry frequency */}
      <div className="bg-white rounded-xl border border-mist-200 p-4">
        <h3 className="text-sm font-medium text-ink-900 mb-2">This Week</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-forest-600">{thisWeek.length}</span>
          <span className="text-sm text-graphite-500">entries</span>
        </div>
      </div>

      {/* Top domains */}
      {topDomains.length > 0 && (
        <div className="bg-white rounded-xl border border-mist-200 p-4">
          <h3 className="text-sm font-medium text-ink-900 mb-3">Most Written About</h3>
          <div className="space-y-2">
            {topDomains.map(([domain, count]) => (
              <div key={domain} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-graphite-600 capitalize">{domain}</span>
                    <span className="text-xs text-graphite-400">{count} times</span>
                  </div>
                  <div className="h-1.5 bg-mist-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-forest-600 rounded-full"
                      style={{ width: `${(count / recentEntries.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mood overview */}
      {moodCounts.size > 0 && (
        <div className="bg-white rounded-xl border border-mist-200 p-4">
          <h3 className="text-sm font-medium text-ink-900 mb-3">Mood Overview</h3>
          <div className="flex gap-3">
            {[...moodCounts.entries()].map(([mood, count]) => (
              <div key={mood} className="text-center">
                <div
                  className="w-10 h-10 rounded-full mx-auto mb-1 flex items-center justify-center text-white text-xs font-bold"
                  style={{
                    backgroundColor:
                      mood === 'positive' ? '#4CAF50' :
                      mood === 'negative' ? '#E57373' :
                      mood === 'mixed' ? '#FFB74D' : '#90A4AE',
                  }}
                >
                  {count}
                </div>
                <span className="text-xs text-graphite-500 capitalize">{mood}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
