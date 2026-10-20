
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Minus,
  Plus,
  Ticket,
  ShoppingCart,
} from 'lucide-react';

import { useCart } from './CartProvider';

type FootballTicketSelectorProps = {
  eventId?: string;
  eventName?: string;
  eventDate?: string;
};

const ticketCategories = [
  {
    id: 'standard',
    name: 'Standard Seating',
    description:
      'General stadium seating. Exact sections and locations will depend on the match.',
  },
  {
    id: 'premium',
    name: 'Premium Seating',
    description:
      'Illustrative upgraded seating option, subject to supplier availability.',
  },
  {
    id: 'hospitality',
    name: 'Hospitality / VIP',
    description:
      'Illustrative hospitality option. Inclusions will be confirmed when inventory is connected.',
  },
];

export default function FootballTicketSelector({
  eventId,
  eventName,
  eventDate,
}: FootballTicketSelectorProps) {
  const { addItem } = useCart();

  const [selectedCategory, setSelectedCategory] =
    useState('standard');

  const [quantity, setQuantity] = useState(1);

  const [addedToCart, setAddedToCart] =
    useState(false);

  const category = ticketCategories.find(
    (item) => item.id === selectedCategory
  );

  const canAddToCart = Boolean(
    eventId && eventName
  );

  const handleAddToCart = () => {
    if (!eventId || !eventName || !category) {
      return;
    }

    addItem({
      id: [
        'football',
        eventId,
        selectedCategory,
      ].join(':'),
      eventId,
      eventName,
      sport: 'Football',
      eventDate,
      category: category.name,
      quantity,
    });

    setAddedToCart(true);
  };

  return (
    <section className="rounded-2xl border bg-white p-6 md:p-8">
      <div className="mb-7">
        <div className="flex items-center gap-3">
          <Ticket className="text-blue" size={25} />

          <h2 className="text-2xl font-black text-navy">
            Select Football Tickets
          </h2>
        </div>

        <p className="muted mt-3">
          Choose your preferred ticket category and
          number of tickets.
        </p>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold text-navy mb-4">
          1. Choose your ticket category
        </h3>

        <div className="grid md:grid-cols-3 gap-4">
          {ticketCategories.map((item) => {
            const isSelected =
              selectedCategory === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(item.id);
                  setAddedToCart(false);
                }}
                aria-pressed={isSelected}
                className={`rounded-xl border-2 p-5 text-left transition ${
                  isSelected
                    ? 'border-blue bg-ice'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-navy">
                    {item.name}
                  </span>

                  {isSelected && (
                    <CheckCircle2
                      size={20}
                      className="text-blue shrink-0"
                    />
                  )}
                </div>

                <p className="muted text-sm mt-3">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold text-navy mb-4">
          2. Number of tickets
        </h3>

        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => {
              setQuantity((current) =>
                Math.max(1, current - 1)
              );
              setAddedToCart(false);
            }}
            disabled={quantity <= 1}
            aria-label="Remove one ticket"
            className="w-11 h-11 rounded-xl border flex items-center justify-center disabled:opacity-40"
          >
            <Minus size={19} />
          </button>

          <span className="text-2xl font-black text-navy min-w-8 text-center">
            {quantity}
          </span>

          <button
            type="button"
            onClick={() => {
              setQuantity((current) =>
                Math.min(10, current + 1)
              );
              setAddedToCart(false);
            }}
            disabled={quantity >= 10}
            aria-label="Add one ticket"
            className="w-11 h-11 rounded-xl border flex items-center justify-center disabled:opacity-40"
          >
            <Plus size={19} />
          </button>
        </div>

        <p className="muted text-sm mt-3">
          Select between 1 and 10 tickets.
        </p>
      </div>

      <div className="rounded-xl bg-ice p-5 md:p-6">
        <h3 className="text-lg font-bold text-navy mb-4">
          Your Ticket Selection
        </h3>

        <div className="space-y-3 text-sm">
          {eventName && (
            <div className="flex justify-between gap-4">
              <span className="muted">
                Match
              </span>

              <span className="font-bold text-navy text-right">
                {eventName}
              </span>
            </div>
          )}

          <div className="flex justify-between gap-4">
            <span className="muted">
              Ticket category
            </span>

            <span className="font-bold text-navy text-right">
              {category?.name}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="muted">
              Quantity
            </span>

            <span className="font-bold text-navy">
              {quantity}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="muted">
              Price
            </span>

            <span className="font-bold text-navy">
              Awaiting live pricing
            </span>
          </div>
        </div>

        <div className="border-t mt-5 pt-5">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canAddToCart}
            className="w-full rounded-xl bg-navy text-white font-bold py-4 flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingCart size={20} />
            Add Selection to Cart
          </button>

          {!canAddToCart && (
            <p className="muted text-sm mt-3 text-center">
              Cart integration is being completed.
              Match details will be connected next.
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

          <p className="muted text-xs mt-4 text-center">
            Ticket categories shown are for demonstration
            only. Prices, seating locations and availability
            will be confirmed when the live ticket supplier
            is connected. No booking or payment can be
            made at this stage.
          </p>
        </div>
      </div>
    </section>
  );
}
