import type { ChoiceCandidate, UtteranceLanguageHint, ProviderSettings } from '../../shared/src/index';

export type MergeAction = 'KEEP' | 'DROP' | 'CHOICE';

export interface MergeAndFilterInput {
  contextOnly?: string;
  fragments: Array<{ id: string; t: string; text: string }>;
  rules: {
    strictFilter: boolean;
    choiceCandidates: number;
    storySafe: boolean;
  };
}

export interface MergeAndFilterUtterance {
  fragmentIds: string[];
  action: MergeAction;
  languageHint?: UtteranceLanguageHint;
  mergedRaw?: string;
  candidates?: ChoiceCandidate[];
  reason?: string;
}

export interface MergeAndFilterOutput {
  utterances: MergeAndFilterUtterance[];
}

export async function mergeAndFilter(settings: ProviderSettings, input: MergeAndFilterInput): Promise<MergeAndFilterOutput> {
  const content = await chatJson(settings, {
    system: buildMergeAndFilterSystemPrompt(),
    user: JSON.stringify(input),
  });

  const parsed = extractJsonFromText(content);
  if (!isPlainObject(parsed) || !Array.isArray(parsed.utterances)) {
    throw new Error('merge_and_filter: invalid JSON shape');
  }

  const utterances: MergeAndFilterUtterance[] = [];
  for (const item of parsed.utterances) {
    if (!isPlainObject(item)) continue;
    const fragmentIds = Array.isArray(item.fragmentIds) ? item.fragmentIds.filter((v) => typeof v === 'string') : [];
    const action = item.action;
    if (!fragmentIds.length || (action !== 'KEEP' && action !== 'DROP' && action !== 'CHOICE')) continue;

    const utterance: MergeAndFilterUtterance = {
      fragmentIds,
      action,
      languageHint: isLanguageHint(item.languageHint) ? item.languageHint : undefined,
      mergedRaw: typeof item.mergedRaw === 'string' ? item.mergedRaw : undefined,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    };

    if (action === 'CHOICE') {
      utterance.candidates = Array.isArray(item.candidates)
        ? item.candidates.filter(isChoiceCandidate).slice(0, 6)
        : [];
      // mergedRaw is still useful for UI/debug.
      if (!utterance.mergedRaw) utterance.mergedRaw = '';
    }

    utterances.push(utterance);
  }

  return { utterances };
}

export function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('empty llm response');

  // Prefer fenced code blocks.
  const fence = findFirstCodeFence(trimmed);
  if (fence) {
    const candidate = fence.trim();
    return JSON.parse(candidate) as unknown;
  }

  // Otherwise, try to parse the first JSON object/array in the text.
  const slice = sliceFirstJsonValue(trimmed);
  return JSON.parse(slice) as unknown;
}

async function chatJson(settings: ProviderSettings, args: { system: string; user: string }): Promise<string> {
  if (!settings.baseUrl || !settings.model) {
    throw new Error('provider not configured');
  }

  const response = await fetch(resolveChatCompletionsUrl(settings.baseUrl), {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
    headers: {
      'content-type': 'application/json',
      ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`llm request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('llm response missing content');
  }

  return content;
}

function buildMergeAndFilterSystemPrompt(): string {
  return [
    'You are a strict text assembler for a privacy-first typing-capture app.',
    'You receive a JSON input with:',
    '- contextOnly: the last committed utterance text (optional, for coherence only)',
    '- fragments: a list of text fragments from ONE app within the last 90 seconds',
    '',
    'Task:',
    '1) Group fragments into utterances (units of meaning).',
    '2) Merge each utterance into mergedRaw (do NOT invent details).',
    '3) Decide an action per utterance:',
    '   - KEEP: meaningful utterance worth learning from',
    '   - DROP: noise / too ambiguous / code / URLs / paths / tokens',
    '   - CHOICE: ambiguous pinyin-like or unclear Chinese intent; offer candidates',
    '',
    'Strict filtering rules (quality > recall):',
    '- DROP obvious noise: URLs, file paths, base64-like blobs, random hashes, code snippets, repeated character spam.',
    '- Story-safe: never output private details (names, addresses, emails, phone numbers, IDs). Abstract intents.',
    '',
    'CHOICE candidates:',
    '- Produce 3–5 candidates.',
    '- intentZh: short, abstract Chinese intent (no private details).',
    '- enMain: simple reusable English.',
    '- enAlternatives: 2–4 alternatives (optional).',
    '- enTemplates: 2–3 templates (optional).',
    '',
    'Output JSON ONLY with this schema:',
    '{ "utterances": [',
    '  { "fragmentIds": ["..."], "action": "KEEP", "languageHint": "en|zh|pinyin|mixed|unknown", "mergedRaw": "..." },',
    '  { "fragmentIds": ["..."], "action": "DROP", "reason": "..." },',
    '  { "fragmentIds": ["..."], "action": "CHOICE", "languageHint": "pinyin", "mergedRaw": "...", "candidates": [ ... ] }',
    '] }',
    '',
    'Constraints:',
    '- Each fragmentId must appear at most once across all utterances.',
    '- Keep utterances in chronological order.',
    '- If unsure, prefer DROP over KEEP.',
  ].join('\n');
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLanguageHint(value: unknown): value is UtteranceLanguageHint {
  return value === 'pinyin' || value === 'zh' || value === 'en' || value === 'mixed' || value === 'unknown';
}

function isChoiceCandidate(value: unknown): value is ChoiceCandidate {
  if (!isPlainObject(value)) return false;
  if (typeof value.intentZh !== 'string') return false;
  if (typeof value.enMain !== 'string') return false;
  if (value.enAlternatives != null && !Array.isArray(value.enAlternatives)) return false;
  if (value.enTemplates != null && !Array.isArray(value.enTemplates)) return false;
  return true;
}

function findFirstCodeFence(text: string): string | null {
  const fenceStart = text.match(/```(?:json)?\s*\n/);
  if (!fenceStart || fenceStart.index == null) return null;
  const startIdx = fenceStart.index + fenceStart[0].length;
  const endIdx = text.indexOf('\n```', startIdx);
  if (endIdx === -1) return null;
  return text.slice(startIdx, endIdx);
}

function sliceFirstJsonValue(text: string): string {
  const start = text.search(/[\[{]/);
  if (start === -1) {
    throw new Error('no JSON found in llm response');
  }

  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === open) depth++;
    if (ch === close) depth--;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }

  throw new Error('unterminated JSON in llm response');
}
