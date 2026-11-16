export interface CurrencyInfo {
  code: string; // ISO 4217
  name: string; // English name
  symbol: string; // Display symbol
  decimals: number; // Minor-unit decimal places
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED ', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF ', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM ', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp ', decimals: 0 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R ', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR ', decimals: 2 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KWD', decimals: 3 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BHD', decimals: 3 },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR', decimals: 3 },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'JOD', decimals: 3 },
  { code: 'CLP', name: 'Chilean Peso', symbol: 'CLP$', decimals: 0 },
];

export const CURRENCY_MAP = new Map<string, CurrencyInfo>(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c])
);

export function getCurrencyInfo(code?: string | null): CurrencyInfo {
  if (!code) {
    return { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 };
  }
  const normalized = code.trim().toUpperCase();
  return (
    CURRENCY_MAP.get(normalized) ?? {
      code: normalized,
      name: normalized,
      symbol: normalized,
      decimals: 2,
    }
  );
}
