import type { DayDigest, ProviderSettings, StoryArtifact } from '../../shared/src/index';

export async function generateStoryFromDigest(
  digest: DayDigest,
  settings: ProviderSettings,
): Promise<StoryArtifact> {
  const fallbackStory = buildFallbackStory(digest);

  if (!settings.baseUrl || !settings.model || digest.stats.totalDoneRecords === 0) {
    return createStoryArtifact(digest, fallbackStory);
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
              'Write a story-safe daily learning recap in simple English.',
              'You receive a compact day digest, not raw user text.',
              '',
              'Rules:',
              '- Do NOT include private details (names, places, companies, emails, numbers, IDs).',
              '- Keep the tone warm, calm, and general.',
              '- Focus on learning themes, repeated patterns, and reusable English.',
              '- Return JSON only.',
              '',
              'JSON shape:',
              '{',
              '  "title": string,',
              '  "summary": string,',
              '  "paragraphs": string[],',
              '  "stealLines": string[]',
              '}',
              '',
              'Constraints:',
              '- title under 60 chars',
              '- summary 1 sentence',
              '- 2 to 4 paragraphs',
              '- 5 to 8 steal lines',
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({
              day: digest.day,
              sessionCount: digest.sessionCount,
              themes: digest.themes,
              topPatterns: digest.topPatterns.map((pattern) => ({
                title: pattern.title,
                count: pattern.count,
                sampleLines: pattern.sampleLines,
              })),
              keyMoments: digest.keyMoments.map((moment) => ({
                timeBucket: moment.timeBucket,
                intentZh: moment.intentZh,
                enMain: moment.enMain,
                patternKeys: moment.patternKeys,
              })),
              stealLines: digest.stealLines,
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
    const content = payload.choices?.[0]?.message?.content?.trim() ?? '';
    const parsed = parseStoryPayload(content);

    if (!parsed) {
      return createStoryArtifact(digest, fallbackStory);
    }

    const story = sanitizeStoryContent(parsed, digest, fallbackStory);
    return createStoryArtifact(digest, story);
  } catch {
    return createStoryArtifact(digest, fallbackStory);
  }
}

export function buildFallbackStory(digest: DayDigest): StoryContent {
  if (digest.stats.totalDoneRecords === 0) {
    return {
      title: digest.day === isoDay(new Date().toISOString()) ? "Today's Story" : `Story for ${digest.day}`,
      summary: 'No captured content for this day yet.',
      paragraphs: ['Start typing to build a daily learning story from your strongest moments.'],
      stealLines: [],
    };
  }

  const themeText = joinList(digest.themes.slice(0, 3)) || 'a few clear intentions';
  const patternText = joinList(digest.topPatterns.slice(0, 2).map((pattern) => pattern.title)) || 'small language upgrades';
  const momentLines = digest.keyMoments
    .map((moment) => moment.enMain)
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);

  const paragraphs = [
    `The day moved through ${themeText}, with the learner returning to ${patternText}.`,
    digest.sessionDigests.length > 1
      ? `These moments arrived across ${digest.sessionDigests.length} focused sessions, which kept the learning loop active without turning the day into a full transcript.`
      : 'The learning stayed focused in one compact session, making the strongest patterns easier to notice.',
    momentLines.length > 0
      ? `Some reusable lines stood out: ${joinList(momentLines)}.`
      : 'A few reusable English lines emerged from the day and are ready for the next conversation.',
  ].filter(Boolean);

  return {
    title: digest.day === isoDay(new Date().toISOString()) ? "Today's Story" : `Story for ${digest.day}`,
    summary: `A focused learning day shaped by ${themeText}.`,
    paragraphs,
    stealLines: digest.stealLines.slice(0, 8),
  };
}

function createStoryArtifact(digest: DayDigest, content: StoryContent): StoryArtifact {
  return {
    id: crypto.randomUUID(),
    day: digest.day,
    title: content.title,
    summary: content.summary,
    paragraphs: content.paragraphs,
    stealLines: content.stealLines,
    themeLabels: digest.themes,
    patternKeys: digest.topPatterns.map((pattern) => pattern.patternKey),
    sessionCount: digest.sessionCount,
    story: composeLegacyStory(content),
    createdAt: new Date().toISOString(),
    sourceRecordIds: digest.sourceRecordIds,
  };
}

function sanitizeStoryContent(
  parsed: Partial<StoryContent>,
  digest: DayDigest,
  fallback: StoryContent,
): StoryContent {
  const paragraphs = (parsed.paragraphs ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
  const stealLines = (parsed.stealLines ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    title: parsed.title?.trim() || fallback.title,
    summary: parsed.summary?.trim() || fallback.summary,
    paragraphs: paragraphs.length > 0 ? paragraphs : fallback.paragraphs,
    stealLines: stealLines.length > 0 ? unique(stealLines) : fallback.stealLines,
  };
}

function parseStoryPayload(content: string): Partial<StoryContent> | null {
  if (!content) return null;

  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as Partial<StoryContent>;
  } catch {
    return null;
  }
}

function composeLegacyStory(content: StoryContent): string {
  const body = [content.summary, ...content.paragraphs.filter((line) => line.trim() && line.trim() !== content.summary.trim())]
    .join('\n\n')
    .trim();
  if (content.stealLines.length === 0) return body;
  return `${body}\n\nSteal these lines\n${content.stealLines.map((line) => `- ${line}`).join('\n')}`.trim();
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

function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

type StoryContent = {
  title: string;
  summary: string;
  paragraphs: string[];
  stealLines: string[];
};
