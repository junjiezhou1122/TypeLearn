import type { CaptureRecord, LearningArtifact, ProviderSettings, StoryArtifact } from '../../shared/src/index';
import { buildLearningArtifact } from './coaching.js';
import { loadState, saveState } from './persistence.js';
import { generateDailyStory } from './story.js';
import { isLikelyPinyin, restoreChineseFromRomanized, translateToEnglish } from './translator.js';
import type { PersistedState } from './types.js';

const maxRetries = 3;
const baseRetryDelayMs = 1500;

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
    this.#state.records = this.#state.records.map((record) => ({
      ...record,
      status: record.status === 'processing' ? 'pending' : record.status,
    }));
    await saveState(this.#state);
    for (const record of this.#state.records) {
      if (record.status === 'pending' && record.retryCount < maxRetries) {
        this.scheduleRetry(record.id, record.retryCount);
      }
    }
  }

  listArtifacts(): LearningArtifact[] {
    return this.#state.records.map((record) => {
      if (record.status !== 'done') {
        return {
          id: record.id,
          sourceText: record.sourceText,
          restoredText: record.restoredText ?? null,
          suggestion: record.status === 'failed' ? 'Processing failed' : 'Processing…',
          explanation: record.status === 'failed'
            ? 'TypeLearn will retry this capture in the background.'
            : 'TypeLearn is converting your capture in the background.',
          createdAt: record.createdAt,
          status: record.status,
        };
      }

      const coaching = buildLearningArtifact(record.englishText);
      return {
        ...coaching,
        id: record.id,
        sourceText: record.sourceText,
        restoredText: record.restoredText ?? null,
        createdAt: record.createdAt,
        status: record.status,
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

  async addRecord(sourceText: string, sourceApp: string | null, settingsOverride?: ProviderSettings): Promise<CaptureRecord> {
    const record: CaptureRecord = {
      id: crypto.randomUUID(),
      sourceText,
      restoredText: null,
      englishText: 'Processing…',
      sourceLanguage: 'unknown',
      sourceApp,
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
      lastError: null,
    };

    this.#state.records.unshift(record);
    await saveState(this.#state);
    this.processRecord(record.id, settingsOverride);
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
      restoredText: null,
      englishText: artifact.suggestion,
      sourceLanguage: 'english',
      sourceApp: null,
      createdAt: artifact.createdAt,
      status: 'done',
      retryCount: 0,
      lastError: null,
    });
    return artifact;
  }

  list(): LearningArtifact[] {
    return this.listArtifacts();
  }

  private scheduleRetry(recordId: string, retryCount: number): void {
    const delay = baseRetryDelayMs * Math.pow(2, retryCount);
    setTimeout(() => {
      void this.processRecord(recordId);
    }, delay);
  }

  private async processRecord(recordId: string, settingsOverride?: ProviderSettings): Promise<void> {
    let recordIndex = this.#state.records.findIndex((record) => record.id === recordId);
    if (recordIndex === -1) return;

    let record = this.#state.records[recordIndex];
    if (record.status === 'processing') return;

    this.#state.records[recordIndex] = { ...record, status: 'processing' };
    await saveState(this.#state);

    const effectiveSettings = settingsOverride ?? this.#state.settings;

    try {
      const restoration = await restoreChineseFromRomanized(record.sourceText, effectiveSettings);
      if (isLikelyPinyin(record.sourceText) && !restoration.didRestore) {
        throw new Error('restoration_failed');
      }

      const textForTranslation = restoration.didRestore ? restoration.restoredText : record.sourceText;
      const translation = await translateToEnglish(textForTranslation, effectiveSettings);

      recordIndex = this.#state.records.findIndex((item) => item.id === recordId);
      if (recordIndex === -1) return;
      record = this.#state.records[recordIndex];

      this.#state.records[recordIndex] = {
        ...record,
        restoredText: restoration.didRestore ? restoration.restoredText : null,
        englishText: translation.englishText,
        sourceLanguage: translation.sourceLanguage,
        status: 'done',
        lastError: null,
      };
      await saveState(this.#state);
    } catch (error) {
      recordIndex = this.#state.records.findIndex((item) => item.id === recordId);
      if (recordIndex === -1) return;
      record = this.#state.records[recordIndex];

      const nextRetry = record.retryCount + 1;
      const status = nextRetry >= maxRetries ? 'failed' : 'pending';
      this.#state.records[recordIndex] = {
        ...record,
        retryCount: nextRetry,
        status,
        lastError: String(error),
      };
      await saveState(this.#state);

      if (status === 'pending') {
        this.scheduleRetry(recordId, nextRetry);
      }
    }
  }
}
