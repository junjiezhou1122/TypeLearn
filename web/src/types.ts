export type ArtifactCategory = 'Fix' | 'Better' | 'Style';
export type ArtifactType = 'Refinement' | 'Expression';

export interface LearningArtifact {
  id: string;
  type: ArtifactType;
  category?: ArtifactCategory;
  
  // English Refinement specific
  sourceText: string;
  suggestion: string;
  explanation: string;
  
  // Chinese Expression specific
  intentText?: string; // What you wanted to say (Chinese)
  alternatives?: string[];
  usageContext?: string;
  keyPhrases?: string[];
  
  createdAt: string;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'filtered';
  isSaved?: boolean;
}

export interface PatternArtifact {
  id: string;
  title: string;
  description: string;
  examples: string[];
  frequency: number;
  createdAt: string;
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
