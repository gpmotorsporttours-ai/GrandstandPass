'use client';

import { useCart } from './CartProvider';
import { formatCurrency, isSupportedCurrency } from '../lib/currency';

type CurrencyAmounts = Partial<Record<'ZAR' | 'EUR' | 'USD' | 'GBP' | 'AED', number>>;

type FootballDisplayPriceProps = {
  sellingPrice: number;
  currency: string;
  displayPrices: CurrencyAmounts;
};

export default function FootballDisplayPrice({
  sellingPrice,
  currency,
  displayPrices,
}: FootballDisplayPriceProps) {
  const { displayCurrency } = useCart();
  const originalValid =
    isSupportedCurrency(currency) &&
    Number.isFinite(sellingPrice) &&
    sellingPrice > 0;

  const converted = displayPrices[displayCurrency];
  const hasConverted =
    typeof converted === 'number' &&
    Number.isFinite(converted) &&
    converted > 0;

  if (!originalValid) {
    return <p className="mt-1 text-2xl font-black text-navy">Price unavailable</p>;
  }

  const sameCurrency = displayCurrency === currency;
  const showPreferred = sameCurrency || hasConverted;
  const amount = sameCurrency ? sellingPrice : converted!;

  return (
    <div>
      <p className="mt-1 text-3xl font-black text-navy">
        {showPreferred
          ? formatCurrency(amount, displayCurrency)
          : formatCurrency(sellingPrice, currency)}
      </p>
      {!sameCurrency && showPreferred && (
        <p className="mt-1 text-xs text-slate-600">
          Indicative conversion · Original selling price:{' '}
          {formatCurrency(sellingPrice, currency)}
        </p>
      )}
      {!sameCurrency && !showPreferred && (
        <p className="mt-1 text-xs text-amber-800">
          {displayCurrency} conversion temporarily unavailable. Showing the original selling price.
        </p>
      )}
      <p className="muted mt-1 text-xs">
        Per ticket · Includes handling allowance and markup
      </p>
    </div>
  );
}
