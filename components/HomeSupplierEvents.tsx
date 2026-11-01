
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, ArrowRight } from 'lucide-react';

type SupplierEvent = {
  event_id: string;
  event_name: string;
  tournament_name?: string;
  date_start?: string;
  venue_name?: string;
  city?: string;
  iso_country?: string;
  event_status?: string;
};

type EventsResponse = {
  testData: boolean;
  events: SupplierEvent[];
  searchComplete?: boolean;
  searchError?: string | null;
};

function formatDate(value?: string) {
  if (!value) return 'Date to be confirmed';

  const date = new Date(value.slice(0, 10) + 'T12:00:00Z');

  if (Number.isNaN(date.getTime())) {
    return 'Date to be confirmed';
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function eventImage(event: SupplierEvent) {
  const text = `${event.event_name} ${event.tournament_name || ''}`;

  return /super bowl/i.test(text)
    ? '/nfl/Super%20Bowl.jpg'
    : '/nfl/NFL%20Regular%20Season.jpg';
}

export default function HomeSupplierEvents() {
  const [events, setEvents] = useState<SupplierEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/nfl-test-events');

        if (!response.ok) {
          throw new Error('Supplier events unavailable');
        }

        const data = (await response.json()) as EventsResponse;

        if (data.testData !== true || !Array.isArray(data.events)) {
          throw new Error('Unexpected supplier response');
        }

        const today = new Date().toISOString().slice(0, 10);

        const valid = data.events
          .filter(event =>
            typeof event.event_id === 'string' &&
            Boolean(event.event_id) &&
            typeof event.event_name === 'string' &&
            Boolean(event.event_name) &&
            typeof event.date_start === 'string' &&
            event.date_start.slice(0, 10) >= today &&
            !/bulk test|dummy|placeholder/i.test(event.event_name) &&
            !['nosale', 'soldout', 'cancelled', 'canceled'].includes(
              (event.event_status || '').toLowerCase()
            )
          )
          .sort((a, b) =>
            (a.date_start || '').localeCompare(b.date_start || '')
          )
          .slice(0, 6);

        if (!cancelled) {
          setEvents(valid);
          setError('');
        }
      } catch {
        if (!cancelled) {
          setError('Supplier NFL events are temporarily unavailable.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="container-wide py-12">
      <div className="eyebrow mb-2">
        Connected to XS2Event
      </div>

      <h2 className="section-title mb-3">
        NFL Events
      </h2>

      <p className="muted mb-6">
        Genuine supplier event listings from the XS2Event test environment.
        TEST DATA — NOT FOR SALE. Checkout remains disabled.
      </p>

      {loading ? (
        <p className="muted">Loading supplier NFL events...</p>
      ) : error ? (
        <p role="alert" className="muted">{error}</p>
      ) : events.length === 0 ? (
        <p className="muted">
          No upcoming NFL test events are currently listed.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => (
            <article
              key={event.event_id}
              className="card group overflow-hidden"
            >
              <Link
                href={`/nfl/tickets?eventId=${encodeURIComponent(event.event_id)}`}
              >
                <div className="h-44 overflow-hidden bg-slate-200">
                  <img
                    src={eventImage(event)}
                    alt={event.event_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </Link>

              <div className="p-5">
                <span className="eyebrow">NFL · TEST</span>

                <h3 className="font-extrabold text-lg mt-1 mb-3">
                  {event.event_name}
                </h3>

                <p className="text-sm muted flex gap-2 items-center mb-2">
                  <CalendarDays size={15} />
                  {formatDate(event.date_start)}
                </p>

                <p className="text-sm muted flex gap-2 items-start mb-5">
                  <MapPin size={15} className="shrink-0" />
                  {[
                    event.venue_name,
                    event.city,
                    event.iso_country,
                  ].filter(Boolean).join(', ') || 'Venue to be confirmed'}
                </p>

                <div className="border-t pt-4">
                  <p className="text-xs muted mb-3">
                    Supplier ticket prices shown on the ticket page.
                    Availability is not guaranteed.
                  </p>

                  <Link
                    href={`/nfl/tickets?eventId=${encodeURIComponent(event.event_id)}`}
                    className="btn-primary text-sm inline-flex items-center gap-2"
                  >
                    View Test Tickets
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Link
          href="/sport/nfl"
          className="font-bold text-blue inline-flex items-center gap-2"
        >
          Browse all NFL events
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
