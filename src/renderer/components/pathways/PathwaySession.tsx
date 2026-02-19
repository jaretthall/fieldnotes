import { useEffect } from 'react';
import { ArrowLeft, PenLine, Mountain } from 'lucide-react';
import PromptCard from './PromptCard';
import PathwayProgressCircles from './PathwayProgressCircles';
import EntryComposer from '../journal/EntryComposer';
import { usePathwaysStore } from '../../stores/pathways.store';
import type { Pathway } from '../../../../shared/types';

const ENJOY_THE_VIEW_QUESTIONS = [
  'Reflect on your progress and solidify what you\'ve learned from this pathway.',
  'What\'s been challenging?',
  'What would you like to see more of?',
  'How does this view help guide the ways in which you want to move forward from this height?',
  'How do you now redefine the person you want to be, living the life you want to live?',
];

interface PathwaySessionProps {
  pathway: Pathway;
  onBack: () => void;
  allowVoice?: boolean;
}

export default function PathwaySession({ pathway, onBack, allowVoice = true }: PathwaySessionProps) {
  const currentPrompt = usePathwaysStore((s) => s.currentPrompt);
  const loadCurrentPrompt = usePathwaysStore((s) => s.loadCurrentPrompt);
  const completeDay = usePathwaysStore((s) => s.completeDay);

  useEffect(() => {
    loadCurrentPrompt(pathway.id);
  }, [pathway.id, loadCurrentPrompt]);

  const isEnjoyTheView = pathway.currentDay === 8;

  const handleEntryCreated = (entry: { id: string }) => {
    completeDay(pathway.id, entry.id);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F7F5F0]">
      <header className="shrink-0 border-b border-[#E8E5DD] bg-white px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-2 text-sm text-[#4A4A5A] hover:text-[#1A1A2E]"
        >
          <ArrowLeft size={16} />
          Back to pathways
        </button>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1A1A2E]">{pathway.name}</h2>
            <p className="text-sm text-[#4A4A5A]">
              {isEnjoyTheView ? 'Enjoy the View' : `Day ${pathway.currentDay} of 7`}
            </p>
          </div>
          <PathwayProgressCircles totalDays={7} currentDay={pathway.currentDay} hasEnjoyTheView />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {isEnjoyTheView ? (
            <section className="rounded-2xl border border-[#E8E5DD] bg-white p-8 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4A853]/5 rounded-full blur-3xl" />
              <div className="flex items-center gap-2 mb-6">
                <Mountain size={24} className="text-[#2B5F3F]" />
                <h3 className="text-lg font-bold text-[#1A1A2E]">Enjoy the View</h3>
              </div>
              <p className="text-[#4A4A5A] mb-6 leading-relaxed">
                You&apos;ve climbed the hill. Take time to reflect on your progress and solidify
                what you&apos;ve learned from this pathway.
              </p>
              <ul className="space-y-3 mb-8">
                {ENJOY_THE_VIEW_QUESTIONS.map((q, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[#2B5F3F] font-bold shrink-0">{i + 1}.</span>
                    <span className="text-[#1A1A2E]">{q}</span>
                  </li>
                ))}
              </ul>
              <EntryComposer
                onEntryCreated={handleEntryCreated}
                pathwayId={pathway.id}
                pathwayName={pathway.name}
                pathwayDay={8}
                allowVoice={allowVoice}
              />
            </section>
          ) : currentPrompt ? (
            <>
              <PromptCard prompt={currentPrompt} dayLabel={`Day ${pathway.currentDay}`} />
              <section className="rounded-2xl border border-[#E8E5DD] bg-white p-6">
                <div className="mb-3 flex items-center gap-2">
                  <PenLine size={18} className="text-[#2B5F3F]" />
                  <h3 className="font-semibold text-[#1A1A2E]">Your reflection</h3>
                </div>
                <p className="mb-4 text-sm text-[#4A4A5A]">
                  Write or record your thoughts on today&apos;s prompt. When you save, you&apos;ll
                  complete this day and unlock the next.
                </p>
                <EntryComposer
                  onEntryCreated={handleEntryCreated}
                  pathwayId={pathway.id}
                  promptId={currentPrompt?.id}
                  pathwayName={pathway.name}
                  pathwayDay={pathway.currentDay}
                  allowVoice={allowVoice}
                />
              </section>
            </>
          ) : (
            <div className="rounded-2xl border border-[#E8E5DD] bg-white p-8 text-center">
              <p className="text-[#4A4A5A]">Loading today&apos;s prompt...</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
