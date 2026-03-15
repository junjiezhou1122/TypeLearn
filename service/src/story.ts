import type { CaptureRecord, ProviderSettings, StoryArtifact } from '../../shared/src/index';

export async function generateDailyStory(records: CaptureRecord[], settings: ProviderSettings): Promise<StoryArtifact> {
  const todayRecords = records.filter((record) => isToday(record.createdAt) && record.status === 'done');

  const intents = todayRecords
    .map((r) => r.intentZh)
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  const stealLines = todayRecords
    .flatMap((r) => r.enTemplates ?? [])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .slice(0, 16);

  const fallbackStory = buildFallbackStory(todayRecords, stealLines);

  if (!settings.baseUrl || !settings.model) {
    return createStoryArtifact(todayRecords, fallbackStory);
  }

  // If we have no safe material, prefer fallback.
  if (intents.length === 0 && stealLines.length === 0) {
    return createStoryArtifact(todayRecords, fallbackStory);
  }

  try {
    const response = await fetch(resolveChatCompletionsUrl(settings.baseUrl), {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'content-type': 'application/json',
        ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: 'system',
            content: [
              'Write an abstract, story-safe daily story in simple English.',
              'Inputs are intents/themes (Chinese summaries) and reusable English templates.',
              '',
              'Rules:',
              '- Do NOT include private details (names, places, companies, emails, numbers, IDs).',
              '- Keep it coherent, warm, and general. No real-world specifics.',
              '- Include a final section titled "Steal these lines" with 5–10 bullet points.',
              '- Each bullet point must be a reusable English line (can reuse templates).',
              '',
              'Return only the story text (multi-paragraph is ok).',
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({
              intents,
              templates: stealLines,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`story generation failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const story = payload.choices?.[0]?.message?.content?.trim() || fallbackStory;
    return createStoryArtifact(todayRecords, story);
  } catch {
    return createStoryArtifact(todayRecords, fallbackStory);
  }
}

function resolveChatCompletionsUrl(baseUrl: string): URL {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL(normalized);
  if (url.pathname.endsWith('/v1/')) {
    return new URL('chat/completions', url);
  }
  if (url.pathname.endsWith('/v1')) {
    return new URL('chat/completions', `${normalized}/`);
  }
  return new URL('v1/chat/completions', url);
}

function createStoryArtifact(records: CaptureRecord[], story: string): StoryArtifact {
  return {
    id: crypto.randomUUID(),
    title: "Today's Story",
    story,
    createdAt: new Date().toISOString(),
    sourceRecordIds: records.map((record) => record.id),
  };
}

function buildFallbackStory(records: CaptureRecord[], templates: string[]): string {
  if (records.length === 0) {
    return 'No captured content for today yet. Start typing to build today\'s story.';
  }

  const opening = 'Today, a learner moved through the day with a few clear intentions.';
  const body = records
    .slice(0, 5)
    .map((record) => record.englishText)
    .filter(Boolean)
    .join(' ');

  const steal = templates.slice(0, 8);
  const stealSection = steal.length
    ? `\n\nSteal these lines\n${steal.map((t) => `- ${t}`).join('\n')}`
    : '';

  return `${opening} ${body}`.trim() + stealSection;
}

function isToday(timestamp: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return timestamp.slice(0, 10) === today;
}
