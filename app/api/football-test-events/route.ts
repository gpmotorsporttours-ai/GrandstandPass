
import { NextResponse } from 'next/server';
import { xs2eventGet } from '../../../lib/xs2event';

type XS2Event = {
  event_id?: unknown;
  event_name?: unknown;
  date_start?: unknown;
  city?: unknown;
  venue_name?: unknown;
  tournament_name?: unknown;
  country?: unknown;
  country_name?: unknown;
};

type XS2Response = {
  events?: XS2Event[];
};

const CITY_REGIONS: Record<string, string> = {
  turin: 'Italy',
  torino: 'Italy',
  glasgow: 'Scotland',
};

const COUNTRY_REGIONS: Record<string, string> = {
  italy: 'Italy',
  it: 'Italy',
  scotland: 'Scotland',
  'united kingdom': 'United Kingdom',
  gb: 'United Kingdom',
  uk: 'United Kingdom',
  spain: 'Spain',
  es: 'Spain',
  germany: 'Germany',
  de: 'Germany',
  france: 'France',
  fr: 'France',
  netherlands: 'Netherlands',
  nl: 'Netherlands',
  portugal: 'Portugal',
  pt: 'Portugal',
  austria: 'Austria',
  at: 'Austria',
  belgium: 'Belgium',
  be: 'Belgium',
  denmark: 'Denmark',
  dk: 'Denmark',
};

function textValue(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function resolveRegion(event: XS2Event): string {
  const city = textValue(event.city).toLowerCase();

  if (CITY_REGIONS[city]) {
    return CITY_REGIONS[city];
  }

  const country = textValue(
    event.country_name || event.country
  ).toLowerCase();

  return COUNTRY_REGIONS[country] || 'Other Leagues';
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const params = new URLSearchParams({
      sport_type: 'soccer',
      date_stop: today,
      page_size: '20',
      page: '1',
    });

    const response = await xs2eventGet<XS2Response>(
      `/events?${params.toString()}`
    );

    const rawEvents = Array.isArray(response.events)
      ? response.events
      : [];

    const supplierFootballEvents = rawEvents.flatMap(
      (event) => {
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
      }
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

