/**
 * Grandstand Pass — XS2Event pricing rules.
 *
 * Supplier net_rate is always returned in minor units (cents),
 * confirmed by XS2Event support. A €5 handling allowance is
 * added per ticket, then a 15% markup on the resulting cost.
 *
 * This module only calculates indicative prices. It does not
 * verify stock, calculate applicable customer taxes/payment fees,
 * create bookings, or authorise checkout.
 */

export const DEFAULT_TICKET_MARKUP_PERCENT = 15;
export const TICKET_HANDLING_ALLOWANCE_EUR = 5;

export type SupplierPricingInput = {
  /** XS2Event net_rate in minor units, e.g. 4500 = €45.00. */
  netRateMinor: number;
  /** ISO currency code returned by XS2Event. */
  supplierCurrency: string;
  /** EUR -> supplier-currency rate; not needed for EUR tickets. */
  eurToSupplierRate?: number;
  /** Percentage markup on cost (not gross margin). Defaults to 15. */
  markupPercent?: number;
};

export type SupplierPricingBreakdown = {
  currency: string;
  supplierNetRate: number;
  handlingAllowance: number;
  costBasis: number;
  markupPercent: number;
  markupAmount: number;
  indicativeSellingPrice: number;
  customerPriceConfirmed: false;
};

/**
 * Returns null when required pricing or currency conversion data
 * is missing or invalid; never invents an exchange rate.
 */
export function calculateSupplierTicketPrice(
  input: SupplierPricingInput
): SupplierPricingBreakdown | null {
  const {
    netRateMinor,
    supplierCurrency,
    eurToSupplierRate,
    markupPercent = DEFAULT_TICKET_MARKUP_PERCENT,
  } = input;

  if (
    !Number.isSafeInteger(netRateMinor) ||
    netRateMinor <= 0 ||
    typeof supplierCurrency !== 'string' ||
    !/^[A-Z]{3}$/.test(supplierCurrency) ||
    !Number.isFinite(markupPercent) ||
    markupPercent < 0 ||
    markupPercent > 1000
  ) {
    return null;
  }

  if (
    supplierCurrency !== 'EUR' &&
    (typeof eurToSupplierRate !== 'number' ||
      !Number.isFinite(eurToSupplierRate) ||
      eurToSupplierRate <= 0)
  ) {
    return null;
  }

  const supplierNetRate = netRateMinor / 100;
  const handlingAllowance =
    TICKET_HANDLING_ALLOWANCE_EUR *
    (supplierCurrency === 'EUR' ? 1 : eurToSupplierRate!);
  const costBasis = supplierNetRate + handlingAllowance;
  const markupAmount = costBasis * (markupPercent / 100);
  const indicativeSellingPrice = costBasis + markupAmount;

  if (
    ![supplierNetRate, handlingAllowance, costBasis, markupAmount, indicativeSellingPrice]
      .every(Number.isFinite)
  ) {
    return null;
  }

  return {
    currency: supplierCurrency,
    supplierNetRate,
    handlingAllowance,
    costBasis,
    markupPercent,
    markupAmount,
    indicativeSellingPrice,
    customerPriceConfirmed: false,
  };
}
