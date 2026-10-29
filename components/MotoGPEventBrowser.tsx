
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  MapPin,
  Search,
  Ticket,
  Loader2,
} from 'lucide-react';
import AvailabilityMessage from './AvailabilityMessage';

type MotoGPEvent = {
  event_id: string;
  event_name: string;
  date_start?: string;
  date_stop?: string;
  venue_name?: string;
  city?: string;
  iso_country?: string;
  event_status?: string;
};

type EventsResponse = {
  testData: boolean;
  events: MotoGPEvent[];
  error?: string;
};

type AvailabilityResponse = {
  testData?: boolean;
  hasAvailableTickets?: boolean;
  availableCategories?: number;
  error?: string;
};

type AvailabilityState =
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'error';

const PAGE_SIZE = 12;

function formatDate(value?: string): string {
  if (!value) {
    return 'Date to be confirmed';
  }

  const datePart = value.slice(0, 10);
  const parts = datePart.split('-').map(Number);

  if (
    parts.length !== 3 ||
    parts.some(part => !Number.isInteger(part))
  ) {
    return value;
  }

  const [year, month, day] = parts;

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export default function MotoGPEventBrowser() {
  const [events, setEvents] = useState<MotoGPEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [year, setYear] = useState('all');
  const [page, setPage] = useState(1);

  const [availability, setAvailability] = useState<
    Record<string, AvailabilityState>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const response = await fetch(
          '/api/motogp-test-events',
          { cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error('Unable to load events');
        }

        const data =
          (await response.json()) as EventsResponse;

        if (!Array.isArray(data.events)) {
          throw new Error('Invalid event response');
        }

        if (!cancelled) {
          setEvents(data.events);
          setError('');
        }
      } catch {
        if (!cancelled) {
          setError(
            'MotoGP test events are temporarily unavailable.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const years = useMemo(() => {
    const values = new Set(
      events
        .map(event => event.date_start?.slice(0, 4))
        .filter((value): value is string =>
          Boolean(value)
        )
    );

    return [...values].sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events.filter(event => {
      const matchesSearch =
        !query ||
        [
          event.event_name,
          event.venue_name,
          event.city,
          event.iso_country,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);

      const matchesYear =
        year === 'all' ||
        event.date_start?.startsWith(year);

      return matchesSearch && matchesYear;
    });
  }, [events, search, year]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEvents.length / PAGE_SIZE)
  );

  const visibleEvents = filteredEvents.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  async function checkAvailability(eventId: string) {
    setAvailability(previous => ({
      ...previous,
      [eventId]: 'checking',
    }));

    try {
      const response = await fetch(
        `/api/motogp-test-availability?eventId=${encodeURIComponent(
          eventId
        )}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error('Availability check failed');
      }

      const data =
        (await response.json()) as AvailabilityResponse;

      if (typeof data.hasAvailableTickets !== 'boolean') {
        throw new Error('Invalid availability response');
      }

      setAvailability(previous => ({
        ...previous,
        [eventId]: data.hasAvailableTickets
          ? 'available'
          : 'unavailable',
      }));
    } catch {
      setAvailability(previous => ({
        ...previous,
        [eventId]: 'error',
      }));
    }
  }

  return (
    <section className="py-10">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>TEST DATA — NOT FOR SALE.</strong>{' '}
        MotoGP inventory is retrieved from the
        XS2Event test environment. No tickets can be
        reserved or purchased. Checkout is disabled.
      </div>

      <div className="mt-8 flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search
            size={19}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="search"
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search Grand Prix, circuit or city"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-navy"
          />
        </div>

        <select
          value={year}
          onChange={event => {
            setYear(event.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-navy"
          aria-label="Filter MotoGP events by year"
        >
          <option value="all">All years</option>

          {years.map(value => (
            <option key={value} value={value}>
              {value} season
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="mt-10 flex items-center gap-3 text-slate-600">
          <Loader2
            size={22}
            className="animate-spin"
          />
          Loading MotoGP test events...
        </div>
      ) : error ? (
        <div className="mt-8">
          <AvailabilityMessage status="error" />
          <p className="mt-3 text-center text-sm text-slate-500">
            {error}
          </p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-600">
            Showing {filteredEvents.length} upcoming
            MotoGP test events.
          </p>

          {visibleEvents.length === 0 ? (
            <div className="mt-8">
              {events.length === 0 ? (
                <AvailabilityMessage
                  status="no-events"
                  sport="MotoGP"
                />
              ) : (
                <div className="rounded-xl border bg-white p-8 text-slate-600">
                  No Grand Prix events match your search.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleEvents.map(event => {
                const status =
                  availability[event.event_id];

                return (
                  <article
                    key={event.event_id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-blue">
                      MotoGP
                    </p>

                    <h2 className="mt-3 text-xl font-black text-navy">
                      {event.event_name}
                    </h2>

                    <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                      <CalendarDays size={17} />
                      {formatDate(event.date_start)}
                      {event.date_stop &&
                        ` – ${formatDate(event.date_stop)}`}
                    </p>

                    <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                      <MapPin
                        size={17}
                        className="shrink-0"
                      />
                      {[
                        event.venue_name,
                        event.city,
                        event.iso_country,
                      ]
                        .filter(Boolean)
                        .join(', ') ||
                        'Circuit to be confirmed'}
                    </p>

                    <div className="mt-auto pt-6">
                      {status === 'available' && (
                        <p className="mb-3 text-sm font-bold text-green-700">
                          Test ticket offers available
                        </p>
                      )}

                      {status === 'unavailable' && (
                        <div className="mb-4">
                          <AvailabilityMessage
                            status="no-tickets"
                            eventName={event.event_name}
                          />
                          <p className="mt-2 text-center text-xs text-slate-500">
                            No offers were found in the checked
                            test inventory. Additional inventory
                            may exist.
                          </p>
                        </div>
                      )}

                      {status === 'error' && (
                        <div className="mb-4">
                          <AvailabilityMessage
                            status="error"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={status === 'checking'}
                        onClick={() =>
                          checkAvailability(event.event_id)
                        }
                        className="mb-3 w-full rounded-xl border border-blue px-4 py-3 font-bold text-blue hover:bg-blue-50 disabled:opacity-50"
                      >
                        {status === 'checking'
                          ? 'Checking availability...'
                          : status === 'error'
                            ? 'Try checking availability again'
                            : 'Check ticket availability'}
                      </button>

                      <Link
                        href={`/motogp/tickets?eventId=${encodeURIComponent(
                          event.event_id
                        )}`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue px-4 py-3 font-bold text-white hover:opacity-90"
                      >
                        <Ticket size={18} />
                        View test tickets
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() =>
                  setPage(previous =>
                    Math.max(1, previous - 1)
                  )
                }
                className="rounded-lg border px-4 py-2 font-bold disabled:opacity-40"
              >
                Previous
              </button>

              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage(previous =>
                    Math.min(totalPages, previous + 1)
                  )
                }
                className="rounded-lg border px-4 py-2 font-bold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
