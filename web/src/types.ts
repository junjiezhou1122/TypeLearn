export type ArtifactCategory = 'Fix' | 'Better' | 'Style';
export type ArtifactType = 'Refinement' | 'Expression';

export interface LearningArtifact {
  id: string;
  type: ArtifactType;
  category?: ArtifactCategory;

  sourceText: string;
  restoredText?: string | null;
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

export type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'night';

export interface StoryMoment {
  recordId: string;
  createdAt: string;
  timeBucket: TimeBucket;
  sourceApp: string | null;
  intentZh?: string;
  enMain?: string;
  patternKeys: string[];
  score: number;
}

export interface StoryPatternSummary {
  patternKey: string;
  title: string;
  count: number;
  sampleLines: string[];
}

export interface SessionDigest {
  id: string;
  startedAt: string;
  endedAt: string;
  sourceApps: string[];
  themeLabels: string[];
  topPatternKeys: string[];
  stealLines: string[];
  moments: StoryMoment[];
  recordIds: string[];
  recordCount: number;
}

export interface DayDigest {
  day: string;
  createdAt: string;
  sessionCount: number;
  themes: string[];
  topPatterns: StoryPatternSummary[];
  stealLines: string[];
  keyMoments: StoryMoment[];
  sessionDigests: SessionDigest[];
  sourceRecordIds: string[];
  stats: {
    totalRecords: number;
    totalDoneRecords: number;
    totalPatterns: number;
  };
}

export interface StoryArtifact {
  id: string;
  day: string;
  title: string;
  summary: string;
  paragraphs: string[];
  stealLines: string[];
  themeLabels: string[];
  patternKeys: string[];
  sessionCount: number;
  story: string;
  createdAt: string;
  sourceRecordIds: string[];
}

export interface ProviderSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}
