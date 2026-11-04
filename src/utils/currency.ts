const DEFAULT_CURRENCY = '₹';

export function getCurrencySymbol(currency = 'INR'): string {
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };
  return symbols[currency] ?? currency;
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${Math.abs(amount).toFixed(2)}`;
}
