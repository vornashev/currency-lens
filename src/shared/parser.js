import { SYMBOL_TO_CODE, getCurrencyInfo } from './currencies.js';

const PREFIX_SYMBOLS = [
  'US$',
  'CA$',
  'AU$',
  'HK$',
  'SG$',
  'MX$',
  'CN¥',
  'R$',
  'C$',
  'A$',
  'S$',
  '€',
  '£',
  '₽',
  '₸',
  '₴',
  '₺',
  '¥',
  '￥',
  '₩',
  '₾',
  '֏',
  '฿',
  '₫',
  '₹',
  '₪',
  '$',
];

const SUFFIX_SYMBOLS = [
  'руб.',
  'руб',
  'грн.',
  'грн',
  'zł',
  'Kč',
  'Ft',
  '₽',
  '€',
  '£',
  '₸',
  '₴',
  '₺',
  '¥',
  '￥',
  '₩',
  '₾',
  '֏',
  '฿',
  '₫',
  '₹',
  '₪',
  '$',
];

const ISO_CODES = [
  'USD',
  'EUR',
  'RUB',
  'GBP',
  'KZT',
  'UAH',
  'BYN',
  'TRY',
  'CNY',
  'RMB',
  'JPY',
  'KRW',
  'PLN',
  'CHF',
  'CAD',
  'AUD',
  'AED',
  'GEL',
  'AMD',
  'UZS',
  'THB',
  'VND',
  'INR',
  'BRL',
  'MXN',
  'SEK',
  'NOK',
  'DKK',
  'CZK',
  'HUF',
  'ILS',
  'SGD',
  'HKD',
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PREFIX_SYM_RE = PREFIX_SYMBOLS.map(escapeRegex).join('|');
const SUFFIX_SYM_RE = SUFFIX_SYMBOLS.map(escapeRegex).join('|');
const ISO_RE = ISO_CODES.join('|');

// Matches numbers like: 1 299,50 | 1,299.50 | 1.299,50 | 49.99 | 1200 | 12.5k
const HSPACE = '[ \\t\\u00A0\\u202F\\u2009]';
const NUM_CORE = '(?:\\d{1,3}(?:[ \\t\\u00A0\\u202F\\u2009.,]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?';
const NUM_WITH_K = `${NUM_CORE}(?:[kK]\\b)?`;

export const AMBIGUOUS_SYMBOL_CODES = {
  '¥': new Set(['CNY', 'JPY']),
  '￥': new Set(['CNY', 'JPY']),
  '$': new Set(['USD', 'CAD', 'AUD', 'HKD', 'SGD', 'MXN', 'BRL']),
};

function isCompatibleIsoForSymbol(sym, baseCode, isoCode) {
  if (!isoCode) return false;
  if (isoCode === baseCode) return true;
  return Boolean(AMBIGUOUS_SYMBOL_CODES[sym]?.has(isoCode));
}

function hasDecimalFraction(numStr) {
  if (!numStr) return false;
  const cleaned = numStr.trim().replace(/[kK]$/, '');
  const m = cleaned.match(/([.,])(\d+)$/);
  if (!m) return false;
  const frac = m[2];
  // 1 or 2 digits after separator is always a decimal fraction (not a 3-digit thousands group)
  return frac.length === 1 || frac.length === 2;
}

// Pattern A: Prefix symbol ($49.99, US$ 1,299.00, €10 – €20, $10-20, ¥34.63 CNY, $49.99 CAD)
// Pattern B: Prefix ISO code (USD 49.99, CHF 120.00, AED 350)
// Pattern C: Suffix symbol (1 490 ₽, 2 500 руб., 49,99 €, 100 zł, 4,99 $)
// Pattern D: Suffix ISO code (199.99 USD, 49,99 EUR)
const PRICE_REGEX = new RegExp(
  [
    // A: Prefix symbol (with optional trailing ISO disambiguator like "¥34.63 CNY" or "$49.99 CAD")
    `(?<![\\p{L}\\p{N}_])(?<preSym>${PREFIX_SYM_RE})${HSPACE}{0,2}(?<preNum>${NUM_WITH_K})(?:${HSPACE}*[-–—]${HSPACE}*(?:${PREFIX_SYM_RE})?${HSPACE}{0,2}(?<preRange>${NUM_WITH_K}))?(?:${HSPACE}+(?<preTrailIso>${ISO_RE}))?(?![\\p{L}\\p{N}_])`,
    // B: Prefix ISO code (requires space between ISO code and number)
    `(?<![\\p{L}\\p{N}_])(?<preIso>${ISO_RE})${HSPACE}+(?<preIsoNum>${NUM_CORE})(?:${HSPACE}*[-–—]${HSPACE}*(?:${ISO_RE})?${HSPACE}{0,2}(?<preIsoRange>${NUM_CORE}))?(?![\\p{L}\\p{N}_])`,
    // C: Suffix symbol
    `(?<![\\p{L}\\p{N}_./-])(?<sufNum>${NUM_CORE})(?:${HSPACE}*[-–—]${HSPACE}*(?<sufRange>${NUM_CORE}))?${HSPACE}{0,2}(?<sufSym>${SUFFIX_SYM_RE})(?![\\p{L}\\p{N}_])`,
    // D: Suffix ISO code (requires space)
    `(?<![\\p{L}\\p{N}_./-])(?<sufIsoNum>${NUM_CORE})(?:${HSPACE}*[-–—]${HSPACE}*(?<sufIsoRange>${NUM_CORE}))?${HSPACE}+(?<sufIso>${ISO_RE})(?![\\p{L}\\p{N}_])`,
  ].join('|'),
  'gu'
);

/**
 * Parse a localized numeric string (US, EU, space-grouped, optional k suffix) into a JS number.
 */
export function parseLocalizedNumber(raw) {
  if (typeof raw !== 'string') return NaN;
  let cleaned = raw.trim().replace(/[\s\u00A0\u202F\u2009']/g, '');
  let multiplier = 1;
  if (/[kK]$/.test(cleaned)) {
    multiplier = 1000;
    cleaned = cleaned.slice(0, -1);
  }
  if (!cleaned) return NaN;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    // Whichever separator appears last is the decimal separator
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      cleaned = cleaned.replaceAll('.', '').replace(',', '.');
    } else {
      cleaned = cleaned.replaceAll(',', '');
    }
  } else if (hasComma) {
    const parts = cleaned.split(',');
    if (parts.length > 2) {
      // Multiple commas -> thousands separators
      cleaned = parts.join('');
    } else {
      const [intPart, fracPart] = parts;
      if (fracPart.length === 3 && intPart !== '0') {
        cleaned = intPart + fracPart;
      } else {
        cleaned = `${intPart}.${fracPart}`;
      }
    }
  } else if (hasDot) {
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts.join('');
    } else {
      const [intPart, fracPart] = parts;
      if (fracPart.length === 3 && intPart !== '0') {
        cleaned = intPart + fracPart;
      }
    }
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return NaN;
  return value * multiplier;
}

/**
 * Resolve a currency symbol or ISO code string to an ISO 4217 code.
 */
export function resolveCurrencyToken(token) {
  if (!token) return null;
  const key = token.trim().toLowerCase();
  return SYMBOL_TO_CODE[key] || null;
}

/**
 * Extract all valid price matches from a plain text string.
 */
export function parsePricesInText(text) {
  if (!text || typeof text !== 'string' || text.length < 2) return [];
  if (!/\d/.test(text)) return [];

  const matches = [];
  PRICE_REGEX.lastIndex = 0;

  let m;
  while ((m = PRICE_REGEX.exec(text)) !== null) {
    const g = m.groups || {};
    const token = g.preSym || g.preIso || g.sufSym || g.sufIso;
    const numStr = g.preNum || g.preIsoNum || g.sufNum || g.sufIsoNum;
    const rangeStr = g.preRange || g.preIsoRange || g.sufRange || g.sufIsoRange;

    let currency = resolveCurrencyToken(token);
    if (!currency) continue;

    let raw = m[0];
    let hasExplicitIso = Boolean(g.preIso || g.sufIso);

    // Handle optional trailing ISO disambiguator on prefix-symbol prices (e.g. "¥34.63 CNY", "$49.99 CAD")
    if (g.preSym && g.preTrailIso) {
      const trailCode = resolveCurrencyToken(g.preTrailIso);
      if (isCompatibleIsoForSymbol(g.preSym, currency, trailCode)) {
        currency = trailCode;
        hasExplicitIso = true;
      } else {
        // Incompatible trailing ISO (e.g. "$10 RUB") — leave it out of this match
        const trimIdx = raw.lastIndexOf(g.preTrailIso);
        if (trimIdx > 0) {
          raw = raw.slice(0, trimIdx).trimEnd();
          PRICE_REGEX.lastIndex = m.index + raw.length;
        }
      }
    }

    // Disambiguate ¥/￥ without explicit ISO: JPY has 0 decimals, whereas CNY uses 2 decimals (e.g. ¥34.63)
    if (!hasExplicitIso && (token === '¥' || token === '￥') && hasDecimalFraction(numStr)) {
      currency = 'CNY';
    }

    const amount = parseLocalizedNumber(numStr);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    let rangeEnd = null;
    if (rangeStr) {
      const parsedEnd = parseLocalizedNumber(rangeStr);
      if (Number.isFinite(parsedEnd) && parsedEnd > amount) {
        rangeEnd = parsedEnd;
      }
    }

    matches.push({
      start: m.index,
      end: m.index + raw.length,
      raw,
      amount,
      rangeEnd,
      currency,
      symbol: hasExplicitIso ? null : (g.preSym || g.sufSym || null),
    });
  }

  return matches;
}

const LEADING_ISO_RE = new RegExp(`^[\\s\\u00A0\\u202F\\u2009]*\\(?(${ISO_RE})\\)?(?![\\p{L}\\p{N}_])`, 'u');
const TRAILING_ISO_RE = new RegExp(`(?<![\\p{L}\\p{N}_])\\(?(${ISO_RE})\\)?[\\s\\u00A0\\u202F\\u2009]*$`, 'u');

/**
 * Disambiguate ambiguous currency symbols (¥ -> CNY/JPY, $ -> USD/CAD/AUD/...)
 * using adjacent DOM text (e.g. <span>¥34.63</span><span>CNY</span>).
 */
export function disambiguateCurrencyFromAdjacentText(match, nextText = '', prevText = '') {
  if (!match || !match.symbol || !AMBIGUOUS_SYMBOL_CODES[match.symbol]) {
    return match;
  }

  const allowed = AMBIGUOUS_SYMBOL_CODES[match.symbol];

  if (nextText) {
    const nextMatch = String(nextText).match(LEADING_ISO_RE);
    if (nextMatch) {
      const resolved = resolveCurrencyToken(nextMatch[1]);
      if (resolved && allowed.has(resolved)) {
        return { ...match, currency: resolved };
      }
    }
  }

  if (prevText) {
    const prevMatch = String(prevText).match(TRAILING_ISO_RE);
    if (prevMatch) {
      const resolved = resolveCurrencyToken(prevMatch[1]);
      if (resolved && allowed.has(resolved)) {
        return { ...match, currency: resolved };
      }
    }
  }

  return match;
}

/**
 * Convert an amount between two currencies using a USD-based rates map.
 */
export function convertAmount(amount, fromCode, toCode, rates) {
  if (!Number.isFinite(amount) || !rates) return null;
  const from = String(fromCode || '').toUpperCase();
  const to = String(toCode || '').toUpperCase();
  if (from === to) return amount;

  const fromRate = from === 'USD' ? 1 : rates[from];
  const toRate = to === 'USD' ? 1 : rates[to];
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0) {
    return null;
  }
  return (amount / fromRate) * toRate;
}

/**
 * Format a numeric amount in a given currency for clean UI display.
 */
export function formatMoney(amount, currencyCode, lang = 'en') {
  if (!Number.isFinite(amount)) return '—';
  const info = getCurrencyInfo(currencyCode);
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';

  let maxFrac = info.decimals;
  let minFrac = 0;

  if (Math.abs(amount) >= 1000) {
    maxFrac = info.decimals === 0 ? 0 : 0;
  } else if (Math.abs(amount) >= 1) {
    maxFrac = info.decimals;
    minFrac = info.decimals === 2 && !Number.isInteger(amount) ? 2 : 0;
  } else if (Math.abs(amount) > 0) {
    maxFrac = 4;
    minFrac = 2;
  }

  try {
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac,
    }).format(amount);

    // Place symbol naturally according to currency convention
    const prefixCurrencies = new Set([
      'USD',
      'EUR',
      'GBP',
      'CAD',
      'AUD',
      'JPY',
      'CNY',
      'KRW',
      'INR',
      'BRL',
      'MXN',
      'SGD',
      'HKD',
      'ILS',
      'THB',
    ]);

    if (prefixCurrencies.has(info.code)) {
      return `${info.symbol}${formattedNumber}`;
    }
    return `${formattedNumber} ${info.symbol}`;
  } catch {
    return `${amount.toFixed(maxFrac)} ${info.symbol}`;
  }
}

/**
 * Format a conversion rate value (e.g. 1 USD = 96.45 RUB).
 */
export function formatRate(rate, lang = 'en') {
  if (!Number.isFinite(rate)) return '—';
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
  const maxFrac = rate >= 100 ? 2 : rate >= 1 ? 3 : 4;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  }).format(rate);
}
