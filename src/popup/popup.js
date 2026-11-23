import { extApi, getSettingsStorage, storageGet, storageSet, sendRuntimeMessage } from '../shared/browser-api.js';
import { CURRENCIES, getCurrencyInfo } from '../shared/currencies.js';
import { t, resolveLanguage, formatRelativeTime } from '../shared/i18n.js';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, RATES_STORAGE_KEY, normalizeSettings } from '../shared/defaults.js';
import { ICONS } from '../shared/icons.js';
import { convertAmount, formatMoney } from '../shared/parser.js';

// Fallback demo rates so the live preview always works even before network completes
const DEMO_FALLBACK_RATES = {
  USD: 1,
  EUR: 0.92,
  RUB: 96.5,
  GBP: 0.79,
  KZT: 495,
  UAH: 41.2,
  BYN: 3.28,
  TRY: 34.4,
  CNY: 7.24,
  JPY: 154,
  KRW: 1390,
  PLN: 4.05,
  CHF: 0.88,
  CAD: 1.39,
  AUD: 1.53,
  AED: 3.67,
  GEL: 2.72,
  AMD: 388,
  UZS: 12800,
  THB: 34.5,
  VND: 25400,
  INR: 84.4,
};

const isPanelView = new URLSearchParams(window.location.search).get('view') === 'panel';
if (isPanelView) {
  document.documentElement.setAttribute('data-view', 'panel');
}

const GRIP_ICON_SVG = ICONS.gripVertical(12);

function mountStaticIcons() {
  for (const el of document.querySelectorAll('[data-icon]')) {
    const name = el.getAttribute('data-icon');
    const fn = ICONS[name];
    if (fn) {
      el.innerHTML = fn();
    }
  }
}

let settings = { ...DEFAULT_SETTINGS };
let ratesState = { rates: null, status: 'loading', updatedAt: null, source: null };
let activeHost = null;
let activeWindowId = null;
let searchQuery = '';
let activePickerTab = 'target'; // 'target' | 'ignored'
let draggedCurrencyCode = null;

const els = {
  globalToggle: document.getElementById('global-toggle'),
  globalStatus: document.getElementById('global-status'),
  langBtn: document.getElementById('lang-btn'),
  siteDot: document.getElementById('site-dot'),
  siteHost: document.getElementById('site-host'),
  siteToggleBtn: document.getElementById('site-toggle-btn'),
  mainContent: document.getElementById('main-content'),
  modeCards: [...document.querySelectorAll('.mode-card')],
  inlineStyleWrap: document.getElementById('inline-style-wrap'),
  segBtns: [...document.querySelectorAll('.seg-btn[data-inline-style]')],
  previewHint: document.getElementById('preview-hint'),
  previewOrig: document.getElementById('preview-orig'),
  previewBadge: document.getElementById('preview-badge'),
  previewPopover: document.getElementById('preview-popover'),
  selectedChips: document.getElementById('selected-chips'),
  ignoredChips: document.getElementById('ignored-chips'),
  pickerTabs: [...document.querySelectorAll('.picker-tab')],
  currencySearch: document.getElementById('currency-search'),
  currencyList: document.getElementById('currency-list'),
  surfaceBtns: [...document.querySelectorAll('.surface-btn')],
  ratesDot: document.getElementById('rates-dot'),
  ratesText: document.getElementById('rates-text'),
  themeBtn: document.getElementById('theme-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
};

function getLang() {
  return resolveLanguage(settings.language);
}

function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'light' || settings.theme === 'dark') {
    root.setAttribute('data-theme', settings.theme);
  } else {
    root.removeAttribute('data-theme');
  }
}

async function saveSettings() {
  const area = getSettingsStorage();
  await storageSet(area, { [SETTINGS_STORAGE_KEY]: settings });
}

function renderI18n() {
  const lang = getLang();
  document.documentElement.lang = lang;

  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.getAttribute('data-i18n'), lang);
  }

  els.currencySearch.placeholder = t('searchCurrencies', lang);
  els.langBtn.innerHTML = `<span class="btn-icon">${ICONS.globe(12)}</span><span>${lang === 'ru' ? 'EN' : 'RU'}</span>`;
  els.globalStatus.textContent = settings.enabled
    ? t('enabledGlobal', lang)
    : t('disabledGlobal', lang);

  const themeKey =
    settings.theme === 'light'
      ? 'themeLight'
      : settings.theme === 'dark'
        ? 'themeDark'
        : 'themeAuto';
  const themeIcon =
    settings.theme === 'light'
      ? ICONS.sun(13)
      : settings.theme === 'dark'
        ? ICONS.moon(13)
        : ICONS.monitor(13);
  els.themeBtn.innerHTML = `<span class="btn-icon">${themeIcon}</span><span>${t(themeKey, lang)}</span>`;
  els.refreshBtn.title = t('refreshRates', lang);
}

function renderSiteBar() {
  const lang = getLang();
  if (!activeHost) {
    els.siteHost.textContent = t('siteUnavailable', lang);
    els.siteDot.setAttribute('data-paused', 'true');
    els.siteToggleBtn.hidden = true;
    return;
  }

  const isPaused = settings.disabledHosts.includes(activeHost);
  els.siteHost.textContent = activeHost;
  els.siteDot.setAttribute('data-paused', isPaused || !settings.enabled ? 'true' : 'false');
  els.siteToggleBtn.hidden = false;
  els.siteToggleBtn.textContent = isPaused
    ? t('enableOnSite', lang, { host: activeHost })
    : t('disableOnSite', lang, { host: activeHost });
}

function renderModes() {
  els.globalToggle.checked = settings.enabled;
  els.mainContent.setAttribute('data-disabled', settings.enabled ? 'false' : 'true');

  for (const card of els.modeCards) {
    const selected = card.getAttribute('data-mode') === settings.mode;
    card.setAttribute('aria-checked', selected ? 'true' : 'false');
  }

  els.inlineStyleWrap.hidden = settings.mode !== 'inline';
  for (const btn of els.segBtns) {
    const selected = btn.getAttribute('data-inline-style') === settings.inlineStyle;
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
}

function renderPreview() {
  const lang = getLang();
  const rates = ratesState?.rates || DEMO_FALLBACK_RATES;
  const sampleAmount = 49.99;
  const sampleCurrency = 'USD';
  const targets = settings.targetCurrencies;
  const primary = targets.find((c) => c !== sampleCurrency) || targets[0];
  const primaryInfo = getCurrencyInfo(primary);
  const converted = convertAmount(sampleAmount, sampleCurrency, primary, rates);
  const formattedPrimary = formatMoney(converted ?? sampleAmount, primary, lang);

  const isInlineReplace = settings.mode === 'inline' && settings.inlineStyle === 'replace';
  els.previewBadge.setAttribute('data-inline-replace', isInlineReplace ? 'true' : 'false');

  if (settings.mode === 'inline') {
    els.previewHint.textContent = t('previewHintInline', lang);
    if (isInlineReplace) {
      els.previewOrig.hidden = true;
      els.previewBadge.textContent = formattedPrimary;
    } else {
      els.previewOrig.hidden = false;
      els.previewBadge.textContent = `≈ ${formattedPrimary}`;
    }
  } else if (settings.mode === 'hover') {
    els.previewHint.textContent = t('previewHintHover', lang);
    els.previewOrig.hidden = false;
    els.previewBadge.innerHTML = `<span class="btn-icon">${ICONS.arrowLeftRight(12)}</span><span>${primaryInfo.symbol}</span>`;
  } else {
    els.previewHint.textContent = t('previewHintClick', lang);
    els.previewOrig.hidden = false;
    els.previewBadge.innerHTML = `<span class="btn-icon">${ICONS.arrowLeftRight(12)}</span><span>${primaryInfo.symbol}</span><span class="preview-dot" aria-hidden="true"></span>`;
  }

  // Render preview popover rows
  els.previewPopover.replaceChildren();
  for (const code of targets) {
    const info = getCurrencyInfo(code);
    const val = convertAmount(sampleAmount, sampleCurrency, code, rates);
    const row = document.createElement('div');
    row.className = 'preview-pop-row';
    if (code === targets[0]) row.setAttribute('data-primary', 'true');

    const left = document.createElement('span');
    left.className = 'preview-pop-left';
    left.innerHTML = `<span>${info.flag} ${info.code}</span>${code === targets[0] ? `<span class="btn-icon">${ICONS.starFilled(11)}</span>` : ''}`;

    const right = document.createElement('span');
    right.textContent = formatMoney(val ?? sampleAmount, code, lang);

    row.append(left, right);
    els.previewPopover.appendChild(row);
  }
}

function clearChipDropIndicators() {
  for (const el of els.selectedChips.querySelectorAll('.chip')) {
    el.removeAttribute('data-drop-pos');
    el.removeAttribute('data-dragging');
  }
}

function reorderSecondaryCurrency(sourceCode, targetCode, insertAfter) {
  const list = [...settings.targetCurrencies];
  const fromIdx = list.indexOf(sourceCode);
  const toIdx = list.indexOf(targetCode);
  // Keep index 0 (primary) fixed
  if (fromIdx <= 0 || toIdx <= 0 || fromIdx === toIdx) return false;

  list.splice(fromIdx, 1);
  let nextIdx = list.indexOf(targetCode);
  if (insertAfter) nextIdx += 1;
  nextIdx = Math.max(1, Math.min(list.length, nextIdx));
  list.splice(nextIdx, 0, sourceCode);

  settings.targetCurrencies = list;
  return true;
}

function renderSelectedChips() {
  const lang = getLang();
  const canReorder = settings.targetCurrencies.length > 2;
  els.selectedChips.replaceChildren();

  settings.targetCurrencies.forEach((code, idx) => {
    const info = getCurrencyInfo(code);
    const isPrimary = idx === 0;
    const isDraggable = !isPrimary && canReorder;

    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset.code = code;
    if (isPrimary) chip.setAttribute('data-primary', 'true');

    if (isDraggable) {
      chip.draggable = true;
      chip.setAttribute('data-draggable', 'true');
      chip.title = t('dragToReorder', lang);

      const grip = document.createElement('span');
      grip.className = 'chip-grip';
      grip.innerHTML = GRIP_ICON_SVG;
      chip.appendChild(grip);

      chip.addEventListener('dragstart', (e) => {
        if (e.target instanceof Element && e.target.closest('button')) {
          e.preventDefault();
          return;
        }
        draggedCurrencyCode = code;
        chip.setAttribute('data-dragging', 'true');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', code);
        }
      });

      chip.addEventListener('dragover', (e) => {
        if (!draggedCurrencyCode || draggedCurrencyCode === code) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        const rect = chip.getBoundingClientRect();
        const insertAfter = e.clientX > rect.left + rect.width / 2;
        for (const other of els.selectedChips.querySelectorAll('.chip[data-drop-pos]')) {
          if (other !== chip) other.removeAttribute('data-drop-pos');
        }
        chip.setAttribute('data-drop-pos', insertAfter ? 'after' : 'before');
      });

      chip.addEventListener('dragleave', () => {
        chip.removeAttribute('data-drop-pos');
      });

      chip.addEventListener('drop', async (e) => {
        e.preventDefault();
        const src = draggedCurrencyCode || e.dataTransfer?.getData('text/plain');
        const insertAfter = chip.getAttribute('data-drop-pos') === 'after';
        clearChipDropIndicators();
        draggedCurrencyCode = null;
        if (src && reorderSecondaryCurrency(src, code, insertAfter)) {
          await saveSettings();
          renderSelectedChips();
          renderPreview();
        }
      });

      chip.addEventListener('dragend', () => {
        draggedCurrencyCode = null;
        clearChipDropIndicators();
      });
    }

    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = 'chip-star';
    starBtn.innerHTML = isPrimary ? ICONS.starFilled(12) : ICONS.star(12);
    starBtn.title = isPrimary ? t('primaryBadge', lang) : t('setPrimary', lang);
    starBtn.addEventListener('click', async () => {
      if (isPrimary) return;
      settings.targetCurrencies = [
        code,
        ...settings.targetCurrencies.filter((c) => c !== code),
      ];
      await saveSettings();
      renderSelectedChips();
      renderPreview();
    });

    const label = document.createElement('span');
    label.textContent = `${info.flag} ${info.code}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chip-remove';
    removeBtn.innerHTML = ICONS.x(12);
    removeBtn.disabled = settings.targetCurrencies.length <= 1;
    removeBtn.title =
      settings.targetCurrencies.length <= 1
        ? t('minOneCurrency', lang)
        : t('removeCurrency', lang);
    removeBtn.addEventListener('click', async () => {
      if (settings.targetCurrencies.length <= 1) return;
      settings.targetCurrencies = settings.targetCurrencies.filter((c) => c !== code);
      await saveSettings();
      renderSelectedChips();
      renderCurrencyList();
      renderPreview();
    });

    chip.append(starBtn, label, removeBtn);
    els.selectedChips.appendChild(chip);
  });
}

function renderIgnoredChips() {
  const lang = getLang();
  els.ignoredChips.replaceChildren();

  if (!settings.ignoredCurrencies || settings.ignoredCurrencies.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'chips-empty';
    empty.textContent = t('ignoredEmpty', lang);
    els.ignoredChips.appendChild(empty);
    return;
  }

  for (const code of settings.ignoredCurrencies) {
    const info = getCurrencyInfo(code);
    const chip = document.createElement('span');
    chip.className = 'chip chip-ignored';

    const label = document.createElement('span');
    label.textContent = `${info.flag} ${info.code}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chip-remove';
    removeBtn.innerHTML = ICONS.x(12);
    removeBtn.title = t('removeCurrency', lang);
    removeBtn.addEventListener('click', async () => {
      settings.ignoredCurrencies = settings.ignoredCurrencies.filter((c) => c !== code);
      await saveSettings();
      renderIgnoredChips();
      renderCurrencyList();
    });

    chip.append(label, removeBtn);
    els.ignoredChips.appendChild(chip);
  }
}

function renderPickerTabs() {
  for (const tab of els.pickerTabs) {
    const isActive = tab.getAttribute('data-picker-tab') === activePickerTab;
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
}

function renderUiSurface() {
  for (const btn of els.surfaceBtns) {
    const selected = btn.getAttribute('data-surface') === settings.uiSurface;
    btn.setAttribute('aria-checked', selected ? 'true' : 'false');
  }
}

function renderCurrencyList() {
  const lang = getLang();
  const isIgnoredTab = activePickerTab === 'ignored';
  const q = searchQuery.trim().toLowerCase();
  const filtered = CURRENCIES.filter((c) => {
    if (!q) return true;
    return (
      c.code.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.nameRu.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q)
    );
  });

  els.currencyList.replaceChildren();

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = t('noCurrenciesFound', lang);
    els.currencyList.appendChild(empty);
    return;
  }

  for (const c of filtered) {
    const selected = isIgnoredTab
      ? settings.ignoredCurrencies.includes(c.code)
      : settings.targetCurrencies.includes(c.code);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'curr-item';
    btn.setAttribute('role', 'option');
    btn.setAttribute('data-picker', activePickerTab);
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');

    const left = document.createElement('div');
    left.className = 'curr-left';

    const flag = document.createElement('span');
    flag.className = 'curr-flag';
    flag.textContent = c.flag;

    const code = document.createElement('span');
    code.className = 'curr-code';
    code.textContent = c.code;

    const name = document.createElement('span');
    name.className = 'curr-name';
    name.textContent = lang === 'ru' ? c.nameRu : c.nameEn;

    left.append(flag, code, name);

    const check = document.createElement('span');
    check.className = 'curr-check';
    check.innerHTML = selected ? ICONS.check(11) : '';

    btn.append(left, check);

    btn.addEventListener('click', async () => {
      if (isIgnoredTab) {
        if (selected) {
          settings.ignoredCurrencies = settings.ignoredCurrencies.filter((x) => x !== c.code);
        } else {
          settings.ignoredCurrencies = [...settings.ignoredCurrencies, c.code];
        }
        await saveSettings();
        renderIgnoredChips();
        renderCurrencyList();
      } else {
        if (selected) {
          if (settings.targetCurrencies.length <= 1) return;
          settings.targetCurrencies = settings.targetCurrencies.filter((x) => x !== c.code);
        } else {
          settings.targetCurrencies = [...settings.targetCurrencies, c.code];
        }
        await saveSettings();
        renderSelectedChips();
        renderCurrencyList();
        renderPreview();
      }
    });

    els.currencyList.appendChild(btn);
  }
}

function renderRatesFooter() {
  const lang = getLang();
  const status = ratesState?.status || 'loading';
  els.ratesDot.setAttribute('data-status', status);
  els.refreshBtn.setAttribute('data-spinning', status === 'loading' ? 'true' : 'false');

  if (status === 'loading') {
    els.ratesText.textContent = t('ratesLoading', lang);
  } else if (status === 'error' && !ratesState?.rates) {
    els.ratesText.textContent = t('ratesError', lang);
  } else {
    const rel = formatRelativeTime(ratesState?.updatedAt, lang);
    const src = ratesState?.source ? ` · ${ratesState.source}` : '';
    els.ratesText.textContent = `${rel}${src}`;
  }
}

function renderAll() {
  applyTheme();
  renderI18n();
  renderSiteBar();
  renderModes();
  renderSelectedChips();
  renderIgnoredChips();
  renderPickerTabs();
  renderCurrencyList();
  renderUiSurface();
  renderPreview();
  renderRatesFooter();
}

function bindEvents() {
  els.globalToggle.addEventListener('change', async () => {
    settings.enabled = els.globalToggle.checked;
    await saveSettings();
    renderI18n();
    renderSiteBar();
    renderModes();
  });

  els.langBtn.addEventListener('click', async () => {
    const next = getLang() === 'ru' ? 'en' : 'ru';
    settings.language = next;
    await saveSettings();
    renderAll();
  });

  els.siteToggleBtn.addEventListener('click', async () => {
    if (!activeHost) return;
    if (settings.disabledHosts.includes(activeHost)) {
      settings.disabledHosts = settings.disabledHosts.filter((h) => h !== activeHost);
    } else {
      settings.disabledHosts = [...settings.disabledHosts, activeHost];
    }
    await saveSettings();
    renderSiteBar();
  });

  for (const card of els.modeCards) {
    card.addEventListener('click', async () => {
      settings.mode = card.getAttribute('data-mode');
      await saveSettings();
      renderModes();
      renderPreview();
    });
  }

  for (const btn of els.segBtns) {
    btn.addEventListener('click', async () => {
      settings.inlineStyle = btn.getAttribute('data-inline-style');
      await saveSettings();
      renderModes();
      renderPreview();
    });
  }

  // Interactive preview badge
  els.previewBadge.addEventListener('mouseenter', () => {
    if (settings.mode === 'hover' || settings.mode === 'inline') {
      els.previewPopover.hidden = false;
    }
  });
  els.previewBadge.addEventListener('mouseleave', () => {
    if (settings.mode === 'hover' || settings.mode === 'inline') {
      els.previewPopover.hidden = true;
    }
  });
  els.previewBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    els.previewPopover.hidden = !els.previewPopover.hidden;
  });
  document.addEventListener('click', () => {
    els.previewPopover.hidden = true;
  });

  for (const tab of els.pickerTabs) {
    tab.addEventListener('click', () => {
      activePickerTab = tab.getAttribute('data-picker-tab') || 'target';
      renderPickerTabs();
      renderCurrencyList();
    });
  }

  for (const btn of els.surfaceBtns) {
    btn.addEventListener('click', async () => {
      const nextSurface = btn.getAttribute('data-surface') === 'sidepanel' ? 'sidepanel' : 'popup';
      if (settings.uiSurface === nextSurface) return;
      settings.uiSurface = nextSurface;
      renderUiSurface();

      // Trigger panel opening synchronously inside the user gesture before async storage writes
      let openPanelPromise = null;
      if (nextSurface === 'sidepanel' && !isPanelView) {
        try {
          if (extApi?.sidePanel?.open && activeWindowId != null) {
            openPanelPromise = extApi.sidePanel.open({ windowId: activeWindowId });
          } else if (extApi?.sidebarAction?.open) {
            openPanelPromise = extApi.sidebarAction.open();
          }
        } catch {
          openPanelPromise = null;
        }
      }

      try {
        if (extApi?.sidePanel?.setPanelBehavior) {
          await extApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: nextSurface === 'sidepanel' });
        }
        if (extApi?.action?.setPopup) {
          await extApi.action.setPopup({ popup: nextSurface === 'sidepanel' ? '' : 'popup/popup.html' });
        }
      } catch {
        // ignore
      }

      await saveSettings();
      sendRuntimeMessage({ type: 'SET_UI_SURFACE', uiSurface: nextSurface }).catch(() => {});

      if (openPanelPromise) {
        try {
          await openPanelPromise;
          window.close();
        } catch {
          // Next toolbar click will still open the side panel
        }
      }
    });
  }

  els.currencySearch.addEventListener('input', () => {
    searchQuery = els.currencySearch.value;
    renderCurrencyList();
  });

  els.themeBtn.addEventListener('click', async () => {
    const order = ['auto', 'light', 'dark'];
    const idx = order.indexOf(settings.theme);
    settings.theme = order[(idx + 1) % order.length];
    await saveSettings();
    applyTheme();
    renderI18n();
  });

  els.refreshBtn.addEventListener('click', async () => {
    ratesState = { ...ratesState, status: 'loading' };
    renderRatesFooter();
    const res = await sendRuntimeMessage({ type: 'FORCE_REFRESH_RATES' });
    if (res) {
      ratesState = res;
      renderRatesFooter();
      renderPreview();
    }
  });
}

async function detectActiveHost() {
  if (!extApi?.tabs?.query) return null;
  try {
    const tabs = await new Promise((resolve) => {
      const res = extApi.tabs.query({ active: true, currentWindow: true }, resolve);
      if (res && typeof res.then === 'function') res.then(resolve).catch(() => resolve([]));
    });
    if (tabs?.[0]?.windowId != null) {
      activeWindowId = tabs[0].windowId;
    }
    const url = tabs?.[0]?.url;
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return null;
    }
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function init() {
  mountStaticIcons();
  bindEvents();

  const area = getSettingsStorage();
  const [settingsData, ratesData, host] = await Promise.all([
    storageGet(area, [SETTINGS_STORAGE_KEY]),
    storageGet(extApi?.storage?.local, [RATES_STORAGE_KEY]),
    detectActiveHost(),
  ]);

  settings = normalizeSettings(settingsData[SETTINGS_STORAGE_KEY]);
  if (ratesData[RATES_STORAGE_KEY]) {
    ratesState = ratesData[RATES_STORAGE_KEY];
  }
  activeHost = host;

  renderAll();

  // Keep side panel in sync when switching tabs or changing settings elsewhere
  if (isPanelView && extApi?.tabs) {
    const refreshHost = async () => {
      activeHost = await detectActiveHost();
      renderSiteBar();
    };
    extApi.tabs.onActivated?.addListener(refreshHost);
    extApi.tabs.onUpdated?.addListener((_tabId, changeInfo, tab) => {
      if (tab?.active && (changeInfo.url || changeInfo.status === 'complete')) {
        refreshHost();
      }
    });
  }

  if (extApi?.storage?.onChanged) {
    extApi.storage.onChanged.addListener((changes) => {
      if (changes[SETTINGS_STORAGE_KEY]?.newValue) {
        settings = normalizeSettings(changes[SETTINGS_STORAGE_KEY].newValue);
        renderAll();
      }
      if (changes[RATES_STORAGE_KEY]?.newValue) {
        ratesState = changes[RATES_STORAGE_KEY].newValue;
        renderRatesFooter();
        renderPreview();
      }
    });
  }

  const fresh = await sendRuntimeMessage({ type: 'GET_RATES' });
  if (fresh) {
    ratesState = fresh;
    renderRatesFooter();
    renderPreview();
  }
}

init();
