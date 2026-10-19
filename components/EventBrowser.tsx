
'use client';

import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { events } from '../lib/data';
import EventCard from './EventCard';

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

export default function EventBrowser({
  initialSport = 'All',
  initialRegion = 'All',
}: {
  initialSport?: string;
  initialRegion?: string;
}) {
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState(initialSport);
  const [region, setRegion] = useState(initialRegion);
  const [sort, setSort] = useState('date');

  const matchesSport = (event: (typeof events)[number]) => {
    if (sport === 'All') return true;

    if (otherSports.includes(sport)) {
      return event.sport === 'Other Events' &&
        event.region === sport;
    }

    return event.sport === sport;
  };

  const regions = [
    ...new Set(
      events
        .filter(matchesSport)
        .map(event => event.region)
    ),
  ].sort();

  const filtered = useMemo(() => {
    return events
      .filter(event => {
        const sportMatches = matchesSport(event);

        const regionMatches =
          region === 'All' || event.region === region;

        const searchMatches = [
          event.name,
          event.location,
          event.region,
          event.sport,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase());

        return sportMatches && regionMatches && searchMatches;
      })
      .sort((a, b) =>
        sort === 'price'
          ? a.categories[0].price - b.categories[0].price
          : a.date.localeCompare(b.date)
      );
  }, [query, sport, region, sort]);

  return (
    <section id="events" className="py-14">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-7">
        <div>
          <div className="eyebrow mb-2">Explore the action</div>
          <h2 className="section-title">Find your next event</h2>
          <p className="muted mt-2">
            Browse event listings while we prepare the live catalogue.
          </p>
        </div>

        <span className="text-sm muted">
          {filtered.length} events
        </span>
      </div>

      <div className="bg-ice p-4 rounded-xl grid md:grid-cols-4 gap-3 mb-7">
        <label className="md:col-span-1 relative">
          <Search
            size={17}
            className="absolute left-3 top-3.5 text-slate-400"
          />
          <input
            className="field pl-10"
            placeholder="Search events or cities"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>

        <select
          className="field"
          value={sport}
          onChange={e => {
            setSport(e.target.value);
            setRegion('All');
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
          onChange={e => setRegion(e.target.value)}
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
          onChange={e => setSort(e.target.value)}
          aria-label="Sort events"
        >
          <option value="date">Soonest first</option>
          {sport !== 'Formula 1' && (
            <option value="price">Lowest demo price</option>
          )}
        </select>
      </div>

      {filtered.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(event => (
            <EventCard key={event.slug} event={event} />
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
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}
