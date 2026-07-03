import type { PersistedData } from '../types';

const STORAGE_KEY = 'tempo.v1';
const DEMO_STORAGE_KEY = 'tempo.demo.v1';
const DEMO_MODE_KEY = 'tempo.demoMode';
const PAT_KEY = 'tempo.gh.pat';
const GIST_ID_KEY = 'tempo.gh.gistId';

function readStorage(key: string): string {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function isPersistedData(value: unknown): value is PersistedData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersistedData>;
  return Array.isArray(candidate.customers)
    && Array.isArray(candidate.projects)
    && Array.isArray(candidate.entries);
}

export function loadData(): PersistedData | null {
  return loadPersistedData(STORAGE_KEY);
}

export function saveData(data: PersistedData): void {
  savePersistedData(STORAGE_KEY, data);
}

export function clearData(): void {
  clearPersistedData(STORAGE_KEY);
}

export function loadDemoData(): PersistedData | null {
  return loadPersistedData(DEMO_STORAGE_KEY);
}

export function saveDemoData(data: PersistedData): void {
  savePersistedData(DEMO_STORAGE_KEY, data);
}

export function clearDemoData(): void {
  clearPersistedData(DEMO_STORAGE_KEY);
}

export function getDemoModeFlag(): boolean {
  try {
    return window.localStorage.getItem(DEMO_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDemoModeFlag(enabled: boolean): void {
  try {
    if (enabled) {
      window.localStorage.setItem(DEMO_MODE_KEY, '1');
    } else {
      window.localStorage.removeItem(DEMO_MODE_KEY);
    }
  } catch {
    // Ignore storage failures to match the legacy runtime behavior.
  }
}

function loadPersistedData(key: string): PersistedData | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isPersistedData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function savePersistedData(key: string, data: PersistedData): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({
      customers: data.customers,
      projects: data.projects,
      entries: data.entries,
    }));
  } catch {
    // Ignore storage failures to match the legacy runtime behavior.
  }
}

function clearPersistedData(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures to match the legacy runtime behavior.
  }
}

export function getPAT(): string {
  return readStorage(PAT_KEY);
}

export function getGistId(): string {
  return readStorage(GIST_ID_KEY);
}

export function savePAT(pat: string): void {
  try {
    window.localStorage.setItem(PAT_KEY, pat);
  } catch {
    // Ignore storage failures to match the legacy runtime behavior.
  }
}

export function saveGistId(id: string): void {
  try {
    window.localStorage.setItem(GIST_ID_KEY, id);
  } catch {
    // Ignore storage failures to match the legacy runtime behavior.
  }
}

export function removePAT(): void {
  try {
    window.localStorage.removeItem(PAT_KEY);
  } catch {
    // Ignore storage failures to match the legacy runtime behavior.
  }
}

export function removeGistId(): void {
  try {
    window.localStorage.removeItem(GIST_ID_KEY);
  } catch {
    // Ignore storage failures to match the legacy runtime behavior.
  }
}

export async function syncToGist(
  data: PersistedData,
  pat: string,
  gistId: string,
): Promise<{ id: string }> {
  const content = JSON.stringify(
    {
      customers: data.customers,
      projects: data.projects,
      entries: data.entries,
    },
    null,
    2,
  );

  const url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
  const method = gistId ? 'PATCH' : 'POST';
  const body = gistId
    ? { files: { 'tempo-data.json': { content } } }
    : {
        description: 'Tempo time tracking data',
        public: false,
        files: { 'tempo-data.json': { content } },
      };

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `token ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json: unknown = await response.json();
  if (!response.ok) {
    const message = typeof json === 'object' && json && 'message' in json ? String((json as { message?: unknown }).message) : 'API error';
    throw new Error(message);
  }

  const id = typeof json === 'object' && json && 'id' in json ? String((json as { id: unknown }).id) : '';
  if (!id) {
    throw new Error('Missing gist id');
  }

  return { id };
}

export async function loadFromGist(pat: string, gistId: string): Promise<PersistedData> {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `token ${pat}`,
    },
  });

  const json: unknown = await response.json();
  if (!response.ok) {
    const message = typeof json === 'object' && json && 'message' in json ? String((json as { message?: unknown }).message) : 'API error';
    throw new Error(message);
  }

  const raw = typeof json === 'object' && json && 'files' in json
    ? (json as {
        files?: Record<string, { content?: string }>;
      }).files?.['tempo-data.json']?.content
    : undefined;

  if (!raw) {
    throw new Error('File not found in gist');
  }

  const parsed: unknown = JSON.parse(raw);
  if (!isPersistedData(parsed)) {
    throw new Error('Invalid data format');
  }

  return parsed;
}
