
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Map,
  Minus,
  Plus,
  ShieldAlert,
  ShoppingCart,
  CheckCircle2,
} from 'lucide-react';

import type { Event } from '../lib/data';
import { useCart } from './CartProvider';

export default function TicketSelector({
  event,
}: {
  event: Event;
}) {
  const { addItem } = useCart();

  const [selected, setSelected] = useState(0);
  const [qty, setQty] = useState(2);
  const [addedToCart, setAddedToCart] =
    useState(false);

  const category = event.categories[selected];

  const price = category?.price ?? 0;

  const handleAddToCart = () => {
    if (!category) {
      return;
    }

    addItem({
      id: [
        'other-events',
        event.slug,
        category.name,
      ].join(':'),
      eventId: event.slug,
      eventName: event.name,
      sport: event.sport,
      eventDate: event.date,
      category: category.name,
      quantity: qty,
    });

    setAddedToCart(true);
  };

  return (
    <div className="grid lg:grid-cols-5 gap-7">
      <div className="lg:col-span-3">
        <div className="card p-6 min-h-[420px] flex flex-col">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-extrabold">
              Venue seating map
            </h2>

            <span className="text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded-full font-bold">
              Demo placeholder
            </span>
          </div>

          <div className="flex-1 bg-ice border border-dashed border-slate-300 rounded-xl mt-5 min-h-[300px] flex flex-col items-center justify-center text-center px-8">
            <Map
              size={54}
              className="text-blue mb-4"
            />

            <h3 className="text-lg font-extrabold">
              Interactive seating map coming soon
            </h3>

            <p className="muted text-sm max-w-md mt-3">
              When XS2Event is connected, this area
              will display the venue map and any
              available category highlighting.
              Exact seat selection will depend
              on the supplier&apos;s data.
            </p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="card p-6">
          <h2 className="text-xl font-extrabold">
            Choose your tickets
          </h2>

          <p className="text-sm muted mt-2 mb-5">
            Sample categories and prices in EUR —
            not live inventory.
          </p>

          <div className="space-y-3">
            {event.categories.map((cat, i) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => {
                  setSelected(i);
                  setAddedToCart(false);
                }}
                aria-pressed={selected === i}
                className={
                  'w-full rounded-xl border p-4 text-left ' +
                  (selected === i
                    ? 'border-blue bg-blue/5'
                    : 'border-slate-200')
                }
              >
                <div className="flex justify-between gap-3">
                  <span className="font-bold">
                    {cat.name}
                  </span>

                  <span className="font-black">
                    €{cat.price}
                  </span>
                </div>

                <p className="text-xs muted mt-2">
                  {cat.description}
                </p>
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="font-bold">
              Tickets
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                className="btn-outline !p-2"
                onClick={() => {
                  setQty((current) =>
                    Math.max(1, current - 1)
                  );
                  setAddedToCart(false);
                }}
                disabled={qty <= 1}
                aria-label="Remove one ticket"
              >
                <Minus size={16} />
              </button>

              <span className="font-bold">
                {qty}
              </span>

              <button
                type="button"
                className="btn-outline !p-2"
                onClick={() => {
                  setQty((current) =>
                    Math.min(8, current + 1)
                  );
                  setAddedToCart(false);
                }}
                disabled={qty >= 8}
                aria-label="Add one ticket"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="border-t mt-6 pt-5 flex justify-between items-center">
            <span className="muted">
              Illustrative total
            </span>

            <span className="text-2xl font-black">
              €{(qty * price).toLocaleString()}
            </span>
          </div>

          <p className="text-xs muted mt-2">
            The prices above are examples only.
            They are not confirmed ticket offers
            and will not be charged.
          </p>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!category}
            className="btn-primary w-full mt-5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingCart size={19} />
            Add Selection to Cart
          </button>

          {addedToCart && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4"
            >
              <div className="flex items-center gap-2 text-green-800 font-bold">
                <CheckCircle2 size={20} />
                Selection added to your cart!
              </div>

              <p className="text-sm text-green-800 mt-2">
                This is a demonstration selection,
                not a confirmed ticket reservation.
              </p>

              <Link
                href="/cart"
                className="inline-block mt-3 text-sm font-bold text-navy underline"
              >
                View Shopping Cart
              </Link>
            </div>
          )}

          <p className="text-xs muted mt-4 flex items-start gap-2">
            <ShieldAlert
              size={17}
              className="shrink-0"
            />

            No reservations or payments are
            processed in this demonstration.
            Actual prices and availability will
            be confirmed when XS2Event is connected.
          </p>
        </div>
      </div>
    </div>
  );
}
