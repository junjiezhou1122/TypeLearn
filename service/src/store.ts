import type { CaptureRecord, LearningArtifact, ProviderSettings, StoryArtifact } from '../../shared/src/index';
import { buildLearningArtifact } from './coaching.js';
import { loadState, saveState } from './persistence.js';
import { generateDailyStory } from './story.js';
import { detectLanguage, isLikelyPinyin, polishEnglishText, restoreChineseFromRomanized, translateToEnglish } from './translator.js';
import type { PersistedState } from './types.js';

const maxRetries = 10; // 提高重试上限
const baseRetryDelayMs = 5000;
const mergeWindowMs = 2000;
const maxMergedLength = 100;

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
      status: record.status === 'done' || record.status === 'filtered' ? record.status : 'pending',
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
    return this.#state.records
      .filter((record) => record.status !== 'filtered')
      .map((record) => {
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
    return this.#state.records.filter((record) => record.status !== 'filtered');
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
    const cleaned = cleanCaptureInput(sourceText);
    const now = new Date().toISOString();

    if (!cleaned) {
      return {
        id: crypto.randomUUID(),
        sourceText,
        restoredText: null,
        englishText: '',
        sourceLanguage: 'unknown',
        sourceApp,
        createdAt: now,
        status: 'filtered',
        retryCount: 0,
        lastError: null,
      };
    }

    const latest = this.#state.records[0];
    if (latest && shouldMerge(latest, now)) {
      const merged = mergeCaptureText(latest.sourceText, cleaned);
      this.#state.records[0] = {
        ...latest,
        sourceText: merged,
        restoredText: null,
        englishText: 'Processing…',
        sourceLanguage: 'unknown',
        createdAt: now,
        status: 'pending',
        retryCount: 0,
        lastError: null,
      };
      await saveState(this.#state);
      this.enqueue(latest.id, true);
      return this.#state.records[0];
    }

    const record: CaptureRecord = {
      id: crypto.randomUUID(),
      sourceText: cleaned,
      restoredText: null,
      englishText: 'Processing…',
      sourceLanguage: 'unknown',
      sourceApp,
      createdAt: now,
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
    const story = await generateDailyStory(
      this.#state.records.filter((record) => record.status !== 'filtered'),
      this.#state.settings
    );
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

    let record = this.#state.records[recordIndex];
    if (record.status === 'done') return;

    const cleaned = cleanCaptureInput(record.sourceText);
    if (!cleaned) {
      this.#state.records.splice(recordIndex, 1);
      await saveState(this.#state);
      return;
    }

    if (cleaned !== record.sourceText) {
      record = { ...record, sourceText: cleaned };
      this.#state.records[recordIndex] = record;
    }

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

function cleanCaptureInput(sourceText: string): string | null {
  let cleaned = sourceText.trim();
  if (!cleaned) return null;
  cleaned = stripToneNumbers(cleaned);
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (shouldDropShort(cleaned)) return null;
  return cleaned;
}

function stripToneNumbers(sourceText: string): string {
  return sourceText
    .replace(/([A-Za-z])[1-5]/g, '$1')
    .replace(/[1-5]([A-Za-z])/g, '$1');
}

function shouldDropShort(sourceText: string): boolean {
  if (/[\u4e00-\u9fff]/.test(sourceText)) return false;
  if (sourceText.length < 3) return true;
  if (sourceText.length === 3) {
    const hasVowel = /[aeiou]/i.test(sourceText);
    const hasSpace = /\s/.test(sourceText);
    return !hasVowel || !hasSpace;
  }
  return false;
}

function shouldMerge(record: CaptureRecord, nowIso: string): boolean {
  if (record.status === 'done' || record.status === 'failed' || record.status === 'filtered') return false;
  const lastTime = Date.parse(record.createdAt);
  const nowTime = Date.parse(nowIso);
  if (Number.isNaN(lastTime) || Number.isNaN(nowTime)) return false;
  return nowTime - lastTime <= mergeWindowMs;
}

function mergeCaptureText(previous: string, next: string): string {
  const needsSpace = previous.length > 0 && !/[\s，。！？,.!?]$/.test(previous);
  const merged = `${previous}${needsSpace ? ' ' : ''}${next}`.trim();
  if (merged.length <= maxMergedLength) return merged;
  return merged.slice(0, maxMergedLength).trim();
}
