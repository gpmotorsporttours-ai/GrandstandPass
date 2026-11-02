'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Minus, Plus, ShoppingCart, Ticket } from 'lucide-react';
import { useCart } from './CartProvider';
import { formatCurrency, isSupportedCurrency } from '../lib/currency';

type DisplayCurrency = 'ZAR' | 'EUR' | 'USD' | 'GBP' | 'AED';
type CurrencyAmounts = Partial<Record<DisplayCurrency, number>>;

type Props = {
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
  sellingPrice?: number | null;
  displayPrices?: CurrencyAmounts;
  pairsOnly?: boolean;
  /** Legacy props retained for compatibility; never used for pricing. */
  price?: number;
  rawNetRate?: number;
  rawFaceValue?: number;
};

export default function SupplierTestCartButton({
  sport = 'Football', ticketId, eventId, eventName, eventDate, category,
  categoryId, stock, minOrder, currency, sellingPrice, displayPrices,
  pairsOnly = false,
}: Props) {
  const { items, addItem, removeItem, displayCurrency } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const cartItemId = `xs2event-test:${ticketId}`;
  const existingItem = items.find(item => item.id === cartItemId);
  const inCart = existingItem?.quantity ?? 0;

  const validPrice = typeof sellingPrice === 'number' && Number.isFinite(sellingPrice) && sellingPrice > 0;
  const validStock = Number.isInteger(stock) && stock > 0;
  const maxQuantity = validStock ? Math.min(10, stock) : 0;
  const minimum = Number.isInteger(minOrder) && minOrder > 0 ? minOrder : 1;
  const remaining = Math.max(0, maxQuantity - inCart);
  const stale = Boolean(existingItem && (
    !validPrice || typeof existingItem.price !== 'number' ||
    Math.abs(existingItem.price - (sellingPrice ?? 0)) > 0.005 ||
    existingItem.currency !== currency || existingItem.supplier !== 'XS2Event' ||
    existingItem.supplierTicketId !== ticketId || existingItem.supplierEnvironment !== 'test'
  ));

  // For pairs-only offers, the final cart quantity must be even.
  // An existing odd quantity is not silently changed or supplemented.
  const allowedQuantities: number[] = [];
  for (let count = 1; count <= remaining; count++) {
    const finalCount = inCart + count;
    if (finalCount >= minimum && (!pairsOnly || finalCount % 2 === 0)) {
      allowedQuantities.push(count);
    }
  }
  const selectedQuantity = allowedQuantities.includes(quantity)
    ? quantity : (allowedQuantities[0] ?? 0);
  const validTicket = Boolean(ticketId && eventId && eventName && category &&
    validStock && validPrice && isSupportedCurrency(currency));
  const canAdd = validTicket && !stale && selectedQuantity > 0;

  const unitConverted = displayPrices?.[displayCurrency];
  const validConverted = typeof unitConverted === 'number' &&
    Number.isFinite(unitConverted) && unitConverted > 0;
  const useConverted = displayCurrency !== currency && validConverted;
  const unitAmount = useConverted ? unitConverted : sellingPrice;
  const unitCurrency = useConverted ? displayCurrency : currency;
  const total = typeof unitAmount === 'number' && Number.isFinite(unitAmount)
    ? Math.round((unitAmount * selectedQuantity + Number.EPSILON) * 100) / 100
    : null;
  const formattedTotal = total !== null && isSupportedCurrency(unitCurrency)
    ? formatCurrency(total, unitCurrency) : 'Price unavailable';

  function addToCart() {
    if (!canAdd || !validPrice || !isSupportedCurrency(currency)) return;
    addItem({
      id: cartItemId, eventId, eventName, sport, eventDate, category,
      session: 'XS2Event TEST — Not for sale', quantity: selectedQuantity,
      price: sellingPrice!, currency, supplier: 'XS2Event',
      supplierTicketId: ticketId, supplierCategoryId: categoryId,
      supplierEnvironment: 'test', maxQuantity,
    });
    setMessage(`${selectedQuantity} test ticket${selectedQuantity === 1 ? '' : 's'} added to your cart.`);
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Ticket size={22} aria-hidden="true" />
        </span>
        <div>
          <h4 className="text-lg font-extrabold text-navy">Select your tickets</h4>
          <p className="mt-1 text-sm text-slate-600">Choose your quantity before adding to your cart.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
        <span>Already in cart: <strong className="text-navy">{inCart}</strong></span>
        <span>Remaining test allowance: <strong className="text-navy">{remaining}</strong></span>
      </div>
      {pairsOnly && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-navy">This offer must be purchased in pairs.</p>}
      {minimum > 1 && <p className="mt-2 text-sm text-slate-600">Minimum order: {minimum} tickets in total for this offer.</p>}

      {stale ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p>An older or differently priced version of this test ticket is in your cart. Remove it before selecting this offer.</p>
          <button type="button" onClick={() => { removeItem(cartItemId); setMessage('Older test ticket removed.'); }}
            className="mt-3 rounded-lg border border-amber-700 bg-white px-4 py-2 font-bold hover:bg-amber-100">
            Remove older test ticket
          </button>
        </div>
      ) : canAdd ? (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-navy">Number of tickets</p>
              <div className="mt-2 inline-flex items-center gap-4" aria-label="Ticket quantity controls">
                <button type="button" aria-label="Decrease ticket quantity"
                  disabled={allowedQuantities.indexOf(selectedQuantity) <= 0}
                  onClick={() => { const index = allowedQuantities.indexOf(selectedQuantity); if (index > 0) setQuantity(allowedQuantities[index - 1]); setMessage(''); }}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-navy disabled:cursor-not-allowed disabled:opacity-40">
                  <Minus size={18} />
                </button>
                <span className="min-w-7 text-center text-xl font-black text-navy" aria-live="polite">{selectedQuantity}</span>
                <button type="button" aria-label="Increase ticket quantity"
                  disabled={allowedQuantities.indexOf(selectedQuantity) >= allowedQuantities.length - 1}
                  onClick={() => { const index = allowedQuantities.indexOf(selectedQuantity); if (index < allowedQuantities.length - 1) setQuantity(allowedQuantities[index + 1]); setMessage(''); }}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-navy disabled:cursor-not-allowed disabled:opacity-40">
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Indicative total</p>
              <p className="mt-1 text-2xl font-black text-navy">{formattedTotal}</p>
              <p className="mt-1 text-xs text-slate-500">For {selectedQuantity} ticket{selectedQuantity === 1 ? '' : 's'}</p>
            </div>
          </div>
          {useConverted && validPrice && isSupportedCurrency(currency) && (
            <p className="mt-3 text-xs text-slate-500">Original selling-price total: {formatCurrency(Math.round(sellingPrice! * selectedQuantity * 100) / 100, currency)}. Currency conversion is indicative.</p>
          )}
          {displayCurrency !== currency && !validConverted && (
            <p className="mt-3 text-xs text-amber-800">Conversion to {displayCurrency} is unavailable. Showing the original selling currency.</p>
          )}
          <button type="button" onClick={addToCart}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue px-4 py-4 font-extrabold text-white hover:opacity-90">
            <ShoppingCart size={19} aria-hidden="true" /> Add to Test Cart
          </button>
        </>
      ) : !stale ? (
        <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {!validPrice ? 'This offer cannot be added until a valid selling price is available.' :
            'This offer cannot currently be added. The stock limit, minimum order or pair requirement may prevent another selection.'}
        </p>
      ) : null}

      {message && (
        <div role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} aria-hidden="true" />{message}</p>
          <div className="mt-3 flex flex-wrap gap-4">
            <Link href="/cart" className="font-bold underline">View shopping cart</Link>
            <button type="button" onClick={() => setMessage('')} className="font-semibold underline">Continue selecting</button>
          </div>
        </div>
      )}
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        <strong>TEST DATA — NOT FOR SALE.</strong> Prices are indicative and stock is not reserved.
        No supplier reservation or payment is created. Checkout remains disabled.
      </p>
    </div>
  );
}
