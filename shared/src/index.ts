export type ProviderMode = 'local' | 'byok-remote' | 'custom-base-url';

export interface HealthStatus {
  status: 'ok';
  service: 'orchestrator-service';
  providerModes: ProviderMode[];
}

export interface LearningArtifact {
  id: string;
  sourceText: string;
  suggestion: string;
  explanation: string;
  createdAt: string;
}

export interface CaptureRecord {
  id: string;
  sourceText: string;
  englishText: string;
  sourceLanguage: 'chinese' | 'english' | 'mixed' | 'unknown';
  sourceApp: string | null;
  createdAt: string;
}

export interface StoryArtifact {
  id: string;
  title: string;
  story: string;
  createdAt: string;
  sourceRecordIds: string[];
}

export interface ProviderSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}
