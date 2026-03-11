import type { LearningArtifact } from '../../shared/src/index';

interface CoachingRule {
  test: (sourceText: string) => boolean;
  suggest: (sourceText: string) => string;
  explain: string;
}

const rules: CoachingRule[] = [
  {
    test: (text) => /\bI has\b/i.test(text),
    suggest: (text) => text.replace(/\bI has\b/i, 'I have'),
    explain: 'Use "have" with "I". "Has" is used with third-person singular subjects like "he" or "she".',
  },
  {
    test: (text) => /\bHe go\b/i.test(text),
    suggest: (text) => text.replace(/\bHe go\b/i, 'He went'),
    explain: 'For a finished action in the past, use the past tense "went" instead of "go".',
  },
  {
    test: (text) => /\bI very like\b/i.test(text),
    suggest: (text) => text.replace(/\bI very like\b/i, 'I really like'),
    explain: 'In natural English, adverbs such as "really" are usually used before "like" instead of "very".',
  },
  {
    test: (text) => /\bcan you help me make this sentence more natural\b/i.test(text),
    suggest: () => 'Could you help me make this sentence sound more natural?',
    explain: '"Sound more natural" is the more idiomatic way to ask for a smoother English phrasing.',
  },
];

export function buildLearningArtifact(sourceText: string): LearningArtifact {
  const matchedRule = rules.find((rule) => rule.test(sourceText));

  const suggestion = matchedRule
    ? matchedRule.suggest(sourceText)
    : rewriteGenerically(sourceText);

  const explanation = matchedRule?.explain ?? genericExplanation(sourceText, suggestion);

  return {
    id: crypto.randomUUID(),
    sourceText,
    suggestion,
    explanation,
    createdAt: new Date().toISOString(),
  };
}

function rewriteGenerically(sourceText: string): string {
  const trimmed = sourceText.trim();
  if (!trimmed) return sourceText;

  const normalized = trimmed[0].toUpperCase() + trimmed.slice(1);
  return normalized.endsWith('.') || normalized.endsWith('!') || normalized.endsWith('?')
    ? normalized
    : `${normalized}.`;
}

function genericExplanation(sourceText: string, suggestion: string): string {
  if (sourceText === suggestion) {
    return 'This sentence already looks clear. TypeLearn kept it as-is for now.';
  }

  return 'TypeLearn normalized capitalization or punctuation to make the sentence look more natural in everyday writing.';
}
