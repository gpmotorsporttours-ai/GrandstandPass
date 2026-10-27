
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  MapPin,
  Search,
  Loader2,
} from 'lucide-react';

type GolfEvent = {
  event_id: string;
  event_name: string;
  tournament_name?: string;
  date_start?: string;
  date_stop?: string;
  venue_name?: string;
  city?: string;
  iso_country?: string;
  event_status?: string;
};

type EventsResponse = {
  testData: boolean;
  events: GolfEvent[];
  error?: string;
};

const PAGE_SIZE = 12;

function formatDate(value?: string): string {
  if (!value) {
    return 'Date to be confirmed';
  }

  const parts = value.slice(0, 10).split('-').map(Number);

  if (
    parts.length !== 3 ||
    parts.some(part => !Number.isInteger(part))
  ) {
    return value;
  }

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));

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

export default function GolfEventBrowser() {
  const [events, setEvents] = useState<GolfEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [year, setYear] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const response = await fetch(
          '/api/golf-test-events',
          { cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error('Unable to load Golf events');
        }

        const data =
          (await response.json()) as EventsResponse;

        if (
          data.testData !== true ||
          !Array.isArray(data.events)
        ) {
          throw new Error('Invalid Golf event response');
        }

        const validEvents = data.events.filter(
          event =>
            typeof event.event_id === 'string' &&
            Boolean(event.event_id) &&
            typeof event.event_name === 'string' &&
            Boolean(event.event_name) &&
            !/bulk test|dummy|placeholder/i.test(event.event_name) &&
            !['nosale', 'soldout', 'cancelled', 'canceled']
              .includes((event.event_status || '').toLowerCase())
        );

        if (!cancelled) {
          setEvents(validEvents);
          setError('');
        }
      } catch {
        if (!cancelled) {
          setError(
            'Golf test events are temporarily unavailable.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const years = useMemo(() => {
    const values = new Set(
      events
        .map(event => event.date_start?.slice(0, 4))
        .filter((value): value is string => Boolean(value))
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
          event.tournament_name,
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

  const currentPage = Math.min(page, totalPages);

  const visibleEvents = filteredEvents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <section className="py-10">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>TEST DATA — NOT FOR SALE.</strong>{' '}
        Golf events are retrieved from the XS2Event test
        environment. Ticket selection is available for
        development only. No reservations or purchases can
        be made. Checkout remains disabled.
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
            placeholder="Search Golf tournaments, venues or cities"
            aria-label="Search Golf events"
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
          aria-label="Filter Golf events by year"
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
          <Loader2 size={22} className="animate-spin" />
          Loading Golf test events...
        </div>
      ) : error ? (
        <div
          role="alert"
          className="mt-8 rounded-xl border bg-white p-6 text-amber-900"
        >
          {error}
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-600">
            Showing {filteredEvents.length} Golf test events.
          </p>

          {visibleEvents.length === 0 ? (
            <div className="mt-8 rounded-xl border bg-white p-8 text-slate-600">
              No Golf events match your search.
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleEvents.map(event => (
                <article
                  key={event.event_id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-blue">
                    Golf · XS2Event TEST
                  </p>

                  <h2 className="mt-3 text-xl font-black text-navy">
                    {event.event_name}
                  </h2>

                  {event.tournament_name &&
                    event.tournament_name !== event.event_name && (
                      <p className="mt-2 text-sm text-slate-500">
                        {event.tournament_name}
                      </p>
                    )}

                  <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                    <CalendarDays size={17} className="shrink-0" />
                    <span>
                      {formatDate(event.date_start)}
                      {event.date_stop &&
                        event.date_stop.slice(0, 10) !==
                          event.date_start?.slice(0, 10) &&
                        ` – ${formatDate(event.date_stop)}`}
                    </span>
                  </p>

                  <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                    <MapPin size={17} className="shrink-0" />
                    <span>
                      {[
                        event.venue_name,
                        event.city,
                        event.iso_country,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Venue to be confirmed'}
                    </span>
                  </p>

                  <div className="mt-auto pt-6">
                    <Link
                      href={`/golf/tickets?eventId=${encodeURIComponent(event.event_id)}`}
                      className="block rounded-xl bg-blue px-4 py-3 text-center text-sm font-bold text-white transition hover:opacity-90"
                    >
                      View Test Tickets
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() =>
                  setPage(previous => Math.max(1, previous - 1))
                }
                className="rounded-lg border px-4 py-2 font-bold disabled:opacity-40"
              >
                Previous
              </button>

              <span className="text-sm text-slate-600">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
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
