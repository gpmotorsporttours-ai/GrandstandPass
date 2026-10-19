
import Link from 'next/link';
import { CalendarDays, MapPin, ArrowRight } from 'lucide-react';
import type { Event } from '../lib/data';

export default function EventCard({ event }: { event: Event }) {
  const isFormula1 = event.sport === 'Formula 1';

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
        <span className="eyebrow">{event.sport}</span>

        <Link href={'/events/' + event.slug}>
          <h3 className="font-extrabold text-lg mt-1 mb-3 hover:text-blue">
            {event.name}
          </h3>
        </Link>

        <p className="text-sm muted flex gap-2 items-center mb-2">
          <CalendarDays size={15} />
          {new Date(event.date + 'T12:00:00').toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
          {!isFormula1 && ' · Demo date'}
        </p>

        <p className="text-sm muted flex gap-2 items-center mb-5">
          <MapPin size={15} />
          {event.location}
        </p>

        <div className="flex justify-between items-end gap-2 border-t pt-4">
          {isFormula1 ? (
            <div>
              <div className="text-xs muted">2027 Formula 1</div>
              <div className="text-sm font-bold text-navy">
                Tickets coming soon
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs muted">Demo price from</div>
              <div className="text-xl font-extrabold">
                €{event.categories[0].price}
              </div>
            </div>
          )}

          <Link
            href={'/events/' + event.slug}
            className="btn-primary text-sm"
          >
            {isFormula1 ? 'View Event' : 'View tickets'}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
