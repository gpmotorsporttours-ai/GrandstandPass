
import { NextResponse } from 'next/server';
import { xs2eventGet } from '../../../lib/xs2event';

type XS2Event = {
  event_id?: unknown;
  event_name?: unknown;
  date_start?: unknown;
  city?: unknown;
  venue_name?: unknown;
  tournament_name?: unknown;
  iso_country?: unknown;
  country?: unknown;
  country_name?: unknown;
};

type XS2Response = {
  events?: XS2Event[];
  pagination?: {
    next_page?: string | null;
    total_size?: number;
  };
};

const COUNTRY_REGIONS: Record<string, string> = {
  ita: 'Italy',
  italy: 'Italy',
  it: 'Italy',
  gbr: 'United Kingdom',
  'united kingdom': 'United Kingdom',
  gb: 'United Kingdom',
  uk: 'United Kingdom',
  esp: 'Spain',
  spain: 'Spain',
  es: 'Spain',
  deu: 'Germany',
  germany: 'Germany',
  de: 'Germany',
  fra: 'France',
  france: 'France',
  fr: 'France',
  nld: 'Netherlands',
  netherlands: 'Netherlands',
  nl: 'Netherlands',
  prt: 'Portugal',
  portugal: 'Portugal',
  pt: 'Portugal',
  aut: 'Austria',
  austria: 'Austria',
  at: 'Austria',
  bel: 'Belgium',
  belgium: 'Belgium',
  be: 'Belgium',
  dnk: 'Denmark',
  denmark: 'Denmark',
  dk: 'Denmark',
  irl: 'Ireland',
  ireland: 'Ireland',
  che: 'Switzerland',
  switzerland: 'Switzerland',
  swe: 'Sweden',
  sweden: 'Sweden',
  nor: 'Norway',
  norway: 'Norway',
  fin: 'Finland',
  finland: 'Finland',
  pol: 'Poland',
  poland: 'Poland',
  tur: 'Turkey',
  turkey: 'Turkey',
  türkiye: 'Turkey',
  grc: 'Greece',
  greece: 'Greece',
  hrv: 'Croatia',
  croatia: 'Croatia',
  srb: 'Serbia',
  serbia: 'Serbia',
  hun: 'Hungary',
  hungary: 'Hungary',
  rou: 'Romania',
  romania: 'Romania',
  ukr: 'Ukraine',
  ukraine: 'Ukraine',
  bra: 'Brazil',
  brazil: 'Brazil',
  arg: 'Argentina',
  argentina: 'Argentina',
  mex: 'Mexico',
  mexico: 'Mexico',
  usa: 'USA',
  'united states': 'USA',
  can: 'Canada',
  canada: 'Canada',
  jpn: 'Japan',
  japan: 'Japan',
  aus: 'Australia',
  australia: 'Australia',
  zaf: 'South Africa',
  'south africa': 'South Africa',
  mar: 'Morocco',
  morocco: 'Morocco',
  egy: 'Egypt',
  egypt: 'Egypt',
  nga: 'Nigeria',
  nigeria: 'Nigeria',
  sau: 'Saudi Arabia',
  'saudi arabia': 'Saudi Arabia',
  qat: 'Qatar',
  qatar: 'Qatar',
  are: 'UAE',
  uae: 'UAE',
  'united arab emirates': 'UAE',
};

const CITY_REGIONS: Record<string, string> = {
  turin: 'Italy',
  torino: 'Italy',
  glasgow: 'Scotland',
  edinburgh: 'Scotland',
  copenhagen: 'Denmark',
  'ponta delgada': 'Portugal',
};

function textValue(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function resolveRegion(event: XS2Event): string {
  const country = textValue(
    event.iso_country ||
    event.country_name ||
    event.country
  ).toLowerCase();

  const city = textValue(event.city).toLowerCase();

  if (
    country === 'gbr' &&
    CITY_REGIONS[city] === 'Scotland'
  ) {
    return 'Scotland';
  }

  if (COUNTRY_REGIONS[country]) {
    return COUNTRY_REGIONS[country];
  }

  return CITY_REGIONS[city] || 'Other Leagues';
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;
const MAX_PAGES = 5;

export async function GET() {
  try {
    const today = new Date()
      .toISOString()
      .slice(0, 10);

    const allEvents: XS2Event[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        sport_type: 'soccer',
        date_stop: `ge:${today}`,
        sorting: 'date_start:asc',
        page_size: String(PAGE_SIZE),
        page: String(page),
      });

      const response = await xs2eventGet<XS2Response>(
        `/events?${params.toString()}`
      );

      const pageEvents = Array.isArray(response.events)
        ? response.events
        : [];

      for (const event of pageEvents) {
        const id = textValue(event.event_id);

        if (!id || seenIds.has(id)) {
          continue;
        }

        seenIds.add(id);
        allEvents.push(event);
      }

      const nextPage = response.pagination?.next_page;

      if (
        pageEvents.length === 0 ||
        !nextPage ||
        typeof nextPage !== 'string' ||
        nextPage.trim() === ''
      ) {
        break;
      }
    }

    const supplierFootballEvents = allEvents
      .flatMap(event => {
        const id = textValue(event.event_id);
        const name = textValue(event.event_name);
        const date = textValue(event.date_start);

        if (
          !id ||
          !name ||
          !date ||
          Number.isNaN(Date.parse(date))
        ) {
          return [];
        }

        const venue = textValue(event.venue_name);
        const city = textValue(event.city);

        return [{
          id: `xs2event-test-${id}`,
          supplierEventId: id,
          name,
          date,
          location:
            [venue, city].filter(Boolean).join(', ') ||
            'Venue to be confirmed',
          region: resolveRegion(event),
          competition:
            textValue(event.tournament_name) ||
            undefined,
        }];
      })
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      );

    return NextResponse.json(
      {
        supplierFootballEvents,
        testData: true,
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
        supplierFootballEvents: [],
        testData: true,
        error: 'Test supplier events unavailable',
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
