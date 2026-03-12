import type { ProviderSettings } from '../../shared/src/index';

export interface TranslationResult {
  englishText: string;
  sourceLanguage: 'chinese' | 'english' | 'mixed' | 'unknown';
}

export interface RestorationResult {
  restoredText: string;
  didRestore: boolean;
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

export async function polishEnglishText(sourceText: string, settings: ProviderSettings): Promise<string> {
  if (!settings.baseUrl || !settings.model) {
    return normalizeEnglish(sourceText);
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
            content: 'Polish the user text into natural, fluent English while preserving meaning. Return only the polished sentence.',
          },
          {
            role: 'user',
            content: sourceText,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`polish failed with status ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const polished = payload.choices?.[0]?.message?.content?.trim();
    return polished || normalizeEnglish(sourceText);
  } catch {
    return normalizeEnglish(sourceText);
  }
}

export async function restoreChineseFromRomanized(sourceText: string, settings: ProviderSettings): Promise<RestorationResult> {
  if (!shouldAttemptRestoration(sourceText)) {
    console.log('[restore] skipped: shouldAttemptRestoration=false for:', JSON.stringify(sourceText));
    return { restoredText: sourceText, didRestore: false };
  }

  if (!settings.baseUrl || !settings.model) {
    console.log('[restore] skipped: no provider configured (baseUrl=%s, model=%s)', settings.baseUrl, settings.model);
    return { restoredText: sourceText, didRestore: false };
  }

  const normalized = sourceText.trim();
  const forcePinyin = isLikelyPinyin(normalized);
  console.log('[restore] attempting restoration for: %s (forcePinyin=%s)', JSON.stringify(normalized), forcePinyin);

  const url = resolveChatCompletionsUrl(settings.baseUrl);
  console.log('[restore] API URL: %s', url.toString());

  try {
    if (forcePinyin && normalized.length > 60) {
      const chunks = splitPinyinInput(normalized, 40);
      const restoredChunks: string[] = [];

      for (const chunk of chunks) {
        const chunkResult = await restorePinyinChunk(chunk, settings);
        restoredChunks.push(chunkResult || chunk);
      }

      const merged = restoredChunks.join('');
      return { restoredText: merged, didRestore: containsChinese(merged) };
    }

    const body = {
      model: settings.model,
      messages: [
        {
          role: 'system',
          content: forcePinyin
            ? 'The following text is Chinese pinyin typed on a keyboard (may have no spaces, may include tone numbers 1-5). Convert ALL of it into natural Simplified Chinese characters. Keep genuine English words unchanged. Return ONLY the Chinese text, nothing else.'
            : 'If the text is normal English, return it unchanged. If the text contains pinyin or romanized Chinese, convert only those parts into natural Simplified Chinese while keeping English words and punctuation unchanged. Return only the corrected text.',
        },
        {
          role: 'user',
          content: sourceText,
        },
      ],
    };

    console.log('[restore] request body:', JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'content-type': 'application/json',
        ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    console.log('[restore] response status: %d', response.status);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(unreadable)');
      console.error('[restore] API error: status=%d body=%s', response.status, errorBody);
      return { restoredText: sourceText, didRestore: false };
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    console.log('[restore] raw API response:', JSON.stringify(payload));

    const restoredText = payload.choices?.[0]?.message?.content?.trim() || sourceText;
    const didRestore = restoredText !== sourceText && containsChinese(restoredText);

    console.log('[restore] result: restoredText=%s didRestore=%s', JSON.stringify(restoredText), didRestore);

    if (!didRestore && forcePinyin) {
      console.log('[restore] first attempt did not produce Chinese, retrying with stronger prompt...');
      const retry = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: {
          'content-type': 'application/json',
          ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            {
              role: 'system',
              content: 'You are a pinyin-to-Chinese converter. The user input is Chinese pinyin. Convert it to Simplified Chinese characters. Reply with ONLY the Chinese characters, no explanations.',
            },
            {
              role: 'user',
              content: `Convert this pinyin to Chinese: ${sourceText}`,
            },
          ],
        }),
      });

      console.log('[restore] retry status: %d', retry.status);

      if (retry.ok) {
        const retryPayload = await retry.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const retryText = retryPayload.choices?.[0]?.message?.content?.trim();
        console.log('[restore] retry result: %s', JSON.stringify(retryText));
        if (retryText && containsChinese(retryText)) {
          return { restoredText: retryText, didRestore: true };
        }
      }
    }

    return { restoredText, didRestore };
  } catch (error) {
    console.error('[restore] EXCEPTION:', error);
    return { restoredText: sourceText, didRestore: false };
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

function shouldAttemptRestoration(sourceText: string): boolean {
  const trimmed = sourceText.trim();
  if (trimmed.length < 2) return false;
  if (containsChinese(trimmed)) return false;
  return /[A-Za-z]/.test(trimmed);
}

export function isLikelyPinyin(sourceText: string): boolean {
  if (!/^[A-Za-z0-9\s]+$/.test(sourceText)) return false;
  if (!/[aeiouAEIOU]/.test(sourceText)) return false;
  return true;
}

async function restorePinyinChunk(chunk: string, settings: ProviderSettings): Promise<string | null> {
  const url = resolveChatCompletionsUrl(settings.baseUrl);
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      'content-type': 'application/json',
      ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: 'system',
          content: 'You are a pinyin-to-Chinese converter. Convert the input to natural Simplified Chinese. Reply with ONLY Chinese characters.',
        },
        {
          role: 'user',
          content: chunk,
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content?.trim() || null;
}

function splitPinyinInput(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const parts: string[] = [];
  if (text.includes(' ')) {
    const tokens = text.split(/\s+/).filter(Boolean);
    let current = '';
    for (const token of tokens) {
      const next = current ? `${current} ${token}` : token;
      if (next.length > maxLength && current) {
        parts.push(current);
        current = token;
      } else {
        current = next;
      }
    }
    if (current) parts.push(current);
    return parts;
  }

  for (let index = 0; index < text.length; index += maxLength) {
    parts.push(text.slice(index, index + maxLength));
  }
  return parts;
}

function containsChinese(sourceText: string): boolean {
  return /[\u4e00-\u9fff]/.test(sourceText);
}

function normalizeEnglish(sourceText: string): string {
  const trimmed = sourceText.trim();
  if (!trimmed) return sourceText;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}
