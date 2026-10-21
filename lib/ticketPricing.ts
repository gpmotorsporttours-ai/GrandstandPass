
import 'server-only';

import {
  isSupportedCurrency,
  type SupportedCurrency,
} from './currency';

import {
  convertPrice,
} from './exchangeRates';

export type SupplierTicketPrice = {
  amount: number;
  currency: SupportedCurrency;
};

export type TicketDisplayPrice = {
  supplierAmount: number;
  supplierCurrency: SupportedCurrency;
  displayAmount: number;
  displayCurrency: SupportedCurrency;
  exchangeRate: number;
  rateDate: string;
  converted: boolean;
  indicative: true;
};

function isValidSupplierPrice(
  price: SupplierTicketPrice
): boolean {
  return (
    typeof price.amount === 'number' &&
    Number.isFinite(price.amount) &&
    price.amount > 0 &&
    isSupportedCurrency(price.currency)
  );
}

export async function getTicketDisplayPrice(
  supplierPrice: SupplierTicketPrice,
  displayCurrency: SupportedCurrency
): Promise<TicketDisplayPrice | null> {
  if (
    !isValidSupplierPrice(supplierPrice) ||
    !isSupportedCurrency(displayCurrency)
  ) {
    return null;
  }

  const result = await convertPrice(
    supplierPrice.amount,
    supplierPrice.currency,
    displayCurrency
  );

  if (!result) {
    return null;
  }

  return {
    supplierAmount: supplierPrice.amount,
    supplierCurrency: supplierPrice.currency,
    displayAmount: result.convertedAmount,
    displayCurrency: result.displayCurrency,
    exchangeRate: result.exchangeRate,
    rateDate: result.rateDate,
    converted:
      supplierPrice.currency !== displayCurrency,
    indicative: true,
  };
}
