import { extApi, getSettingsStorage, storageGet, storageSet } from '../shared/browser-api.js';
import { RATES_STORAGE_KEY, SETTINGS_STORAGE_KEY, normalizeSettings } from '../shared/defaults.js';

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const REFRESH_ALARM_NAME = 'cl_refresh_rates';

const PRIMARY_API = {
  name: 'open.er-api.com',
  url: 'https://open.er-api.com/v6/latest/USD',
  parse(json) {
    if (json && json.result === 'success' && json.rates && typeof json.rates === 'object') {
      return json.rates;
    }
    throw new Error('Invalid open.er-api.com payload');
  },
};

const FALLBACK_API = {
  name: 'currency-api (jsDelivr)',
  url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
  parse(json) {
    if (json && json.usd && typeof json.usd === 'object') {
      const normalized = {};
      for (const [k, v] of Object.entries(json.usd)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          normalized[k.toUpperCase()] = v;
        }
      }
      normalized.USD = 1;
      return normalized;
    }
    throw new Error('Invalid currency-api payload');
  },
};

let inFlightFetch = null;

async function readRatesCache() {
  const data = await storageGet(extApi?.storage?.local, [RATES_STORAGE_KEY]);
  return data[RATES_STORAGE_KEY] || null;
}

async function writeRatesCache(payload) {
  await storageSet(extApi?.storage?.local, { [RATES_STORAGE_KEY]: payload });
}

async function fetchFromProvider(provider) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(provider.url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${provider.name}`);
    }
    const json = await res.json();
    const rates = provider.parse(json);
    return {
      rates,
      base: 'USD',
      source: provider.name,
      updatedAt: Date.now(),
      status: 'ready',
      error: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function refreshRates(force = false) {
  const cached = await readRatesCache();
  const isFresh =
    cached &&
    cached.status === 'ready' &&
    cached.rates &&
    Date.now() - cached.updatedAt < CACHE_TTL_MS;

  if (!force && isFresh) {
    return cached;
  }

  if (inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    const loadingState = {
      rates: cached?.rates || null,
      base: 'USD',
      source: cached?.source || null,
      updatedAt: cached?.updatedAt || null,
      status: 'loading',
      error: null,
    };
    await writeRatesCache(loadingState);

    let lastError = null;
    for (const provider of [PRIMARY_API, FALLBACK_API]) {
      try {
        const fresh = await fetchFromProvider(provider);
        await writeRatesCache(fresh);
        return fresh;
      } catch (err) {
        lastError = err?.message || String(err);
      }
    }

    // If we had stale cached rates, keep them usable while surfacing the error status
    const errorState = {
      rates: cached?.rates || null,
      base: 'USD',
      source: cached?.source || null,
      updatedAt: cached?.updatedAt || null,
      status: 'error',
      error: lastError || 'Failed to fetch exchange rates',
    };
    await writeRatesCache(errorState);
    return errorState;
  })();

  try {
    return await inFlightFetch;
  } finally {
    inFlightFetch = null;
  }
}

function setupAlarms() {
  if (!extApi?.alarms) return;
  try {
    extApi.alarms.create(REFRESH_ALARM_NAME, { periodInMinutes: 240 });
  } catch {
    // ignore
  }
}

async function applyUiSurface(uiSurface) {
  const isSidePanel = uiSurface === 'sidepanel';
  try {
    if (extApi?.sidePanel?.setPanelBehavior) {
      await extApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: isSidePanel });
    }
  } catch {
    // ignore
  }
  try {
    if (extApi?.action?.setPopup) {
      await extApi.action.setPopup({ popup: isSidePanel ? '' : 'popup/popup.html' });
    }
  } catch {
    // ignore
  }
}

async function syncUiSurfaceFromStorage() {
  try {
    const area = getSettingsStorage();
    const data = await storageGet(area, [SETTINGS_STORAGE_KEY]);
    const normalized = normalizeSettings(data[SETTINGS_STORAGE_KEY]);
    await applyUiSurface(normalized.uiSurface);
  } catch {
    // ignore
  }
}

if (extApi?.runtime?.onInstalled) {
  extApi.runtime.onInstalled.addListener(() => {
    setupAlarms();
    syncUiSurfaceFromStorage();
    refreshRates(false);
  });
}

if (extApi?.runtime?.onStartup) {
  extApi.runtime.onStartup.addListener(() => {
    setupAlarms();
    syncUiSurfaceFromStorage();
    refreshRates(false);
  });
}

if (extApi?.storage?.onChanged) {
  extApi.storage.onChanged.addListener((changes) => {
    if (changes[SETTINGS_STORAGE_KEY]?.newValue) {
      const normalized = normalizeSettings(changes[SETTINGS_STORAGE_KEY].newValue);
      applyUiSurface(normalized.uiSurface);
    }
  });
}

if (extApi?.action?.onClicked) {
  extApi.action.onClicked.addListener(() => {
    // Firefox opens sidebar_action on action click when popup is empty
    if (extApi?.sidebarAction?.open) {
      try {
        extApi.sidebarAction.open();
      } catch {
        // ignore
      }
    }
  });
}

if (extApi?.alarms?.onAlarm) {
  extApi.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name === REFRESH_ALARM_NAME) {
      refreshRates(true);
    }
  });
}

if (extApi?.runtime?.onMessage) {
  extApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    if (message.type === 'GET_RATES') {
      refreshRates(false).then(sendResponse);
      return true;
    }

    if (message.type === 'FORCE_REFRESH_RATES') {
      refreshRates(true).then(sendResponse);
      return true;
    }

    if (message.type === 'SET_UI_SURFACE') {
      applyUiSurface(message.uiSurface).then(() => sendResponse({ ok: true }));
      return true;
    }

    return false;
  });
}

// Ensure toolbar behavior is synced on service worker wakeup
syncUiSurfaceFromStorage();
