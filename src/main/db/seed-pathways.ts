import type Database from 'better-sqlite3';

const PATHWAY_ID = 'psych-flexibility';

const SAMPLE_PATHWAY = {
  id: PATHWAY_ID,
  name: 'Finding Your Footing',
  slug: 'psych-flexibility',
  description:
    "A gentle introduction to psychological flexibility. Explore what matters, notice your mind's patterns, and take small steps toward the life you want.",
  durationWeeks: 8,
  condition: 'general',
};

const SAMPLE_PROMPTS = [
  {
    dayNumber: 1,
    phase: 'foundation',
    actProcess: 'values',
    integratedModality: null as string | null,
    anchorPrompt:
      'Take three slow breaths. Notice where you are right now. Let the day\'s noise settle for a moment.',
    corePrompt:
      'If you could choose three words that describe the kind of person you most want to be — not who you think you should be, but who you genuinely aspire to be — what would they be? Say or write them, then explore: why these three?',
    microPractice:
      "Tomorrow, notice one moment where you act in line with one of your three words. Just notice it.",
  },
  {
    dayNumber: 2,
    phase: 'foundation',
    actProcess: 'present-moment',
    integratedModality: null as string | null,
    anchorPrompt:
      'Before you begin, notice five things you can see, four you can hear, three you can physically feel.',
    corePrompt:
      "Think about yesterday. Was there a moment — even brief — when you were completely absorbed in what you were doing? Describe it. What were you doing? What did it feel like to be fully there? Now: was there a moment when your mind pulled you away from the present? Where did it go?",
    microPractice:
      'Pick one routine activity tomorrow (brushing teeth, making coffee) and do it with full attention.',
  },
  {
    dayNumber: 3,
    phase: 'foundation',
    actProcess: 'defusion',
    integratedModality: null as string | null,
    anchorPrompt:
      "Settle in. Notice any thoughts already competing for your attention. You don't need to chase them.",
    corePrompt:
      "Your mind is a great storyteller. It narrates your life with running commentary, predictions, and judgments. What story is your mind telling you today? Can you give this story a title — like a book or movie? Write the title, then describe: how often does this story play? What happens when you get caught up in it?",
    microPractice:
      "Next time you notice the story playing, try saying to yourself: 'Ah, there's the [title] story again.'",
  },
  {
    dayNumber: 4,
    phase: 'foundation',
    actProcess: 'acceptance',
    integratedModality: null as string | null,
    anchorPrompt:
      "Take a breath. Whatever you're feeling right now — let it be here. You don't need to change it.",
    corePrompt:
      "What feeling have you been trying to push away, avoid, or fix lately? Imagine this feeling as a physical object. What shape is it? What color? How heavy? Where would you hold it? Now write: 'I am willing to make room for this because what matters to me is ___.' What fills that blank?",
    microPractice:
      "Tomorrow, when a difficult feeling shows up, try placing your hand on your chest and saying: 'I notice I'm feeling ___. I can make room for this.'",
  },
  {
    dayNumber: 5,
    phase: 'foundation',
    actProcess: 'values',
    integratedModality: 'mi',
    anchorPrompt:
      "Three breaths. Arrive here. What do you want to bring to this reflection?",
    corePrompt:
      "Think about the different areas of your life: relationships, work, health, personal growth, community, creativity. For each one, rate on a scale of 1-10: how important is this area to me? Then: how closely am I living in line with what matters here? Where are the biggest gaps? What makes the gap a [number] and not a 1?",
    microPractice:
      'Choose the area with the biggest gap. What is one tiny step you could take tomorrow?',
  },
  {
    dayNumber: 6,
    phase: 'foundation',
    actProcess: 'defusion',
    integratedModality: 'narrative',
    anchorPrompt: 'Settle in. Let whatever is present be present.',
    corePrompt:
      "Think of a problem or struggle you've been dealing with. Now try something different: write about it as if it were a character — separate from you. Give it a name. Describe what it looks like, how it behaves, when it shows up. What does it want you to do? What does it tell you? Now: when this character is loudest, what does it keep you from doing that matters to you?",
    microPractice:
      "When the 'character' shows up tomorrow, try acknowledging it: 'I see you're here, [name].'",
  },
  {
    dayNumber: 7,
    phase: 'foundation',
    actProcess: 'committed-action',
    integratedModality: null as string | null,
    anchorPrompt:
      "One week in. Take a moment to appreciate that you've shown up seven days for yourself.",
    corePrompt:
      "Look back at this week's reflections. What stands out? What surprised you? You've identified values, noticed stories your mind tells, made room for difficult feelings, and met a 'character' that lives in your struggle. Based on all of that: what is one small, concrete action you can commit to this coming week that moves you toward what matters — even if uncomfortable feelings come along for the ride?",
    microPractice:
      "Write your commitment somewhere you'll see it daily. Not as a should — as a choice.",
  },
];

export function seedPathwaysIfEmpty(sqlite: Database.Database): void {
  const count = sqlite.prepare('SELECT COUNT(*) as c FROM pathways').get() as { c: number };
  if (count.c > 0) return;

  const pathwayStmt = sqlite.prepare(`
    INSERT INTO pathways (id, name, slug, description, duration_weeks, condition, is_active, current_day)
    VALUES (?, ?, ?, ?, ?, ?, 0, 1)
  `);
  pathwayStmt.run(
    SAMPLE_PATHWAY.id,
    SAMPLE_PATHWAY.name,
    SAMPLE_PATHWAY.slug,
    SAMPLE_PATHWAY.description,
    SAMPLE_PATHWAY.durationWeeks,
    SAMPLE_PATHWAY.condition,
  );

  const promptStmt = sqlite.prepare(`
    INSERT INTO prompts (id, pathway_id, day_number, phase, act_process, integrated_modality, anchor_prompt, core_prompt, micro_practice, estimated_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 12)
  `);

  for (const p of SAMPLE_PROMPTS) {
    const promptId = `${PATHWAY_ID}-day-${p.dayNumber}`;
    promptStmt.run(
      promptId,
      PATHWAY_ID,
      p.dayNumber,
      p.phase,
      p.actProcess,
      p.integratedModality,
      p.anchorPrompt,
      p.corePrompt,
      p.microPractice,
    );
  }

  console.log('[DB] Seeded pathways and prompts');
}
