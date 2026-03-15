export type ArtifactCategory = 'Fix' | 'Better' | 'Style';
export type ArtifactType = 'Refinement' | 'Expression';

export interface LearningArtifact {
  id: string;
  type: ArtifactType;
  category?: ArtifactCategory;

  sourceText: string;
  suggestion: string;
  explanation: string;

  // Rich optional fields from the new pipeline.
  corrected?: string;
  alt1Natural?: string;
  alt2ClearFormal?: string;

  intentZh?: string;
  enMain?: string;
  enAlternatives?: string[];
  enTemplates?: string[];

  patternKeys?: string[];

  createdAt: string;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'filtered';
  isSaved?: boolean;
}

export interface ChoiceCandidate {
  intentZh: string;
  enMain: string;
  enAlternatives?: string[];
  enTemplates?: string[];
}

export interface ChoiceItem {
  id: string;
  sourceApp: string | null;
  createdAt: string;
  mergedRaw: string;
  languageHint: 'pinyin' | 'zh' | 'en' | 'mixed' | 'unknown';
  fragmentIds: string[];
  candidates: ChoiceCandidate[];
  expiresAt: string;
}

export type MacroCategory =
  | 'Tense'
  | 'Articles'
  | 'Prepositions'
  | 'WordChoice'
  | 'Collocation'
  | 'SentenceStructure'
  | 'Tone'
  | 'CN2EN';

export interface Teaching {
  rule: string;
  hook: string;
  badExample: string;
  goodExample: string;
  template: string;
}

export interface Pattern {
  patternKey: string;
  macroCategory: MacroCategory;
  title: string;
  lesson: Teaching;
  counts: {
    today: number;
    last7d: number;
    total: number;
  };
  exampleEventIds: string[];
}

export interface DailyLessonGroup {
  macroCategory: MacroCategory;
  patterns: Pattern[];
}

export interface DailyLesson {
  day: string;
  createdAt: string;
  groups: DailyLessonGroup[];
  stealLines: string[];
}

export interface StoryArtifact {
  id: string;
  title: string;
  story: string;
  createdAt: string;
  sourceRecordIds: string[];
  highlightedPhrases?: string[];
}

export interface ProviderSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}
