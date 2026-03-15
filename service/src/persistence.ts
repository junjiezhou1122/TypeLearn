import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { PersistedState } from './types.js';
import { defaultProviderSettings } from './config.js';

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
      stories: parsed.stories ?? [],
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
