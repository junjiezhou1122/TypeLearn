export type ProviderMode = 'local' | 'byok-remote' | 'custom-base-url';

export interface HealthStatus {
  status: 'ok';
  service: 'orchestrator-service';
  providerModes: ProviderMode[];
}

export type CaptureStatus = 'pending' | 'processing' | 'done' | 'failed' | 'filtered';

export interface LearningArtifact {
  id: string;
  sourceText: string;
  restoredText?: string | null;

  // Optional: helps UIs categorize artifacts without heuristics.
  sourceLanguage?: 'chinese' | 'english' | 'mixed' | 'unknown';

  // Backward-compatible string fields (existing UIs).
  suggestion: string;
  explanation: string;

  // Optional richer fields (web UI can use; Swift ignores unknown keys).
  corrected?: string;
  alt1Natural?: string;
  alt2ClearFormal?: string;

  intentZh?: string;
  enMain?: string;
  enAlternatives?: string[];
  enTemplates?: string[];

  patternKeys?: string[];

  createdAt: string;
  status?: CaptureStatus;
}

export interface CaptureRecord {
  id: string;
  sourceText: string;
  restoredText: string | null;

  // Main English line for legacy story + UI.
  englishText: string;

  sourceLanguage: 'chinese' | 'english' | 'mixed' | 'unknown';
  sourceApp: string | null;
  createdAt: string;
  status: CaptureStatus;
  retryCount: number;
  lastError: string | null;

  // Pipeline bookkeeping (new pipeline only).
  pipelineStage?: 'draft' | 'committed';

  // Optional learning metadata.
  corrected?: string;
  alt1Natural?: string;
  alt2ClearFormal?: string;
  intentZh?: string;
  enAlternatives?: string[];
  enTemplates?: string[];
  eventIds?: string[];
  patternKeys?: string[];
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

export interface ProviderSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type UtteranceLanguageHint = 'pinyin' | 'zh' | 'en' | 'mixed' | 'unknown';

export interface ChoiceCandidate {
  // What the user likely meant (abstract).
  intentZh: string;

  // Reusable English (simple).
  enMain: string;
  enAlternatives?: string[];
  enTemplates?: string[];
}

export interface ChoiceItem {
  id: string;
  sourceApp: string | null;
  createdAt: string;
  mergedRaw: string;
  languageHint: UtteranceLanguageHint;
  fragmentIds: string[];
  candidates: ChoiceCandidate[];
  expiresAt: string;
}

export type LearningEventType = 'GrammarFix' | 'ExpressionUpgrade' | 'CN2EN';

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

export interface LearningEvent {
  id: string;
  createdAt: string;
  utteranceId: string;
  type: LearningEventType;
  before: string;
  after: string;
  teaching: Teaching;
  patternKey: string;
  macroCategory: MacroCategory;
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
  day: string; // YYYY-MM-DD
  createdAt: string;
  groups: DailyLessonGroup[];
  stealLines: string[];
}
