/**
 * Default settings and normalization helper.
 */
export const SETTINGS_STORAGE_KEY = 'cl_settings';
export const RATES_STORAGE_KEY = 'cl_rates_cache';

export const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'hover', // 'inline' | 'hover' | 'click'
  inlineStyle: 'beside', // 'beside' | 'replace'
  targetCurrencies: ['RUB', 'EUR', 'USD'],
  ignoredCurrencies: [],
  uiSurface: 'popup', // 'popup' | 'sidepanel'
  language: 'auto', // 'auto' | 'ru' | 'en'
  theme: 'auto', // 'auto' | 'light' | 'dark'
  disabledHosts: [],
};

export function normalizeSettings(raw) {
  const merged = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  if (!['inline', 'hover', 'click'].includes(merged.mode)) {
    merged.mode = DEFAULT_SETTINGS.mode;
  }
  if (!['beside', 'replace'].includes(merged.inlineStyle)) {
    merged.inlineStyle = DEFAULT_SETTINGS.inlineStyle;
  }
  if (!Array.isArray(merged.targetCurrencies) || merged.targetCurrencies.length === 0) {
    merged.targetCurrencies = [...DEFAULT_SETTINGS.targetCurrencies];
  } else {
    merged.targetCurrencies = [...new Set(merged.targetCurrencies.map((c) => String(c).toUpperCase()))];
  }
  if (!Array.isArray(merged.ignoredCurrencies)) {
    merged.ignoredCurrencies = [];
  } else {
    merged.ignoredCurrencies = [...new Set(merged.ignoredCurrencies.map((c) => String(c).toUpperCase()))];
  }
  if (!['popup', 'sidepanel'].includes(merged.uiSurface)) {
    merged.uiSurface = DEFAULT_SETTINGS.uiSurface;
  }
  if (!['auto', 'ru', 'en'].includes(merged.language)) {
    merged.language = 'auto';
  }
  if (!['auto', 'light', 'dark'].includes(merged.theme)) {
    merged.theme = 'auto';
  }
  if (!Array.isArray(merged.disabledHosts)) {
    merged.disabledHosts = [];
  }
  return merged;
}
