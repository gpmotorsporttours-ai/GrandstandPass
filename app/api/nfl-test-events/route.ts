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

type EventsResponse = { events?: SupplierEvent[] };

const PAGE_SIZE = 50;
const MAX_PAGES = 60;
const CONCURRENT_PAGES = 6;
const CACHE_MS = 15 * 60 * 1000;

const NFL_TERMS = [
  'nfl', 'super bowl', 'american football', 'cincinnati bengals',
  'atlanta falcons', 'new england patriots', 'kansas city chiefs',
  'dallas cowboys', 'miami dolphins', 'jacksonville jaguars',
  'new york giants', 'new york jets', 'san francisco 49ers',
  'los angeles rams', 'los angeles chargers', 'philadelphia eagles',
  'buffalo bills', 'chicago bears', 'detroit lions', 'green bay packers',
  'pittsburgh steelers', 'baltimore ravens', 'cleveland browns',
  'denver broncos', 'houston texans', 'indianapolis colts',
  'las vegas raiders', 'minnesota vikings', 'new orleans saints',
  'arizona cardinals', 'carolina panthers', 'seattle seahawks',
  'tampa bay buccaneers', 'tennessee titans', 'washington commanders',
];

function isNflEvent(event: SupplierEvent): boolean {
  const searchableText = [event.event_name, event.tournament_name]
    .filter(Boolean).join(' ').toLowerCase();
  return NFL_TERMS.some((term) => searchableText.includes(term));
}

type ApiResult = {
  testData: boolean;
  sport: string;
  diagnosticMode: boolean;
  eventsReturned: number;
  pagesChecked: number;
  searchComplete: boolean;
  searchError: string | null;
  events: SupplierEvent[];
};

type CachedResult = { value: ApiResult; expiresAt: number };

// Best-effort server-instance cache. Serverless instances may not share this cache.
let cached: CachedResult | null = null;
let inFlight: Promise<ApiResult> | null = null;

async function loadEvents(): Promise<ApiResult> {
  const today = new Date().toISOString().slice(0, 10);
  const unique = new Map<string, SupplierEvent>();
  let pagesChecked = 0;
  let reachedLastPage = false;
  let searchError: string | null = null;

  // Request a bounded batch concurrently. We only advance to the next
  // batch after checking all results in page order, so a short final page
  // still marks the end of the catalogue.
  for (let firstPage = 1; firstPage <= MAX_PAGES; firstPage += CONCURRENT_PAGES) {
    const lastPage = Math.min(firstPage + CONCURRENT_PAGES - 1, MAX_PAGES);
    const pageNumbers = Array.from(
      { length: lastPage - firstPage + 1 },
      (_, index) => firstPage + index
    );

    const results = await Promise.all(
      pageNumbers.map(async (page) => {
        try {
          const params = new URLSearchParams({
            date_stop: `ge:${today}`,
            sorting: 'date_start:asc',
            page_size: String(PAGE_SIZE),
            page: String(page),
          });
          const response = await xs2eventGet<EventsResponse>(
            `/events?${params.toString()}`
          );
          return {
            page,
            events: Array.isArray(response.events) ? response.events : [],
            failed: false,
          };
        } catch {
          return { page, events: [] as SupplierEvent[], failed: true };
        }
      })
    );

    for (const result of results) {
      if (result.failed) {
        searchError = `Supplier request failed on page ${result.page}`;
        break;
      }

      pagesChecked++;
      for (const event of result.events) {
        if (event.event_id && event.event_name && event.date_start && isNflEvent(event)) {
          unique.set(event.event_id, event);
        }
      }

      if (result.events.length < PAGE_SIZE) {
        reachedLastPage = true;
        break;
      }
    }

    if (reachedLastPage || searchError) break;
  }

  const events = [...unique.values()]
    .sort((a, b) => (a.date_start || '').localeCompare(b.date_start || ''))
    .map((event) => ({
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
    sport: 'NFL',
    diagnosticMode: false,
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
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=300' },
    });
  }

  if (!inFlight) {
    inFlight = loadEvents().finally(() => { inFlight = null; });
  }

  const result = await inFlight;
  // Cache only successful scans. Do not turn supplier failures into long-lived results.
  if (!result.searchError) {
    cached = { value: result, expiresAt: Date.now() + CACHE_MS };
  }
  return NextResponse.json(result, {
    status: result.searchError && result.pagesChecked === 0 ? 503 : 200,
    headers: {
      'Cache-Control': result.searchError
        ? 'no-store'
        : 'public, s-maxage=900, stale-while-revalidate=300',
    },
  });
}
