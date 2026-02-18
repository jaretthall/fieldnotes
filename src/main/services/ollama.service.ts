import type { AICategorization } from '../../../shared/types';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2:1b';

const CATEGORIZATION_PROMPT = `You are a journal entry analyzer.
Given a journal entry, return ONLY a JSON object with these fields:
{
  "mood_valence": "positive" | "negative" | "mixed" | "neutral",
  "mood_granular": ["array of 1-3 specific emotions from: anxious, calm, frustrated, grateful, hopeful, sad, angry, content, overwhelmed, energized, lonely, connected, confused, clear, grief, excited, bored, tender, resilient, stuck"],
  "life_domains": ["array of 1-3 relevant domains from: work, relationships, health, personal-growth, family, finances, creativity, spirituality, recreation, community, education"],
  "entities": [{"name": "string", "type": "person|place|concept"}],
  "keywords": ["array of 3-6 key topics/themes"],
  "title": "Brief 3-8 word title for this entry",
  "summary": "1-2 sentence summary"
}

Be concise. Return ONLY valid JSON. No commentary.`;

export async function checkOllamaStatus(model = DEFAULT_MODEL): Promise<{ available: boolean; model: string }> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      return { available: false, model };
    }
    const data = await response.json();
    const models = data.models || [];
    const hasModel = models.some((m: { name: string }) =>
      m.name === model || m.name.startsWith(model.split(':')[0])
    );
    return { available: hasModel, model };
  } catch {
    return { available: false, model };
  }
}

export async function categorizeEntry(text: string, model = DEFAULT_MODEL): Promise<AICategorization> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${CATEGORIZATION_PROMPT}\n\nJournal entry:\n${text}`,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 512,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.response.trim();

    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    return {
      moodValence: parsed.mood_valence || 'neutral',
      moodGranular: parsed.mood_granular || [],
      lifeDomains: parsed.life_domains || [],
      entities: (parsed.entities || []).map((e: { name: string; type: string }) => ({
        name: e.name,
        type: e.type as 'person' | 'place' | 'concept',
      })),
      keywords: parsed.keywords || [],
      title: parsed.title || 'Untitled Entry',
      summary: parsed.summary || '',
    };
  } catch (err) {
    console.warn('[AI] Ollama categorization failed, using fallback:', (err as Error).message);
    return categorizeFallback(text);
  }
}

// Fallback keyword-based categorization when Ollama is unavailable
export function categorizeFallback(text: string): AICategorization {
  const lower = text.toLowerCase();

  // Simple mood detection
  const positiveWords = ['happy', 'grateful', 'excited', 'good', 'great', 'amazing', 'wonderful', 'love', 'enjoy', 'proud', 'calm', 'peaceful'];
  const negativeWords = ['sad', 'angry', 'frustrated', 'anxious', 'worried', 'stressed', 'tired', 'overwhelmed', 'lonely', 'afraid', 'hurt', 'disappointed'];

  const posCount = positiveWords.filter(w => lower.includes(w)).length;
  const negCount = negativeWords.filter(w => lower.includes(w)).length;

  let moodValence: AICategorization['moodValence'] = 'neutral';
  if (posCount > 0 && negCount > 0) moodValence = 'mixed';
  else if (posCount > 0) moodValence = 'positive';
  else if (negCount > 0) moodValence = 'negative';

  // Granular mood
  const moodGranular: string[] = [];
  const moodMap: Record<string, string> = {
    anxious: 'anxious', worried: 'anxious', stressed: 'anxious',
    calm: 'calm', peaceful: 'calm', relaxed: 'calm',
    frustrated: 'frustrated', angry: 'frustrated',
    grateful: 'grateful', thankful: 'grateful',
    hopeful: 'hopeful', optimistic: 'hopeful',
    sad: 'sad', unhappy: 'sad',
    content: 'content', satisfied: 'content',
    overwhelmed: 'overwhelmed',
    energized: 'energized', excited: 'excited',
    lonely: 'lonely', isolated: 'lonely',
    confused: 'confused', lost: 'confused',
  };
  for (const [word, mood] of Object.entries(moodMap)) {
    if (lower.includes(word) && !moodGranular.includes(mood)) {
      moodGranular.push(mood);
      if (moodGranular.length >= 3) break;
    }
  }

  // Life domains
  const lifeDomains: string[] = [];
  const domainMap: Record<string, string> = {
    work: 'work', job: 'work', career: 'work', office: 'work', boss: 'work', meeting: 'work', project: 'work',
    relationship: 'relationships', partner: 'relationships', friend: 'relationships', dating: 'relationships',
    health: 'health', exercise: 'health', doctor: 'health', sleep: 'health', workout: 'health',
    family: 'family', parent: 'family', sibling: 'family', child: 'family', mom: 'family', dad: 'family',
    money: 'finances', financial: 'finances', budget: 'finances', debt: 'finances',
    creative: 'creativity', art: 'creativity', music: 'creativity', write: 'creativity', writing: 'creativity',
    learn: 'education', study: 'education', school: 'education', class: 'education',
    growth: 'personal-growth', improve: 'personal-growth', goal: 'personal-growth',
  };
  for (const [word, domain] of Object.entries(domainMap)) {
    if (lower.includes(word) && !lifeDomains.includes(domain)) {
      lifeDomains.push(domain);
      if (lifeDomains.length >= 3) break;
    }
  }

  // Extract potential keywords (simple: most frequent non-stop words)
  const stopWords = new Set(['the', 'a', 'an', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'like', 'through', 'after', 'over', 'between', 'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because', 'if', 'when', 'where', 'while', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'really', 'also', 'even', 'still', 'much', 'going', 'get', 'got', 'thing', 'things', 'way', 'today', 'feel', 'feeling', 'think', 'thought']);
  const words = lower.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  const wordFreq = new Map<string, number>();
  words.forEach(w => wordFreq.set(w, (wordFreq.get(w) || 0) + 1));
  const keywords = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Generate a simple title
  const firstSentence = text.split(/[.!?]/)[0].trim();
  const title = firstSentence.length > 40
    ? firstSentence.slice(0, 37) + '...'
    : firstSentence || 'Journal Entry';

  return {
    moodValence,
    moodGranular: moodGranular.length > 0 ? moodGranular : ['neutral' as never],
    lifeDomains: lifeDomains.length > 0 ? lifeDomains : ['uncategorized'],
    entities: [],
    keywords,
    title,
    summary: text.length > 150 ? text.slice(0, 147) + '...' : text,
  };
}

export { DEFAULT_MODEL as DEFAULT_OLLAMA_MODEL, CATEGORIZATION_PROMPT };
