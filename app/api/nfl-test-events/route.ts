
import { NextResponse } from 'next/server';
import { xs2eventGet } from '../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupplierEvent = {
  event_id?: string;
  event_name?: string;
  tournament_name?: string;
  venue_name?: string;
  city?: string;
  iso_country?: string;
  date_start?: string;
  date_stop?: string;
  event_status?: string;
};

type EventsResponse = {
  events?: SupplierEvent[];
};

const PAGE_SIZE = 50;
const MAX_PAGES = 20;

const NFL_TERMS = [
  'nfl',
  'super bowl',
  'american football',
  'cincinnati bengals',
  'atlanta falcons',
  'new england patriots',
  'kansas city chiefs',
  'dallas cowboys',
  'miami dolphins',
  'jacksonville jaguars',
  'new york giants',
  'new york jets',
  'san francisco 49ers',
  'los angeles rams',
  'los angeles chargers',
  'philadelphia eagles',
  'buffalo bills',
  'chicago bears',
  'detroit lions',
  'green bay packers',
  'pittsburgh steelers',
  'baltimore ravens',
  'cleveland browns',
  'denver broncos',
  'houston texans',
  'indianapolis colts',
  'las vegas raiders',
  'minnesota vikings',
  'new orleans saints',
  'arizona cardinals',
  'carolina panthers',
  'seattle seahawks',
  'tampa bay buccaneers',
  'tennessee titans',
  'washington commanders',
];

function isNflEvent(event: SupplierEvent): boolean {
  const searchableText = [
    event.event_name,
    event.tournament_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return NFL_TERMS.some(term =>
    searchableText.includes(term)
  );
}

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const collected: SupplierEvent[] = [];
    let pagesChecked = 0;
    let reachedLastPage = false;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        date_stop: `ge:${today}`,
        sorting: 'date_start:asc',
        page_size: String(PAGE_SIZE),
        page: String(page),
      });

      const response = await xs2eventGet<EventsResponse>(
        `/events?${params.toString()}`
      );

      const pageEvents = Array.isArray(response.events)
        ? response.events
        : [];

      pagesChecked++;
      collected.push(...pageEvents);

      if (pageEvents.length < PAGE_SIZE) {
        reachedLastPage = true;
        break;
      }
    }

    const unique = new Map<string, SupplierEvent>();

    for (const event of collected) {
      if (
        event.event_id &&
        event.event_name &&
        event.date_start &&
        isNflEvent(event)
      ) {
        unique.set(event.event_id, event);
      }
    }

    const events = [...unique.values()]
      .sort((a, b) =>
        (a.date_start || '').localeCompare(
          b.date_start || ''
        )
      )
      .map(event => ({
        event_id: event.event_id,
        event_name: event.event_name,
        tournament_name: event.tournament_name,
        date_start: event.date_start,
        date_stop: event.date_stop,
        venue_name: event.venue_name,
        city: event.city,
        iso_country: event.iso_country,
        event_status: event.event_status,
      }));

    return NextResponse.json(
      {
        testData: true,
        sport: 'NFL',
        diagnosticMode: false,
        eventsReturned: events.length,
        pagesChecked,
        searchComplete: reachedLastPage,
        events,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        testData: true,
        sport: 'NFL',
        error: 'NFL test events could not be loaded',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
