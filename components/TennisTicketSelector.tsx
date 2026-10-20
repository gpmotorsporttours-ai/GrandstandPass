
'use client';

import { useState } from 'react';

type TennisTicketSelectorProps = {
  startDate: string;
  endDate?: string;
};

type TicketSession = 'day' | 'evening' | 'full-day';

type TicketCategory =
  | 'grounds'
  | 'court'
  | 'hospitality';

const sessions = [
  {
    id: 'day',
    label: 'Day Session',
    detail: 'Daytime tennis matches, where offered',
  },
  {
    id: 'evening',
    label: 'Evening Session',
    detail: 'Evening tennis matches, where offered',
  },
  {
    id: 'full-day',
    label: 'Full Day',
    detail: 'Full-day access, where offered',
  },
] as const;

const categories = [
  {
    id: 'grounds',
    label: 'Grounds Admission',
    detail: 'General access areas, where offered',
  },
  {
    id: 'court',
    label: 'Court Seating',
    detail: 'Reserved or allocated court seating',
  },
  {
    id: 'hospitality',
    label: 'Hospitality / VIP',
    detail: 'Premium experiences, where offered',
  },
] as const;

function formatDate(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString(
    'en-GB',
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );
}

function getTournamentDates(
  startDate: string,
  endDate?: string
) {
  const dates: string[] = [];

  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(
    (endDate || startDate) + 'T12:00:00'
  );

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return [startDate];
  }

  const current = new Date(start);

  while (
    current <= end &&
    dates.length < 31
  ) {
    const year = current.getFullYear();
    const month = String(
      current.getMonth() + 1
    ).padStart(2, '0');
    const day = String(
      current.getDate()
    ).padStart(2, '0');

    dates.push(`${year}-${month}-${day}`);

    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export default function TennisTicketSelector({
  startDate,
  endDate,
}: TennisTicketSelectorProps) {
  const tournamentDates = getTournamentDates(
    startDate,
    endDate
  );

  const [selectedDate, setSelectedDate] =
    useState(startDate);

  const [session, setSession] =
    useState<TicketSession>('day');

  const [category, setCategory] =
    useState<TicketCategory>('court');

  const [quantity, setQuantity] = useState(2);

  const selectedSession = sessions.find(
    (item) => item.id === session
  );

  const selectedCategory = categories.find(
    (item) => item.id === category
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
      <div className="mb-8">
        <div className="eyebrow">
          Grandstand Pass / Ticket Selection
        </div>

        <h2 className="text-2xl md:text-3xl font-black text-navy mt-2">
          Choose your Tennis tickets
        </h2>

        <p className="muted mt-3">
          Explore illustrative ticket options below.
          Actual tournament sessions, seating
          categories, prices and availability will
          depend on XS2Event supplier inventory.
          Booking is not yet available.
        </p>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-extrabold text-navy mb-4">
          1. Select tournament date
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {tournamentDates.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}
              aria-pressed={selectedDate === date}
              className={
                'rounded-xl border p-4 text-left transition ' +
                (selectedDate === date
                  ? 'border-blue bg-blue/5 ring-2 ring-blue'
                  : 'border-slate-200 hover:border-blue')
              }
            >
              <div className="font-extrabold text-navy">
                {formatDate(date)}
              </div>
            </button>
          ))}
        </div>

        <p className="text-sm muted mt-3">
          Dates are taken from the tournament calendar.
          Ticket availability for individual dates
          has not yet been confirmed.
        </p>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-extrabold text-navy mb-4">
          2. Select session
        </h3>

        <div className="grid md:grid-cols-3 gap-3">
          {sessions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSession(item.id)}
              aria-pressed={session === item.id}
              className={
                'rounded-xl border p-5 text-left transition ' +
                (session === item.id
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
          3. Select ticket category
        </h3>

        <div className="grid md:grid-cols-3 gap-3">
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
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
          4. Select number of tickets
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
            onClick={() =>
              setQuantity((current) =>
                Math.min(10, current + 1)
              )
            }
            disabled={quantity >= 10}
            className="h-11 w-11 rounded-xl border border-slate-300 font-bold text-xl disabled:opacity-40"
            aria-label="Add one ticket"
          >
            +
          </button>
        </div>

        <p className="text-sm muted mt-3">
          Actual quantity limits and seating-together
          rules will depend on supplier availability.
        </p>
      </div>

      <div className="rounded-xl bg-ice p-6">
        <h3 className="text-xl font-extrabold text-navy">
          Your ticket selection
        </h3>

        <div className="mt-4 space-y-2 text-sm">
          <p>
            <strong>Date:</strong>{' '}
            {formatDate(selectedDate)}
          </p>

          <p>
            <strong>Session:</strong>{' '}
            {selectedSession?.label}
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
            These selections are illustrative,
            not confirmed ticket offers. Actual
            dates, sessions, court categories,
            availability, prices and booking
            conditions will be supplied by XS2Event.
          </p>
        </div>
      </div>
    </section>
  );
}
