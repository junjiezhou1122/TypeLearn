import type {
  CaptureRecord,
  ChoiceCandidate,
  ChoiceItem,
  DailyLesson,
  LearningArtifact,
  Pattern,
  ProviderSettings,
  StoryArtifact,
  UtteranceLanguageHint,
} from '../../shared/src/index';
import { buildLearningArtifact } from './coaching.js';
import { mergeAndFilter } from './llm.js';
import { extractLearningCn2En, extractLearningEnglish } from './extract_learning.js';
import { addEventsToPatterns, buildStealLines, groupPatterns } from './patterns.js';
import { loadState, saveState } from './persistence.js';
import { generateDailyStory } from './story.js';
import {
  detectLanguage,
  isLikelyPinyin,
  polishEnglishText,
  restoreChineseFromRomanized,
  translateToEnglish,
} from './translator.js';
import type { PersistedState } from './types.js';

const maxRetries = 10;

// Stream assembly parameters (v1 defaults).
const commitDelayMs = 20_000; // L=20s
const tailWindowMs = 90_000; // W=90s
const assembleDebounceMs = 4_000;
const assembleTickMs = 5_000;
const choiceTtlMs = 60 * 60 * 1000;

type Fragment = {
  id: string;
  createdAt: string; // ISO
  sourceApp: string | null;
  text: string;
};

type StreamState = {
  app: string | null;
  tailFragments: Fragment[];

  // Placeholder persisted record (draft-only; removed on service restart).
  draftRecordId: string | null;

  lastFragmentAtMs: number;
  lastCommittedRaw?: string;

  assembleTimer: NodeJS.Timeout | null;
  assembling: boolean;
  needsAssemble: boolean;
};

type Assignment = {
  fragmentIds: string[];
  action: 'KEEP' | 'DROP' | 'CHOICE';
  languageHint?: UtteranceLanguageHint;
  mergedRaw?: string;
  candidates?: ChoiceCandidate[];
  reason?: string;
};

export class LearningStore {
  #state: PersistedState = {
    records: [],
    stories: [],
    settings: {
      baseUrl: '',
      apiKey: '',
      model: 'gpt-4.1-mini',
    },
    choices: [],
    events: [],
    patterns: {},
  };

  #queue: string[] = [];
  #isProcessing = false;

  #streams = new Map<string, StreamState>();

  async init(): Promise<void> {
    this.#state = await loadState();

    // Draft records are ephemeral (we don't persist fragment buffers). Drop them
    // on startup to avoid stuck "pending" items after a restart.
    this.#state.records = this.#state.records.filter((record) => record.pipelineStage !== 'draft');

    // Clean up expired choices.
    this.cleanupExpiredChoices();

    // Normalize statuses: anything non-terminal gets re-queued later.
    this.#state.records = this.#state.records.map((record) => ({
      ...record,
      status: record.status === 'done' || record.status === 'filtered' ? record.status : 'pending',
    }));

    await saveState(this.#state);

    this.startQueueProcessor();

    setInterval(() => this.watchdog(), 30_000);
    setInterval(() => this.cleanupExpiredChoices(), 60_000);
    setInterval(() => this.assembleAllStreams(), assembleTickMs);
  }

  private watchdog(): void {
    const pendingIds = this.#state.records
      .filter(
        (r) =>
          (r.status === 'pending' || r.status === 'failed') &&
          r.pipelineStage !== 'draft' &&
          !this.#queue.includes(r.id)
      )
      .map((r) => r.id);

    if (pendingIds.length > 0) {
      console.log(`[Queue] Watchdog found ${pendingIds.length} items to process.`);
      pendingIds.forEach((id) => this.enqueue(id));
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
      .map((record) => this.toLearningArtifact(record));
  }

  // ---- CHOICE API helpers ----

  listChoices(): ChoiceItem[] {
    this.cleanupExpiredChoices();
    return [...this.#state.choices];
  }

  async selectChoice(choiceId: string, index: number): Promise<CaptureRecord | null> {
    this.cleanupExpiredChoices();

    const choiceIndex = this.#state.choices.findIndex((c) => c.id === choiceId);
    if (choiceIndex === -1) return null;

    const choice = this.#state.choices[choiceIndex];
    const candidate = choice.candidates[index];
    if (!candidate) return null;

    // Remove choice first (prevents double-select).
    this.#state.choices.splice(choiceIndex, 1);

    const nowIso = new Date().toISOString();

    const restoration =
      choice.languageHint === 'pinyin'
        ? await restoreChineseFromRomanized(choice.mergedRaw, this.#state.settings)
        : { restoredText: choice.mergedRaw, didRestore: false };

    const restoredText = restoration.didRestore ? restoration.restoredText : null;
    const sourceLanguage = restoredText
      ? detectLanguage(restoredText)
      : choice.languageHint === 'zh'
        ? 'chinese'
        : choice.languageHint === 'en'
          ? 'english'
          : detectLanguage(choice.mergedRaw);

    // NOTE: selecting a CHOICE should preserve the original capture (pinyin/raw)
    // while committing the chosen English immediately.
    const record: CaptureRecord = {
      id: crypto.randomUUID(),
      sourceText: choice.mergedRaw,
      restoredText,
      englishText: candidate.enMain,
      sourceLanguage,
      sourceApp: choice.sourceApp,
      createdAt: nowIso,
      status: 'done',
      retryCount: 0,
      lastError: null,
      pipelineStage: 'committed',
      intentZh: candidate.intentZh,
      enAlternatives: candidate.enAlternatives,
      enTemplates: candidate.enTemplates,
    };

    this.#state.records.unshift(record);
    await saveState(this.#state);

    return record;
  }

  async deleteChoice(choiceId: string): Promise<boolean> {
    const next = this.#state.choices.filter((c) => c.id !== choiceId);
    if (next.length === this.#state.choices.length) return false;
    this.#state.choices = next;
    await saveState(this.#state);
    return true;
  }

  listRecords(): CaptureRecord[] {
    return this.#state.records.filter((record) => record.status !== 'filtered');
  }

  // ---- Patterns / daily lesson ----

  getPatterns(day: string): Pattern[] {
    // For v1 we keep counts on patterns and return them (sorted).
    const isToday = day === new Date().toISOString().slice(0, 10);
    const list = Object.values(this.#state.patterns);
    return list.sort((a, b) => {
      const aScore = isToday ? a.counts.today : a.counts.total;
      const bScore = isToday ? b.counts.today : b.counts.total;
      return bScore - aScore;
    });
  }

  getDailyLesson(day: string): DailyLesson {
    const patterns = this.getPatterns(day);
    const groups = groupPatterns(patterns);
    const stealLines = buildStealLines(patterns, 12);

    return {
      day,
      createdAt: new Date().toISOString(),
      groups,
      stealLines,
    };
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

  // Fragment ingest (backward compatible API).
  async addRecord(sourceText: string, sourceApp: string | null, _settingsOverride?: ProviderSettings): Promise<CaptureRecord> {
    const cleaned = cleanCaptureInput(sourceText);
    const now = new Date();
    const nowIso = now.toISOString();

    if (!cleaned) {
      return {
        id: crypto.randomUUID(),
        sourceText,
        restoredText: null,
        englishText: '',
        sourceLanguage: 'unknown',
        sourceApp,
        createdAt: nowIso,
        status: 'filtered',
        retryCount: 0,
        lastError: null,
        pipelineStage: 'draft',
      };
    }

    const normalized = hardNormalize(cleaned);
    if (!normalized) {
      return {
        id: crypto.randomUUID(),
        sourceText,
        restoredText: null,
        englishText: '',
        sourceLanguage: 'unknown',
        sourceApp,
        createdAt: nowIso,
        status: 'filtered',
        retryCount: 0,
        lastError: null,
        pipelineStage: 'draft',
      };
    }

    const fragment: Fragment = {
      id: crypto.randomUUID(),
      createdAt: nowIso,
      sourceApp,
      text: normalized,
    };

    const stream = this.getStream(sourceApp);
    stream.tailFragments.push(fragment);
    stream.lastFragmentAtMs = now.getTime();

    // Keep only last W seconds of fragments.
    stream.tailFragments = pruneByAge(stream.tailFragments, now.getTime(), tailWindowMs);

    const preview = buildTailPreview(stream.tailFragments);
    const draftRecord = this.upsertDraftRecord(stream, preview, nowIso);

    this.scheduleAssemble(sourceApp);

    await saveState(this.#state);
    return draftRecord;
  }

  async deleteRecord(id: string): Promise<boolean> {
    const nextRecords = this.#state.records.filter((record) => record.id !== id);
    if (nextRecords.length === this.#state.records.length) return false;
    this.#state.records = nextRecords;

    // If a stream was pointing at this draft record, detach it.
    for (const stream of this.#streams.values()) {
      if (stream.draftRecordId === id) {
        stream.draftRecordId = null;
      }
    }

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

  // Local-only helper used by tests.
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
      pipelineStage: 'committed',
    });
    return artifact;
  }

  list(): LearningArtifact[] {
    return this.listArtifacts();
  }

  private toLearningArtifact(record: CaptureRecord): LearningArtifact {
    if (record.status !== 'done') {
      return {
        id: record.id,
        sourceText: record.sourceText,
        restoredText: record.restoredText ?? null,
        suggestion: record.status === 'failed' ? 'Waiting for network…' : 'Processing…',
        explanation:
          record.status === 'failed'
            ? 'TypeLearn will automatically retry this when the connection is stable.'
            : record.pipelineStage === 'draft'
              ? 'TypeLearn is assembling your typing into stable utterances.'
              : 'TypeLearn is converting your capture in the background.',
        createdAt: record.createdAt,
        status: record.status,
        corrected: record.corrected,
        alt1Natural: record.alt1Natural,
        alt2ClearFormal: record.alt2ClearFormal,
        intentZh: record.intentZh,
        enAlternatives: record.enAlternatives,
        enTemplates: record.enTemplates,
        patternKeys: record.patternKeys,
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
      corrected: record.corrected,
      alt1Natural: record.alt1Natural,
      alt2ClearFormal: record.alt2ClearFormal,
      intentZh: record.intentZh,
      enAlternatives: record.enAlternatives,
      enTemplates: record.enTemplates,
      patternKeys: record.patternKeys,
    };
  }

  private getStream(sourceApp: string | null): StreamState {
    const key = streamKey(sourceApp);
    const existing = this.#streams.get(key);
    if (existing) return existing;

    const stream: StreamState = {
      app: sourceApp,
      tailFragments: [],
      draftRecordId: null,
      lastFragmentAtMs: 0,
      assembleTimer: null,
      assembling: false,
      needsAssemble: false,
    };
    this.#streams.set(key, stream);
    return stream;
  }

  private scheduleAssemble(sourceApp: string | null): void {
    const stream = this.getStream(sourceApp);
    if (stream.assembleTimer) {
      clearTimeout(stream.assembleTimer);
      stream.assembleTimer = null;
    }

    stream.assembleTimer = setTimeout(() => {
      void this.assembleStream(sourceApp);
    }, assembleDebounceMs);
  }

  private assembleAllStreams(): void {
    for (const stream of this.#streams.values()) {
      void this.assembleStream(stream.app);
    }
  }

  private async assembleStream(sourceApp: string | null): Promise<void> {
    const stream = this.getStream(sourceApp);
    if (stream.assembling) {
      stream.needsAssemble = true;
      return;
    }

    stream.assembling = true;
    stream.needsAssemble = false;

    try {
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      stream.tailFragments = pruneByAge(stream.tailFragments, nowMs, tailWindowMs);

      if (stream.tailFragments.length === 0) {
        this.removeDraftRecord(stream);
        await saveState(this.#state);
        return;
      }

      const idleMs = stream.lastFragmentAtMs ? nowMs - stream.lastFragmentAtMs : 0;
      const providerConfigured = Boolean(this.#state.settings.baseUrl && this.#state.settings.model);

      const pinyinPresent = stream.tailFragments.some((f) => isLikelyPinyin(f.text));
      const fragmentCount = stream.tailFragments.length;
      const shouldUseLlm =
        providerConfigured &&
        (idleMs >= assembleDebounceMs || fragmentCount >= 10 || (pinyinPresent && fragmentCount >= 4));

      const assignments: Assignment[] = shouldUseLlm
        ? await this.llmAssignUtterances(stream, nowMs)
        : ruleAssignUtterances(stream.tailFragments, providerConfigured);

      const consumedFragmentIds = new Set<string>();
      let didMutate = false;

      // Apply CHOICE/DROP first (consume fragments).
      for (const item of assignments) {
        if (item.action === 'DROP') {
          item.fragmentIds.forEach((id) => consumedFragmentIds.add(id));
        }

        if (item.action === 'CHOICE') {
          if (!providerConfigured || !item.candidates?.length) {
            item.fragmentIds.forEach((id) => consumedFragmentIds.add(id));
            continue;
          }

          const mergedRaw = item.mergedRaw ?? mergeFragmentsText(stream.tailFragments, item.fragmentIds);
          const isAmbiguousPinyin = item.languageHint === 'pinyin' || isLikelyPinyin(mergedRaw);
          if (!isAmbiguousPinyin) {
            item.fragmentIds.forEach((id) => consumedFragmentIds.add(id));
            continue;
          }

          const filteredCandidates = await filterChoiceCandidates(mergedRaw, item.candidates, this.#state.settings);
          if (!filteredCandidates.length) {
            item.fragmentIds.forEach((id) => consumedFragmentIds.add(id));
            continue;
          }

          const choice: ChoiceItem = {
            id: crypto.randomUUID(),
            sourceApp,
            createdAt: nowIso,
            mergedRaw,
            languageHint: item.languageHint ?? 'pinyin',
            fragmentIds: [...item.fragmentIds],
            candidates: filteredCandidates.slice(0, 3),
            expiresAt: new Date(nowMs + choiceTtlMs).toISOString(),
          };

          this.#state.choices.unshift(choice);
          didMutate = true;
          item.fragmentIds.forEach((id) => consumedFragmentIds.add(id));
        }
      }

      // Determine committable KEEP utterances.
      const watermarkMs = nowMs - commitDelayMs;
      const keepItems = assignments.filter((u) => u.action === 'KEEP');

      // Commit in chronological order (older first).
      const committable = keepItems
        .map((u) => ({
          ...u,
          startAtMs: minCreatedAtMs(stream.tailFragments, u.fragmentIds),
          endAtMs: maxCreatedAtMs(stream.tailFragments, u.fragmentIds),
        }))
        .filter((u) => u.endAtMs !== null && u.endAtMs < watermarkMs)
        .sort((a, b) => (a.endAtMs ?? 0) - (b.endAtMs ?? 0));

      for (const utterance of committable) {
        const mergedRaw = utterance.mergedRaw ?? mergeFragmentsText(stream.tailFragments, utterance.fragmentIds);
        const languageHint = utterance.languageHint ?? guessLanguageHint(mergedRaw);

        // If we can't send to a provider and this looks like pinyin noise, drop it.
        if (!providerConfigured && languageHint === 'pinyin') {
          utterance.fragmentIds.forEach((id) => consumedFragmentIds.add(id));
          continue;
        }

        const record: CaptureRecord = {
          id: crypto.randomUUID(),
          sourceText: mergedRaw,
          restoredText: null,
          englishText: 'Processing…',
          sourceLanguage: detectLanguage(mergedRaw),
          sourceApp,
          createdAt: new Date(utterance.endAtMs ?? nowMs).toISOString(),
          status: 'pending',
          retryCount: 0,
          lastError: null,
          pipelineStage: 'committed',
        };

        this.#state.records.unshift(record);
        didMutate = true;
        stream.lastCommittedRaw = mergedRaw;
        utterance.fragmentIds.forEach((id) => consumedFragmentIds.add(id));

        this.enqueue(record.id, true);
      }

      if (consumedFragmentIds.size > 0) {
        stream.tailFragments = stream.tailFragments.filter((f) => !consumedFragmentIds.has(f.id));
        didMutate = true;
      }

      // Update (or remove) the placeholder draft record.
      const preview = buildTailPreview(stream.tailFragments);
      if (preview) {
        this.upsertDraftRecord(stream, preview, nowIso);
        didMutate = true;
      } else {
        if (this.removeDraftRecord(stream)) {
          didMutate = true;
        }
      }

      if (didMutate) {
        await saveState(this.#state);
      }
    } catch (error) {
      console.error('[assemble] failed:', error);
    } finally {
      stream.assembling = false;
      if (stream.needsAssemble) {
        void this.assembleStream(sourceApp);
      }
    }
  }

  private async llmAssignUtterances(stream: StreamState, nowMs: number): Promise<Assignment[]> {
    const now = new Date(nowMs);
    const fragments = stream.tailFragments
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map((f) => ({
        id: f.id,
        t: formatRelativeSeconds(nowMs - Date.parse(f.createdAt)),
        text: f.text,
      }));

    const output = await mergeAndFilter(this.#state.settings, {
      contextOnly: stream.lastCommittedRaw,
      fragments,
      rules: {
        strictFilter: true,
        choiceCandidates: 3,
        storySafe: true,
      },
    });

    // Ensure no fragment id appears twice.
    const seen = new Set<string>();
    const safe: Assignment[] = [];

    for (const u of output.utterances) {
      const unique = u.fragmentIds.filter((id) => !seen.has(id));
      if (!unique.length) continue;
      unique.forEach((id) => seen.add(id));
      safe.push({
        fragmentIds: unique,
        action: u.action,
        languageHint: u.languageHint,
        mergedRaw: u.mergedRaw,
        candidates: u.candidates,
        reason: u.reason,
      });
    }

    return safe;
  }

  private upsertDraftRecord(stream: StreamState, preview: string, nowIso: string): CaptureRecord {
    const existingId = stream.draftRecordId;

    if (existingId) {
      const index = this.#state.records.findIndex((r) => r.id === existingId);
      if (index !== -1) {
        const current = this.#state.records[index];
        const updated: CaptureRecord = {
          ...current,
          sourceText: preview,
          restoredText: null,
          englishText: 'Assembling…',
          sourceLanguage: 'unknown',
          sourceApp: stream.app,
          createdAt: nowIso,
          status: 'pending',
          retryCount: 0,
          lastError: null,
          pipelineStage: 'draft',
        };

        // Move to front.
        this.#state.records.splice(index, 1);
        this.#state.records.unshift(updated);
        return updated;
      }
    }

    const record: CaptureRecord = {
      id: crypto.randomUUID(),
      sourceText: preview,
      restoredText: null,
      englishText: 'Assembling…',
      sourceLanguage: 'unknown',
      sourceApp: stream.app,
      createdAt: nowIso,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      pipelineStage: 'draft',
    };

    stream.draftRecordId = record.id;
    this.#state.records.unshift(record);
    return record;
  }

  private removeDraftRecord(stream: StreamState): boolean {
    const id = stream.draftRecordId;
    if (!id) return false;

    const next = this.#state.records.filter((r) => r.id !== id);
    if (next.length === this.#state.records.length) {
      stream.draftRecordId = null;
      return false;
    }

    this.#state.records = next;
    stream.draftRecordId = null;
    return true;
  }

  private cleanupExpiredChoices(): void {
    const nowMs = Date.now();
    const next = this.#state.choices.filter((choice) => Date.parse(choice.expiresAt) > nowMs);
    this.#state.choices = next;
  }

  private async processRecord(recordId: string): Promise<void> {
    let recordIndex = this.#state.records.findIndex((r) => r.id === recordId);
    if (recordIndex === -1) return;

    let record = this.#state.records[recordIndex];
    if (record.status === 'done' || record.pipelineStage === 'draft') return;

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

      const providerConfigured = Boolean(this.#state.settings.baseUrl && this.#state.settings.model);

      if (sourceLanguage === 'english' && isLikelyEnglishSentence(record.sourceText)) {
        if (providerConfigured) {
          const extracted = await extractLearningEnglish(this.#state.settings, { text: record.sourceText });

          recordIndex = this.#state.records.findIndex((item) => item.id === recordId);
          if (recordIndex === -1) return;

          const rewrite = extracted.rewrite;
          const corrected = rewrite?.corrected?.trim() || record.sourceText;
          const alt1Natural = rewrite?.alt1Natural?.trim() || corrected;
          const alt2ClearFormal = rewrite?.alt2ClearFormal?.trim() || corrected;

          const createdAt = new Date().toISOString();
          const newEvents = extracted.events.map((ev) => ({
            ...ev,
            id: crypto.randomUUID(),
            createdAt,
            utteranceId: record.id,
          }));

          addEventsToPatterns(this.#state, newEvents);

          this.#state.records[recordIndex] = {
            ...record,
            restoredText: null,
            englishText: corrected,
            corrected,
            alt1Natural,
            alt2ClearFormal,
            sourceLanguage: 'english',
            status: 'done',
            lastError: null,
            eventIds: newEvents.map((e) => e.id),
            patternKeys: newEvents.map((e) => e.patternKey),
          };

          await saveState(this.#state);
          return;
        }

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
      const textZhOrRaw = restoration.didRestore ? restoration.restoredText : record.sourceText;
      const hasChinese = /[\u4e00-\u9fff]/.test(textZhOrRaw);

      if (providerConfigured) {
        const cn2en = await extractLearningCn2En(this.#state.settings, { textZhOrPinyin: textZhOrRaw });

        recordIndex = this.#state.records.findIndex((item) => item.id === recordId);
        if (recordIndex === -1) return;

        const enMain = cn2en.enMain?.trim() || `[Translation pending] ${textZhOrRaw}`;

        const createdAt = new Date().toISOString();
        const newEvents = cn2en.events.map((ev) => ({
          ...ev,
          id: crypto.randomUUID(),
          createdAt,
          utteranceId: record.id,
        }));

        addEventsToPatterns(this.#state, newEvents);

        this.#state.records[recordIndex] = {
          ...record,
          restoredText: restoration.didRestore ? restoration.restoredText : null,
          englishText: enMain,
          intentZh: restoration.didRestore ? restoration.restoredText : hasChinese ? textZhOrRaw : undefined,
          enAlternatives: cn2en.enAlternatives,
          enTemplates: cn2en.enTemplates,
          sourceLanguage: detectLanguage(textZhOrRaw),
          status: 'done',
          lastError: null,
          eventIds: newEvents.map((e) => e.id),
          patternKeys: newEvents.map((e) => e.patternKey),
        };

        await saveState(this.#state);
        return;
      }

      const translation = await translateToEnglish(textZhOrRaw, this.#state.settings);

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
      const status = nextRetry >= maxRetries ? 'failed' : 'pending';

      this.#state.records[recordIndex] = {
        ...record,
        retryCount: nextRetry,
        status,
        lastError: String(error),
      };
      await saveState(this.#state);

      console.error(`[Queue] Failed to process ${recordId}, attempt ${nextRetry}. Error: ${error}`);
    }
  }
}

function isLikelyEnglishSentence(sourceText: string): boolean {
  const lower = sourceText.toLowerCase();
  const tokens = lower.split(/[^a-z]+/).filter(Boolean);
  if (tokens.length < 2) return false;
  const common = new Set([
    'the',
    'and',
    'to',
    'of',
    'is',
    'are',
    'i',
    'you',
    'we',
    'they',
    'he',
    'she',
    'it',
    'my',
    'your',
    'for',
    'in',
    'on',
    'with',
    'at',
  ]);
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

function hardNormalize(sourceText: string): string | null {
  const trimmed = sourceText.trim();
  if (!trimmed) return null;

  // Hard drop: urls, file paths, obvious tokens, code-ish blobs.
  if (/https?:\/\//i.test(trimmed) || /\bwww\./i.test(trimmed)) return null;
  if (/(^|\s)[~\/](Users|Library|Applications)\//.test(trimmed)) return null;
  if (/\b[A-Za-z]:\\/.test(trimmed)) return null;
  if (/\b(sk-[A-Za-z0-9]{20,})\b/.test(trimmed)) return null;
  if (/\bAKIA[0-9A-Z]{16}\b/.test(trimmed)) return null;
  if (/\b[A-Fa-f0-9]{32,}\b/.test(trimmed) && !/\s/.test(trimmed)) return null;
  if (/^[A-Za-z0-9+/]{40,}={0,2}$/.test(trimmed) && !/\s/.test(trimmed)) return null;
  if (/(.)\1{7,}/.test(trimmed)) return null;

  // Code-ish: lots of symbols + keywords.
  const symbolCount = (trimmed.match(/[{}()[\];=<>]/g) ?? []).length;
  if (symbolCount >= 6 && /(const|let|function|class|import|export|=>)/.test(trimmed)) return null;

  // Normalize whitespace.
  const normalized = trimmed.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (normalized.length > 400) return null;

  return normalized;
}

function stripToneNumbers(sourceText: string): string {
  return sourceText.replace(/([A-Za-z])[1-5]/g, '$1').replace(/[1-5]([A-Za-z])/g, '$1');
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

function streamKey(sourceApp: string | null): string {
  return sourceApp ?? '__unknown__';
}

function pruneByAge<T extends { createdAt: string }>(items: T[], nowMs: number, windowMs: number): T[] {
  const cutoff = nowMs - windowMs;
  return items.filter((item) => {
    const t = Date.parse(item.createdAt);
    return Number.isFinite(t) && t >= cutoff;
  });
}

function buildTailPreview(fragments: Fragment[]): string {
  const merged = fragments
    .slice()
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((f) => f.text)
    .reduce((acc, next) => mergeText(acc, next), '')
    .trim();

  if (!merged) return '';
  if (merged.length <= 200) return merged;
  return merged.slice(0, 200).trim();
}

function mergeText(previous: string, next: string): string {
  const a = previous.trim();
  const b = next.trim();
  if (!a) return b;
  if (!b) return a;
  const needsSpace = !/[\s，。！？,.!?]$/.test(a);
  return `${a}${needsSpace ? ' ' : ''}${b}`.trim();
}

function formatRelativeSeconds(deltaMs: number): string {
  const seconds = Math.max(0, deltaMs) / 1000;
  return `-${seconds.toFixed(1)}s`;
}

function minCreatedAtMs(fragments: Fragment[], fragmentIds: string[]): number | null {
  let min: number | null = null;
  const set = new Set(fragmentIds);
  for (const f of fragments) {
    if (!set.has(f.id)) continue;
    const t = Date.parse(f.createdAt);
    if (!Number.isFinite(t)) continue;
    if (min === null || t < min) min = t;
  }
  return min;
}

function maxCreatedAtMs(fragments: Fragment[], fragmentIds: string[]): number | null {
  let max: number | null = null;
  const set = new Set(fragmentIds);
  for (const f of fragments) {
    if (!set.has(f.id)) continue;
    const t = Date.parse(f.createdAt);
    if (!Number.isFinite(t)) continue;
    if (max === null || t > max) max = t;
  }
  return max;
}

function mergeFragmentsText(fragments: Fragment[], fragmentIds: string[]): string {
  const set = new Set(fragmentIds);
  return fragments
    .slice()
    .filter((f) => set.has(f.id))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((f) => f.text)
    .reduce((acc, next) => mergeText(acc, next), '')
    .trim();
}

function guessLanguageHint(text: string): UtteranceLanguageHint {
  if (isLikelyPinyin(text)) return 'pinyin';

  const lang = detectLanguage(text);
  if (lang === 'chinese') return 'zh';
  if (lang === 'english') return 'en';
  if (lang === 'mixed') return 'mixed';
  return 'unknown';
}

const CHOICE_META_PATTERNS = [
  /\boption(s)?\b/i,
  /\bselection\b/i,
  /\bselect\b/i,
  /\bchoose\b/i,
  /\btranslate\b/i,
  /\bexplanation\b/i,
  /\blist\b/i,
  /\bprovide\b/i,
  /\brequest\b/i,
  /\bconfirm\b/i,
  /\bexpress\b/i,
  /\bask\b/i,
  /\bneed\b/i,
  /\bcompare\b/i,
  /\brecommend\b/i,
  /\bdecide\b/i,
  /\bindecisive\b/i,
];

const CHOICE_META_ZH_PATTERNS = [
  /表达/,
  /请求/,
  /询问/,
  /确认/,
  /建议/,
  /选择/,
  /选项/,
  /解释/,
  /翻译/,
  /举例/,
  /例子/,
  /继续/,
  /帮助/,
  /可能/,
  /需要/,
  /提供/,
  /比较/,
  /推荐/,
  /决定/,
  /犹豫/,
  /说明/,
  /描述/,
];

async function filterChoiceCandidates(
  mergedRaw: string,
  candidates: ChoiceCandidate[],
  settings: ProviderSettings
): Promise<ChoiceCandidate[]> {
  if (!candidates.length) return [];

  const trimmed = mergedRaw.trim();
  if (!trimmed) return [];

  let baseMeaningZh = '';
  if (isLikelyPinyin(trimmed)) {
    const restoration = await restoreChineseFromRomanized(trimmed, settings);
    if (restoration.didRestore) {
      baseMeaningZh = restoration.restoredText.trim();
    }
  }

  const filtered = candidates.filter((candidate) => {
    const intentZh = candidate.intentZh?.trim();
    const enMain = candidate.enMain?.trim();
    if (!intentZh || !enMain) return false;

    if (baseMeaningZh) {
      return hasChineseOverlap(baseMeaningZh, intentZh);
    }

    const combined = `${enMain} ${intentZh}`;
    if (CHOICE_META_PATTERNS.some((pattern) => pattern.test(combined))) return false;
    if (CHOICE_META_ZH_PATTERNS.some((pattern) => pattern.test(intentZh))) return false;
    return true;
  });

  if (baseMeaningZh) {
    const normalizedBase = normalizeChinese(baseMeaningZh);
    const hasBase = filtered.some((candidate) => normalizeChinese(candidate.intentZh) === normalizedBase);
    if (!hasBase) {
      const translation = await translateToEnglish(baseMeaningZh, settings);
      filtered.unshift({
        intentZh: baseMeaningZh,
        enMain: translation.englishText || baseMeaningZh,
      });
    }
  }

  return dedupeCandidates(filtered);
}

function normalizeChinese(text: string): string {
  return text.replace(/\s+/g, '').replace(/[，。！？,.!?]/g, '').trim();
}

function hasChineseOverlap(a: string, b: string): boolean {
  const aZh = extractChinese(a);
  const bZh = extractChinese(b);
  if (!aZh || !bZh) return false;

  const minLen = Math.min(2, aZh.length);
  for (let i = 0; i <= aZh.length - minLen; i += 1) {
    const fragment = aZh.slice(i, i + minLen);
    if (bZh.includes(fragment)) return true;
  }
  return false;
}

function extractChinese(text: string): string {
  return (text.match(/[\u4e00-\u9fff]/g) ?? []).join('');
}

function dedupeCandidates(candidates: ChoiceCandidate[]): ChoiceCandidate[] {
  const seen = new Set<string>();
  const out: ChoiceCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${normalizeChinese(candidate.intentZh)}|${candidate.enMain.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

function ruleAssignUtterances(
  fragments: Fragment[],
  providerConfigured: boolean
): Assignment[] {
  const groups = ruleGroupFragments(fragments);
  return groups
    .map((g) => {
      const hint = guessLanguageHint(g.mergedRaw);
      if (!providerConfigured && hint === 'pinyin') {
        return { fragmentIds: g.fragmentIds, action: 'DROP' as const, languageHint: hint, mergedRaw: g.mergedRaw };
      }
      return { fragmentIds: g.fragmentIds, action: 'KEEP' as const, languageHint: hint, mergedRaw: g.mergedRaw };
    })
    .filter((g) => g.fragmentIds.length > 0);
}

function ruleGroupFragments(fragments: Fragment[]): Array<{ fragmentIds: string[]; mergedRaw: string }> {
  const ordered = fragments.slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const out: Array<{ fragmentIds: string[]; mergedRaw: string }> = [];
  let currentIds: string[] = [];
  let currentText = '';
  let lastAtMs: number | null = null;

  for (const f of ordered) {
    const at = Date.parse(f.createdAt);
    if (!Number.isFinite(at)) continue;

    const gapMs = lastAtMs == null ? 0 : at - lastAtMs;
    const boundaryByGap = gapMs > 4_000;
    const boundaryByPunct = currentText && /[。！？.!?]$/.test(currentText.trim()) && gapMs > 1_200;

    if (currentIds.length > 0 && (boundaryByGap || boundaryByPunct || currentText.length > 240)) {
      out.push({ fragmentIds: currentIds, mergedRaw: currentText.trim() });
      currentIds = [];
      currentText = '';
    }

    currentIds.push(f.id);
    currentText = mergeText(currentText, f.text);
    lastAtMs = at;
  }

  if (currentIds.length > 0 && currentText.trim()) {
    out.push({ fragmentIds: currentIds, mergedRaw: currentText.trim() });
  }

  return out;
}
