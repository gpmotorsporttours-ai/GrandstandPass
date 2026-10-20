
'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Minus,
  Plus,
  Ticket,
} from 'lucide-react';

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

export default function FootballTicketSelector() {
  const [selectedCategory, setSelectedCategory] =
    useState('standard');

  const [quantity, setQuantity] = useState(1);

  const category = ticketCategories.find(
    (item) => item.id === selectedCategory
  );

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
                onClick={() =>
                  setSelectedCategory(item.id)
                }
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
            onClick={() =>
              setQuantity((current) =>
                Math.max(1, current - 1)
              )
            }
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
            onClick={() =>
              setQuantity((current) =>
                Math.min(10, current + 1)
              )
            }
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
            disabled
            className="w-full rounded-xl bg-navy text-white font-bold py-4 opacity-60 cursor-not-allowed"
          >
            Booking Available Soon
          </button>

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
