import type {
  CaptureRecord,
  ChoiceItem,
  LearningEvent,
  Pattern,
  ProviderSettings,
  StoryArtifact,
} from '../../shared/src/index';

export interface PersistedState {
  records: CaptureRecord[];
  stories: StoryArtifact[];
  settings: ProviderSettings;

  // New pipeline state (v1). These are optional in persisted JSON and
  // defaulted on load for backward compatibility.
  choices: ChoiceItem[];
  events: LearningEvent[];
  patterns: Record<string, Pattern>;
}
