'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Trophy } from 'lucide-react';

type FootballEvent = {
  event_id?: string;
  event_name?: string;
  date_start?: string;
  venue_name?: string;
  city?: string;
  tournament_name?: string;
  event_status?: string;
};

type LegacyFootballEvent = {
  supplierEventId?: string;
  name?: string;
  date?: string;
  location?: string;
  competition?: string;
};

type FootballResponse = {
  testData?: boolean;
  events?: FootballEvent[];
  supplierFootballEvents?: LegacyFootballEvent[];
};

type FeaturedMatch = {
  id: string;
  name: string;
  date: string;
  location: string;
  competition: string;
};

const featuredClubs = [
  /real madrid/i,
  /barcelona/i,
  /manchester united/i,
  /manchester city/i,
  /liverpool/i,
  /arsenal/i,
  /chelsea/i,
  /tottenham/i,
  /bayern/i,
  /borussia dortmund/i,
  /juventus/i,
  /internazionale|inter milan/i,
  /ac milan/i,
  /paris saint.germain|\bpsg\b/i,
  /atletico|atlético/i,
  /napoli/i,
];

function rankMatch(name: string): number {
  return featuredClubs.reduce((score, club) => score + (club.test(name) ? 1 : 0), 0);
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return 'Date to be confirmed';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return 'Date to be confirmed';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

function normalizeResponse(data: FootballResponse): FeaturedMatch[] {
  const source: FeaturedMatch[] = Array.isArray(data.supplierFootballEvents)
    ? data.supplierFootballEvents.flatMap(event => {
        if (!event.supplierEventId || !event.name || !event.date) return [];
        return [{
          id: event.supplierEventId,
          name: event.name,
          date: event.date,
          location: event.location || 'Venue to be confirmed',
          competition: event.competition || 'Football',
        }];
      })
    : Array.isArray(data.events)
      ? data.events.flatMap(event => {
          if (!event.event_id || !event.event_name || !event.date_start) return [];
          if (['nosale', 'soldout', 'cancelled', 'canceled'].includes((event.event_status || '').toLowerCase())) return [];
          return [{
            id: event.event_id,
            name: event.event_name,
            date: event.date_start,
            location: [event.venue_name, event.city].filter(Boolean).join(', ') || 'Venue to be confirmed',
            competition: event.tournament_name || 'Football',
          }];
        })
      : [];

  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  return source.filter(event => {
    if (seen.has(event.id) || event.date.slice(0, 10) < today ||
        !/^\d{4}-\d{2}-\d{2}/.test(event.date) ||
        /bulk test|dummy|placeholder/i.test(event.name) ||
        rankMatch(event.name) === 0) return false;
    seen.add(event.id);
    return true;
  }).sort((a, b) => {
    const scoreDifference = rankMatch(b.name) - rankMatch(a.name);
    return scoreDifference || a.date.localeCompare(b.date);
  }).slice(0, 6);
}

export default function FeaturedFootballMatches() {
  const [matches, setMatches] = useState<FeaturedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/football-test-events', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Supplier unavailable');
        const data = (await response.json()) as FootballResponse;
        if (data.testData !== true) throw new Error('Not a test feed');
        if (!controller.signal.aborted) setMatches(normalizeResponse(data));
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const matchCount = useMemo(() => matches.length, [matches]);

  return (
    <section className="container-wide py-12" aria-labelledby="featured-football-title">
      <div className="eyebrow mb-2">The biggest matchdays</div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h2 id="featured-football-title" className="section-title">Featured Football Matches</h2>
          <p className="muted mt-2">Major-club fixtures from the XS2Event test catalogue.</p>
        </div>
        <Link href="/football" className="font-bold text-blue inline-flex items-center gap-2">
          Browse all football <ArrowRight size={16} />
        </Link>
      </div>
      <p className="text-sm text-amber-900 mb-6 font-semibold">
        TEST DATA — NOT FOR SALE. Ticket availability is not guaranteed and checkout is disabled.
      </p>
      {loading ? (
        <p className="muted" role="status">Loading featured test fixtures...</p>
      ) : failed ? (
        <p className="muted" role="status">Featured football fixtures are temporarily unavailable.</p>
      ) : matchCount === 0 ? (
        <p className="muted">No upcoming featured fixtures are currently in the test feed. <Link href="/football" className="font-bold text-blue">Browse football events</Link>.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map(match => (
            <article key={match.id} className="card overflow-hidden">
              <div className="bg-navy text-white px-5 py-6">
                <div className="text-xs font-extrabold uppercase tracking-wider text-blue-200 flex items-center gap-2 mb-3">
                  <Trophy size={15} /> {match.competition}
                </div>
                <h3 className="text-xl font-extrabold leading-snug">{match.name}</h3>
              </div>
              <div className="p-5">
                <p className="text-sm muted flex items-center gap-2 mb-3"><CalendarDays size={16} className="shrink-0" /> {formatDate(match.date)}</p>
                <p className="text-sm muted flex items-start gap-2 mb-5"><MapPin size={16} className="shrink-0" /> {match.location}</p>
                <div className="border-t pt-4">
                  <p className="text-xs muted mb-3">Supplier test listing. Prices and reported offers can be checked on the ticket page.</p>
                  <Link href={`/football/tickets?eventId=${encodeURIComponent(match.id)}`} className="btn-primary text-sm inline-flex items-center gap-2">
                    View Test Tickets <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
