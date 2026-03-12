import type { CaptureRecord, LearningArtifact, ProviderSettings, StoryArtifact } from '../../shared/src/index';
import { buildLearningArtifact } from './coaching.js';
import { loadState, saveState } from './persistence.js';
import { generateDailyStory } from './story.js';
import { detectLanguage, isLikelyPinyin, polishEnglishText, restoreChineseFromRomanized, translateToEnglish } from './translator.js';
import type { PersistedState } from './types.js';

const maxRetries = 10; // 提高重试上限
const baseRetryDelayMs = 5000;

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

  #queue: string[] = [];
  #isProcessing = false;

  async init(): Promise<void> {
    this.#state = await loadState();
    
    // 初始化时，将所有非 done 的记录重置为 pending
    this.#state.records = this.#state.records.map((record) => ({
      ...record,
      status: record.status === 'done' ? 'done' : 'pending',
    }));
    
    await saveState(this.#state);

    // 启动后台队列处理器
    this.startQueueProcessor();
    
    // 启动定期检查器（Watchdog），每 30 秒检查一次是否有遗漏或失败的任务
    setInterval(() => this.watchdog(), 30000);
  }

  private watchdog(): void {
    const pendingIds = this.#state.records
      .filter(r => (r.status === 'pending' || r.status === 'failed') && !this.#queue.includes(r.id))
      .map(r => r.id);
    
    if (pendingIds.length > 0) {
      console.log(`[Queue] Watchdog found ${pendingIds.length} items to process.`);
      pendingIds.forEach(id => this.enqueue(id));
    }
  }

  private enqueue(id: string, priority = false): void {
    if (this.#queue.includes(id)) return;
    if (priority) {
      this.#queue.unshift(id);
    } else {
      this.#queue.push(id);
    }
    this.startQueueProcessor();
  }

  private async startQueueProcessor(): Promise<void> {
    if (this.#isProcessing || this.#queue.length === 0) return;
    
    this.#isProcessing = true;
    while (this.#queue.length > 0) {
      const recordId = this.#queue.shift();
      if (recordId) {
        await this.processRecord(recordId);
      }
    }
    this.#isProcessing = false;
  }

  async retry(recordId: string): Promise<boolean> {
    const recordIndex = this.#state.records.findIndex((r) => r.id === recordId);
    if (recordIndex === -1) return false;
    
    const record = this.#state.records[recordIndex];
    this.#state.records[recordIndex] = { ...record, status: 'pending', retryCount: 0 };
    await saveState(this.#state);
    this.enqueue(recordId);
    return true;
  }

  listArtifacts(): LearningArtifact[] {
    return this.#state.records.map((record) => {
      if (record.status !== 'done') {
        return {
          id: record.id,
          sourceText: record.sourceText,
          restoredText: record.restoredText ?? null,
          suggestion: record.status === 'failed' ? 'Waiting for network…' : 'Processing…',
          explanation: record.status === 'failed'
            ? 'TypeLearn will automatically retry this when the connection is stable.'
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
    this.enqueue(record.id, true);
    return record;
  }

  async deleteRecord(id: string): Promise<boolean> {
    const nextRecords = this.#state.records.filter((record) => record.id !== id);
    if (nextRecords.length === this.#state.records.length) return false;
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

  private async processRecord(recordId: string): Promise<void> {
    let recordIndex = this.#state.records.findIndex((r) => r.id === recordId);
    if (recordIndex === -1) return;

    const record = this.#state.records[recordIndex];
    if (record.status === 'done') return;

    this.#state.records[recordIndex] = { ...record, status: 'processing' };
    await saveState(this.#state);

    try {
      const sourceLanguage = detectLanguage(record.sourceText);

      if (sourceLanguage === 'english' && isLikelyEnglishSentence(record.sourceText)) {
        const polished = await polishEnglishText(record.sourceText, this.#state.settings);

        recordIndex = this.#state.records.findIndex((item) => item.id === recordId);
        if (recordIndex === -1) return;

        this.#state.records[recordIndex] = {
          ...record,
          restoredText: null,
          englishText: polished,
          sourceLanguage: 'english',
          status: 'done',
          lastError: null,
        };
        await saveState(this.#state);
        return;
      }

      const restoration = await restoreChineseFromRomanized(record.sourceText, this.#state.settings);
      const textForTranslation = restoration.didRestore ? restoration.restoredText : record.sourceText;
      const translation = await translateToEnglish(textForTranslation, this.#state.settings);

      recordIndex = this.#state.records.findIndex((item) => item.id === recordId);
      if (recordIndex === -1) return;

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

      const nextRetry = record.retryCount + 1;
      // 即使失败也保持 pending 状态，除非重试次数过多
      const status = nextRetry >= maxRetries ? 'failed' : 'pending';
      
      this.#state.records[recordIndex] = {
        ...record,
        retryCount: nextRetry,
        status,
        lastError: String(error),
      };
      await saveState(this.#state);
      
      // 如果失败了，等待一段时间后再让 watchdog 捡起来
      console.error(`[Queue] Failed to process ${recordId}, attempt ${nextRetry}. Error: ${error}`);
    }
  }
}

function isLikelyEnglishSentence(sourceText: string): boolean {
  const lower = sourceText.toLowerCase();
  const tokens = lower.split(/[^a-z]+/).filter(Boolean);
  if (tokens.length < 2) return false;
  const common = new Set(['the', 'and', 'to', 'of', 'is', 'are', 'i', 'you', 'we', 'they', 'he', 'she', 'it', 'my', 'your', 'for', 'in', 'on', 'with', 'at']);
  return tokens.some((token) => common.has(token));
}
