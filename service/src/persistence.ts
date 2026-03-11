import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { PersistedState } from './types.js';
import { defaultProviderSettings } from './config.js';

const stateFilePath = join(homedir(), '.typelearn', 'state.json');

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await readFile(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedState>;

    return {
      records: parsed.records ?? [],
      stories: parsed.stories ?? [],
      settings: {
        ...defaultProviderSettings,
        ...parsed.settings,
      },
    };
  } catch {
    return {
      records: [],
      stories: [],
      settings: defaultProviderSettings,
    };
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  await mkdir(dirname(stateFilePath), { recursive: true });
  await writeFile(stateFilePath, JSON.stringify(state, null, 2), 'utf8');
}
