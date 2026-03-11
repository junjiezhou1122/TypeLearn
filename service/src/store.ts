import type { CaptureRecord, LearningArtifact, ProviderSettings, StoryArtifact } from '../../shared/src/index';
import { buildLearningArtifact } from './coaching.js';
import { loadState, saveState } from './persistence.js';
import { generateDailyStory } from './story.js';
import { translateToEnglish } from './translator.js';
import type { PersistedState } from './types.js';

export class LearningStore {
  #state: PersistedState = {
    records: [],
    stories: [],
    settings: {
      baseUrl: '',
      apiKey: '',
      model: 'gpt-4.1-mini',
    },
  };

  async init(): Promise<void> {
    this.#state = await loadState();
  }

  listArtifacts(): LearningArtifact[] {
    return this.#state.records.map((record) => {
      const coaching = buildLearningArtifact(record.englishText);
      return {
        ...coaching,
        id: record.id,
        sourceText: record.sourceText,
        createdAt: record.createdAt,
      };
    });
  }

  listRecords(): CaptureRecord[] {
    return [...this.#state.records];
  }

  listStories(): StoryArtifact[] {
    return [...this.#state.stories];
  }

  getSettings(): ProviderSettings {
    return this.#state.settings;
  }

  async updateSettings(settings: ProviderSettings): Promise<ProviderSettings> {
    this.#state.settings = settings;
    await saveState(this.#state);
    return settings;
  }

  async addRecord(sourceText: string, sourceApp: string | null): Promise<CaptureRecord> {
    const translation = await translateToEnglish(sourceText, this.#state.settings);

    const record: CaptureRecord = {
      id: crypto.randomUUID(),
      sourceText,
      englishText: translation.englishText,
      sourceLanguage: translation.sourceLanguage,
      sourceApp,
      createdAt: new Date().toISOString(),
    };

    this.#state.records.unshift(record);
    await saveState(this.#state);
    return record;
  }

  async deleteRecord(id: string): Promise<boolean> {
    const nextRecords = this.#state.records.filter((record) => record.id !== id);
    const changed = nextRecords.length !== this.#state.records.length;

    if (!changed) {
      return false;
    }

    this.#state.records = nextRecords;
    await saveState(this.#state);
    return true;
  }

  async generateStory(): Promise<StoryArtifact> {
    const story = await generateDailyStory(this.#state.records, this.#state.settings);
    this.#state.stories.unshift(story);
    await saveState(this.#state);
    return story;
  }

  add(sourceText: string): LearningArtifact {
    const artifact = buildLearningArtifact(sourceText);

    this.#state.records.unshift({
      id: artifact.id,
      sourceText,
      englishText: artifact.suggestion,
      sourceLanguage: 'english',
      sourceApp: null,
      createdAt: artifact.createdAt,
    });
    return artifact;
  }

  list(): LearningArtifact[] {
    return this.listArtifacts();
  }
}
