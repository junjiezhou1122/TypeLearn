import type {
  CaptureRecord,
  DayDigest,
  Pattern,
  SessionDigest,
  StoryMoment,
  StoryPatternSummary,
  TimeBucket,
} from '../../shared/src/index';

const sessionGapMs = 25 * 60 * 1000;
const maxRecordsPerSession = 12;
const maxThemeCount = 5;
const maxPatternCount = 5;
const maxDayMoments = 6;
const maxDayStealLines = 8;

export function buildDayDigest(
  day: string,
  records: CaptureRecord[],
  patterns: Record<string, Pattern>,
): DayDigest {
  const dayRecords = records.filter((record) => (
    record.createdAt.slice(0, 10) === day &&
    record.pipelineStage !== 'draft' &&
    record.status !== 'filtered'
  ));
  const doneRecords = dayRecords
    .filter((record) => record.status === 'done')
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const sessions = buildSessions(doneRecords);
  const sessionDigests = sessions.map((session) => summarizeSession(session, patterns));

  const themeCounts = new Map<string, number>();
  const patternCounts = new Map<string, number>();
  const allStealLines: string[] = [];
  const allMoments = sessionDigests.flatMap((session) => session.moments);

  for (const session of sessionDigests) {
    for (const theme of session.themeLabels) {
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    }
    for (const patternKey of session.topPatternKeys) {
      patternCounts.set(patternKey, (patternCounts.get(patternKey) ?? 0) + 1);
    }
    allStealLines.push(...session.stealLines);
  }

  for (const record of doneRecords) {
    for (const patternKey of record.patternKeys ?? []) {
      patternCounts.set(patternKey, (patternCounts.get(patternKey) ?? 0) + 1);
    }
  }

  const themes = sortCounts(themeCounts).slice(0, maxThemeCount).map(([theme]) => theme);
  const topPatterns = sortCounts(patternCounts)
    .slice(0, maxPatternCount)
    .map(([patternKey, count]) => buildPatternSummary(patternKey, count, doneRecords, patterns));
  const stealLines = uniqueLines(allStealLines).slice(0, maxDayStealLines);
  const keyMoments = allMoments
    .slice()
    .sort((a, b) => b.score - a.score || Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(0, maxDayMoments)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return {
    day,
    createdAt: new Date().toISOString(),
    sessionCount: sessionDigests.length,
    themes,
    topPatterns,
    stealLines,
    keyMoments,
    sessionDigests,
    sourceRecordIds: doneRecords.map((record) => record.id),
    stats: {
      totalRecords: dayRecords.length,
      totalDoneRecords: doneRecords.length,
      totalPatterns: Array.from(patternCounts.values()).reduce((sum, count) => sum + count, 0),
    },
  };
}

function buildSessions(records: CaptureRecord[]): CaptureRecord[][] {
  const sessions: CaptureRecord[][] = [];
  let current: CaptureRecord[] = [];

  for (const record of records) {
    const last = current[current.length - 1];
    const gapMs = last ? Date.parse(record.createdAt) - Date.parse(last.createdAt) : 0;

    if (current.length === 0 || (Number.isFinite(gapMs) && gapMs <= sessionGapMs && current.length < maxRecordsPerSession)) {
      current.push(record);
      continue;
    }

    sessions.push(current);
    current = [record];
  }

  if (current.length > 0) sessions.push(current);
  return sessions;
}

function summarizeSession(records: CaptureRecord[], patterns: Record<string, Pattern>): SessionDigest {
  const themeCounts = new Map<string, number>();
  const patternCounts = new Map<string, number>();
  const lineCandidates: string[] = [];
  const moments = records.map((record) => scoreMoment(record));

  for (const record of records) {
    const theme = deriveThemeLabel(record);
    if (theme) {
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    }

    for (const patternKey of record.patternKeys ?? []) {
      patternCounts.set(patternKey, (patternCounts.get(patternKey) ?? 0) + 1);
    }

    lineCandidates.push(...extractLineCandidates(record, patterns));
  }

  const selectedMoments = uniqueMoments(moments)
    .sort((a, b) => b.score - a.score || Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(0, 2)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return {
    id: crypto.randomUUID(),
    startedAt: records[0]?.createdAt ?? new Date().toISOString(),
    endedAt: records[records.length - 1]?.createdAt ?? new Date().toISOString(),
    sourceApps: unique(records.map((record) => record.sourceApp).filter((value): value is string => Boolean(value))),
    themeLabels: sortCounts(themeCounts).slice(0, 3).map(([theme]) => theme),
    topPatternKeys: sortCounts(patternCounts).slice(0, 3).map(([patternKey]) => patternKey),
    stealLines: uniqueLines(lineCandidates).slice(0, 3),
    moments: selectedMoments,
    recordIds: records.map((record) => record.id),
    recordCount: records.length,
  };
}

function buildPatternSummary(
  patternKey: string,
  count: number,
  records: CaptureRecord[],
  patterns: Record<string, Pattern>,
): StoryPatternSummary {
  const pattern = patterns[patternKey];
  const sampleLines = uniqueLines([
    pattern?.lesson?.template ?? '',
    ...records
      .filter((record) => record.patternKeys?.includes(patternKey))
      .flatMap((record) => extractLineCandidates(record, patterns)),
  ]).slice(0, 3);

  return {
    patternKey,
    title: pattern?.title?.trim() || humanizePatternKey(patternKey),
    count,
    sampleLines,
  };
}

function scoreMoment(record: CaptureRecord): StoryMoment {
  const templateBonus = Math.min((record.enTemplates?.length ?? 0), 2);
  const patternBonus = Math.min((record.patternKeys?.length ?? 0), 3) * 1.5;
  const intentBonus = record.intentZh ? 1 : 0;
  const score = 1 + templateBonus + patternBonus + intentBonus;

  return {
    recordId: record.id,
    createdAt: record.createdAt,
    timeBucket: getTimeBucket(record.createdAt),
    sourceApp: record.sourceApp,
    intentZh: record.intentZh,
    enMain: chooseMomentLine(record),
    patternKeys: record.patternKeys ?? [],
    score,
  };
}

function deriveThemeLabel(record: CaptureRecord): string | null {
  const preferred = record.intentZh?.trim() || chooseMomentLine(record) || record.sourceText.trim();
  if (!preferred) return null;
  const compact = preferred.replace(/\s+/g, ' ').replace(/[。！？!?]+$/g, '').trim();
  if (!compact) return null;
  return compact.length <= 28 ? compact : `${compact.slice(0, 28).trim()}…`;
}

function chooseMomentLine(record: CaptureRecord): string | undefined {
  return firstNonEmpty(
    ...(record.enTemplates ?? []),
    ...(record.enAlternatives ?? []),
    record.corrected,
    record.alt1Natural,
    record.alt2ClearFormal,
    record.englishText,
  );
}

function extractLineCandidates(record: CaptureRecord, patterns: Record<string, Pattern>): string[] {
  const patternLines = (record.patternKeys ?? [])
    .map((patternKey) => patterns[patternKey]?.lesson?.template ?? '')
    .filter(Boolean);

  return uniqueLines([
    ...(record.enTemplates ?? []),
    ...(record.enAlternatives ?? []),
    record.corrected ?? '',
    record.alt1Natural ?? '',
    record.alt2ClearFormal ?? '',
    record.englishText,
    ...patternLines,
  ]).filter(isReusableLine);
}

function uniqueMoments(moments: StoryMoment[]): StoryMoment[] {
  const seen = new Set<string>();
  const out: StoryMoment[] = [];
  for (const moment of moments) {
    const key = normalizeKey(`${moment.intentZh ?? ''}|${moment.enMain ?? ''}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(moment);
  }
  return out;
}

function getTimeBucket(iso: string): TimeBucket {
  const hour = new Date(iso).getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

function isReusableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length >= 6 && trimmed.length <= 120 && /[a-zA-Z]/.test(trimmed);
}

function sortCounts(counts: Map<string, number>): Array<[string, number]> {
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const key = normalizeKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function humanizePatternKey(patternKey: string): string {
  const parts = patternKey.split(':');
  const raw = parts.length > 1 ? parts[1] : parts[0];
  return raw.replace(/[_-]+/g, ' ').trim();
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
}
