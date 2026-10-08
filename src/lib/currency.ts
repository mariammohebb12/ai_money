export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'EGP' | 'AED' | 'SAR' | 'CAD' | 'AUD' | 'JPY' | 'INR';

export const CURRENCY_OPTIONS: { value: CurrencyCode; label: string }[] = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EGP', label: 'EGP — Egyptian Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'INR', label: 'INR — Indian Rupee' },
];

// JPY (and similarly zero-decimal currencies) is quoted in whole units, not cents.
const ZERO_DECIMAL_CURRENCIES = new Set<CurrencyCode>(['JPY']);

// Formats an amount using a currency's standard symbol/decimal conventions.
// This is display formatting only — the underlying number is never converted
// between currencies, it's shown as-is with a different symbol/format.
//
// Grouping separators are inserted manually rather than relying on
// Intl.NumberFormat('en-US', ...).format() to do it — some Hermes builds
// (notably older Android configs) ship without full ICU grouping data and
// silently return digits with no thousand separators.
export function formatCurrency(amount: number, currency: CurrencyCode) {
  const symbol = getCurrencySymbol(currency);
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  const [whole, fraction] = Math.abs(amount).toFixed(decimals).split('.');
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const value = fraction ? `${groupedWhole}.${fraction}` : groupedWhole;
  const spacer = /[A-Za-z]$/.test(symbol) ? ' ' : '';
  return `${amount < 0 ? '-' : ''}${symbol}${spacer}${value}`;
}

// The standalone symbol/code for a currency (e.g. "$", "€", "E£"), for use as
// an inline prefix in amount inputs rather than a fully formatted amount.
//
// Built from `.format()` rather than `.formatToParts()` — Hermes doesn't
// implement `formatToParts` and throws "undefined is not a function" on it.
export function getCurrencySymbol(currency: CurrencyCode) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0);
  return formatted.replace(/[\d\s]/g, '') || currency;
}
