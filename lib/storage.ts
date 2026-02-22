import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'stocksnap:';

// In-memory cache for synchronous reads
const cache = new Map<string, string | number>();

function prefixedKey(key: string): string {
  return STORAGE_PREFIX + key;
}

/**
 * Load all persisted values into the in-memory cache.
 * Must be called once at app startup before any reads.
 */
export async function loadFromStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter((k) => k.startsWith(STORAGE_PREFIX));

  if (ours.length === 0) return;

  const pairs = await AsyncStorage.multiGet(ours);
  for (const [fullKey, raw] of pairs) {
    if (raw === null) continue;
    const key = fullKey.slice(STORAGE_PREFIX.length);
    // Attempt to parse as number
    const num = Number(raw);
    if (raw !== '' && !isNaN(num)) {
      cache.set(key, num);
    } else {
      cache.set(key, raw);
    }
  }
}

export const storage = {
  getString(key: string): string | undefined {
    const val = cache.get(key);
    return typeof val === 'string' ? val : undefined;
  },

  getNumber(key: string): number | undefined {
    const val = cache.get(key);
    return typeof val === 'number' ? val : undefined;
  },

  set(key: string, value: string | number): void {
    cache.set(key, value);
    AsyncStorage.setItem(prefixedKey(key), String(value));
  },

  delete(key: string): void {
    cache.delete(key);
    AsyncStorage.removeItem(prefixedKey(key));
  },

  clearAll(): void {
    const keys = Array.from(cache.keys());
    cache.clear();
    const prefixedKeys = keys.map(prefixedKey);
    if (prefixedKeys.length > 0) {
      AsyncStorage.multiRemove(prefixedKeys);
    }
  },
};

const KEYS = {
  SESSION: 'supabase-session',
  USER_ID: 'user-id',
} as const;

export function saveSession(accessToken: string, refreshToken: string): void {
  storage.set(
    KEYS.SESSION,
    JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
  );
}

export function getStoredSession(): {
  access_token: string;
  refresh_token: string;
} | null {
  const raw = storage.getString(KEYS.SESSION);
  if (!raw) return null;
  return JSON.parse(raw) as {
    access_token: string;
    refresh_token: string;
  };
}

export function clearSession(): void {
  storage.delete(KEYS.SESSION);
  storage.delete(KEYS.USER_ID);
}

export function saveUserId(id: string): void {
  storage.set(KEYS.USER_ID, id);
}

export function getStoredUserId(): string | null {
  return storage.getString(KEYS.USER_ID) ?? null;
}

export function clearAllStorage(): void {
  storage.clearAll();
}
