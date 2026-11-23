/**
 * Bilingual i18n dictionary (RU + EN) for popup and on-page UI.
 */
export const TRANSLATIONS = {
  en: {
    appName: 'CurrencyLens',
    enabledGlobal: 'Active',
    disabledGlobal: 'Paused',
    disableOnSite: 'Pause on {host}',
    enableOnSite: 'Resume on {host}',
    siteUnavailable: 'Unavailable on this page',
    displayModeTitle: 'Display mode',
    modeInline: 'Inline',
    modeInlineDesc: 'Directly on page',
    modeHover: 'On hover',
    modeHoverDesc: 'Badge + hover card',
    modeClick: 'On click',
    modeClickDesc: 'Badge + click popup',
    inlineStyleBeside: 'Beside price',
    inlineStyleReplace: 'Replace price',
    previewTitle: 'Live preview',
    previewHintHover: 'Hover the badge to preview popup',
    previewHintClick: 'Click the badge to preview popup',
    previewHintInline: 'Shown directly next to or over prices',
    currenciesTitle: 'Target currencies',
    currenciesSub: 'Primary (★) for inline · drag others to reorder',
    ignoredTitle: 'Do not convert',
    ignoredSub: 'Skip prices in these currencies',
    ignoredEmpty: 'None — all detected currencies are converted',
    pickerTabTarget: 'Target',
    pickerTabIgnored: 'Ignore',
    dragToReorder: 'Drag to change order in popup',
    searchCurrencies: 'Search currency (USD, Euro, ₽...)',
    setPrimary: 'Make primary',
    primaryBadge: 'Primary',
    removeCurrency: 'Remove currency',
    minOneCurrency: 'Keep at least one currency',
    noCurrenciesFound: 'No currencies match your search',
    uiSurfaceTitle: 'Open extension in',
    uiSurfacePopup: 'Popup',
    uiSurfaceSidepanel: 'Side panel',
    ratesUpdatedJustNow: 'Updated just now',
    ratesUpdatedMins: 'Updated {n}m ago',
    ratesUpdatedHours: 'Updated {n}h ago',
    ratesLoading: 'Loading rates…',
    ratesError: 'Rates unavailable',
    refreshRates: 'Refresh rates',
    badgeLoadingTitle: 'Loading exchange rates…',
    badgeHoverTitle: 'Hover to convert currency',
    badgeClickTitle: 'Click to convert currency',
    badgeInlineTitle: 'Click or hover to see all selected currencies',
    badgeErrorTitle: 'Failed to load rates — click to retry',
    popoverOriginal: 'Original',
    popoverCopied: 'Copied',
    popoverCopy: 'Copy value',
    popoverRateNote: '1 {from} = {rate} {to}',
    popoverErrorText: 'Could not load exchange rates.',
    popoverRetry: 'Retry',
    popoverLoadingText: 'Updating exchange rates…',
    themeAuto: 'Auto',
    themeLight: 'Light',
    themeDark: 'Dark',
  },
  ru: {
    appName: 'CurrencyLens',
    enabledGlobal: 'Включено',
    disabledGlobal: 'На паузе',
    disableOnSite: 'Пауза на {host}',
    enableOnSite: 'Включить на {host}',
    siteUnavailable: 'Недоступно на этой странице',
    displayModeTitle: 'Режим отображения',
    modeInline: 'Сразу',
    modeInlineDesc: 'Прямо на странице',
    modeHover: 'При наведении',
    modeHoverDesc: 'Плашка + ховер',
    modeClick: 'По нажатию',
    modeClickDesc: 'Плашка + клик',
    inlineStyleBeside: 'Рядом с ценой',
    inlineStyleReplace: 'Заменить цену',
    previewTitle: 'Живое превью',
    previewHintHover: 'Наведите на плашку для предпросмотра',
    previewHintClick: 'Нажмите на плашку для предпросмотра',
    previewHintInline: 'Отображается сразу рядом или вместо цены',
    currenciesTitle: 'Целевые валюты',
    currenciesSub: 'Основная (★) для «Сразу» · тяните остальные для порядка',
    ignoredTitle: 'Не переводить',
    ignoredSub: 'Пропускать цены в этих валютах',
    ignoredEmpty: 'Не выбрано — переводятся все найденные валюты',
    pickerTabTarget: 'Целевые',
    pickerTabIgnored: 'Не переводить',
    dragToReorder: 'Перетащите для изменения порядка при наведении/клике',
    searchCurrencies: 'Поиск валюты (RUB, Доллар, €...)',
    setPrimary: 'Сделать основной',
    primaryBadge: 'Основная',
    removeCurrency: 'Удалить валюту',
    minOneCurrency: 'Нужна минимум одна валюта',
    noCurrenciesFound: 'Валюты не найдены',
    uiSurfaceTitle: 'Открывать расширение',
    uiSurfacePopup: 'В попапе',
    uiSurfaceSidepanel: 'В боковой панели',
    ratesUpdatedJustNow: 'Обновлено только что',
    ratesUpdatedMins: 'Обновлено {n} мин назад',
    ratesUpdatedHours: 'Обновлено {n} ч назад',
    ratesLoading: 'Загрузка курсов…',
    ratesError: 'Курсы недоступны',
    refreshRates: 'Обновить курсы',
    badgeLoadingTitle: 'Загрузка курсов валют…',
    badgeHoverTitle: 'Наведите для конвертации',
    badgeClickTitle: 'Нажмите для конвертации',
    badgeInlineTitle: 'Наведите или нажмите для всех валют',
    badgeErrorTitle: 'Не удалось загрузить курсы — нажмите для повтора',
    popoverOriginal: 'Исходная цена',
    popoverCopied: 'Скопировано',
    popoverCopy: 'Копировать сумму',
    popoverRateNote: '1 {from} = {rate} {to}',
    popoverErrorText: 'Не удалось загрузить курсы валют.',
    popoverRetry: 'Повторить',
    popoverLoadingText: 'Загружаем актуальные курсы…',
    themeAuto: 'Авто',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
  },
};

export function resolveLanguage(settingLang) {
  if (settingLang === 'ru' || settingLang === 'en') {
    return settingLang;
  }
  const navLang =
    typeof navigator !== 'undefined' && navigator.language
      ? navigator.language.toLowerCase()
      : 'en';
  return navLang.startsWith('ru') ? 'ru' : 'en';
}

export function t(key, lang = 'en', params = {}) {
  const resolved = lang === 'ru' ? 'ru' : 'en';
  const table = TRANSLATIONS[resolved] || TRANSLATIONS.en;
  let str = table[key] ?? TRANSLATIONS.en[key] ?? key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replaceAll(`{${k}}`, String(v));
  }
  return str;
}

export function formatRelativeTime(timestamp, lang = 'en') {
  if (!timestamp) return '';
  const diffMs = Math.max(0, Date.now() - timestamp);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t('ratesUpdatedJustNow', lang);
  if (mins < 60) return t('ratesUpdatedMins', lang, { n: mins });
  const hours = Math.floor(mins / 60);
  return t('ratesUpdatedHours', lang, { n: hours });
}
