
'use client';

import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { events } from '../lib/data';
import EventCard from './EventCard';

const SUPPLIER_EVENTS_PER_PAGE = 15;

const otherSports = [
  'Basketball',
  'Boxing',
  'Cricket',
  'Golf',
  'Horse Racing',
  'NFL',
  'Rugby',
];

const sportOptions = [
  'Football',
  'Formula 1',
  'MotoGP',
  'Tennis',
  'Other Events',
  ...otherSports,
];

type ListedEvent = (typeof events)[number];

/**
 * A separate, development-only supplier listing.
 *
 * These listings are NOT added to lib/data.ts.
 * They are NOT passed to EventCard, because EventCard
 * expects a normal demonstration event.
 */
export type SupplierFootballEvent = {
  id: string;
  name: string;
  date: string;
  location: string;
  region: string;
  competition?: string;
  supplierEventId?: string;
};

const rugbyCompetitions = [
  {
    title: 'Nations Championship 2026',
    matches: (event: ListedEvent) =>
      event.slug.startsWith('rugby-nations-2026-') ||
      event.description.includes('Nations Championship 2026'),
  },
  {
    title: 'Six Nations 2027',
    matches: (event: ListedEvent) =>
      event.slug.startsWith('six-nations-2027-') ||
      event.slug.startsWith('rugby-six-nations-2027-') ||
      event.description.includes('Six Nations 2027'),
  },
  {
    title: 'Rugby World Championship 2027',
    matches: (event: ListedEvent) =>
      event.slug.includes('rugby-world') ||
      /rugby world (cup|championship)/i.test(
        event.name + ' ' + event.description
      ),
  },
];

const basketballCompetitions = [
  {
    title: 'NBA Global Games',
    matches: (event: ListedEvent) =>
      event.slug.startsWith('nba-global-games-') ||
      event.description.includes('NBA Global Games'),
  },
  {
    title: 'NBA Europe Games',
    matches: (event: ListedEvent) =>
      event.slug.startsWith('nba-europe-games-') ||
      event.description.includes('NBA Europe Games'),
  },
];

const golfCompetitions = [
  {
    title: 'DP World Tour Championship 2026',
    matches: (event: ListedEvent) =>
      event.slug.startsWith('dp-world-tour-championship-2026-') ||
      event.description.includes('DP World Tour Championship 2026'),
  },
  {
    title: 'US Open Golf 2027',
    matches: (event: ListedEvent) =>
      event.slug.startsWith('us-open-golf-2027-') ||
      event.description.includes('US Open Golf 2027'),
  },
];

function formatSupplierDate(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function EventBrowser({
  initialSport = 'All',
  initialRegion = 'All',
  supplierFootballEvents = [],
}: {
  initialSport?: string;
  initialRegion?: string;
  supplierFootballEvents?: SupplierFootballEvent[];
}) {
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState(initialSport);
  const [region, setRegion] = useState(initialRegion);
  const [sort, setSort] = useState('date');
  const [supplierPage, setSupplierPage] = useState(1);

  const matchesSport = (event: ListedEvent) => {
    if (sport === 'All') return true;

    if (otherSports.includes(sport)) {
      return (
        event.sport === 'Other Events' &&
        event.region === sport
      );
    }

    return event.sport === sport;
  };

  const showSupplierFootball =
    sport === 'Football' || sport === 'All';

  const regions = [
    ...new Set([
      ...events
        .filter(matchesSport)
        .map(event => event.region),

      ...(showSupplierFootball
        ? supplierFootballEvents.map(event => event.region)
        : []),
    ]),
  ].sort();

  const filtered = useMemo(() => {
    return events
      .filter(event => {
        const sportMatches =
          sport === 'All' ||
          (otherSports.includes(sport)
            ? event.sport === 'Other Events' &&
              event.region === sport
            : event.sport === sport);

        const regionMatches =
          region === 'All' || event.region === region;

        const searchMatches = [
          event.name,
          event.location,
          event.region,
          event.sport,
          event.description,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase());

        return (
          sportMatches &&
          regionMatches &&
          searchMatches
        );
      })
      .sort((a, b) =>
        sort === 'price'
          ? a.categories[0].price - b.categories[0].price
          : a.date.localeCompare(b.date)
      );
  }, [query, sport, region, sort]);

  const filteredSupplierEvents = useMemo(() => {
    if (!showSupplierFootball) {
      return [];
    }

    const search = query.trim().toLowerCase();

    return supplierFootballEvents
      .filter(event => {
        const regionMatches =
          region === 'All' || event.region === region;

        const searchMatches = [
          event.name,
          event.location,
          event.region,
          event.competition || '',
          'Football',
        ]
          .join(' ')
          .toLowerCase()
          .includes(search);

        return regionMatches && searchMatches;
      })
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      );
  }, [
    supplierFootballEvents,
    showSupplierFootball,
    region,
    query,
  ]);

  const supplierPageCount = Math.ceil(
    filteredSupplierEvents.length / SUPPLIER_EVENTS_PER_PAGE
  );

  const currentSupplierPage = Math.min(
    supplierPage,
    Math.max(1, supplierPageCount)
  );

  const visibleSupplierEvents = filteredSupplierEvents.slice(
    (currentSupplierPage - 1) * SUPPLIER_EVENTS_PER_PAGE,
    currentSupplierPage * SUPPLIER_EVENTS_PER_PAGE
  );

  const supplierPageNumbers = Array.from(
    { length: supplierPageCount },
    (_, index) => index + 1
  ).filter(page =>
    page === 1 ||
    page === supplierPageCount ||
    Math.abs(page - currentSupplierPage) <= 1
  );

  const competitions =
    sport === 'Rugby'
      ? rugbyCompetitions
      : sport === 'Basketball'
        ? basketballCompetitions
        : sport === 'Golf'
          ? golfCompetitions
          : null;

  const groupedEvents = competitions?.map(
    competition => ({
      title: competition.title,
      items: filtered.filter(competition.matches),
    })
  );

  const ungroupedEvents = competitions
    ? filtered.filter(
        event =>
          !competitions.some(competition =>
            competition.matches(event)
          )
      )
    : [];

  const totalEvents =
    filtered.length + filteredSupplierEvents.length;

  return (
    <section id="events" className="py-14">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-7">
        <div>
          <div className="eyebrow mb-2">
            Explore the action
          </div>

          <h2 className="section-title">
            Find your next event
          </h2>

          <p className="muted mt-2">
            Browse event listings while we prepare
            the live catalogue.
          </p>
        </div>

        <span className="text-sm muted">
          {totalEvents} events
        </span>
      </div>

      <div className="bg-ice p-4 rounded-xl grid md:grid-cols-4 gap-3 mb-7">
        <label className="md:col-span-1 relative">
          <Search
            size={17}
            className="absolute left-3 top-3.5 text-slate-400"
          />

          <input
            className="field w-full"
            style={{ paddingLeft: '2.75rem' }}
            placeholder="Search events or cities"
            aria-label="Search events or cities"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSupplierPage(1);
            }}
          />
        </label>

        <select
          className="field"
          value={sport}
          onChange={e => {
            setSport(e.target.value);
            setRegion('All');
            setSupplierPage(1);
          }}
          aria-label="Sport"
        >
          <option value="All">All</option>

          {sportOptions.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          className="field"
          value={region}
          onChange={e => {
            setRegion(e.target.value);
            setSupplierPage(1);
          }}
          aria-label="Region"
        >
          <option value="All">All</option>

          {regions.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          className="field"
          value={sort}
          onChange={e => {
            setSort(e.target.value);
            setSupplierPage(1);
          }}
          aria-label="Sort events"
        >
          <option value="date">Soonest first</option>

          {sport !== 'Formula 1' && (
            <option value="price">
              Lowest demo price
            </option>
          )}
        </select>
      </div>

      {totalEvents > 0 ? (
        <div className="space-y-12">
          {filteredSupplierEvents.length > 0 && (
            <div>
              <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
                <h3 className="text-xl font-extrabold text-amber-950">
                  XS2Event test football matches
                </h3>

                <p className="mt-2 text-sm text-amber-950">
                  TEST DATA — NOT FOR SALE.
                  These are development-only supplier
                  listings. Availability is not reserved
                  and checkout is disabled.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleSupplierEvents.map(event => (
                  <article
                    key={event.id}
                    className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-3 text-xs font-extrabold uppercase tracking-wider text-amber-800">
                      Football · XS2Event TEST
                    </div>

                    <h3 className="text-lg font-extrabold text-navy">
                      {event.name}
                    </h3>

                    <p className="mt-3 text-sm muted">
                      {formatSupplierDate(event.date)}
                    </p>

                    <p className="mt-2 text-sm muted">
                      {event.location}
                    </p>

                    <p className="mt-2 text-sm font-semibold text-navy">
                      {event.region}
                    </p>

                    {event.competition && (
                      <p className="mt-2 text-sm muted">
                        {event.competition}
                      </p>
                    )}

                    <div className="mt-5 border-t pt-4">
                      <p className="text-sm font-bold text-amber-900">
                        Test listing — not for sale
                      </p>

                      <p className="mt-1 text-xs muted">
                        Ticket availability and indicative
                        Grandstand Pass prices are shown
                        on the match ticket page.
                      </p>

                      <a
                        href={
                          event.supplierEventId
                            ? `/football/tickets?eventId=${encodeURIComponent(event.supplierEventId)}`
                            : '/football'
                        }
                        className="mt-4 inline-flex items-center justify-center rounded-lg bg-navy px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue"
                      >
                        View test tickets →
                      </a>
                    </div>
                  </article>
                ))}
              </div>

              {supplierPageCount > 1 && (
                <nav
                  aria-label="Supplier match pages"
                  className="mt-8 flex flex-wrap items-center justify-center gap-2"
                >
                  <button
                    type="button"
                    disabled={currentSupplierPage === 1}
                    onClick={() => setSupplierPage(currentSupplierPage - 1)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  {supplierPageNumbers.map((page, index) => (
                    <span key={page} className="contents">
                      {index > 0 && page > supplierPageNumbers[index - 1] + 1 && (
                        <span aria-hidden="true" className="px-1 text-slate-500">…</span>
                      )}
                      <button
                        type="button"
                        aria-label={`Go to supplier match page ${page}`}
                        aria-current={page === currentSupplierPage ? 'page' : undefined}
                        onClick={() => setSupplierPage(page)}
                        className={
                          'min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold ' +
                          (page === currentSupplierPage
                            ? 'border-navy bg-navy text-white'
                            : 'border-slate-300 bg-white text-navy hover:bg-ice')
                        }
                      >
                        {page}
                      </button>
                    </span>
                  ))}

                  <button
                    type="button"
                    disabled={currentSupplierPage === supplierPageCount}
                    onClick={() => setSupplierPage(currentSupplierPage + 1)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>

                  <span className="w-full text-center text-xs text-slate-600">
                    Page {currentSupplierPage} of {supplierPageCount} · Showing{' '}
                    {(currentSupplierPage - 1) * SUPPLIER_EVENTS_PER_PAGE + 1}–
                    {Math.min(currentSupplierPage * SUPPLIER_EVENTS_PER_PAGE, filteredSupplierEvents.length)}{' '}
                    of {filteredSupplierEvents.length} test matches
                  </span>
                </nav>
              )}
            </div>
          )}

          {filtered.length > 0 &&
            (competitions ? (
              <div className="space-y-14">
                {groupedEvents?.map(group =>
                  group.items.length > 0 ? (
                    <div key={group.title}>
                      <div className="mb-6 border-b border-slate-200 pb-4">
                        <h2 className="text-2xl md:text-3xl font-black text-navy">
                          {group.title}
                        </h2>

                        <p className="muted mt-2">
                          {group.items.length}{' '}
                          {group.items.length === 1
                            ? 'event'
                            : 'events'}
                        </p>
                      </div>

                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {group.items.map(event => (
                          <EventCard
                            key={event.slug}
                            event={event}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null
                )}

                {ungroupedEvents.length > 0 && (
                  <div>
                    <div className="mb-6 border-b border-slate-200 pb-4">
                      <h2 className="text-2xl md:text-3xl font-black text-navy">
                        Other {sport} Events
                      </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {ungroupedEvents.map(event => (
                        <EventCard
                          key={event.slug}
                          event={event}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(event => (
                  <EventCard
                    key={event.slug}
                    event={event}
                  />
                ))}
              </div>
            ))}
        </div>
      ) : (
        <div className="text-center py-16 border rounded-xl">
          <SlidersHorizontal className="mx-auto mb-3 text-blue" />

          <h3 className="font-bold">
            No events match your filters
          </h3>

          <p className="muted text-sm mt-2">
            Try a different search or category.
          </p>

          <button
            className="btn-outline mt-5"
            onClick={() => {
              setQuery('');
              setRegion('All');
              setSport(initialSport);
              setSupplierPage(1);
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}
