
export const SUPPORTED_CURRENCIES = [
  'ZAR',
  'EUR',
  'USD',
  'GBP',
  'AED',
] as const;

export type SupportedCurrency =
  (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_DISPLAY_CURRENCY:
  SupportedCurrency = 'EUR';

const CURRENCY_LOCALES: Record<
  SupportedCurrency,
  string
> = {
  ZAR: 'en-ZA',
  EUR: 'en-IE',
  USD: 'en-US',
  GBP: 'en-GB',
  AED: 'en-AE',
};

export function isSupportedCurrency(
  value: unknown
): value is SupportedCurrency {
  return (
    typeof value === 'string' &&
    SUPPORTED_CURRENCIES.some(
      (currency) => currency === value
    )
  );
}

export function formatCurrency(
  amount: number,
  currency: SupportedCurrency
): string {
  if (!Number.isFinite(amount)) {
    return 'Price unavailable';
  }

  return new Intl.NumberFormat(
    CURRENCY_LOCALES[currency],
    {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(amount);
}

export type CurrencyConversionResult = {
  amount: number;
  currency: SupportedCurrency;
  converted: boolean;
};

export function convertCurrency(
  amount: number,
  sourceCurrency: SupportedCurrency,
  targetCurrency: SupportedCurrency,
  exchangeRate?: number
): CurrencyConversionResult | null {
  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return null;
  }

  if (sourceCurrency === targetCurrency) {
    return {
      amount,
      currency: targetCurrency,
      converted: false,
    };
  }

  if (
    typeof exchangeRate !== 'number' ||
    !Number.isFinite(exchangeRate) ||
    exchangeRate <= 0
  ) {
    return null;
  }

  return {
    amount: amount * exchangeRate,
    currency: targetCurrency,
    converted: true,
  };
}
