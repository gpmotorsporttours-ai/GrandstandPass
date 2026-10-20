
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays,
  MapPin,
  ChevronRight,
} from 'lucide-react';

import { events } from '../../../lib/data';
import TicketSelector from '../../../components/TicketSelector';
import Formula1TicketSelector from '../../../components/Formula1TicketSelector';

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const event = events.find((e) => e.slug === slug);

  if (!event) notFound();

  const isF1 = event.sport === 'Formula 1';
  const isTennis = event.sport === 'Tennis';

  const formatDate = (date: string) =>
    new Date(date + 'T12:00:00').toLocaleDateString(
      'en-GB',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );

  return (
    <>
      <section className="bg-ice border-b">
        <div className="container-wide py-5 text-sm muted flex items-center gap-2">
          <Link href="/">Home</Link>

          <ChevronRight size={14} />

          <Link
            href={
              event.sport === 'Football'
                ? '/football'
                : '/sport/' +
                  event.sport
                    .toLowerCase()
                    .replaceAll(' ', '-')
            }
          >
            {event.sport}
          </Link>

          <ChevronRight size={14} />

          <span className="text-navy font-bold">
            {event.name}
          </span>
        </div>
      </section>

      <section className="container-wide py-10">
        <div className="grid md:grid-cols-2 gap-8 items-center mb-12">
          <div>
            <div className="eyebrow">
              {event.sport} ·{' '}
              {isF1
                ? '2027 race calendar'
                : isTennis
                ? 'Tournament calendar'
                : 'Demonstration event'}
            </div>

            <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-3">
              {event.name}
            </h1>

            <p className="muted mt-5">
              {event.description}
            </p>

            <p className="flex items-center gap-2 mt-6 font-semibold">
              <CalendarDays
                size={19}
                className="text-blue"
              />

              {formatDate(event.date)}

              {event.endDate
                ? ' – ' + formatDate(event.endDate)
                : ''}

              {!isF1 && !isTennis
                ? ' (sample date)'
                : ''}
            </p>

            <p className="flex items-center gap-2 mt-3 font-semibold">
              <MapPin
                size={19}
                className="text-blue"
              />

              {event.location}
            </p>
          </div>

          <img
            src={event.image}
            alt={event.name}
            className="w-full h-72 object-cover rounded-2xl"
          />
        </div>

        {isF1 ? (
          <Formula1TicketSelector />
        ) : isTennis ? (
          <div className="rounded-2xl border p-8 bg-ice">
            <h2 className="text-2xl font-bold text-navy">
              Tickets coming soon
            </h2>

            <p className="muted mt-3">
              Ticket prices and availability through
              Grandstand Pass are not yet confirmed.
              Booking will become available when live
              inventory is connected.
            </p>
          </div>
        ) : (
          <TicketSelector event={event} />
        )}
      </section>
    </>
  );
}
