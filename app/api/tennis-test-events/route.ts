
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

type ApiResult = {
  testData: boolean;
  sport: string;
  eventsReturned: number;
  pagesChecked: number;
  searchComplete: boolean;
  searchError: string | null;
  events: SupplierEvent[];
};

const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const CONCURRENT_PAGES = 5;
const CACHE_MS = 15 * 60 * 1000;

let cached: {
  value: ApiResult;
  expiresAt: number;
} | null = null;

let inFlight: Promise<ApiResult> | null = null;

function isValidTennisEvent(
  event: SupplierEvent,
  today: string
): boolean {
  const name = event.event_name?.trim() || '';
  const tournament = event.tournament_name?.trim() || '';
  const country = (event.iso_country || '').toUpperCase();
  const city = (event.city || '').toLowerCase();
  const venue = (event.venue_name || '').toLowerCase();

  if (!event.event_id || !name || !event.date_start) {
    return false;
  }

  // Include only upcoming events.
  if (event.date_start.slice(0, 10) < today) {
    return false;
  }

  // Exclude unavailable, cancelled and closed events.
  if ((event.event_status || '').toLowerCase() !== 'notstarted') {
    return false;
  }

  // Exclude placeholder or dummy records.
  if (
    /bulk test|dummy|sample|placeholder/i.test(
      `${name} ${tournament}`
    )
  ) {
    return false;
  }

  // Exclude Wimbledon records with an inconsistent location.
  // Legitimate Wimbledon sessions should be in London, UK.
  if (/wimbledon/i.test(`${name} ${tournament}`)) {
    if (
      country !== 'GBR' ||
      !city.includes('london') ||
      !venue.includes('wimbledon')
    ) {
      return false;
    }
  }

  return true;
}

async function loadEvents(): Promise<ApiResult> {
  const today = new Date().toISOString().slice(0, 10);
  const unique = new Map<string, SupplierEvent>();

  let pagesChecked = 0;
  let reachedLastPage = false;
  let searchError: string | null = null;

  for (
    let firstPage = 1;
    firstPage <= MAX_PAGES;
    firstPage += CONCURRENT_PAGES
  ) {
    const lastPage = Math.min(
      firstPage + CONCURRENT_PAGES - 1,
      MAX_PAGES
    );

    const pageNumbers = Array.from(
      { length: lastPage - firstPage + 1 },
      (_, index) => firstPage + index
    );

    const results = await Promise.all(
      pageNumbers.map(async page => {
        try {
          const params = new URLSearchParams({
            sport_type: 'tennis',
            date_stop: `ge:${today}`,
            sorting: 'date_start:asc',
            page_size: String(PAGE_SIZE),
            page: String(page),
          });

          const response = await xs2eventGet<EventsResponse>(
            `/events?${params.toString()}`
          );

          if (!Array.isArray(response.events)) {
            throw new Error('Invalid supplier response');
          }

          return {
            page,
            events: response.events,
            failed: false,
          };
        } catch {
          return {
            page,
            events: [] as SupplierEvent[],
            failed: true,
          };
        }
      })
    );

    // Process results in page order.
    for (const result of results) {
      if (result.failed) {
        searchError =
          `Supplier request failed on page ${result.page}`;
        break;
      }

      pagesChecked++;

      for (const event of result.events) {
        if (
          isValidTennisEvent(event, today) &&
          event.event_id
        ) {
          unique.set(event.event_id, event);
        }
      }

      if (result.events.length < PAGE_SIZE) {
        reachedLastPage = true;
        break;
      }
    }

    if (reachedLastPage || searchError) {
      break;
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

  return {
    testData: true,
    sport: 'Tennis',
    eventsReturned: events.length,
    pagesChecked,
    searchComplete: reachedLastPage,
    searchError,
    events,
  };
}

export async function GET() {
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.value, {
      headers: {
        'Cache-Control':
          'public, s-maxage=900, stale-while-revalidate=300',
      },
    });
  }

  if (!inFlight) {
    inFlight = loadEvents().finally(() => {
      inFlight = null;
    });
  }

  try {
    const result = await inFlight;

    if (!result.searchError) {
      cached = {
        value: result,
        expiresAt: Date.now() + CACHE_MS,
      };
    }

    return NextResponse.json(result, {
      status:
        result.searchError && result.pagesChecked === 0
          ? 503
          : 200,
      headers: {
        'Cache-Control': result.searchError
          ? 'no-store'
          : 'public, s-maxage=900, stale-while-revalidate=300',
      },
    });
  } catch {
    return NextResponse.json(
      {
        testData: true,
        sport: 'Tennis',
        error: 'Tennis test events could not be loaded',
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
