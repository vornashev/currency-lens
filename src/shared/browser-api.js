/**
 * Cross-browser WebExtension API wrapper (Chrome MV3 + Firefox MV3).
 */
export const extApi =
  typeof globalThis.browser !== 'undefined'
    ? globalThis.browser
    : typeof globalThis.chrome !== 'undefined'
      ? globalThis.chrome
      : null;

export function getSettingsStorage() {
  if (!extApi?.storage) return null;
  return extApi.storage.sync || extApi.storage.local;
}

export async function storageGet(area, keys) {
  if (!area) return {};
  return new Promise((resolve) => {
    try {
      const result = area.get(keys, (data) => {
        resolve(data || {});
      });
      if (result && typeof result.then === 'function') {
        result.then((data) => resolve(data || {})).catch(() => resolve({}));
      }
    } catch {
      resolve({});
    }
  });
}

export async function storageSet(area, items) {
  if (!area) return;
  return new Promise((resolve) => {
    try {
      const result = area.set(items, () => resolve());
      if (result && typeof result.then === 'function') {
        result.then(() => resolve()).catch(() => resolve());
      }
    } catch {
      resolve();
    }
  });
}

export async function sendRuntimeMessage(message) {
  if (!extApi?.runtime?.sendMessage) return null;
  return new Promise((resolve) => {
    try {
      const result = extApi.runtime.sendMessage(message, (response) => {
        if (extApi.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response ?? null);
      });
      if (result && typeof result.then === 'function') {
        result.then((res) => resolve(res ?? null)).catch(() => resolve(null));
      }
    } catch {
      resolve(null);
    }
  });
}
