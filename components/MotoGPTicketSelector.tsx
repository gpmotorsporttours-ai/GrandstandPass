
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  CheckCircle2,
} from 'lucide-react';

import { useCart } from './CartProvider';

type TicketDuration =
  | 'friday'
  | 'saturday'
  | 'sunday'
  | 'weekend';

type TicketCategory =
  | 'general'
  | 'grandstand'
  | 'hospitality';

type MotoGPTicketSelectorProps = {
  eventId?: string;
  eventName?: string;
  eventDate?: string;
};

const durations = [
  {
    id: 'friday',
    label: 'Friday',
    detail: 'Practice sessions',
  },
  {
    id: 'saturday',
    label: 'Saturday',
    detail: 'Practice and Sprint day',
  },
  {
    id: 'sunday',
    label: 'Sunday',
    detail: 'Grand Prix race day',
  },
  {
    id: 'weekend',
    label: 'Full Weekend',
    detail: 'Multi-day access',
  },
] as const;

const categories = [
  {
    id: 'general',
    label: 'General Admission',
    detail: 'General viewing areas, where offered',
  },
  {
    id: 'grandstand',
    label: 'Grandstand Seating',
    detail: 'Reserved or allocated seating, where offered',
  },
  {
    id: 'hospitality',
    label: 'Hospitality / VIP',
    detail: 'Premium experiences, where offered',
  },
] as const;

export default function MotoGPTicketSelector({
  eventId,
  eventName,
  eventDate,
}: MotoGPTicketSelectorProps) {
  const { addItem } = useCart();

  const [duration, setDuration] =
    useState<TicketDuration>('weekend');

  const [category, setCategory] =
    useState<TicketCategory>('grandstand');

  const [quantity, setQuantity] = useState(2);

  const [addedToCart, setAddedToCart] =
    useState(false);

  const selectedDuration = durations.find(
    (item) => item.id === duration
  );

  const selectedCategory = categories.find(
    (item) => item.id === category
  );

  const resetConfirmation = () => {
    setAddedToCart(false);
  };

  const handleAddToCart = () => {
    if (
      !eventId ||
      !eventName ||
      !selectedDuration ||
      !selectedCategory
    ) {
      return;
    }

    addItem({
      id: [
        'motogp',
        eventId,
        duration,
        category,
      ].join(':'),
      eventId,
      eventName,
      sport: 'MotoGP',
      eventDate,
      session: selectedDuration.label,
      category: selectedCategory.label,
      quantity,
    });

    setAddedToCart(true);
  };

  const canAddToCart = Boolean(
    eventId && eventName
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
      <div className="mb-8">
        <div className="eyebrow">
          Grandstand Pass / Ticket Selection
        </div>

        <h2 className="text-2xl md:text-3xl font-black text-navy mt-2">
          Choose your MotoGP tickets
        </h2>

        <p className="muted mt-3">
          Explore ticket options below. This is a
          demonstration of the selection process.
          Prices, availability and booking will be
          enabled once XS2Event is connected.
        </p>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-extrabold text-navy mb-4">
          1. Select ticket duration
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {durations.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setDuration(item.id);
                resetConfirmation();
              }}
              aria-pressed={duration === item.id}
              className={
                'rounded-xl border p-4 text-left transition ' +
                (duration === item.id
                  ? 'border-blue bg-blue/5 ring-2 ring-blue'
                  : 'border-slate-200 hover:border-blue')
              }
            >
              <div className="font-extrabold text-navy">
                {item.label}
              </div>

              <div className="text-sm muted mt-2">
                {item.detail}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-extrabold text-navy mb-4">
          2. Select ticket category
        </h3>

        <div className="grid md:grid-cols-3 gap-3">
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setCategory(item.id);
                resetConfirmation();
              }}
              aria-pressed={category === item.id}
              className={
                'rounded-xl border p-5 text-left transition ' +
                (category === item.id
                  ? 'border-blue bg-blue/5 ring-2 ring-blue'
                  : 'border-slate-200 hover:border-blue')
              }
            >
              <div className="font-extrabold text-navy">
                {item.label}
              </div>

              <div className="text-sm muted mt-2">
                {item.detail}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-extrabold text-navy mb-4">
          3. Select number of tickets
        </h3>

        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => {
              setQuantity((current) =>
                Math.max(1, current - 1)
              );
              resetConfirmation();
            }}
            disabled={quantity <= 1}
            className="h-11 w-11 rounded-xl border border-slate-300 font-bold text-xl disabled:opacity-40"
            aria-label="Remove one ticket"
          >
            −
          </button>

          <span className="text-2xl font-black text-navy">
            {quantity}
          </span>

          <button
            type="button"
            onClick={() => {
              setQuantity((current) =>
                Math.min(10, current + 1)
              );
              resetConfirmation();
            }}
            disabled={quantity >= 10}
            className="h-11 w-11 rounded-xl border border-slate-300 font-bold text-xl disabled:opacity-40"
            aria-label="Add one ticket"
          >
            +
          </button>
        </div>

        <p className="text-sm muted mt-3">
          Actual ticket quantity limits and
          seating-together rules will depend on
          supplier availability.
        </p>
      </div>

      <div className="rounded-xl bg-ice p-6">
        <h3 className="text-xl font-extrabold text-navy">
          Your ticket selection
        </h3>

        <div className="mt-4 space-y-2 text-sm">
          {eventName && (
            <p>
              <strong>Event:</strong> {eventName}
            </p>
          )}

          <p>
            <strong>Duration:</strong>{' '}
            {selectedDuration?.label}
          </p>

          <p>
            <strong>Category:</strong>{' '}
            {selectedCategory?.label}
          </p>

          <p>
            <strong>Quantity:</strong>{' '}
            {quantity}{' '}
            {quantity === 1 ? 'ticket' : 'tickets'}
          </p>

          <p>
            <strong>Price:</strong>{' '}
            Awaiting live supplier pricing
          </p>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <p className="font-bold text-navy">
            Booking not yet available
          </p>

          <p className="text-sm muted mt-2">
            These are illustrative ticket options,
            not confirmed offers. Available durations,
            categories, prices and booking conditions
            will be supplied by XS2Event.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAddToCart}
          className="mt-6 w-full rounded-xl bg-navy text-white font-bold py-4 flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart size={20} />
          Add Selection to Cart
        </button>

        {!canAddToCart && (
          <p className="muted text-sm mt-3 text-center">
            Cart integration is being completed.
            Event details will be connected next.
          </p>
        )}

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
              not a ticket reservation.
            </p>

            <Link
              href="/cart"
              className="inline-block mt-3 text-sm font-bold text-navy underline"
            >
              View Shopping Cart
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
