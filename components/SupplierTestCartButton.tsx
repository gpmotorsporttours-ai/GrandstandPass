
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ShoppingCart,
  Ticket,
} from 'lucide-react';
import { useCart } from './CartProvider';
import {
  formatCurrency,
  isSupportedCurrency,
} from '../lib/currency';

type DisplayCurrency =
  | 'ZAR'
  | 'EUR'
  | 'USD'
  | 'GBP'
  | 'AED';

type CurrencyAmounts = Partial<
  Record<DisplayCurrency, number>
>;

type SupplierTestCartButtonProps = {
  sport?: string;
  ticketId: string;
  eventId: string;
  eventName: string;
  eventDate?: string;
  category: string;
  categoryId?: string;
  stock: number;
  minOrder: number;
  currency: string;

  /** Server-calculated Grandstand Pass selling price. */
  sellingPrice?: number | null;

  /** Server-calculated indicative currency equivalents per ticket. */
  displayPrices?: CurrencyAmounts;

  /** Temporary compatibility only. These values are unused. */
  price?: number;
  rawNetRate?: number;
  rawFaceValue?: number;
};

export default function SupplierTestCartButton({
  sport = 'Football',
  ticketId,
  eventId,
  eventName,
  eventDate,
  category,
  categoryId,
  stock,
  minOrder,
  currency,
  sellingPrice,
  displayPrices,
}: SupplierTestCartButtonProps) {
  const {
    items,
    addItem,
    removeItem,
    displayCurrency,
  } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');

  const cartItemId = `xs2event-test:${ticketId}`;

  const existingItem = items.find(
    item => item.id === cartItemId
  );

  const validSellingPrice =
    typeof sellingPrice === 'number' &&
    Number.isFinite(sellingPrice) &&
    sellingPrice > 0;

  // Compare customer selling prices, not supplier costs.
  const staleCartItem = Boolean(
    existingItem &&
    (!validSellingPrice ||
      typeof existingItem.price !== 'number' ||
      Math.abs(
        existingItem.price - sellingPrice!
      ) > 0.005 ||
      existingItem.currency !== currency ||
      existingItem.supplier !== 'XS2Event' ||
      existingItem.supplierTicketId !== ticketId ||
      existingItem.supplierEnvironment !== 'test')
  );

  const alreadyInCart =
    existingItem?.quantity ?? 0;

  const validStock =
    Number.isInteger(stock) && stock > 0;

  const maxQuantity = validStock
    ? Math.min(10, stock)
    : 0;

  const remainingQuantity = Math.max(
    0,
    maxQuantity - alreadyInCart
  );

  const minimumQuantity =
    Number.isInteger(minOrder) && minOrder > 0
      ? minOrder
      : 1;

  const validTicket =
    ticketId.length > 0 &&
    eventId.length > 0 &&
    eventName.length > 0 &&
    category.length > 0 &&
    validStock &&
    validSellingPrice &&
    isSupportedCurrency(currency);

  const canAdd =
    validTicket &&
    !staleCartItem &&
    remainingQuantity >= minimumQuantity;

  const selectedQuantity = Math.min(
    Math.max(quantity, minimumQuantity),
    Math.max(
      minimumQuantity,
      remainingQuantity
    )
  );

  // The original selling price remains the source of truth.
  const originalTotal = validSellingPrice
    ? Math.round(
        sellingPrice! * selectedQuantity * 100
      ) / 100
    : null;

  // Currency equivalents are calculated on the server.
  const convertedUnitPrice =
    displayPrices?.[displayCurrency];

  const hasConvertedPrice =
    typeof convertedUnitPrice === 'number' &&
    Number.isFinite(convertedUnitPrice) &&
    convertedUnitPrice > 0;

  const sameCurrency =
    displayCurrency === currency;

  const showConvertedTotal =
    !sameCurrency && hasConvertedPrice;

  const convertedTotal = showConvertedTotal
    ? Math.round(
        convertedUnitPrice! *
          selectedQuantity *
          100
      ) / 100
    : null;

  const indicativeTotal =
    showConvertedTotal &&
    convertedTotal !== null
      ? formatCurrency(
          convertedTotal,
          displayCurrency
        )
      : originalTotal !== null &&
          isSupportedCurrency(currency)
        ? formatCurrency(
            originalTotal,
            currency
          )
        : null;

  function handleAddToCart() {
    if (
      !canAdd ||
      !isSupportedCurrency(currency) ||
      !validSellingPrice
    ) {
      return;
    }

    addItem({
      id: cartItemId,
      eventId,
      eventName,
      sport,
      eventDate,
      category,
      session: 'XS2Event TEST — Not for sale',
      quantity: selectedQuantity,

      // Always store the original selling price.
      price: sellingPrice!,
      currency,

      supplier: 'XS2Event',
      supplierTicketId: ticketId,
      supplierCategoryId: categoryId,
      supplierEnvironment: 'test',
      maxQuantity,
    });

    setMessage(
      `${selectedQuantity} test ticket${
        selectedQuantity === 1 ? '' : 's'
      } added to your cart.`
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Ticket
            size={20}
            aria-hidden="true"
          />
        </span>

        <div>
          <h4 className="text-lg font-extrabold text-navy">
            Select your tickets
          </h4>

          <p className="mt-1 text-sm text-slate-600">
            Choose a quantity to add to your test cart.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
        <span>
          <strong className="text-navy">
            In cart:
          </strong>{' '}
          {alreadyInCart}
        </span>

        <span>
          <strong className="text-navy">
            Remaining:
          </strong>{' '}
          {remainingQuantity}
        </span>
      </div>

      {staleCartItem && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            An older or differently priced version
            of this test ticket is in your cart.
            Remove it before adding the current offer.
          </p>

          <button
            type="button"
            onClick={() => {
              removeItem(cartItemId);
              setMessage(
                'Older test ticket removed.'
              );
            }}
            className="mt-3 rounded-lg border border-amber-700 bg-white px-4 py-2 font-bold text-amber-900 hover:bg-amber-100"
          >
            Remove older test ticket
          </button>
        </div>
      )}

      {canAdd ? (
        <>
          <label
            htmlFor={`quantity-${ticketId}`}
            className="mt-5 block text-sm font-bold text-navy"
          >
            Number of tickets
          </label>

          <select
            id={`quantity-${ticketId}`}
            value={selectedQuantity}
            onChange={event => {
              setQuantity(
                Number(event.target.value)
              );
              setMessage('');
            }}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-navy"
          >
            {Array.from(
              {
                length:
                  remainingQuantity -
                  minimumQuantity +
                  1,
              },
              (_, index) =>
                minimumQuantity + index
            ).map(value => (
              <option
                key={value}
                value={value}
              >
                {value}{' '}
                {value === 1
                  ? 'ticket'
                  : 'tickets'}
              </option>
            ))}
          </select>

          <div className="mt-4 rounded-lg bg-ice p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Indicative total
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {selectedQuantity}{' '}
                  {selectedQuantity === 1
                    ? 'ticket'
                    : 'tickets'}
                </p>
              </div>

              <p className="text-2xl font-black text-navy">
                {indicativeTotal}
              </p>
            </div>

            {showConvertedTotal &&
              originalTotal !== null &&
              isSupportedCurrency(currency) && (
                <p className="mt-2 text-xs text-slate-500">
                  Indicative conversion ·
                  Original total:{' '}
                  {formatCurrency(
                    originalTotal,
                    currency
                  )}
                </p>
              )}

            {!sameCurrency &&
              !hasConvertedPrice &&
              originalTotal !== null && (
                <p className="mt-2 text-xs text-amber-800">
                  {displayCurrency} conversion
                  unavailable. Showing the
                  original selling price.
                </p>
              )}
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue px-4 py-4 font-extrabold text-white transition hover:opacity-90"
          >
            <ShoppingCart
              size={20}
              aria-hidden="true"
            />
            Add to Test Cart
          </button>
        </>
      ) : !staleCartItem ? (
        <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          {validSellingPrice
            ? 'This offer cannot currently be added. The stock limit may have been reached, or the ticket details may be incomplete.'
            : 'Test cart temporarily unavailable until the Grandstand Pass selling price is passed from the server.'}
        </p>
      ) : null}

      {message && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          <p className="flex items-center gap-2 font-bold">
            <CheckCircle2
              size={18}
              aria-hidden="true"
            />
            {message}
          </p>

          <Link
            href="/cart"
            className="mt-2 inline-block font-bold underline"
          >
            View shopping cart →
          </Link>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        <strong>
          TEST DATA — NOT FOR SALE.
        </strong>{' '}
        Prices are indicative, availability
        may change, and no supplier reservation
        or payment is created. Checkout
        remains disabled.
      </p>
    </div>
  );
}
