import type { CaptureRecord, ProviderSettings, StoryArtifact } from '../../shared/src/index';

export async function generateDailyStory(records: CaptureRecord[], settings: ProviderSettings): Promise<StoryArtifact> {
  const todayRecords = records.filter((record) => isToday(record.createdAt) && record.status === 'done');
  const englishLines = todayRecords.map((record) => `- ${record.englishText}`).join('\n');

  const fallbackStory = buildFallbackStory(todayRecords);

  if (!settings.baseUrl || !settings.model || !englishLines) {
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
            content: 'You are an English coach. Write a short, coherent English story inspired by the user\'s lines from today. You may omit or combine lines for clarity. Return only the story text.',
          },
          {
            role: 'user',
            content: `Today\'s English lines:\n${englishLines}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`story generation failed with status ${response.status}`);
    }

    const payload = await response.json() as {
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
    title: 'Today\'s Story',
    story,
    createdAt: new Date().toISOString(),
    sourceRecordIds: records.map((record) => record.id),
  };
}

function buildFallbackStory(records: CaptureRecord[]): string {
  if (records.length === 0) {
    return 'No captured content for today yet. Start typing in Chinese or English to build today\'s story.';
  }

  const opening = 'Today, a learner moved through the day collecting fragments of thought.';
  const body = records.slice(0, 5).map((record) => record.englishText).join(' ');
  return `${opening} ${body}`.trim();
}

function isToday(timestamp: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return timestamp.slice(0, 10) === today;
}
