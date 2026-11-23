import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocalizedNumber,
  parsePricesInText,
  disambiguateCurrencyFromAdjacentText,
  convertAmount,
  formatMoney,
} from '../src/shared/parser.js';

test('parseLocalizedNumber handles US, EU, space-grouped, and k-suffix formats', () => {
  assert.equal(parseLocalizedNumber('49.99'), 49.99);
  assert.equal(parseLocalizedNumber('1,299.50'), 1299.5);
  assert.equal(parseLocalizedNumber('1.299,50'), 1299.5);
  assert.equal(parseLocalizedNumber('1 490'), 1490);
  assert.equal(parseLocalizedNumber('1\u00A0299,90'), 1299.9);
  assert.equal(parseLocalizedNumber('1,299'), 1299);
  assert.equal(parseLocalizedNumber('49,90'), 49.9);
  assert.equal(parseLocalizedNumber('12.5k'), 12500);
  assert.ok(Number.isNaN(parseLocalizedNumber('0')));
  assert.ok(Number.isNaN(parseLocalizedNumber('abc')));
});

test('parsePricesInText extracts prefix, suffix, ISO codes, and ranges', () => {
  const cases = [
    { text: 'Price: $49.99 today', currency: 'USD', amount: 49.99 },
    { text: 'Only €1.299,50!', currency: 'EUR', amount: 1299.5 },
    { text: 'Итого 1 490 ₽ за месяц', currency: 'RUB', amount: 1490 },
    { text: 'Стоимость 2 500 руб.', currency: 'RUB', amount: 2500 },
    { text: 'Hotel £240.00', currency: 'GBP', amount: 240 },
    { text: 'Transfer 350 AED', currency: 'AED', amount: 350 },
    { text: 'Swiss CHF 120.50', currency: 'CHF', amount: 120.5 },
    { text: 'Tokyo ¥3,200', currency: 'JPY', amount: 3200 },
    { text: 'Enterprise $12.5k', currency: 'USD', amount: 12500 },
    { text: 'CA$ 89.00', currency: 'CAD', amount: 89 },
    { text: '4,99 $', currency: 'USD', amount: 4.99 },
    { text: '0,49 $ в месяц', currency: 'USD', amount: 0.49 },
    { text: 'на период: 1 месяц, затем 4,99 $ в месяц', currency: 'USD', amount: 4.99 },
    { text: '99,99\u2009$ в месяц', currency: 'USD', amount: 99.99 },
    { text: '19,99  $', currency: 'USD', amount: 19.99 },
    { text: 'Balance ¥34.63 CNY', currency: 'CNY', amount: 34.63 },
    { text: 'Balance ¥34.63', currency: 'CNY', amount: 34.63 },
    { text: 'Balance ¥7.20', currency: 'CNY', amount: 7.2 },
    { text: 'Voucher ¥100 CNY', currency: 'CNY', amount: 100 },
    { text: 'Total 34.63 RMB', currency: 'CNY', amount: 34.63 },
    { text: 'Plan $49.99 CAD', currency: 'CAD', amount: 49.99 },
  ];

  for (const c of cases) {
    const res = parsePricesInText(c.text);
    assert.equal(res.length, 1, `Expected 1 match for "${c.text}", got ${res.length}`);
    assert.equal(res[0].currency, c.currency, `Currency mismatch for "${c.text}"`);
    assert.equal(res[0].amount, c.amount, `Amount mismatch for "${c.text}"`);
  }
});

test('disambiguateCurrencyFromAdjacentText resolves ¥ and $ from sibling ISO codes', () => {
  const [yenMatch] = parsePricesInText('¥500');
  assert.equal(yenMatch.currency, 'JPY');
  assert.equal(disambiguateCurrencyFromAdjacentText(yenMatch, 'CNY', '').currency, 'CNY');
  assert.equal(disambiguateCurrencyFromAdjacentText(yenMatch, '', 'RMB').currency, 'CNY');

  const [dollarMatch] = parsePricesInText('$49.99');
  assert.equal(dollarMatch.currency, 'USD');
  assert.equal(disambiguateCurrencyFromAdjacentText(dollarMatch, 'CAD', '').currency, 'CAD');
  // Unrelated ISO code should not override
  assert.equal(disambiguateCurrencyFromAdjacentText(dollarMatch, 'RUB', '').currency, 'USD');
});

test('parsePricesInText extracts price ranges accurately', () => {
  const res = parsePricesInText('Tickets: $19.99 – $49.99');
  assert.equal(res.length, 1);
  assert.equal(res[0].currency, 'USD');
  assert.equal(res[0].amount, 19.99);
  assert.equal(res[0].rangeEnd, 49.99);
});

test('parsePricesInText avoids common false positives', () => {
  const nonPrices = [
    'Version v2.4.1 released',
    'Date: 2026-11-22',
    'Count: 4200 items in stock',
    'Variable $price in JS',
    'Identifier USD_RATE = 100',
    'Phone +1-555-0199',
  ];

  for (const text of nonPrices) {
    const res = parsePricesInText(text);
    assert.equal(res.length, 0, `Unexpected match in "${text}": ${JSON.stringify(res)}`);
  }

  // Ensure newlines do not bridge a preceding number with a currency symbol on the next line
  const multiline = parsePricesInText('Total items: 5\n$10');
  assert.equal(multiline.length, 1);
  assert.equal(multiline[0].amount, 10);
  assert.equal(multiline[0].currency, 'USD');
});

test('convertAmount performs cross-currency conversion via USD base', () => {
  const rates = { USD: 1, EUR: 0.9, RUB: 90 };
  assert.equal(convertAmount(10, 'USD', 'RUB', rates), 900);
  assert.ok(Math.abs(convertAmount(90, 'EUR', 'RUB', rates) - 9000) < 1e-6);
  assert.equal(convertAmount(50, 'USD', 'USD', rates), 50);
  assert.equal(convertAmount(50, 'USD', 'UNKNOWN', rates), null);
});

test('formatMoney formats currencies cleanly in RU and EN', () => {
  const usdEn = formatMoney(49.99, 'USD', 'en');
  assert.ok(usdEn.includes('$') && usdEn.includes('49.99'), `Got "${usdEn}"`);

  const rubRu = formatMoney(4850, 'RUB', 'ru');
  assert.ok(rubRu.includes('₽') && rubRu.includes('4') && rubRu.includes('850'), `Got "${rubRu}"`);

  const jpyEn = formatMoney(3200, 'JPY', 'en');
  assert.ok(jpyEn.includes('¥') && !jpyEn.includes('.'), `Got "${jpyEn}"`);
});
