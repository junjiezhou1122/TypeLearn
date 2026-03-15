import type { LearningEvent, MacroCategory, ProviderSettings, Teaching } from '../../shared/src/index';
import { extractJsonFromText } from './llm.js';

export interface ExtractLearningOutput {
  rewrite?: {
    corrected: string;
    alt1Natural: string;
    alt2ClearFormal: string;
  };
  events: Omit<LearningEvent, 'id' | 'createdAt' | 'utteranceId'>[];
}

export async function extractLearningEnglish(
  settings: ProviderSettings,
  input: { text: string }
): Promise<ExtractLearningOutput> {
  if (!settings.baseUrl || !settings.model) {
    return { events: [] };
  }

  const content = await chatJson(settings, {
    system: buildExtractLearningEnglishSystemPrompt(),
    user: JSON.stringify({ text: input.text }),
  });

  const parsed = extractJsonFromText(content);
  return coerceExtractLearningOutput(parsed);
}

export async function extractLearningCn2En(
  settings: ProviderSettings,
  input: { textZhOrPinyin: string }
): Promise<{
  enMain: string;
  enAlternatives: string[];
  enTemplates: string[];
  events: Omit<LearningEvent, 'id' | 'createdAt' | 'utteranceId'>[];
}> {
  if (!settings.baseUrl || !settings.model) {
    return {
      enMain: `[Translation pending] ${input.textZhOrPinyin}`,
      enAlternatives: [],
      enTemplates: [],
      events: [],
    };
  }

  const content = await chatJson(settings, {
    system: buildCn2EnSystemPrompt(),
    user: JSON.stringify({ text: input.textZhOrPinyin }),
  });

  const parsed = extractJsonFromText(content);
  if (!isPlainObject(parsed)) {
    throw new Error('cn2en: invalid JSON');
  }

  const enMain = typeof parsed.enMain === 'string' ? parsed.enMain.trim() : '';
  const enAlternatives = Array.isArray(parsed.enAlternatives)
    ? parsed.enAlternatives.filter((v) => typeof v === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 6)
    : [];
  const enTemplates = Array.isArray(parsed.enTemplates)
    ? parsed.enTemplates.filter((v) => typeof v === 'string').map((s) => s.trim()).filter(Boolean).slice(0, 6)
    : [];

  const out = coerceExtractLearningOutput(parsed);

  return {
    enMain,
    enAlternatives,
    enTemplates,
    events: out.events,
  };
}

async function chatJson(settings: ProviderSettings, args: { system: string; user: string }): Promise<string> {
  const response = await fetch(resolveChatCompletionsUrl(settings.baseUrl), {
    method: 'POST',
    signal: AbortSignal.timeout(25_000),
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
    throw new Error(`extract_learning request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('extract_learning response missing content');
  }

  return content;
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

function buildExtractLearningEnglishSystemPrompt(): string {
  return [
    'You are an English writing coach. You must return JSON only.',
    '',
    'Input JSON: {"text":"..."}',
    '',
    'Output JSON schema:',
    '{',
    '  "rewrite": {',
    '    "corrected": "...",',
    '    "alt1Natural": "...",',
    '    "alt2ClearFormal": "..."',
    '  },',
    '  "events": [',
    '    {',
    '      "type": "GrammarFix|ExpressionUpgrade",',
    '      "macroCategory": "Tense|Articles|Prepositions|WordChoice|Collocation|SentenceStructure|Tone",',
    '      "patternKey": "...",',
    '      "before": "...",',
    '      "after": "...",',
    '      "teaching": {"rule":"...","hook":"...","badExample":"...","goodExample":"...","template":"..."}',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- The rewrite must preserve meaning. Keep it a single sentence unless input clearly has multiple sentences.',
    '- alt1Natural should sound casual and native.',
    '- alt2ClearFormal should sound clear and more formal.',
    '- Extract MANY micro learning events (2–8).',
    '- Teaching must be simple English and short.',
    '- If there are no meaningful fixes, still produce rewrites (may be same as input) and events may be empty.',
  ].join('\n');
}

function buildCn2EnSystemPrompt(): string {
  return [
    'You convert Chinese (or pinyin-like romanized Chinese) into usable English expressions.',
    'Return JSON only. Be story-safe: do not include private details.',
    '',
    'Input JSON: {"text":"..."}',
    '',
    'Output JSON schema:',
    '{',
    '  "enMain": "...",',
    '  "enAlternatives": ["..."],',
    '  "enTemplates": ["..."],',
    '  "events": [',
    '    {',
    '      "type": "CN2EN",',
    '      "macroCategory": "CN2EN",',
    '      "patternKey": "cn2en:...",',
    '      "before": "<short Chinese intent>",',
    '      "after": "<english line>",',
    '      "teaching": {"rule":"...","hook":"...","badExample":"...","goodExample":"...","template":"..."}',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- enMain should be simple, reusable English.',
    '- enAlternatives: 2–4 alternatives.',
    '- enTemplates: 2–3 templates with blanks.',
    '- Extract 1–3 CN2EN events.',
  ].join('\n');
}

function coerceExtractLearningOutput(value: unknown): ExtractLearningOutput {
  if (!isPlainObject(value)) {
    throw new Error('extract_learning: invalid JSON');
  }

  const rewriteRaw = value.rewrite;
  const rewrite = isPlainObject(rewriteRaw)
    ? {
        corrected: typeof rewriteRaw.corrected === 'string' ? rewriteRaw.corrected.trim() : '',
        alt1Natural: typeof rewriteRaw.alt1Natural === 'string' ? rewriteRaw.alt1Natural.trim() : '',
        alt2ClearFormal: typeof rewriteRaw.alt2ClearFormal === 'string' ? rewriteRaw.alt2ClearFormal.trim() : '',
      }
    : undefined;

  const eventsRaw = Array.isArray(value.events) ? value.events : [];
  const events: Array<Omit<LearningEvent, 'id' | 'createdAt' | 'utteranceId'>> = [];

  for (const item of eventsRaw) {
    if (!isPlainObject(item)) continue;

    const type = item.type;
    if (type !== 'GrammarFix' && type !== 'ExpressionUpgrade' && type !== 'CN2EN') continue;

    const macro = item.macroCategory;
    if (!isMacroCategory(macro)) continue;

    const patternKey = typeof item.patternKey === 'string' ? item.patternKey.trim() : '';
    const before = typeof item.before === 'string' ? item.before.trim() : '';
    const after = typeof item.after === 'string' ? item.after.trim() : '';
    const teaching = coerceTeaching(item.teaching);

    if (!patternKey || !before || !after || !teaching) continue;

    events.push({
      type,
      macroCategory: macro,
      patternKey,
      before,
      after,
      teaching,
    });
  }

  return { rewrite, events };
}

function coerceTeaching(value: unknown): Teaching | null {
  if (!isPlainObject(value)) return null;
  const rule = typeof value.rule === 'string' ? value.rule.trim() : '';
  const hook = typeof value.hook === 'string' ? value.hook.trim() : '';
  const badExample = typeof value.badExample === 'string' ? value.badExample.trim() : '';
  const goodExample = typeof value.goodExample === 'string' ? value.goodExample.trim() : '';
  const template = typeof value.template === 'string' ? value.template.trim() : '';

  if (!rule || !hook || !badExample || !goodExample || !template) return null;
  return { rule, hook, badExample, goodExample, template };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMacroCategory(value: unknown): value is MacroCategory {
  return (
    value === 'Tense' ||
    value === 'Articles' ||
    value === 'Prepositions' ||
    value === 'WordChoice' ||
    value === 'Collocation' ||
    value === 'SentenceStructure' ||
    value === 'Tone' ||
    value === 'CN2EN'
  );
}
