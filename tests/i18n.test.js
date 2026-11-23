import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSLATIONS, t } from '../src/shared/i18n.js';

test('RU and EN translation tables have identical key sets', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).sort();
  const ruKeys = Object.keys(TRANSLATIONS.ru).sort();
  assert.deepEqual(ruKeys, enKeys);
});

test('t() interpolates parameters and respects selected language', () => {
  assert.equal(t('disableOnSite', 'en', { host: 'amazon.com' }), 'Pause on amazon.com');
  assert.equal(t('disableOnSite', 'ru', { host: 'amazon.com' }), 'Пауза на amazon.com');
  assert.equal(
    t('popoverRateNote', 'en', { from: 'USD', rate: '96.50', to: 'RUB' }),
    '1 USD = 96.50 RUB'
  );
});
