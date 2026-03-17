import type {
  CaptureRecord,
  ChoiceItem,
  DayDigest,
  LearningEvent,
  Pattern,
  ProviderSettings,
  StoryArtifact,
} from '../../shared/src/index';

export interface PersistedState {
  records: CaptureRecord[];
  stories: StoryArtifact[];
  dailyDigests: Record<string, DayDigest>;
  settings: ProviderSettings;

  // New pipeline state (v1). These are optional in persisted JSON and
  // defaulted on load for backward compatibility.
  choices: ChoiceItem[];
  events: LearningEvent[];
  patterns: Record<string, Pattern>;
}
