
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

import { xs2eventGet } from '../../../lib/xs2event';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

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

type SupplierEventsResponse = {
  events?: SupplierEvent[];
};

type SupplierTicket = {
  event_id?: string;
  ticket_id?: string;
  ticket_status?: string;
  stock?: number | null;
};

type SupplierTicketsResponse = {
  tickets?: SupplierTicket[];
};

const PAGE_SIZE = 50;
const MAX_EVENT_PAGES = 20;
const MAX_TICKET_PAGES = 5;
const MAX_EVENTS_PER_RUN = 20;

function isAuthorised(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret || configuredSecret.length < 32) {
    return false;
  }

  const authorization = request.headers.get('authorization') || '';

  if (!authorization.startsWith('Bearer ')) {
    return false;
  }

  const providedSecret = authorization.slice(7);

  const expected = Buffer.from(configuredSecret, 'utf8');
  const provided = Buffer.from(providedSecret, 'utf8');

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}

function isValidFormula1Event(event: SupplierEvent): boolean {
  if (
    !event.event_id ||
    !/^[A-Za-z0-9_-]{1,150}$/.test(event.event_id) ||
    !event.event_name?.trim() ||
    !event.date_start
  ) {
    return false;
  }

  if (event.event_status !== 'notstarted') {
    return false;
  }

  if (/test|dummy|sample|atp tour|motogp/i.test(event.event_name)) {
    return false;
  }

  return /grand prix/i.test(event.event_name);
}

function parseSupplierDate(value?: string): string | null {
  if (!value) return null;

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

async function fetchFormula1Events(): Promise<SupplierEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const unique = new Map<string, SupplierEvent>();
  let complete = false;

  for (let page = 1; page <= MAX_EVENT_PAGES; page++) {
    const params = new URLSearchParams({
      sport_type: 'formula1',
      date_stop: `ge:${today}`,
      sorting: 'date_start:asc',
      page_size: String(PAGE_SIZE),
      page: String(page),
    });

    const response = await xs2eventGet<SupplierEventsResponse>(
      `/events?${params.toString()}`
    );

    if (!Array.isArray(response.events)) {
      throw new Error('Unexpected XS2Event events response.');
    }

    for (const event of response.events) {
      if (isValidFormula1Event(event) && event.event_id) {
        unique.set(event.event_id, event);
      }
    }

    if (response.events.length < PAGE_SIZE) {
      complete = true;
      break;
    }
  }

  if (!complete) {
    throw new Error(
      'Formula 1 event pagination limit reached. Synchronisation stopped.'
    );
  }

  return [...unique.values()].sort((a, b) =>
    (a.date_start || '').localeCompare(b.date_start || '')
  );
}

async function fetchTicketAvailability(eventId: string) {
  const uniqueTickets = new Map<string, SupplierTicket>();
  let complete = false;

  for (let page = 1; page <= MAX_TICKET_PAGES; page++) {
    const params = new URLSearchParams({
      event_id: eventId,
      ticket_status: 'available',
      stock: 'gt:0',
      page_size: String(PAGE_SIZE),
      page: String(page),
    });

    const response = await xs2eventGet<SupplierTicketsResponse>(
      `/tickets?${params.toString()}`
    );

    if (!Array.isArray(response.tickets)) {
      throw new Error('Unexpected XS2Event tickets response.');
    }

    for (const ticket of response.tickets) {
      if (
        ticket.ticket_id &&
        ticket.ticket_status === 'available' &&
        Number.isInteger(ticket.stock) &&
        (ticket.stock ?? 0) > 0 &&
        (!ticket.event_id || ticket.event_id === eventId)
      ) {
        uniqueTickets.set(ticket.ticket_id, ticket);
      }
    }

    if (response.tickets.length < PAGE_SIZE) {
      complete = true;
      break;
    }
  }

  if (!complete) {
    throw new Error(
      `Ticket pagination limit reached for event ${eventId}.`
    );
  }

  return {
    hasAvailableTickets: uniqueTickets.size > 0,
    availableCategories: uniqueTickets.size,
  };
}

export async function GET(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.XS2EVENT_SYNC_ENABLED !== 'true'
  ) {
    return NextResponse.json(
      { error: 'Synchronisation is not enabled.' },
      { status: 404 }
    );
  }

  if (!isAuthorised(request)) {
    return NextResponse.json(
      { error: 'Unauthorised.' },
      { status: 401 }
    );
  }

  try {
    const events = await fetchFormula1Events();

    if (events.length > MAX_EVENTS_PER_RUN) {
      return NextResponse.json(
        {
          error: 'Too many events for this initial test synchronisation.',
          eventsFound: events.length,
          maximumSupported: MAX_EVENTS_PER_RUN,
        },
        { status: 409 }
      );
    }

    const supabase = getSupabaseAdmin();
    let savedEvents = 0;
    let availabilityFailures = 0;

    for (const event of events) {
      if (!event.event_id || !event.event_name) {
        continue;
      }

      let availability: {
        hasAvailableTickets: boolean;
        availableCategories: number;
      } | null = null;

      try {
        availability = await fetchTicketAvailability(event.event_id);
      } catch (error) {
        availabilityFailures++;

        console.error(
          '[XS2Event sync] Availability check failed:',
          event.event_id,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      const checkedAt = new Date().toISOString();

      const record = {
        supplier_event_id: event.event_id,
        sport_type: 'formula1',
        event_name: event.event_name,
        tournament_name: event.tournament_name ?? null,
        venue_name: event.venue_name ?? null,
        city: event.city ?? null,
        iso_country: event.iso_country ?? null,
        date_start: parseSupplierDate(event.date_start),
        date_stop: parseSupplierDate(event.date_stop),
        event_status: event.event_status ?? null,
        event_checked_at: checkedAt,
        updated_at: checkedAt,
        ...(availability
          ? {
              has_available_tickets: availability.hasAvailableTickets,
              available_categories: availability.availableCategories,
              availability_checked_at: checkedAt,
            }
          : {}),
      };

      const { error } = await supabase
        .from('xs2event_events')
        .upsert(record, {
          onConflict: 'supplier_event_id',
        });

      if (error) {
        throw new Error(
          `Supabase synchronisation failed: ${error.message}`
        );
      }

      savedEvents++;
    }

    return NextResponse.json(
      {
        testMode: true,
        supplierEnvironment: 'test',
        sport: 'Formula 1',
        eventsFound: events.length,
        eventsSaved: savedEvents,
        availabilityFailures,
        completedAt: new Date().toISOString(),
        supplierReservationsCreated: false,
        supplierOrdersCreated: false,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      '[XS2Event sync] Failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );

    return NextResponse.json(
      {
        error: 'XS2Event test synchronisation failed.',
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
