export interface LearningArtifact {
  id: string;
  sourceText: string;
  restoredText?: string | null;
  suggestion: string;
  explanation: string;
  createdAt: string;
  status?: 'pending' | 'processing' | 'done' | 'failed' | 'filtered';
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
