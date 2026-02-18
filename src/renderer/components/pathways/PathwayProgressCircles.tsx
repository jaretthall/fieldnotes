import { Mountain } from 'lucide-react';

/**
 * Hill-climbing progress: circles connected by dashed lines.
 * Completed = filled green, current = highlighted ring, upcoming = outline.
 * Day 8 = "Enjoy the View" (mountain icon).
 */
interface PathwayProgressCirclesProps {
  totalDays: number;
  currentDay: number;
  /** Day 8 = "Enjoy the View" (post-prompt reflection) */
  hasEnjoyTheView?: boolean;
  /** Smaller circles for sidebar */
  compact?: boolean;
}

export default function PathwayProgressCircles({
  totalDays,
  currentDay,
  hasEnjoyTheView = true,
  compact = false,
}: PathwayProgressCirclesProps) {
  const steps = hasEnjoyTheView ? totalDays + 1 : totalDays;
  const maxStep = hasEnjoyTheView ? 8 : 7;
  const size = compact ? 'w-4 h-4' : 'w-7 h-7';
  const gap = compact ? 'w-1 mx-0.5' : 'w-4 mx-0.5';
  const iconSize = compact ? 8 : 12;

  return (
    <div className="flex items-center gap-0" role="img" aria-label={`Pathway progress: day ${currentDay} of ${maxStep}`}>
      {Array.from({ length: steps }, (_, i) => {
        const dayNum = i + 1;
        const isCompleted = currentDay > dayNum;
        const isCurrent = currentDay === dayNum;
        const isView = hasEnjoyTheView && dayNum === 8;

        return (
          <div key={dayNum} className="flex items-center">
            <div
              className={`
                ${size} rounded-full flex items-center justify-center
                transition-all duration-300
                ${isCompleted
                  ? 'bg-[#2B5F3F] text-white'
                  : isCurrent
                    ? 'ring-2 ring-[#2B5F3F] ring-offset-1 bg-white text-[#2B5F3F]'
                    : 'border-2 border-dashed border-[#E8E5DD] bg-white text-[#9CA3AF]'
                }
              `}
              title={isView ? 'Enjoy the View' : `Day ${dayNum}`}
            >
              {isView ? (
                <Mountain size={iconSize} strokeWidth={2.5} />
              ) : compact ? (
                <span className="text-[6px] font-bold">{dayNum}</span>
              ) : (
                <span className="text-[10px] font-bold">{dayNum}</span>
              )}
            </div>
            {i < steps - 1 && (
              <div
                className={`
                  ${gap} h-0.5
                  ${currentDay > dayNum ? 'bg-[#2B5F3F]' : 'border-t border-dashed border-[#E8E5DD]'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
