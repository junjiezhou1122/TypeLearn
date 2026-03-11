import type { ProviderSettings } from '../../shared/src/index';

export interface TranslationResult {
  englishText: string;
  sourceLanguage: 'chinese' | 'english' | 'mixed' | 'unknown';
}

export async function translateToEnglish(sourceText: string, settings: ProviderSettings): Promise<TranslationResult> {
  const sourceLanguage = detectLanguage(sourceText);

  if (sourceLanguage === 'english' || sourceLanguage === 'unknown') {
    return { englishText: normalizeEnglish(sourceText), sourceLanguage };
  }

  if (!settings.baseUrl || !settings.model) {
    return {
      englishText: `[Translation pending] ${sourceText}`,
      sourceLanguage,
    };
  }

  try {
    const response = await fetch(resolveChatCompletionsUrl(settings.baseUrl), {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'content-type': 'application/json',
        ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: 'system',
            content: 'Translate the user text into natural English. Return only the English translation.',
          },
          {
            role: 'user',
            content: sourceText,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`translation failed with status ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const englishText = payload.choices?.[0]?.message?.content?.trim();

    return {
      englishText: englishText || `[Translation pending] ${sourceText}`,
      sourceLanguage,
    };
  } catch {
    return {
      englishText: `[Translation pending] ${sourceText}`,
      sourceLanguage,
    };
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

export function detectLanguage(sourceText: string): 'chinese' | 'english' | 'mixed' | 'unknown' {
  const chineseMatches = sourceText.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const englishMatches = sourceText.match(/[A-Za-z]/g)?.length ?? 0;

  if (chineseMatches > 0 && englishMatches === 0) return 'chinese';
  if (englishMatches > 0 && chineseMatches === 0) return 'english';
  if (chineseMatches > 0 && englishMatches > 0) return 'mixed';
  return 'unknown';
}

function normalizeEnglish(sourceText: string): string {
  const trimmed = sourceText.trim();
  if (!trimmed) return sourceText;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}
