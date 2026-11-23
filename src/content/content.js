import { extApi, getSettingsStorage, storageGet, sendRuntimeMessage } from '../shared/browser-api.js';
import { getCurrencyInfo } from '../shared/currencies.js';
import { t, resolveLanguage } from '../shared/i18n.js';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, RATES_STORAGE_KEY, normalizeSettings } from '../shared/defaults.js';
import { ICONS } from '../shared/icons.js';
import { parsePricesInText, disambiguateCurrencyFromAdjacentText, convertAmount, formatMoney } from '../shared/parser.js';
import { BADGE_CSS } from './styles.js';
import { CurrencyPopoverController } from './popover.js';

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'CODE',
  'PRE',
  'SVG',
  'CANVAS',
  'IFRAME',
  'HEAD',
  'TITLE',
  'META',
  'LINK',
  'CURRENCY-LENS-BADGE',
  'CURRENCY-LENS-POPOVER',
]);

const SWAP_ICON_SVG = ICONS.arrowLeftRight(12);
const ERROR_ICON_SVG = ICONS.alertCircle(12);

let sharedBadgeSheet = null;
let sharedBadgeTemplate = null;

function getBadgeSheet() {
  if (!sharedBadgeSheet) {
    sharedBadgeSheet = new CSSStyleSheet();
    sharedBadgeSheet.replaceSync(BADGE_CSS);
  }
  return sharedBadgeSheet;
}

function getBadgeTemplate() {
  if (!sharedBadgeTemplate) {
    sharedBadgeTemplate = document.createElement('template');
    sharedBadgeTemplate.innerHTML = `<button type="button" class="badge" aria-expanded="false"></button>`;
  }
  return sharedBadgeTemplate;
}

const SPLIT_PRICE_SELECTOR =
  'span, div, p, b, strong, ins, del, s, dd, dt, td, th, li, a, button, label, h1, h2, h3, h4, h5, h6';

const SPLIT_BLOCK_TAGS = new Set([
  'DIV',
  'P',
  'UL',
  'OL',
  'TABLE',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'NAV',
  'MAIN',
  'FORM',
]);

let currentSettings = { ...DEFAULT_SETTINGS };
let currentRatesState = { rates: null, status: 'loading', updatedAt: null, source: null };
let observer = null;
let toggleListenerAttached = false;
let scanTimer = null;
const observedRoots = new WeakSet();
const pendingScanRoots = new Set();
const pendingSplitAnchors = new Set();
const mountedBadges = new Set(); // Set<{ host, btn, anchor, origEl, isSplit, isPurePrice, priceData }>

const popover = new CurrencyPopoverController({
  onRetry: () => requestRates(true),
});

function getActiveHosts() {
  const hosts = [];
  try {
    const h = window.location.hostname.toLowerCase();
    if (h) hosts.push(h);
  } catch {
    // ignore
  }
  try {
    if (window.top && window.top !== window) {
      const topHost = window.top.location.hostname.toLowerCase();
      if (topHost && !hosts.includes(topHost)) hosts.push(topHost);
    }
  } catch {
    // cross-origin top frame
  }
  return hosts;
}

function isActiveOnThisPage() {
  if (!currentSettings.enabled) return false;
  for (const host of getActiveHosts()) {
    if (currentSettings.disabledHosts.includes(host)) return false;
  }
  return true;
}

function isCurrencyIgnored(currencyCode) {
  if (!currencyCode) return false;
  return Array.isArray(currentSettings.ignoredCurrencies) && currentSettings.ignoredCurrencies.includes(currencyCode);
}

function getParentAcrossShadow(el) {
  if (!el) return null;
  if (el.parentElement) return el.parentElement;
  if (el.parentNode instanceof ShadowRoot) return el.parentNode.host;
  return null;
}

function isNodeSkippable(node) {
  if (!node) return true;
  let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!el && node.parentNode instanceof ShadowRoot) {
    el = node.parentNode.host;
  }
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.hasAttribute('data-cl-ignore') || el.hasAttribute('data-cl-anchor') || el.hasAttribute('data-cl-split-anchor')) {
      return true;
    }
    if (el.isContentEditable) return true;
    el = getParentAcrossShadow(el);
  }
  return false;
}

function findEnclosingSplitAnchor(node) {
  let el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  while (el) {
    if (el.hasAttribute?.('data-cl-ignore')) return null;
    if (el.hasAttribute?.('data-cl-split-anchor')) return el;
    el = el.parentElement;
  }
  return null;
}

function formatConvertedForInline(priceData, targetCode, rates, lang) {
  const converted = convertAmount(priceData.amount, priceData.currency, targetCode, rates);
  if (converted == null) return null;
  if (priceData.rangeEnd) {
    const convertedEnd = convertAmount(priceData.rangeEnd, priceData.currency, targetCode, rates);
    if (convertedEnd != null) {
      return `${formatMoney(converted, targetCode, lang)} – ${formatMoney(convertedEnd, targetCode, lang)}`;
    }
  }
  return formatMoney(converted, targetCode, lang);
}

function hasLineThrough(startEl) {
  let el = startEl;
  let depth = 0;
  while (el && el.nodeType === Node.ELEMENT_NODE && depth < 5) {
    if (el.tagName === 'S' || el.tagName === 'DEL' || el.tagName === 'STRIKE') {
      return true;
    }
    try {
      const td = getComputedStyle(el).textDecorationLine || '';
      if (td.includes('line-through')) {
        return true;
      }
    } catch {
      // ignore
    }
    el = el.parentElement;
    depth++;
  }
  return false;
}

function updateBadgeRecord(record) {
  const { host, btn, origEl, anchor, isSplit, isPurePrice, priceData } = record;
  const lang = resolveLanguage(currentSettings.language);
  const mode = currentSettings.mode;
  const inlineStyle = currentSettings.inlineStyle;
  const targets = currentSettings.targetCurrencies;
  const primaryCode = targets.find((c) => c !== priceData.currency) || targets[0];
  const primaryInfo = getCurrencyInfo(primaryCode);

  // Sync theme attribute on badge host
  if (currentSettings.theme === 'light' || currentSettings.theme === 'dark') {
    host.setAttribute('data-theme', currentSettings.theme);
  } else {
    host.removeAttribute('data-theme');
  }

  // Determine badge state
  const hasRates = Boolean(currentRatesState?.rates);
  const state =
    currentRatesState?.status === 'loading' && !hasRates
      ? 'loading'
      : !hasRates && currentRatesState?.status === 'error'
        ? 'error'
        : hasRates
          ? 'ready'
          : 'loading';

  const canReplace = !isSplit || isPurePrice !== false;
  const isInlineReplace = canReplace && mode === 'inline' && inlineStyle === 'replace' && state === 'ready';

  btn.setAttribute('data-mode', mode);
  btn.setAttribute('data-state', state);
  btn.setAttribute('data-inline-replace', isInlineReplace ? 'true' : 'false');
  host.setAttribute('data-inline-replace', isInlineReplace ? 'true' : 'false');

  // Preserve strikethrough (text-decoration does not propagate across shadow/inline-flex boundaries)
  const struck = isInlineReplace && hasLineThrough(origEl || anchor);
  btn.setAttribute('data-strikethrough', struck ? 'true' : 'false');

  // Toggle original price visibility for inline-replace mode
  if (!isSplit && origEl) {
    origEl.style.display = isInlineReplace ? 'none' : '';
  } else if (isSplit && anchor) {
    if (isInlineReplace) {
      // Capture typography from the primary numeric child before hiding it
      let sampleEl = null;
      for (const child of anchor.children) {
        if (child === host) continue;
        if (/\d/.test(child.textContent || '')) {
          sampleEl = child;
          break;
        }
        if (!sampleEl) sampleEl = child;
      }
      if (sampleEl) {
        if (hasLineThrough(sampleEl)) {
          btn.setAttribute('data-strikethrough', 'true');
        }
        const cs = getComputedStyle(sampleEl);
        host.style.fontFamily = cs.fontFamily;
        host.style.fontSize = cs.fontSize;
        host.style.fontWeight = cs.fontWeight;
        host.style.fontStyle = cs.fontStyle;
        host.style.lineHeight = cs.lineHeight;
        host.style.letterSpacing = cs.letterSpacing;
        host.style.color = cs.color;
        host.style.textTransform = cs.textTransform;
        host.style.textDecoration = cs.textDecoration;
        host.style.textShadow = cs.textShadow;
      }
    } else {
      host.style.fontFamily = '';
      host.style.fontSize = '';
      host.style.fontWeight = '';
      host.style.fontStyle = '';
      host.style.lineHeight = '';
      host.style.letterSpacing = '';
      host.style.color = '';
      host.style.textTransform = '';
      host.style.textDecoration = '';
      host.style.textShadow = '';
    }

    for (const child of anchor.children) {
      if (child === host) continue;
      child.style.display = isInlineReplace ? 'none' : '';
    }
  }

  // Render badge inner UI by state & mode
  // Use aria-label instead of title so the native browser tooltip does not overlap our popover
  btn.removeAttribute('title');

  if (state === 'loading') {
    btn.setAttribute('aria-label', t('badgeLoadingTitle', lang));
    btn.innerHTML = `<span class="icon"><span class="spinner"></span></span><span>${primaryInfo.symbol}</span>`;
    return;
  }

  if (state === 'error') {
    btn.setAttribute('aria-label', t('badgeErrorTitle', lang));
    btn.innerHTML = `<span class="icon">${ERROR_ICON_SVG}</span><span>!</span>`;
    return;
  }

  if (mode === 'inline') {
    const formatted = formatConvertedForInline(priceData, primaryCode, currentRatesState.rates, lang);
    btn.setAttribute('aria-label', t('badgeInlineTitle', lang));
    if (isInlineReplace) {
      btn.innerHTML = `<span>${formatted || priceData.raw}</span>`;
    } else {
      btn.innerHTML = `<span>≈ ${formatted || primaryInfo.symbol}</span>`;
    }
    return;
  }

  if (mode === 'click') {
    btn.setAttribute('aria-label', t('badgeClickTitle', lang));
    btn.innerHTML = `<span class="icon">${SWAP_ICON_SVG}</span><span>${primaryInfo.symbol}</span><span class="click-dot" aria-hidden="true"></span>`;
    return;
  }

  // Default: hover mode
  btn.setAttribute('aria-label', t('badgeHoverTitle', lang));
  btn.innerHTML = `<span class="icon">${SWAP_ICON_SVG}</span><span>${primaryInfo.symbol}</span>`;
}

function createBadgeHost(priceData, anchor, origEl, isSplit, isPurePrice = true, deferUpdate = false) {
  const host = document.createElement('currency-lens-badge');
  host.setAttribute('data-cl-ignore', 'true');
  const shadow = host.attachShadow({ mode: 'open', delegatesFocus: true });
  shadow.adoptedStyleSheets = [getBadgeSheet()];
  shadow.appendChild(getBadgeTemplate().content.cloneNode(true));

  const btn = shadow.querySelector('button.badge');
  const record = { host, btn, anchor, origEl, isSplit, isPurePrice, priceData };

  const getContext = () => ({
    settings: currentSettings,
    ratesState: currentRatesState,
    lang: resolveLanguage(currentSettings.language),
  });

  // Hover interactions (used in 'hover' mode and also helpful in 'inline' mode)
  const handleEnter = () => {
    if (currentSettings.mode === 'hover' || currentSettings.mode === 'inline') {
      popover.scheduleOpen(btn, record.priceData, getContext(), 'hover', 150);
    }
  };

  const handleLeave = () => {
    if (currentSettings.mode === 'hover' || currentSettings.mode === 'inline') {
      popover.scheduleClose(180);
    }
  };

  btn.addEventListener('mouseenter', handleEnter);
  btn.addEventListener('mouseleave', handleLeave);

  // Prevent parent dropdowns/menus from closing or selecting on badge press
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });
  btn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  // Also trigger hover/highlight when hovering the original price itself
  if (origEl) {
    origEl.addEventListener('mouseenter', () => {
      btn.classList.add('is-hovered');
      if (currentSettings.mode === 'hover') {
        popover.scheduleOpen(btn, record.priceData, getContext(), 'hover', 180);
      }
    });
    origEl.addEventListener('mouseleave', () => {
      btn.classList.remove('is-hovered');
      if (currentSettings.mode === 'hover') {
        popover.scheduleClose(180);
      }
    });
  }

  // Click interaction (primary in 'click' mode, retry on error, or pin open in 'inline'/'hover')
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (btn.getAttribute('data-state') === 'error') {
      requestRates(true);
      return;
    }

    popover.open(btn, record.priceData, getContext(), 'click');
  });

  mountedBadges.add(record);
  if (!deferUpdate) {
    updateBadgeRecord(record);
  }
  return { host, record };
}

function getAdjacentSiblingText(node, direction) {
  let cur = node;
  for (let level = 0; level < 2 && cur; level++) {
    let sib = direction === 'next' ? cur.nextSibling : cur.previousSibling;
    while (sib) {
      if (sib.nodeType === Node.ELEMENT_NODE && sib.tagName === 'CURRENCY-LENS-BADGE') {
        sib = direction === 'next' ? sib.nextSibling : sib.previousSibling;
        continue;
      }
      const txt = (sib.textContent || '').trim();
      if (txt) return txt.slice(0, 24);
      sib = direction === 'next' ? sib.nextSibling : sib.previousSibling;
    }
    cur = cur.parentElement;
  }
  return '';
}

function processTextNode(textNode) {
  const text = textNode.nodeValue;
  if (!text || text.length < 2) return;
  const rawMatches = parsePricesInText(text);
  if (rawMatches.length === 0) return;

  const matches = [];
  for (const rawMatch of rawMatches) {
    let match = rawMatch;
    if (match.symbol) {
      const afterInNode = text.slice(match.end).trim();
      const beforeInNode = text.slice(0, match.start).trim();
      const nextText = afterInNode || getAdjacentSiblingText(textNode, 'next');
      const prevText = beforeInNode || getAdjacentSiblingText(textNode, 'prev');
      match = disambiguateCurrencyFromAdjacentText(match, nextText, prevText);
    }
    if (!isCurrencyIgnored(match.currency)) {
      matches.push(match);
    }
  }
  if (matches.length === 0) return;

  const parent = textNode.parentNode;
  if (!parent) return;

  const frag = document.createDocumentFragment();
  const createdRecords = [];
  let lastIndex = 0;

  for (const match of matches) {
    if (match.start > lastIndex) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex, match.start)));
    }

    const anchor = document.createElement('span');
    anchor.setAttribute('data-cl-anchor', 'true');
    anchor.style.display = 'inline';
    anchor.style.pointerEvents = 'auto';

    const origEl = document.createElement('span');
    origEl.setAttribute('data-cl-orig', 'true');
    origEl.textContent = match.raw;

    const { host: badgeHost, record } = createBadgeHost(match, anchor, origEl, false, true, true);
    anchor.append(origEl, badgeHost);
    frag.appendChild(anchor);
    createdRecords.push(record);

    lastIndex = match.end;
  }

  if (lastIndex < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  parent.replaceChild(frag, textNode);

  // Update badges after insertion so computed styles (e.g. ancestor line-through) are live
  for (const record of createdRecords) {
    updateBadgeRecord(record);
  }
}

/**
 * Handles split-DOM prices common on e-commerce sites, modals, and dropdowns:
 * e.g. <span class="price"><span>$</span><span>49</span><span>.99</span></span>
 * or   <div><span>0,49</span><span>$</span><span>в месяц</span></div>
 */
function scanSplitPriceContainers(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  const candidates = Array.from(root.querySelectorAll(SPLIT_PRICE_SELECTOR));
  if (root.nodeType === Node.ELEMENT_NODE && root.matches(SPLIT_PRICE_SELECTOR)) {
    candidates.unshift(root);
  }

  // Iterate bottom-up so innermost containers always take precedence over wrappers
  for (let i = candidates.length - 1; i >= 0; i--) {
    const el = candidates[i];
    if (isNodeSkippable(el)) continue;
    if (el.querySelector('[data-cl-anchor], [data-cl-split-anchor], currency-lens-badge')) continue;

    const childCount = el.childNodes.length;
    if (childCount < 2 || childCount > 6) continue;

    // Must only contain inline/text children (no nested layout containers)
    let hasBlockChild = false;
    for (const child of el.children) {
      if (SPLIT_BLOCK_TAGS.has(child.tagName)) {
        hasBlockChild = true;
        break;
      }
    }
    if (hasBlockChild) continue;

    const rawText = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (rawText.length < 2 || rawText.length > 32) continue;

    const matches = parsePricesInText(rawText);
    if (matches.length !== 1) continue;

    let match = matches[0];
    if (match.symbol) {
      match = disambiguateCurrencyFromAdjacentText(
        match,
        getAdjacentSiblingText(el, 'next'),
        getAdjacentSiblingText(el, 'prev')
      );
    }
    if (isCurrencyIgnored(match.currency)) continue;
    const extraLen = rawText.length - match.raw.trim().length;
    if (extraLen > 14) continue;

    const isPurePrice = extraLen <= 2;
    el.setAttribute('data-cl-split-anchor', 'true');
    const { host: badgeHost, record } = createBadgeHost(match, el, null, true, isPurePrice, true);
    el.appendChild(badgeHost);
    updateBadgeRecord(record);
  }
}

function syncSplitAnchor(anchor) {
  if (!anchor || !anchor.isConnected) return;
  let record = null;
  for (const r of mountedBadges) {
    if (r.isSplit && r.anchor === anchor) {
      record = r;
      break;
    }
  }
  if (!record) return;

  const rawText = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
  const matches = rawText.length <= 32 ? parsePricesInText(rawText) : [];
  if (matches.length === 1 && !isCurrencyIgnored(matches[0].currency)) {
    const match = matches[0];
    const extraLen = rawText.length - match.raw.trim().length;
    if (extraLen <= 14) {
      record.priceData = match;
      record.isPurePrice = extraLen <= 2;
      updateBadgeRecord(record);
      return;
    }
  }

  // No longer a valid split price — unwrap cleanly
  anchor.removeAttribute('data-cl-split-anchor');
  for (const child of anchor.children) {
    if (child !== record.host) child.style.display = '';
  }
  record.host.remove();
  mountedBadges.delete(record);
}

function pruneDisconnectedBadges() {
  for (const record of [...mountedBadges]) {
    if (!record.host.isConnected) {
      mountedBadges.delete(record);
    }
  }
}

function scanRoot(root) {
  if (!isActiveOnThisPage() || !root) return;

  if (root instanceof ShadowRoot || root === document.documentElement) {
    observeRoot(root);
  }

  const textNodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !/\d/.test(node.nodeValue)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (isNodeSkippable(node)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current;
  while ((current = walker.nextNode())) {
    textNodes.push(current);
  }

  for (const textNode of textNodes) {
    if (textNode.isConnected) {
      processTextNode(textNode);
    }
  }

  // Discover open Shadow DOM trees (e.g. Web Component modals, dropdowns, pricing cards)
  const shadowRoots = [];
  if (root.nodeType === Node.ELEMENT_NODE && root.shadowRoot && !isNodeSkippable(root)) {
    shadowRoots.push(root.shadowRoot);
  }
  const elWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode(el) {
      if (isNodeSkippable(el)) return NodeFilter.FILTER_REJECT;
      return el.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  let shadowHost;
  while ((shadowHost = elWalker.nextNode())) {
    if (shadowHost.shadowRoot) {
      shadowRoots.push(shadowHost.shadowRoot);
    }
  }

  for (const sr of shadowRoots) {
    observeRoot(sr);
    scanRoot(sr);
  }

  scanSplitPriceContainers(root);
}

function refreshAllBadges() {
  for (const record of [...mountedBadges]) {
    if (!record.host.isConnected) {
      mountedBadges.delete(record);
      continue;
    }
    updateBadgeRecord(record);
  }
}

function teardownAllBadges() {
  popover.close();
  for (const record of [...mountedBadges]) {
    const { host, anchor, origEl, isSplit } = record;
    if (isSplit) {
      if (anchor) {
        anchor.removeAttribute('data-cl-split-anchor');
        for (const child of anchor.children) {
          if (child !== host) child.style.display = '';
        }
      }
      host.remove();
    } else if (anchor && anchor.parentNode) {
      const originalText = origEl ? origEl.textContent : record.priceData.raw;
      anchor.parentNode.replaceChild(document.createTextNode(originalText), anchor);
    }
    mountedBadges.delete(record);
  }
}

function scheduleScan(target) {
  if (!target) return;
  const root = target === document ? document.documentElement : target;
  if (!root) return;
  pendingScanRoots.add(root);
  clearTimeout(scanTimer);
  scanTimer = setTimeout(flushPendingScans, 120);
}

function flushPendingScans() {
  scanTimer = null;
  if (!isActiveOnThisPage()) {
    pendingScanRoots.clear();
    pendingSplitAnchors.clear();
    return;
  }

  if (mountedBadges.size > 0) {
    pruneDisconnectedBadges();
  }

  if (pendingSplitAnchors.size > 0) {
    const anchors = [...pendingSplitAnchors];
    pendingSplitAnchors.clear();
    for (const anchor of anchors) {
      syncSplitAnchor(anchor);
    }
  }

  if (pendingScanRoots.size === 0) return;

  const roots = [...pendingScanRoots].filter((r) => r.isConnected);
  pendingScanRoots.clear();

  // Deduplicate nested roots so we don't scan the same subtree twice
  const filtered = roots.filter(
    (candidate) => !roots.some((other) => other !== candidate && other.contains?.(candidate))
  );

  for (const r of filtered) {
    if (r.isConnected) {
      scanRoot(r);
    }
  }
}

function handleMutations(mutations) {
  if (!isActiveOnThisPage()) return;

  for (const m of mutations) {
    if (m.type === 'childList' && m.addedNodes.length > 0) {
      const splitAnchor = findEnclosingSplitAnchor(m.target);
      if (splitAnchor) {
        const hasNonBadge = [...m.addedNodes].some(
          (n) => !(n.nodeType === Node.ELEMENT_NODE && n.tagName === 'CURRENCY-LENS-BADGE')
        );
        if (hasNonBadge) {
          pendingSplitAnchors.add(splitAnchor);
          clearTimeout(scanTimer);
          scanTimer = setTimeout(flushPendingScans, 120);
        }
        continue;
      }

      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && !isNodeSkippable(node)) {
          scheduleScan(m.target);
          break;
        }
        if (node.nodeType === Node.TEXT_NODE && /\d/.test(node.nodeValue || '') && !isNodeSkippable(node)) {
          scheduleScan(m.target);
          break;
        }
      }
    } else if (m.type === 'characterData') {
      const splitAnchor = findEnclosingSplitAnchor(m.target);
      if (splitAnchor) {
        pendingSplitAnchors.add(splitAnchor);
        clearTimeout(scanTimer);
        scanTimer = setTimeout(flushPendingScans, 120);
        continue;
      }

      if (/\d/.test(m.target.nodeValue || '') && !isNodeSkippable(m.target)) {
        const container = m.target.parentElement || m.target.getRootNode?.();
        if (container) scheduleScan(container);
      }
    }
  }
}

function observeRoot(root) {
  if (!root || observedRoots.has(root)) return;
  if (!observer) {
    observer = new MutationObserver(handleMutations);
  }
  observedRoots.add(root);
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function startObserver() {
  const root = document.documentElement || document.body;
  if (root) {
    observeRoot(root);
  }

  if (!toggleListenerAttached) {
    toggleListenerAttached = true;
    // Catch native <dialog>, Popover API, and <details> opening dynamically
    document.addEventListener(
      'toggle',
      (e) => {
        if (!isActiveOnThisPage()) return;
        const target = e.target;
        if (target instanceof Element && !isNodeSkippable(target)) {
          scheduleScan(target);
        }
      },
      true
    );
  }
}

async function requestRates(force = false) {
  currentRatesState = { ...currentRatesState, status: 'loading' };
  refreshAllBadges();

  const res = await sendRuntimeMessage({
    type: force ? 'FORCE_REFRESH_RATES' : 'GET_RATES',
  });
  if (res) {
    currentRatesState = res;
    refreshAllBadges();
  }
}

function getScanTarget() {
  return document.body || document.documentElement;
}

async function loadInitialState() {
  const settingsArea = getSettingsStorage();
  const [settingsData, ratesData] = await Promise.all([
    storageGet(settingsArea, [SETTINGS_STORAGE_KEY]),
    storageGet(extApi?.storage?.local, [RATES_STORAGE_KEY]),
  ]);

  currentSettings = normalizeSettings(settingsData[SETTINGS_STORAGE_KEY]);
  if (ratesData[RATES_STORAGE_KEY]) {
    currentRatesState = ratesData[RATES_STORAGE_KEY];
  }

  if (isActiveOnThisPage()) {
    const target = getScanTarget();
    if (target) {
      scanRoot(target);
    }
    startObserver();

    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          if (isActiveOnThisPage() && getScanTarget()) {
            scanRoot(getScanTarget());
          }
        },
        { once: true }
      );
    }
  }

  // Ask background to ensure fresh rates
  requestRates(false);
}

if (extApi?.storage?.onChanged) {
  extApi.storage.onChanged.addListener((changes) => {
    if (changes[SETTINGS_STORAGE_KEY]) {
      const wasActive = isActiveOnThisPage();
      const prevIgnoredKey = (currentSettings.ignoredCurrencies || []).slice().sort().join(',');
      currentSettings = normalizeSettings(changes[SETTINGS_STORAGE_KEY].newValue);
      const nowActive = isActiveOnThisPage();
      const nextIgnoredKey = (currentSettings.ignoredCurrencies || []).slice().sort().join(',');

      if (!nowActive) {
        teardownAllBadges();
      } else if (!wasActive && nowActive) {
        const target = getScanTarget();
        if (target) scanRoot(target);
        startObserver();
      } else if (prevIgnoredKey !== nextIgnoredKey) {
        popover.setTheme(currentSettings.theme);
        teardownAllBadges();
        const target = getScanTarget();
        if (target) scanRoot(target);
      } else {
        popover.setTheme(currentSettings.theme);
        refreshAllBadges();
      }
    }

    if (changes[RATES_STORAGE_KEY] && changes[RATES_STORAGE_KEY].newValue) {
      currentRatesState = changes[RATES_STORAGE_KEY].newValue;
      refreshAllBadges();
    }
  });
}

// Kick off
loadInitialState();
