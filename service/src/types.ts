import type { CaptureRecord, ProviderSettings, StoryArtifact } from '../../shared/src/index';

export interface PersistedState {
  records: CaptureRecord[];
  stories: StoryArtifact[];
  settings: ProviderSettings;
}
