import type { AICategorization } from '../../../shared/types';
import { CATEGORIZATION_PROMPT, categorizeFallback } from './ollama.service';

interface CloudConfig {
  endpoint: string;
  model: string;
  apiKey: string;
}

export async function categorizeWithCloud(text: string, config: CloudConfig): Promise<AICategorization> {
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: CATEGORIZATION_PROMPT },
          { role: 'user', content: `Journal entry:\n${text}` },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) throw new Error(`Cloud API returned ${response.status}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error('Cloud API returned empty content');

    const parsed = JSON.parse(raw);
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
    console.warn('[AI] Cloud categorization failed, using fallback:', (err as Error).message);
    return categorizeFallback(text);
  }
}

