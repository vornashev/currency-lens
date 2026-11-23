import { getCurrencyInfo } from '../shared/currencies.js';
import { t, formatRelativeTime } from '../shared/i18n.js';
import { ICONS } from '../shared/icons.js';
import { convertAmount, formatMoney, formatRate } from '../shared/parser.js';
import { POPOVER_CSS } from './styles.js';

function findOpenDialog(el) {
  let cur = el;
  while (cur) {
    if (cur instanceof Element) {
      const dialog = cur.closest('dialog[open]');
      if (dialog) return dialog;
      const root = cur.getRootNode?.();
      cur = root && root.host ? root.host : null;
    } else {
      break;
    }
  }
  return null;
}

/**
 * Singleton Shadow DOM popover rendered in the browser top layer via Popover API.
 * Handles viewport-aware positioning (works identically in Chrome and Firefox),
 * hover-bridge timing, click light-dismiss, and clipboard copy feedback.
 */
export class CurrencyPopoverController {
  constructor({ onRetry }) {
    this.onRetry = onRetry;
    this.host = null;
    this.shadow = null;
    this.card = null;
    this.activeTrigger = null;
    this.activeMode = null; // 'hover' | 'click'
    this.closeTimer = null;
    this.openTimer = null;
    this.isPointerInsideCard = false;
    this._onScrollOrResize = () => {
      if (this.isOpen() && this.activeTrigger) {
        this._positionCard(this.activeTrigger);
      }
    };
  }

  _ensureMounted(triggerEl = null) {
    const targetParent = findOpenDialog(triggerEl) || document.body || document.documentElement;
    if (!targetParent) return;

    if (!this.host) {
      this.host = document.createElement('currency-lens-popover');
      this.host.setAttribute('data-cl-ignore', 'true');
      this.shadow = this.host.attachShadow({ mode: 'open' });

      const sheet = new CSSStyleSheet();
      sheet.replaceSync(POPOVER_CSS);
      this.shadow.adoptedStyleSheets = [sheet];

      this.card = document.createElement('div');
      this.card.className = 'card';
      this.card.setAttribute('popover', 'manual');
      this.card.setAttribute('role', 'dialog');

      this.card.addEventListener('mouseenter', () => {
        this.isPointerInsideCard = true;
        this._clearCloseTimer();
      });

      this.card.addEventListener('mouseleave', () => {
        this.isPointerInsideCard = false;
        if (this.activeMode === 'hover') {
          this.scheduleClose(180);
        }
      });

      this.card.addEventListener('toggle', (e) => {
        const open = e.newState === 'open';
        if (this.activeTrigger) {
          this.activeTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        if (!open) {
          this.activeTrigger = null;
          this.activeMode = null;
          window.removeEventListener('scroll', this._onScrollOrResize, true);
          window.removeEventListener('resize', this._onScrollOrResize);
        }
      });

      this.shadow.appendChild(this.card);
    }

    if (this.host.parentNode !== targetParent) {
      if (this.isOpen()) {
        try {
          this.card.hidePopover();
        } catch {
          // ignore
        }
      }
      targetParent.appendChild(this.host);
    }
  }

  setTheme(theme) {
    if (!this.host) {
      this._ensureMounted();
    }
    if (!this.host) return;
    if (theme === 'light' || theme === 'dark') {
      this.host.setAttribute('data-theme', theme);
    } else {
      this.host.removeAttribute('data-theme');
    }
  }

  isOpen() {
    if (!this.card) return false;
    try {
      return this.card.matches(':popover-open');
    } catch {
      return this.card.style.display === 'block';
    }
  }

  _clearCloseTimer() {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  _clearOpenTimer() {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  scheduleOpen(triggerBtn, priceData, context, mode, delayMs = 150) {
    this._clearCloseTimer();
    this._clearOpenTimer();
    if (this.isOpen() && this.activeTrigger === triggerBtn) return;

    const effectiveDelay = this.isOpen() ? 0 : delayMs;
    this.openTimer = setTimeout(() => {
      this.open(triggerBtn, priceData, context, mode);
    }, effectiveDelay);
  }

  scheduleClose(delayMs = 180) {
    this._clearOpenTimer();
    this._clearCloseTimer();
    this.closeTimer = setTimeout(() => {
      if (!this.isPointerInsideCard) {
        this.close();
      }
    }, delayMs);
  }

  open(triggerBtn, priceData, context, mode = 'click') {
    this._ensureMounted(triggerBtn);
    if (!this.card) return;
    this._clearCloseTimer();
    this._clearOpenTimer();

    const { settings, ratesState, lang } = context;
    this.setTheme(settings.theme);

    // If clicking the same trigger while already open in click mode, toggle closed
    if (mode === 'click' && this.isOpen() && this.activeTrigger === triggerBtn) {
      this.close();
      return;
    }

    // Reset previous trigger's aria-expanded
    if (this.activeTrigger && this.activeTrigger !== triggerBtn) {
      this.activeTrigger.setAttribute('aria-expanded', 'false');
    }

    // Switch popover type before showing ('auto' for click light-dismiss, 'manual' for hover)
    const desiredType = mode === 'click' ? 'auto' : 'manual';
    if (this.card.getAttribute('popover') !== desiredType) {
      if (this.isOpen()) {
        try {
          this.card.hidePopover();
        } catch {
          // ignore
        }
      }
      this.card.setAttribute('popover', desiredType);
    }

    this.activeTrigger = triggerBtn;
    this.activeMode = mode;

    this._renderContent(priceData, settings, ratesState, lang, mode);

    try {
      if (!this.isOpen()) {
        this.card.showPopover();
      }
    } catch {
      this.card.style.display = 'block';
    }

    triggerBtn.setAttribute('aria-expanded', 'true');
    this._positionCard(triggerBtn);

    window.addEventListener('scroll', this._onScrollOrResize, true);
    window.addEventListener('resize', this._onScrollOrResize);
  }

  close() {
    this._clearCloseTimer();
    this._clearOpenTimer();
    if (!this.card) return;
    try {
      if (this.isOpen()) {
        this.card.hidePopover();
      }
    } catch {
      this.card.style.display = 'none';
    }
    if (this.activeTrigger) {
      this.activeTrigger.setAttribute('aria-expanded', 'false');
      this.activeTrigger = null;
    }
    this.activeMode = null;
  }

  _positionCard(triggerEl) {
    if (!this.card || !triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const cardRect = this.card.getBoundingClientRect();
    const margin = 10;
    const gap = 8;

    let top = rect.bottom + gap;
    if (top + cardRect.height > window.innerHeight - margin) {
      const aboveTop = rect.top - cardRect.height - gap;
      if (aboveTop >= margin) {
        top = aboveTop;
      } else {
        top = Math.max(margin, window.innerHeight - cardRect.height - margin);
      }
    }

    let left = rect.left;
    if (left + cardRect.width > window.innerWidth - margin) {
      left = window.innerWidth - cardRect.width - margin;
    }
    if (left < margin) {
      left = margin;
    }

    this.card.style.top = `${Math.round(top)}px`;
    this.card.style.left = `${Math.round(left)}px`;
  }

  _renderContent(priceData, settings, ratesState, lang, mode) {
    const srcInfo = getCurrencyInfo(priceData.currency);
    const origFormatted = priceData.rangeEnd
      ? `${formatMoney(priceData.amount, priceData.currency, lang)} – ${formatMoney(priceData.rangeEnd, priceData.currency, lang)}`
      : formatMoney(priceData.amount, priceData.currency, lang);

    this.card.replaceChildren();
    this.card.removeAttribute('data-compact');

    const rates = ratesState?.rates;
    const targets = settings.targetCurrencies;
    const visibleTargets = targets.filter((c) => !(c === priceData.currency && targets.length > 1));

    // Compact single-row conversion card with footer when only one target currency is shown
    if (rates && visibleTargets.length === 1) {
      const targetCode = visibleTargets[0];
      const info = getCurrencyInfo(targetCode);
      const converted = convertAmount(priceData.amount, priceData.currency, targetCode, rates);
      const convertedEnd = priceData.rangeEnd
        ? convertAmount(priceData.rangeEnd, priceData.currency, targetCode, rates)
        : null;
      const formatted =
        convertedEnd != null
          ? `${formatMoney(converted, targetCode, lang)} – ${formatMoney(convertedEnd, targetCode, lang)}`
          : formatMoney(converted, targetCode, lang);

      const unitRate = convertAmount(1, priceData.currency, targetCode, rates);

      this.card.setAttribute('data-compact', 'true');

      const bar = document.createElement('div');
      bar.className = 'compact-bar';

      const origEl = document.createElement('span');
      origEl.className = 'compact-orig';
      origEl.textContent = `${srcInfo.flag} ${origFormatted}`;

      const arrow = document.createElement('span');
      arrow.className = 'compact-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.innerHTML = ICONS.arrowRight(15);

      const targetBtn = document.createElement('button');
      targetBtn.type = 'button';
      targetBtn.className = 'compact-target';
      targetBtn.title = t('popoverCopy', lang);

      const targetVal = document.createElement('span');
      targetVal.textContent = `${info.flag} ${formatted}`;

      const copyIcon = document.createElement('span');
      copyIcon.className = 'copy-icon';
      copyIcon.innerHTML = ICONS.copy(14);

      targetBtn.append(targetVal, copyIcon);
      targetBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(formatted);
          targetBtn.setAttribute('data-copied', 'true');
          copyIcon.innerHTML = ICONS.check(14);
          setTimeout(() => {
            targetBtn.removeAttribute('data-copied');
            copyIcon.innerHTML = ICONS.copy(14);
          }, 1200);
        } catch {
          // Clipboard may be blocked in non-HTTPS contexts
        }
      });

      bar.append(origEl, arrow, targetBtn);

      if (mode === 'click') {
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'close-btn';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = ICONS.x(14);
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.close();
        });
        bar.appendChild(closeBtn);
      }

      const footer = document.createElement('div');
      footer.className = 'footer';

      const rateNote = document.createElement('span');
      rateNote.textContent =
        unitRate != null
          ? t('popoverRateNote', lang, {
              from: priceData.currency,
              rate: formatRate(unitRate, lang),
              to: targetCode,
            })
          : '';

      const timeNote = document.createElement('span');
      timeNote.textContent = formatRelativeTime(ratesState.updatedAt, lang);

      footer.append(rateNote, timeNote);
      this.card.append(bar, footer);
      return;
    }

    // Header
    const header = document.createElement('div');
    header.className = 'header';

    const origWrap = document.createElement('div');
    origWrap.className = 'orig-wrap';

    const origLabel = document.createElement('span');
    origLabel.className = 'orig-label';
    origLabel.textContent = t('popoverOriginal', lang);

    const origValue = document.createElement('span');
    origValue.className = 'orig-value';
    origValue.textContent = `${srcInfo.flag} ${origFormatted} (${srcInfo.code})`;

    origWrap.append(origLabel, origValue);
    header.appendChild(origWrap);

    if (mode === 'click') {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'close-btn';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML = ICONS.x(14);
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
      header.appendChild(closeBtn);
    }

    this.card.appendChild(header);

    // Body: loading / error / rates list
    if (!rates && ratesState?.status === 'loading') {
      const box = document.createElement('div');
      box.className = 'status-box';
      box.textContent = t('popoverLoadingText', lang);
      this.card.appendChild(box);
      return;
    }

    if (!rates) {
      const box = document.createElement('div');
      box.className = 'status-box';
      const msg = document.createElement('span');
      msg.textContent = t('popoverErrorText', lang);
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'retry-btn';
      retryBtn.textContent = t('popoverRetry', lang);
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onRetry?.();
      });
      box.append(msg, retryBtn);
      this.card.appendChild(box);
      return;
    }

    const rows = document.createElement('div');
    rows.className = 'rows';

    const primaryCode = targets[0];

    for (const targetCode of targets) {
      if (targetCode === priceData.currency && targets.length > 1) continue;

      const info = getCurrencyInfo(targetCode);
      const converted = convertAmount(priceData.amount, priceData.currency, targetCode, rates);
      const convertedEnd = priceData.rangeEnd
        ? convertAmount(priceData.rangeEnd, priceData.currency, targetCode, rates)
        : null;

      const formatted =
        convertedEnd != null
          ? `${formatMoney(converted, targetCode, lang)} – ${formatMoney(convertedEnd, targetCode, lang)}`
          : formatMoney(converted, targetCode, lang);

      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'row';
      row.title = t('popoverCopy', lang);
      if (targetCode === primaryCode) {
        row.setAttribute('data-primary', 'true');
      }

      const left = document.createElement('div');
      left.className = 'row-left';

      const flag = document.createElement('span');
      flag.className = 'flag';
      flag.textContent = info.flag;

      const codeCol = document.createElement('div');
      codeCol.className = 'code-col';

      const codeEl = document.createElement('span');
      codeEl.className = 'code';
      codeEl.textContent = info.code;
      if (targetCode === primaryCode) {
        const star = document.createElement('span');
        star.className = 'star';
        star.innerHTML = ICONS.starFilled(11);
        codeEl.appendChild(star);
      }

      const nameEl = document.createElement('span');
      nameEl.className = 'name';
      nameEl.textContent = lang === 'ru' ? info.nameRu : info.nameEn;

      codeCol.append(codeEl, nameEl);
      left.append(flag, codeCol);

      const right = document.createElement('div');
      right.className = 'row-right';

      const amountEl = document.createElement('span');
      amountEl.className = 'amount';
      amountEl.textContent = formatted;

      const copyIcon = document.createElement('span');
      copyIcon.className = 'copy-icon';
      copyIcon.innerHTML = ICONS.copy(14);

      right.append(amountEl, copyIcon);
      row.append(left, right);

      row.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(formatted);
          row.setAttribute('data-copied', 'true');
          copyIcon.innerHTML = ICONS.check(14);
          setTimeout(() => {
            row.removeAttribute('data-copied');
            copyIcon.innerHTML = ICONS.copy(14);
          }, 1200);
        } catch {
          // Clipboard may be blocked in non-HTTPS contexts
        }
      });

      rows.appendChild(row);
    }

    this.card.appendChild(rows);

    // Footer with primary conversion rate & freshness
    const displayRateTarget =
      targets.find((c) => c !== priceData.currency) || primaryCode;
    const unitRate = convertAmount(1, priceData.currency, displayRateTarget, rates);

    const footer = document.createElement('div');
    footer.className = 'footer';

    const rateNote = document.createElement('span');
    rateNote.textContent =
      unitRate != null
        ? t('popoverRateNote', lang, {
            from: priceData.currency,
            rate: formatRate(unitRate, lang),
            to: displayRateTarget,
          })
        : '';

    const timeNote = document.createElement('span');
    timeNote.textContent = formatRelativeTime(ratesState.updatedAt, lang);

    footer.append(rateNote, timeNote);
    this.card.appendChild(footer);
  }
}
