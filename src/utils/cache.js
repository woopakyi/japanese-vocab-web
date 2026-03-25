const CACHE_PREFIX = 'jv-cache:';

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getCachedValue(key, maxAgeMs) {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.cachedAt !== 'number') return null;

    const isExpired = Date.now() - parsed.cachedAt > maxAgeMs;
    if (isExpired) {
      storage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function setCachedValue(key, value) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({
        cachedAt: Date.now(),
        value,
      })
    );
  } catch {
    // Best-effort cache only.
  }
}

export function removeCachedValue(key) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch {
    // Ignore cache removal failures.
  }
}

export function removeCacheByPrefix(prefix) {
  const storage = getStorage();
  if (!storage) return;

  try {
    const fullPrefix = `${CACHE_PREFIX}${prefix}`;
    const toDelete = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(fullPrefix)) {
        toDelete.push(key);
      }
    }

    toDelete.forEach((key) => storage.removeItem(key));
  } catch {
    // Ignore cache removal failures.
  }
}