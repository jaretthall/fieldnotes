import type { Prompt } from '../../../../shared/types';

interface PromptCardProps {
  prompt: Prompt;
  dayLabel?: string;
}

export default function PromptCard({ prompt, dayLabel }: PromptCardProps) {
  const label = dayLabel ?? `Day ${prompt.dayNumber}`;

  return (
    <div className="rounded-2xl border border-[#E8E5DD] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#5B8C6E]">
          {label}
        </span>
        <span className="rounded-full bg-[#2B5F3F]/10 px-2 py-0.5 text-[10px] font-medium text-[#2B5F3F] capitalize">
          {prompt.phase}
        </span>
      </div>

      <div className="space-y-6">
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#4A4A5A]">
            Grounding (2 min)
          </h4>
          <p className="text-[#1A1A2E] leading-relaxed italic">{prompt.anchorPrompt}</p>
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#4A4A5A]">
            Reflection (5–8 min)
          </h4>
          <p className="text-[#1A1A2E] leading-relaxed">{prompt.corePrompt}</p>
        </section>

        {prompt.microPractice && (
          <section className="border-t border-[#E8E5DD] pt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#D4A853]">
              Micro-practice
            </h4>
            <p className="text-sm text-[#4A4A5A] leading-relaxed">{prompt.microPractice}</p>
          </section>
        )}
      </div>

      <p className="mt-4 font-mono text-[10px] text-[#4A4A5A]">
        ~{prompt.estimatedMinutes} min
      </p>
    </div>
  );
}
