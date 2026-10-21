
import Link from 'next/link';
import {
  CalendarDays,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import type { Event } from '../lib/data';

export default function EventCard({
  event,
}: {
  event: Event;
}) {
  const isComingSoon =
    event.sport === 'Formula 1' ||
    event.sport === 'Tennis';

  const startingPrice = event.categories[0]?.price;

  const hasDemoPrice =
    typeof startingPrice === 'number' &&
    Number.isFinite(startingPrice) &&
    startingPrice > 0;

  const formatDate = (date: string) =>
    new Date(date + 'T12:00:00').toLocaleDateString(
      'en-GB',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }
    );

  return (
    <article className="card group">
      <Link href={'/events/' + event.slug}>
        <div className="h-44 overflow-hidden bg-slate-200">
          <img
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            src={event.image}
            alt={event.name}
          />
        </div>
      </Link>

      <div className="p-5">
        <span className="eyebrow">
          {event.sport}
        </span>

        <Link href={'/events/' + event.slug}>
          <h3 className="font-extrabold text-lg mt-1 mb-3 hover:text-blue">
            {event.name}
          </h3>
        </Link>

        <p className="text-sm muted flex gap-2 items-center mb-2">
          <CalendarDays size={15} />
          {formatDate(event.date)}
          {event.endDate
            ? ' – ' + formatDate(event.endDate)
            : ''}
          {!isComingSoon ? ' · Demo date' : ''}
        </p>

        <p className="text-sm muted flex gap-2 items-center mb-5">
          <MapPin size={15} />
          {event.location}
        </p>

        <div className="flex justify-between items-end gap-2 border-t pt-4">
          {isComingSoon ? (
            <div>
              <div className="text-xs muted">
                {event.sport}
              </div>

              <div className="text-sm font-bold text-navy">
                Tickets coming soon
              </div>
            </div>
          ) : hasDemoPrice ? (
            <div>
              <div className="text-xs muted">
                Demo price from
              </div>

              <div className="text-xl font-extrabold">
                €{startingPrice}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs muted">
                Ticket pricing
              </div>

              <div className="text-sm font-bold text-navy">
                Awaiting supplier pricing
              </div>
            </div>
          )}

          <Link
            href={'/events/' + event.slug}
            className="btn-primary text-sm"
          >
            {isComingSoon
              ? 'View Event'
              : 'View tickets'}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
