import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { PersistedState } from './types.js';
import { defaultProviderSettings } from './config.js';
import type { StoryArtifact } from '../../shared/src/index';

const defaultStateFilePath = join(homedir(), '.typelearn', 'state.json');

function getStateFilePath(): string {
  return process.env.TYPELEARN_STATE_FILE || defaultStateFilePath;
}

export async function loadState(): Promise<PersistedState> {
  const stateFilePath = getStateFilePath();
  try {
    const raw = await readFile(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedState>;

    return {
      records: (parsed.records ?? []).map((record) => ({
        ...record,
        restoredText: record.restoredText ?? null,
        status: record.status ?? 'done',
        retryCount: record.retryCount ?? 0,
        lastError: record.lastError ?? null,
        pipelineStage: record.pipelineStage ?? 'committed',
      })),
      stories: (parsed.stories ?? []).map(normalizeStoryArtifact),
      dailyDigests: parsed.dailyDigests ?? {},
      settings: {
        ...defaultProviderSettings,
        ...parsed.settings,
      },
      choices: parsed.choices ?? [],
      events: parsed.events ?? [],
      patterns: parsed.patterns ?? {},
    };
  } catch {
    return {
      records: [],
      stories: [],
      dailyDigests: {},
      settings: defaultProviderSettings,
      choices: [],
      events: [],
      patterns: {},
    };
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  const stateFilePath = getStateFilePath();
  await mkdir(dirname(stateFilePath), { recursive: true });
  await writeFile(stateFilePath, JSON.stringify(state, null, 2), 'utf8');
}

function normalizeStoryArtifact(story: Partial<StoryArtifact>): StoryArtifact {
  const day = story.day ?? story.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const parsed = splitLegacyStorySections(story.story ?? '');
  const paragraphs = Array.isArray(story.paragraphs) && story.paragraphs.length > 0
    ? story.paragraphs.map((line) => line.trim()).filter(Boolean)
    : parsed.paragraphs;
  const stealLines = Array.isArray(story.stealLines) && story.stealLines.length > 0
    ? story.stealLines.map((line) => line.trim()).filter(Boolean)
    : parsed.stealLines;
  const summary = story.summary?.trim() || paragraphs[0] || parsed.summary || 'A small set of learning moments from the day.';
  const flatStory = buildLegacyStoryText(summary, paragraphs, stealLines);

  return {
    id: story.id ?? crypto.randomUUID(),
    day,
    title: story.title?.trim() || (day === new Date().toISOString().slice(0, 10) ? "Today's Story" : `Story for ${day}`),
    summary,
    paragraphs,
    stealLines,
    themeLabels: story.themeLabels ?? [],
    patternKeys: story.patternKeys ?? [],
    sessionCount: story.sessionCount ?? 0,
    story: flatStory,
    createdAt: story.createdAt ?? new Date().toISOString(),
    sourceRecordIds: story.sourceRecordIds ?? [],
  };
}

function splitLegacyStorySections(storyText: string): {
  summary: string;
  paragraphs: string[];
  stealLines: string[];
} {
  const marker = 'steal these lines';
  const lower = storyText.toLowerCase();
  const idx = lower.indexOf(marker);
  const body = idx === -1 ? storyText.trim() : storyText.slice(0, idx).trim();
  const after = idx === -1 ? '' : storyText.slice(idx + marker.length).trim();
  const paragraphs = body.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const stealLines = after
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);

  return {
    summary: paragraphs[0] ?? '',
    paragraphs,
    stealLines,
  };
}

function buildLegacyStoryText(summary: string, paragraphs: string[], stealLines: string[]): string {
  const body = [summary, ...paragraphs.filter((line) => line.trim() && line.trim() !== summary.trim())].join('\n\n').trim();
  if (stealLines.length === 0) return body;
  return `${body}\n\nSteal these lines\n${stealLines.map((line) => `- ${line}`).join('\n')}`.trim();
}
