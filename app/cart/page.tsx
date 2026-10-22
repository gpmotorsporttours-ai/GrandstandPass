
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  Ticket,
} from 'lucide-react';

import { useCart } from '../../components/CartProvider';
import {
  calculateSupplierTicketPrice,
  type SupplierPricingBreakdown,
} from '../../lib/supplierPricing';
import {
  formatCurrency,
  isSupportedCurrency,
  type SupportedCurrency,
} from '../../lib/currency';

type ConvertedPrice = {
  supplierAmount: number;
  supplierCurrency: SupportedCurrency;
  displayAmount: number;
  displayCurrency: SupportedCurrency;
  exchangeRate: number;
  rateDate: string;
  converted: boolean;
  indicative: true;
};

type PricingState = {
  requestKey: string;
  prices: Record<string, ConvertedPrice>;
  breakdowns: Record<string, SupplierPricingBreakdown>;
  loading: boolean;
  failed: boolean;
};

function formatOriginalPrice(
  amount: number,
  currency: string
): string {
  if (!Number.isFinite(amount) || amount < 0) {
    return 'Price unavailable';
  }

  if (isSupportedCurrency(currency)) {
    return formatCurrency(amount, currency);
  }

  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return 'Price unavailable';
  }
}

function isValidPrice(
  price: unknown,
  currency: unknown
): currency is SupportedCurrency {
  return (
    typeof price === 'number' &&
    Number.isFinite(price) &&
    price > 0 &&
    isSupportedCurrency(currency)
  );
}

export default function CartPage() {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    itemCount,
    displayCurrency,
  } = useCart();

  const [pricingState, setPricingState] =
    useState<PricingState | null>(null);

  const requestKey = JSON.stringify({
    displayCurrency,
    tickets: items.map((item) => ({
      id: item.id,
      price: item.price,
      currency: item.currency,
      supplier: item.supplier,
      supplierEnvironment: item.supplierEnvironment,
      supplierRawNetRate: item.supplierRawNetRate,
    })),
  });

  useEffect(() => {
    let cancelled = false;

    const pricedItems = items.filter((item) =>
      isValidPrice(item.price, item.currency)
    );

    if (pricedItems.length === 0) {
      return;
    }

    async function loadPrices() {
      setPricingState({
        requestKey,
        prices: {},
        breakdowns: {},
        loading: true,
        failed: false,
      });

      try {
        async function convertAmount(
          amount: number,
          from: SupportedCurrency,
          to: SupportedCurrency
        ): Promise<ConvertedPrice> {
          const params = new URLSearchParams({
            amount: String(amount),
            from,
            to,
          });
          const response = await fetch(
            `/api/cart-pricing?${params.toString()}`,
            { cache: 'no-store' }
          );
          if (!response.ok) {
            throw new Error('Currency conversion unavailable');
          }
          const data = await response.json();
          if (
            data.success !== true ||
            !data.pricing ||
            data.pricing.supplierAmount !== amount ||
            data.pricing.supplierCurrency !== from ||
            data.pricing.displayCurrency !== to ||
            typeof data.pricing.displayAmount !== 'number' ||
            !Number.isFinite(data.pricing.displayAmount) ||
            data.pricing.displayAmount < 0 ||
            typeof data.pricing.exchangeRate !== 'number' ||
            !Number.isFinite(data.pricing.exchangeRate) ||
            data.pricing.exchangeRate <= 0 ||
            typeof data.pricing.rateDate !== 'string' ||
            data.pricing.indicative !== true
          ) {
            throw new Error('Invalid currency conversion response');
          }
          return data.pricing as ConvertedPrice;
        }

        const results = await Promise.all(
          pricedItems.map(async (item) => {
            // Recheck inside the callback so TypeScript narrows the currency.
            if (!isValidPrice(item.price, item.currency)) {
              throw new Error('Invalid ticket price or currency');
            }
            const supplierCurrency = item.currency;

            const supplierTest =
              item.supplier === 'XS2Event' &&
              item.supplierEnvironment === 'test';

            let amount = item.price!;
            let breakdown: SupplierPricingBreakdown | null = null;

            if (supplierTest) {
              if (
                !Number.isSafeInteger(item.supplierRawNetRate) ||
                (item.supplierRawNetRate ?? 0) <= 0 ||
                Math.abs(item.price! * 100 - item.supplierRawNetRate!) > 0.01
              ) {
                throw new Error('Invalid supplier net rate');
              }

              let eurToSupplierRate: number | undefined;
              if (item.currency !== 'EUR') {
                const allowanceConversion = await convertAmount(
                  5,
                  'EUR',
                  supplierCurrency
                );
                eurToSupplierRate = allowanceConversion.displayAmount / 5;
              }

              breakdown = calculateSupplierTicketPrice({
                netRateMinor: item.supplierRawNetRate!,
                supplierCurrency,
                eurToSupplierRate,
              });
              if (!breakdown) {
                throw new Error('Supplier selling price unavailable');
              }
              amount = breakdown.indicativeSellingPrice;
            }

            const pricing = await convertAmount(
              amount,
              supplierCurrency,
              displayCurrency
            );
            return { id: item.id, pricing, breakdown };
          })
        );

        if (cancelled) return;

        const prices: Record<string, ConvertedPrice> = {};
        const breakdowns: Record<string, SupplierPricingBreakdown> = {};

        for (const result of results) {
          prices[result.id] = result.pricing;
          if (result.breakdown) {
            breakdowns[result.id] = result.breakdown;
          }
        }

        setPricingState({
          requestKey,
          prices,
          breakdowns,
          loading: false,
          failed: false,
        });
      } catch {
        if (cancelled) return;

        setPricingState({
          requestKey,
          prices: {},
          breakdowns: {},
          loading: false,
          failed: true,
        });
      }
    }

    void loadPrices();

    return () => {
      cancelled = true;
    };
  }, [requestKey, displayCurrency, items]);

  const hasPricedItems = items.some((item) =>
    isValidPrice(item.price, item.currency)
  );

  const allItemsPriced =
    items.length > 0 &&
    items.every((item) =>
      isValidPrice(item.price, item.currency)
    );

  const currentPricing =
    pricingState?.requestKey === requestKey
      ? pricingState
      : null;

  const conversionReady =
    allItemsPriced &&
    currentPricing !== null &&
    !currentPricing.loading &&
    !currentPricing.failed &&
    items.every((item) =>
      Object.prototype.hasOwnProperty.call(
        currentPricing.prices,
        item.id
      )
    );

  const convertedTotal = conversionReady
    ? items.reduce((sum, item) => {
        return (
          sum +
          currentPricing!.prices[item.id].displayAmount *
            item.quantity
        );
      }, 0)
    : null;

  const rateDates = conversionReady
    ? Array.from(
        new Set(
          items.map(
            (item) =>
              currentPricing!.prices[item.id].rateDate
          )
        )
      )
    : [];

  return (
    <>
      <section className="bg-ice border-b">
        <div className="container-wide py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-navy"
          >
            <ArrowLeft size={16} />
            Continue browsing events
          </Link>
        </div>
      </section>

      <section className="container-wide py-12">
        <div className="flex items-center gap-3 mb-8">
          <ShoppingCart
            size={30}
            className="text-blue"
          />

          <div>
            <h1 className="text-3xl md:text-4xl font-black text-navy">
              Your Shopping Cart
            </h1>

            <p className="muted mt-2">
              Review your ticket selections before
              proceeding to checkout.
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 md:p-12 text-center">
            <ShoppingCart
              size={48}
              className="mx-auto text-blue mb-5"
            />

            <h2 className="text-2xl font-bold text-navy">
              Your cart is empty
            </h2>

            <p className="muted mt-3 mb-7">
              Explore sporting events and choose your
              preferred tickets to get started.
            </p>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-navy px-7 py-4 text-white font-bold"
            >
              Explore Events
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-5">
              {items.map((item) => {
                const hasPrice = isValidPrice(
                  item.price,
                  item.currency
                );

                const convertedPrice =
                  hasPrice && currentPricing
                    ? currentPricing.prices[item.id]
                    : undefined;

                const isSupplierTestTicket =
                  item.supplier === 'XS2Event' &&
                  item.supplierEnvironment === 'test';

                const sellingBreakdown =
                  currentPricing?.breakdowns[item.id];

                const quantityLimit =
                  isSupplierTestTicket &&
                  typeof item.maxQuantity === 'number' &&
                  Number.isInteger(item.maxQuantity) &&
                  item.maxQuantity >= 1
                    ? Math.min(10, item.maxQuantity)
                    : 10;

                const atQuantityLimit =
                  item.quantity >= quantityLimit;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border bg-white p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-ice p-3">
                        <Ticket
                          size={24}
                          className="text-blue"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-blue">
                          {item.sport}
                        </p>

                        <h2 className="text-xl font-black text-navy mt-1">
                          {item.eventName}
                        </h2>

                        {isSupplierTestTicket && (
                          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
                            XS2Event TEST DATA — NOT FOR SALE
                          </div>
                        )}

                        {item.eventDate && (
                          <p className="muted text-sm mt-2">
                            Date: {item.eventDate}
                          </p>
                        )}

                        {item.session && (
                          <p className="muted text-sm mt-2">
                            Session: {item.session}
                          </p>
                        )}

                        <p className="text-sm mt-2">
                          <span className="muted">
                            Category:
                          </span>{' '}
                          <span className="font-semibold text-navy">
                            {item.category}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="border-t mt-5 pt-5 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              item.quantity - 1
                            )
                          }
                          aria-label={`Decrease quantity for ${item.eventName}`}
                          className="w-10 h-10 rounded-lg border flex items-center justify-center"
                        >
                          <Minus size={17} />
                        </button>

                        <span className="font-black text-navy min-w-6 text-center">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              item.quantity + 1
                            )
                          }
                          disabled={atQuantityLimit}
                          aria-label={`Increase quantity for ${item.eventName}`}
                          className="w-10 h-10 rounded-lg border flex items-center justify-center disabled:opacity-40"
                        >
                          <Plus size={17} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeItem(item.id)
                        }
                        className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:underline"
                      >
                        <Trash2 size={17} />
                        Remove
                      </button>
                    </div>

                    {isSupplierTestTicket && (
                      <div className="mt-3 text-xs text-amber-900">
                        <p>
                          Maximum test quantity: {quantityLimit}.
                          {atQuantityLimit
                            ? ' Maximum reached — the + button is disabled.'
                            : ' This is based on the last reported supplier stock.'}
                        </p>
                        <p className="mt-1">
                          Supplier stock is not reserved and may change.
                        </p>
                      </div>
                    )}

                    <div className="mt-4 text-sm font-semibold text-navy">
                      {hasPrice ? (
                        <>
                          <p>
                            {isSupplierTestTicket
                              ? 'XS2Event test supplier net rate:'
                              : 'Original unit price:'}{' '}
                            {formatOriginalPrice(
                              item.price!,
                              supplierCurrency
                            )}
                          </p>

                          {isSupplierTestTicket && sellingBreakdown && (
                            <div className="mt-2 text-sm font-normal space-y-1">
                              <p>
                                Handling allowance:{' '}
                                {formatOriginalPrice(
                                  sellingBreakdown.handlingAllowance,
                                  supplierCurrency
                                )}
                              </p>
                              <p>
                                15% markup:{' '}
                                {formatOriginalPrice(
                                  sellingBreakdown.markupAmount,
                                  supplierCurrency
                                )}
                              </p>
                              <p className="font-bold text-navy">
                                Indicative Grandstand Pass unit price:{' '}
                                {formatOriginalPrice(
                                  sellingBreakdown.indicativeSellingPrice,
                                  supplierCurrency
                                )}
                              </p>
                            </div>
                          )}

                          {convertedPrice ? (
                            <div className="mt-2">
                              <p className="text-blue font-bold">
                                {isSupplierTestTicket
                                  ? 'Indicative selling price in selected currency:'
                                  : 'Indicative unit price:'}{' '}
                                {formatCurrency(
                                  convertedPrice.displayAmount,
                                  displayCurrency
                                )}
                              </p>

                              <p className="muted text-xs font-normal mt-1">
                                Exchange-rate date:{' '}
                                {convertedPrice.rateDate}
                              </p>

                              <p className="muted text-xs font-normal mt-1">
                                Indicative line subtotal:{' '}
                                {formatCurrency(
                                  convertedPrice.displayAmount *
                                    item.quantity,
                                  displayCurrency
                                )}
                              </p>
                            </div>
                          ) : (
                            <p className="muted text-xs font-normal mt-2">
                              {currentPricing?.failed
                                ? 'Currency conversion is currently unavailable.'
                                : 'Calculating indicative price...'}
                            </p>
                          )}
                        </>
                      ) : (
                        <p>
                          Price: Awaiting live supplier pricing
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={clearCart}
                className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:underline"
              >
                <Trash2 size={17} />
                Empty shopping cart
              </button>
            </div>

            <aside className="rounded-2xl border bg-ice p-6">
              <h2 className="text-xl font-black text-navy">
                Order Summary
              </h2>

              <div className="border-b py-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="muted">
                    Total tickets
                  </span>

                  <span className="font-bold text-navy">
                    {itemCount}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="muted">
                    Preferred display currency
                  </span>

                  <span className="font-bold text-navy">
                    {displayCurrency}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="muted">
                    Indicative cart total
                  </span>

                  <span className="font-bold text-navy text-right">
                    {convertedTotal !== null
                      ? formatCurrency(
                          convertedTotal,
                          displayCurrency
                        )
                      : allItemsPriced
                        ? currentPricing?.failed
                          ? 'Conversion unavailable'
                          : 'Calculating...'
                        : 'Awaiting live pricing'}
                  </span>
                </div>
              </div>

              {items.some(
                (item) =>
                  item.supplier === 'XS2Event' &&
                  item.supplierEnvironment === 'test'
              ) && (
                <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                  TEST DATA — NOT FOR SALE. XS2Event test tickets
                  use an indicative Grandstand Pass selling price
                  with a €5 handling allowance per ticket and 15%
                  markup. Applicable taxes, payment charges and
                  other costs may not be included. No tickets have
                  been reserved.
                </p>
              )}

              {convertedTotal !== null && (
                <p className="text-xs muted mt-4">
                  Indicative converted total only.
                  XS2Event test ticket prices include the €5 handling
                  allowance and 15% markup. Final prices may differ.
                  {rateDates.length > 0 && (
                    <>
                      {' '}Exchange-rate date
                      {rateDates.length > 1 ? 's' : ''}:{' '}
                      {rateDates.join(', ')}.
                    </>
                  )}
                </p>
              )}

              {hasPricedItems &&
                !allItemsPriced && (
                  <p className="text-xs muted mt-4">
                    Some tickets are awaiting live
                    supplier pricing. A complete order
                    total cannot be calculated yet.
                  </p>
                )}

              {currentPricing?.failed && (
                <p className="text-xs text-red-600 mt-4">
                  Currency conversion is temporarily
                  unavailable. Original ticket prices
                  have been preserved.
                </p>
              )}

              <button
                type="button"
                disabled
                className="w-full mt-6 rounded-xl bg-navy py-4 font-bold text-white opacity-60 cursor-not-allowed"
              >
                Checkout Available Soon
              </button>

              <p className="muted text-xs mt-4 text-center">
                Booking and payment are not yet enabled.
                Ticket availability and prices will be
                confirmed when the live supplier
                integration is connected.
              </p>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
