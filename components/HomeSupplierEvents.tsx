
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  MapPin,
  ArrowRight,
} from 'lucide-react';

type SupplierEvent = {
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
  events: SupplierEvent[];
  searchComplete?: boolean;
  searchError?: string | null;
};

type SportConfig = {
  title: string;
  label: string;
  api: string;
  ticketPath: string;
  browsePath: string;
  browseLabel: string;
  sport: 'nfl' | 'formula1';
};

const sportConfigs: SportConfig[] = [
  {
    title: 'Formula 1 Events',
    label: 'FORMULA 1 · TEST',
    api: '/api/formula1-test-events',
    ticketPath: '/formula1/tickets',
    browsePath: '/sport/formula-1',
    browseLabel: 'Browse all Formula 1 events',
    sport: 'formula1',
  },
  {
    title: 'NFL Events',
    label: 'NFL · TEST',
    api: '/api/nfl-test-events',
    ticketPath: '/nfl/tickets',
    browsePath: '/sport/nfl',
    browseLabel: 'Browse all NFL events',
    sport: 'nfl',
  },
];

function formatDate(value?: string): string {
  if (!value) return 'Date to be confirmed';

  const datePart = value.slice(0, 10);
  const parts = datePart.split('-').map(Number);

  if (
    parts.length !== 3 ||
    parts.some(part => !Number.isInteger(part))
  ) {
    return 'Date to be confirmed';
  }

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return 'Date to be confirmed';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function eventImage(
  event: SupplierEvent,
  sport: SportConfig['sport']
): string {
  const text = (
    `${event.event_name} ${event.tournament_name || ''}`
  ).toLowerCase();

  if (sport === 'nfl') {
    return /super bowl/i.test(text)
      ? '/nfl/Super%20Bowl.jpg'
      : '/nfl/NFL%20Regular%20Season.jpg';
  }

  // Match supplier Grand Prix names to the existing
  // images already uploaded to Grandstand Pass.
  const grandPrixImages: {
    terms: string[];
    image: string;
  }[] = [
    {
      terms: ['bahrain'],
      image: '/f1/Bahrain%20Image.JPG',
    },
    {
      terms: ['saudi arabian', 'jeddah'],
      image: '/f1/Saudi%20Image.JPG',
    },
    {
      terms: ['australian', 'melbourne'],
      image: '/f1/Australia%20Image.JPG',
    },
    {
      terms: ['japanese', 'suzuka'],
      image: '/f1/Japan%20Image.jpg',
    },
    {
      terms: ['chinese', 'shanghai'],
      image: '/f1/China%20Image.jpg',
    },
    {
      terms: ['miami'],
      image: '/f1/Miami%20Image.JPG',
    },
    {
      terms: ['canadian', 'montreal', 'montréal'],
      image: '/f1/Canada%20Image.JPG',
    },
    {
      terms: ['monaco', 'monte carlo'],
      image: '/f1/Monaco%20Image.jpg',
    },
    {
      terms: ['portuguese', 'portugese', 'portimao', 'portimão'],
      image: '/f1/Portugal%20Image.jpg',
    },
    {
      terms: ['british', 'silverstone'],
      image: '/f1/Britain%20Image.PNG',
    },
    {
      terms: ['austrian', 'spielberg'],
      image: '/f1/Austria%20Image.JPG',
    },
    {
      terms: ['belgian', 'spa-francorchamps'],
      image: '/f1/Belgium%20Image.JPG',
    },
    {
      terms: ['hungarian', 'hungaroring'],
      image: '/f1/Hungary%20Image.jpg',
    },
    {
      terms: ['italian', 'monza'],
      image: '/f1/Italy%20Image.jpg',
    },
    {
      terms: ['spanish', 'madrid'],
      image: '/f1/Spain%20Image.jpg',
    },
    {
      terms: ['azerbaijan', 'baku'],
      image: '/f1/Azerbaijan%20Image.jpg',
    },
    {
      terms: ['turkish', 'istanbul'],
      image: '/f1/Turkey%20Image.JPG',
    },
    {
      terms: ['singapore'],
      image: '/f1/Singapore%20Image.jpg',
    },
    {
      terms: ['united states', 'austin'],
      image: '/f1/United%20States%20Image.JPG',
    },
    {
      terms: ['mexico', 'mexican'],
      image: '/f1/Mexico%20Image.JPG',
    },
    {
      terms: ['brazil', 'são paulo', 'sao paulo'],
      image: '/f1/Brazil%20Image.JPG',
    },
    {
      terms: ['las vegas'],
      image: '/f1/Las%20Vegas%20Image.JPG',
    },
    {
      terms: ['qatar', 'lusail'],
      image: '/f1/Lusail%20Image.jpg',
    },
    {
      terms: ['abu dhabi'],
      image: '/f1/Abu%20Dhabi%20Image.JPG',
    },
  ];

  const match = grandPrixImages.find(item =>
    item.terms.some(term => text.includes(term))
  );

  return match?.image || '/formula-1-category.png';
}

function ticketUrl(
  event: SupplierEvent,
  config: SportConfig
): string {
  return (
    `${config.ticketPath}?eventId=` +
    encodeURIComponent(event.event_id)
  );
}

function SupplierSportSection({
  config,
}: {
  config: SportConfig;
}) {
  const [events, setEvents] = useState<SupplierEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(config.api);

        if (!response.ok) {
          throw new Error('Supplier events unavailable');
        }

        const data = (await response.json()) as EventsResponse;

        if (
          data.testData !== true ||
          !Array.isArray(data.events)
        ) {
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
            !/bulk test|dummy|placeholder/i.test(
              event.event_name
            ) &&
            ![
              'nosale',
              'soldout',
              'cancelled',
              'canceled',
            ].includes(
              (event.event_status || '').toLowerCase()
            )
          )
          .sort((a, b) =>
            (a.date_start || '').localeCompare(
              b.date_start || ''
            )
          )
          .slice(0, 6);

        if (!cancelled) {
          setEvents(valid);
          setError('');
        }
      } catch {
        if (!cancelled) {
          setError(
            `${config.title} are temporarily unavailable.`
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [config.api, config.title]);

  return (
    <section className="container-wide py-12">
      <div className="eyebrow mb-2">
        Connected to XS2Event
      </div>

      <h2 className="section-title mb-3">
        {config.title}
      </h2>

      <p className="muted mb-6">
        Supplier event listings from the XS2Event test environment.
        TEST DATA — NOT FOR SALE. Checkout remains disabled.
      </p>

      {loading ? (
        <p className="muted">
          Loading {config.title.toLowerCase()}...
        </p>
      ) : error ? (
        <p role="alert" className="muted">
          {error}
        </p>
      ) : events.length === 0 ? (
        <p className="muted">
          No upcoming test events are currently listed.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => {
            const href = ticketUrl(event, config);

            return (
              <article
                key={event.event_id}
                className="card group overflow-hidden"
              >
                <Link href={href}>
                  <div className="h-44 overflow-hidden bg-slate-200">
                    <img
                      src={eventImage(event, config.sport)}
                      alt={event.event_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </Link>

                <div className="p-5">
                  <span className="eyebrow">
                    {config.label}
                  </span>

                  <Link href={href}>
                    <h3 className="font-extrabold text-lg mt-1 mb-3 hover:text-blue">
                      {event.event_name}
                    </h3>
                  </Link>

                  <p className="text-sm muted flex gap-2 items-center mb-2">
                    <CalendarDays
                      size={15}
                      className="shrink-0"
                    />
                    <span>
                      {formatDate(event.date_start)}
                      {event.date_stop &&
                        event.date_stop.slice(0, 10) !==
                          event.date_start?.slice(0, 10) &&
                        ` – ${formatDate(event.date_stop)}`}
                    </span>
                  </p>

                  <p className="text-sm muted flex gap-2 items-start mb-5">
                    <MapPin
                      size={15}
                      className="shrink-0"
                    />
                    <span>
                      {[
                        event.venue_name,
                        event.city,
                        event.iso_country,
                      ]
                        .filter(Boolean)
                        .join(', ') ||
                        'Venue to be confirmed'}
                    </span>
                  </p>

                  <div className="border-t pt-4">
                    <p className="text-xs muted mb-3">
                      Supplier ticket prices shown on the
                      ticket page. Availability is not
                      guaranteed.
                    </p>

                    <Link
                      href={href}
                      className="btn-primary text-sm inline-flex items-center gap-2"
                    >
                      View Test Tickets
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Link
          href={config.browsePath}
          className="font-bold text-blue inline-flex items-center gap-2"
        >
          {config.browseLabel}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

export default function HomeSupplierEvents() {
  return (
    <>
      {sportConfigs.map(config => (
        <SupplierSportSection
          key={config.sport}
          config={config}
        />
      ))}
    </>
  );
}
