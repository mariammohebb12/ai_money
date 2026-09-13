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

// Formats an amount using a currency's standard symbol/decimal conventions.
// This is display formatting only — the underlying number is never converted
// between currencies, it's shown as-is with a different symbol/format.
export function formatCurrency(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
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
