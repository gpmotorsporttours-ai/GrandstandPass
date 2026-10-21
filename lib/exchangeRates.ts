
import 'server-only';

import {
  isSupportedCurrency,
  type SupportedCurrency,
} from './currency';

const EXCHANGE_RATE_API =
  'https://api.frankfurter.dev/v2';

const MAX_RATE_AGE_DAYS = 5;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type ExchangeRateResult = {
  from: SupportedCurrency;
  to: SupportedCurrency;
  rate: number;
  date: string;
  provider: 'Frankfurter';
};

export type ConvertedPrice = {
  originalAmount: number;
  originalCurrency: SupportedCurrency;
  convertedAmount: number;
  displayCurrency: SupportedCurrency;
  exchangeRate: number;
  rateDate: string;
};

type FrankfurterRateResponse = {
  date?: unknown;
  base?: unknown;
  quote?: unknown;
  rate?: unknown;
};

function isValidRateDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);

  if (
    !Number.isFinite(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    return false;
  }

  const ageInDays =
    (Date.now() - parsedDate.getTime()) /
    MILLISECONDS_PER_DAY;

  return ageInDays >= -1 && ageInDays <= MAX_RATE_AGE_DAYS;
}

export async function getExchangeRate(
  from: SupportedCurrency,
  to: SupportedCurrency
): Promise<ExchangeRateResult | null> {
  if (
    !isSupportedCurrency(from) ||
    !isSupportedCurrency(to)
  ) {
    return null;
  }

  if (from === to) {
    return {
      from,
      to,
      rate: 1,
      date: new Date().toISOString().slice(0, 10),
      provider: 'Frankfurter',
    };
  }

  try {
    const url =
      `${EXCHANGE_RATE_API}/rate/${from}/${to}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      next: {
        revalidate: 3600,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(
        'Exchange-rate provider returned HTTP status:',
        response.status
      );

      return null;
    }

    const data: FrankfurterRateResponse =
      await response.json();

    if (
      data.base !== from ||
      data.quote !== to ||
      typeof data.rate !== 'number' ||
      !Number.isFinite(data.rate) ||
      data.rate <= 0 ||
      typeof data.date !== 'string' ||
      !isValidRateDate(data.date)
    ) {
      console.error(
        'Exchange-rate provider returned invalid or outdated data.'
      );

      return null;
    }

    return {
      from,
      to,
      rate: data.rate,
      date: data.date,
      provider: 'Frankfurter',
    };
  } catch (error) {
    console.error(
      'Unable to retrieve exchange rate:',
      error instanceof Error
        ? error.name
        : 'Unknown error'
    );

    return null;
  }
}

export async function convertPrice(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency
): Promise<ConvertedPrice | null> {
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !isSupportedCurrency(from) ||
    !isSupportedCurrency(to)
  ) {
    return null;
  }

  const exchangeRate = await getExchangeRate(
    from,
    to
  );

  if (!exchangeRate) {
    return null;
  }

  const convertedAmount =
    amount * exchangeRate.rate;

  if (!Number.isFinite(convertedAmount)) {
    return null;
  }

  return {
    originalAmount: amount,
    originalCurrency: from,
    convertedAmount,
    displayCurrency: to,
    exchangeRate: exchangeRate.rate,
    rateDate: exchangeRate.date,
  };
}
