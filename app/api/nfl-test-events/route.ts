
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
const MAX_PAGES = 5;

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const collected: SupplierEvent[] = [];

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

      collected.push(...pageEvents);

      if (pageEvents.length < PAGE_SIZE) {
        break;
      }
    }

    const unique = new Map<string, SupplierEvent>();

    for (const event of collected) {
      if (
        event.event_id &&
        event.event_name &&
        event.date_start
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
        diagnosticMode: true,
        eventsReturned: events.length,
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
        diagnosticMode: true,
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
