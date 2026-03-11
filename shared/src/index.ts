export type ProviderMode = 'local' | 'byok-remote' | 'custom-base-url';

export interface HealthStatus {
  status: 'ok';
  service: 'orchestrator-service';
  providerModes: ProviderMode[];
}

export interface LearningArtifact {
  id: string;
  sourceText: string;
  restoredText?: string | null;
  suggestion: string;
  explanation: string;
  createdAt: string;
  status?: CaptureStatus;
}

export type CaptureStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface CaptureRecord {
  id: string;
  sourceText: string;
  restoredText: string | null;
  englishText: string;
  sourceLanguage: 'chinese' | 'english' | 'mixed' | 'unknown';
  sourceApp: string | null;
  createdAt: string;
  status: CaptureStatus;
  retryCount: number;
  lastError: string | null;
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
