'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2, Ticket, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useCart } from '../../components/CartProvider';
import { formatCurrency, isSupportedCurrency, type SupportedCurrency } from '../../lib/currency';

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
  loading: boolean;
  failed: boolean;
};

function isValidPrice(price: unknown, currency: unknown): currency is SupportedCurrency {
  return typeof price === 'number' && Number.isFinite(price) && price > 0 && isSupportedCurrency(currency);
}

function originalPrice(amount: number, currency: string): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Price unavailable';
  if (isSupportedCurrency(currency)) return formatCurrency(amount, currency);
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount); }
  catch { return 'Price unavailable'; }
}

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, itemCount, displayCurrency } = useCart();
  const [pricingState, setPricingState] = useState<PricingState | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const requestKey = JSON.stringify({
    displayCurrency,
    tickets: items.map(item => ({ id: item.id, price: item.price, currency: item.currency,
      supplier: item.supplier, supplierEnvironment: item.supplierEnvironment })),
  });

  useEffect(() => {
    let cancelled = false;
    const pricedItems = items.filter(item => isValidPrice(item.price, item.currency));
    if (pricedItems.length === 0) return;
    setPricingState({ requestKey, prices: {}, loading: true, failed: false });

    async function loadPrices() {
      try {
        const results = await Promise.all(pricedItems.map(async item => {
          if (!isValidPrice(item.price, item.currency)) throw new Error('Invalid price');
          const amount = item.price;
          const from = item.currency;
          if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
            throw new Error('Invalid ticket price');
          }
          let pricing: ConvertedPrice;
          if (from === displayCurrency) {
            pricing = { supplierAmount: amount, supplierCurrency: from, displayAmount: amount,
              displayCurrency, exchangeRate: 1, rateDate: 'Not required', converted: false, indicative: true };
          } else {
            const params = new URLSearchParams({ amount: String(amount), from, to: displayCurrency });
            const response = await fetch(`/api/cart-pricing?${params.toString()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Conversion unavailable');
            const data = await response.json();
            const p = data.pricing;
            if (data.success !== true || !p || p.supplierAmount !== amount ||
              p.supplierCurrency !== from || p.displayCurrency !== displayCurrency ||
              typeof p.displayAmount !== 'number' || !Number.isFinite(p.displayAmount) || p.displayAmount < 0 ||
              typeof p.exchangeRate !== 'number' || !Number.isFinite(p.exchangeRate) || p.exchangeRate <= 0 ||
              typeof p.rateDate !== 'string' || p.indicative !== true) throw new Error('Invalid conversion');
            pricing = p as ConvertedPrice;
          }
          return { id: item.id, pricing };
        }));
        if (cancelled) return;
        const prices: Record<string, ConvertedPrice> = {};
        for (const result of results) prices[result.id] = result.pricing;
        setPricingState({ requestKey, prices, loading: false, failed: false });
      } catch {
        if (!cancelled) setPricingState({ requestKey, prices: {}, loading: false, failed: true });
      }
    }
    void loadPrices();
    return () => { cancelled = true; };
  }, [requestKey, displayCurrency]);

  const allItemsPriced = items.length > 0 && items.every(item => isValidPrice(item.price, item.currency));
  const currentPricing = pricingState?.requestKey === requestKey ? pricingState : null;
  const conversionReady = allItemsPriced && currentPricing !== null && !currentPricing.loading &&
    !currentPricing.failed && items.every(item => Object.prototype.hasOwnProperty.call(currentPricing.prices, item.id));
  const total = conversionReady ? items.reduce((sum, item) =>
    sum + currentPricing!.prices[item.id].displayAmount * item.quantity, 0) : null;
  const hasTestTickets = items.some(item => item.supplier === 'XS2Event' && item.supplierEnvironment === 'test');
  const rateDates = conversionReady ? Array.from(new Set(items.map(item => currentPricing!.prices[item.id].rateDate)))
    .filter(date => date !== 'Not required') : [];

  return (
    <>
      <section className="bg-ice border-b">
        <div className="container-wide py-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-navy hover:underline">
            <ArrowLeft size={16} /> Continue browsing events
          </Link>
        </div>
      </section>
      <section className="container-wide py-10 md:py-14">
        <div className="flex items-start gap-4 mb-8">
          <div className="rounded-2xl bg-ice p-3"><ShoppingCart size={28} className="text-blue" /></div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-navy">Your Shopping Cart</h1>
            <p className="muted mt-2">Review your tickets and indicative prices. Checkout is not yet enabled.</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 md:p-14 text-center">
            <ShoppingCart size={48} className="mx-auto text-blue mb-5" />
            <h2 className="text-2xl font-black text-navy">Your cart is empty</h2>
            <p className="muted mt-3 mb-7">Discover events and add your preferred tickets to get started.</p>
            <Link href="/" className="inline-flex rounded-xl bg-navy px-7 py-4 text-white font-bold">Explore Events</Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-5">
              <p className="text-sm font-semibold text-navy">{itemCount} {itemCount === 1 ? 'ticket' : 'tickets'} in your cart</p>
              {items.map(item => {
                const testTicket = item.supplier === 'XS2Event' && item.supplierEnvironment === 'test';
                const limit = testTicket && typeof item.maxQuantity === 'number' &&
                  Number.isInteger(item.maxQuantity) && item.maxQuantity >= 1
                  ? Math.min(10, item.maxQuantity) : 10;
                const valid = isValidPrice(item.price, item.currency);
                const converted = valid ? currentPricing?.prices[item.id] : undefined;
                return (
                  <article key={item.id} className="rounded-2xl border bg-white p-5 md:p-6 shadow-sm">
                    <div className="flex gap-4 items-start">
                      <div className="rounded-xl bg-ice p-3 shrink-0"><Ticket size={25} className="text-blue" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-blue">{item.sport}</p>
                        <h2 className="text-lg md:text-xl font-black text-navy mt-1 break-words">{item.eventName}</h2>
                        {item.eventDate && <p className="muted text-sm mt-2">Date: {item.eventDate}</p>}
                        {item.session && <p className="muted text-sm mt-1">Session: {item.session}</p>}
                        <p className="text-sm mt-2"><span className="muted">Ticket category: </span>
                          <span className="font-bold text-navy">{item.category}</span></p>
                        {testTicket && <p className="mt-3 inline-block rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900">
                          XS2Event TEST DATA — NOT FOR SALE</p>}
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 mt-5 pt-5 border-t items-end">
                      <div>
                        <p className="text-xs muted mb-2">Number of tickets</p>
                        <div className="inline-flex items-center gap-3">
                          <button type="button" onClick={() => item.quantity <= 1 ? removeItem(item.id) : updateQuantity(item.id, item.quantity - 1)}
                            aria-label={`Decrease quantity for ${item.eventName}`} className="w-10 h-10 rounded-lg border flex items-center justify-center hover:bg-ice">
                            {item.quantity <= 1 ? <Trash2 size={16} /> : <Minus size={17} />}
                          </button>
                          <span className="font-black text-navy min-w-6 text-center">{item.quantity}</span>
                          <button type="button" disabled={item.quantity >= limit}
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label={`Increase quantity for ${item.eventName}`} className="w-10 h-10 rounded-lg border flex items-center justify-center hover:bg-ice disabled:opacity-40 disabled:cursor-not-allowed">
                            <Plus size={17} />
                          </button>
                        </div>
                        {testTicket && <p className="text-xs text-amber-900 mt-2">Test quantity limit: {limit}. Stock is not reserved.</p>}
                      </div>
                      <div className="sm:text-right">
                        <p className="text-xs muted">Indicative unit price</p>
                        <p className="text-xl font-black text-navy mt-1">
                          {converted ? formatCurrency(converted.displayAmount, displayCurrency) : valid ?
                            currentPricing?.failed ? 'Conversion unavailable' : 'Calculating…' : 'Price unavailable'}
                        </p>
                        {valid && <p className="text-xs muted mt-1">Stored selling price: {originalPrice(item.price!, item.currency!)}</p>}
                        {converted && <p className="text-sm font-semibold text-blue mt-2">Line total: {formatCurrency(converted.displayAmount * item.quantity, displayCurrency)}</p>}
                      </div>
                    </div>
                    <div className="mt-5 pt-4 border-t flex items-center justify-between gap-3">
                      <p className="text-xs muted">{testTicket ? 'Test inventory • Not reserved' : 'Availability subject to confirmation'}</p>
                      <button type="button" onClick={() => removeItem(item.id)} className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:underline">
                        <Trash2 size={16} /> Remove
                      </button>
                    </div>
                  </article>
                );
              })}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-navy hover:underline"><ArrowLeft size={16} /> Add more tickets</Link>
                {!confirmClear ? (
                  <button type="button" onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:underline"><Trash2 size={16} /> Empty cart</button>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap rounded-xl border border-red-200 bg-red-50 p-3" role="group" aria-label="Confirm empty cart">
                    <span className="text-sm font-semibold text-red-800">Remove all tickets?</span>
                    <button type="button" onClick={() => { clearCart(); setConfirmClear(false); }} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white">Yes, empty cart</button>
                    <button type="button" onClick={() => setConfirmClear(false)} className="rounded-lg border bg-white px-3 py-2 text-sm font-bold">Cancel</button>
                  </div>
                )}
              </div>
            </div>
            <aside className="rounded-2xl border bg-ice p-6 lg:sticky lg:top-6">
              <h2 className="text-xl font-black text-navy">Order Summary</h2>
              <div className="mt-5 space-y-3 border-b pb-5 text-sm">
                <div className="flex justify-between gap-3"><span className="muted">Total tickets</span><span className="font-bold text-navy">{itemCount}</span></div>
                <div className="flex justify-between gap-3"><span className="muted">Display currency</span><span className="font-bold text-navy">{displayCurrency}</span></div>
                <div className="flex justify-between gap-3"><span className="muted">Event selections</span><span className="font-bold text-navy">{items.length}</span></div>
              </div>
              {conversionReady && <div className="py-5 border-b space-y-3 text-sm">
                {items.map(item => <div key={item.id} className="flex justify-between gap-3">
                  <span className="muted break-words">{item.quantity} × {item.category}<span className="block text-xs">{item.eventName}</span></span>
                  <span className="font-semibold text-navy shrink-0">{formatCurrency(currentPricing!.prices[item.id].displayAmount * item.quantity, displayCurrency)}</span>
                </div>)}
              </div>}
              <div className="flex justify-between items-start gap-3 py-5">
                <span className="font-bold text-navy">Indicative total</span>
                <span className="text-xl md:text-2xl font-black text-navy text-right">
                  {total !== null ? formatCurrency(total, displayCurrency) : currentPricing?.failed ? 'Unavailable' : allItemsPriced ? 'Calculating…' : 'Awaiting pricing'}
                </span>
              </div>
              {rateDates.length > 0 && <p className="text-xs muted mb-4">Exchange-rate date{rateDates.length > 1 ? 's' : ''}: {rateDates.join(', ')}</p>}
              {hasTestTickets && <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 mb-4">
                <AlertTriangle size={18} className="shrink-0" /><p><strong>TEST DATA — NOT FOR SALE.</strong> XS2Event test ticket prices include a €5 handling allowance per ticket and 15% markup. Other costs may not be included. No tickets are reserved.</p>
              </div>}
              {currentPricing?.failed && <p className="text-sm text-red-600 mb-4">Currency conversion is unavailable. Your selections are preserved.</p>}
              {!allItemsPriced && <p className="text-xs muted mb-4">Some ticket prices are unavailable. A complete total cannot be calculated.</p>}
              <button type="button" disabled className="w-full rounded-xl bg-navy py-4 font-bold text-white opacity-60 cursor-not-allowed">Checkout Available Soon</button>
              <p className="text-xs muted text-center mt-4">No payment or booking will be made. Prices and availability require confirmation before live checkout.</p>
              <div className="flex items-center justify-center gap-2 text-xs text-navy font-semibold mt-5"><ShieldCheck size={16} /> Test mode — purchasing disabled</div>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
