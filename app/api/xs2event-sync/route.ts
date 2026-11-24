import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

import { xs2eventGet } from '../../../lib/xs2event';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SOURCE_ENVIRONMENT = 'test';

const EVENT_PAGE_SIZE = 50;
const TICKET_PAGE_SIZE = 50;
const MAX_TICKET_PAGES = 5;
const MAX_EVENT_PAGES = 1000;

const BATCH_SIZE = 10;
const AVAILABILITY_CONCURRENCY = 3;
const RUN_BUDGET_MS = 30000;
const GROUP_START_LIMIT_MS = 15000;

const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;
const SAFE_SPORT = /^[a-z0-9_-]{1,50}$/;

type SupplierEvent = {
  event_id?: string;
  event_name?: string;
  sport_type?: string;
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

type Availability = {
  hasAvailableTickets: boolean;
  availableCategories: number;
};

type EventRecord = {
  source_environment: string;
  supplier_event_id: string;
  sport_type: string;
  event_name: string;
  tournament_name: string | null;
  venue_name: string | null;
  city: string | null;
  iso_country: string | null;
  date_start: string | null;
  date_stop: string | null;
  event_status: string | null;
  event_checked_at: string;
  updated_at: string;
  has_available_tickets?: boolean;
  available_categories?: number;
  availability_checked_at?: string;
};

type EventResult = {
  record: EventRecord | null;
  skipped: boolean;
  availabilityFailed: boolean;
  failedEventId: string | null;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function isAuthorised(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret || configuredSecret.length < 32) {
    return false;
  }

  const authorization =
    request.headers.get('authorization') || '';

  if (!authorization.startsWith('Bearer ')) {
    return false;
  }

  const expected = Buffer.from(
    configuredSecret,
    'utf8'
  );

  const provided = Buffer.from(
    authorization.slice(7),
    'utf8'
  );

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}

function parseSupplierDate(
  value?: string
): string | null {
  if (!value) return null;

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function parseInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
): number | null {
  if (value === null) {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

function isValidEvent(
  event: SupplierEvent,
  sport: string
): boolean {
  if (
    !event.event_id ||
    !SAFE_ID.test(event.event_id) ||
    !event.event_name?.trim() ||
    !parseSupplierDate(event.date_start)
  ) {
    return false;
  }

  if (
    event.sport_type &&
    event.sport_type !== sport
  ) {
    return false;
  }

  if (event.event_status !== 'notstarted') {
    return false;
  }

  if (
    /\b(test|dummy|sample)\b/i.test(
      event.event_name
    )
  ) {
    return false;
  }

  if (sport === 'formula1') {
    if (
      /atp tour|motogp/i.test(event.event_name)
    ) {
      return false;
    }

    return /grand prix/i.test(event.event_name);
  }

  return true;
}

function checkRunBudget(startedAt: number) {
  if (Date.now() - startedAt >= RUN_BUDGET_MS) {
    throw new Error(
      'Synchronisation time budget reached.'
    );
  }
}

async function fetchEventPage(
  sport: string,
  page: number
): Promise<SupplierEvent[]> {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const params = new URLSearchParams({
    sport_type: sport,
    date_stop: `ge:${today}`,
    sorting: 'date_start:asc',
    page_size: String(EVENT_PAGE_SIZE),
    page: String(page),
  });

  const response =
    await xs2eventGet<SupplierEventsResponse>(
      `/events?${params.toString()}`
    );

  if (!Array.isArray(response.events)) {
    throw new Error(
      'Unexpected XS2Event events response.'
    );
  }

  return response.events;
}

async function fetchTicketAvailability(
  eventId: string,
  startedAt: number
): Promise<Availability> {
  const uniqueTickets =
    new Map<string, SupplierTicket>();

  let complete = false;

  for (
    let page = 1;
    page <= MAX_TICKET_PAGES;
    page++
  ) {
    checkRunBudget(startedAt);

    const params = new URLSearchParams({
      event_id: eventId,
      ticket_status: 'available',
      stock: 'gt:0',
      page_size: String(TICKET_PAGE_SIZE),
      page: String(page),
    });

    const response =
      await xs2eventGet<SupplierTicketsResponse>(
        `/tickets?${params.toString()}`
      );

    if (!Array.isArray(response.tickets)) {
      throw new Error(
        'Unexpected XS2Event tickets response.'
      );
    }

    for (const ticket of response.tickets) {
      if (
        ticket.ticket_id &&
        SAFE_ID.test(ticket.ticket_id) &&
        ticket.ticket_status === 'available' &&
        Number.isInteger(ticket.stock) &&
        (ticket.stock ?? 0) > 0 &&
        (
          !ticket.event_id ||
          ticket.event_id === eventId
        )
      ) {
        uniqueTickets.set(
          ticket.ticket_id,
          ticket
        );
      }
    }

    if (
      response.tickets.length < TICKET_PAGE_SIZE
    ) {
      complete = true;
      break;
    }
  }

  if (!complete) {
    throw new Error(
      `Ticket pagination limit reached for ${eventId}.`
    );
  }

  return {
    hasAvailableTickets: uniqueTickets.size > 0,
    availableCategories: uniqueTickets.size,
  };
}

async function processEvent(
  event: SupplierEvent,
  sport: string,
  startedAt: number
): Promise<EventResult> {
  if (
    !isValidEvent(event, sport) ||
    !event.event_id ||
    !event.event_name
  ) {
    return {
      record: null,
      skipped: true,
      availabilityFailed: false,
      failedEventId: null,
    };
  }

  let availability: Availability | null = null;
  let availabilityFailed = false;

  try {
    availability =
      await fetchTicketAvailability(
        event.event_id,
        startedAt
      );
  } catch (error) {
    availabilityFailed = true;

    console.error(
      '[XS2Event sync] Availability check failed:',
      event.event_id,
      error instanceof Error
        ? error.message
        : 'Unknown error'
    );
  }

  const checkedAt = new Date().toISOString();

  const record: EventRecord = {
    source_environment: SOURCE_ENVIRONMENT,
    supplier_event_id: event.event_id,
    sport_type: sport,
    event_name: event.event_name,
    tournament_name:
      event.tournament_name ?? null,
    venue_name:
      event.venue_name ?? null,
    city:
      event.city ?? null,
    iso_country:
      event.iso_country ?? null,
    date_start:
      parseSupplierDate(event.date_start),
    date_stop:
      parseSupplierDate(event.date_stop),
    event_status:
      event.event_status ?? null,
    event_checked_at: checkedAt,
    updated_at: checkedAt,
    ...(availability
      ? {
          has_available_tickets:
            availability.hasAvailableTickets,
          available_categories:
            availability.availableCategories,
          availability_checked_at:
            checkedAt,
        }
      : {}),
  };

  return {
    record,
    skipped: false,
    availabilityFailed,
    failedEventId: availabilityFailed
      ? event.event_id
      : null,
  };
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.XS2EVENT_SYNC_ENABLED !== 'true'
  ) {
    return json(
      { error: 'Synchronisation is not enabled.' },
      404
    );
  }

  if (!isAuthorised(request)) {
    return json(
      { error: 'Unauthorised.' },
      401
    );
  }

  const searchParams =
    request.nextUrl.searchParams;

  const sport =
    searchParams.get('sport') || 'formula1';

  const page = parseInteger(
    searchParams.get('page'),
    1,
    1,
    MAX_EVENT_PAGES
  );

  const offset = parseInteger(
    searchParams.get('offset'),
    0,
    0,
    EVENT_PAGE_SIZE - 1
  );

  if (
    !SAFE_SPORT.test(sport) ||
    page === null ||
    offset === null
  ) {
    return json(
      { error: 'Invalid synchronisation parameters.' },
      400
    );
  }

  try {
    const supplierEvents =
      await fetchEventPage(sport, page);

    const supabase = getSupabaseAdmin();

    let savedEvents = 0;
    let skippedEvents = 0;
    let availabilityFailures = 0;
    let processedEvents = 0;
    let databaseWrites = 0;

    const failedAvailabilityEventIds: string[] = [];

    const recordsWithAvailability =
      new Map<string, EventRecord>();

    const recordsWithoutAvailability =
      new Map<string, EventRecord>();

    let currentOffset = offset;

    const batchEnd = Math.min(
      supplierEvents.length,
      offset + BATCH_SIZE
    );

    while (currentOffset < batchEnd) {
      checkRunBudget(startedAt);

      if (
        processedEvents > 0 &&
        Date.now() - startedAt >= GROUP_START_LIMIT_MS
      ) {
        break;
      }

      const groupEnd = Math.min(
        currentOffset + AVAILABILITY_CONCURRENCY,
        batchEnd
      );

      const group = supplierEvents.slice(
        currentOffset,
        groupEnd
      );

      const results = await Promise.all(
        group.map((event) =>
          processEvent(
            event,
            sport,
            startedAt
          )
        )
      );

      for (const result of results) {
        processedEvents++;

        if (result.skipped) {
          skippedEvents++;
          continue;
        }

        if (result.availabilityFailed) {
          availabilityFailures++;

          if (result.failedEventId) {
            failedAvailabilityEventIds.push(
              result.failedEventId
            );
          }
        }

        if (!result.record) {
          continue;
        }

        const eventId =
          result.record.supplier_event_id;

        if (result.availabilityFailed) {
          if (!recordsWithAvailability.has(eventId)) {
            recordsWithoutAvailability.set(
              eventId,
              result.record
            );
          }
        } else {
          recordsWithoutAvailability.delete(eventId);

          recordsWithAvailability.set(
            eventId,
            result.record
          );
        }

        savedEvents++;
      }

      currentOffset = groupEnd;

      if (availabilityFailures > 0) {
        break;
      }
    }

    checkRunBudget(startedAt);

    if (recordsWithAvailability.size > 0) {
      const { error } = await supabase
        .from('xs2event_events')
        .upsert(
          Array.from(
            recordsWithAvailability.values()
          ),
          {
            onConflict:
              'source_environment,supplier_event_id',
            defaultToNull: false,
          }
        );

      if (error) {
        throw new Error(
          `Supabase synchronisation failed: ${error.message}`
        );
      }

      databaseWrites++;
    }

    if (recordsWithoutAvailability.size > 0) {
      const { error } = await supabase
        .from('xs2event_events')
        .upsert(
          Array.from(
            recordsWithoutAvailability.values()
          ),
          {
            onConflict:
              'source_environment,supplier_event_id',
            defaultToNull: false,
          }
        );

      if (error) {
        throw new Error(
          `Supabase event metadata update failed: ${error.message}`
        );
      }

      databaseWrites++;
    }

    let nextCursor: {
      sport: string;
      page: number;
      offset: number;
    } | null = null;

    let paginationLimitReached = false;

    if (currentOffset < supplierEvents.length) {
      nextCursor = {
        sport,
        page,
        offset: currentOffset,
      };
    } else if (
      supplierEvents.length >= EVENT_PAGE_SIZE
    ) {
      if (page < MAX_EVENT_PAGES) {
        nextCursor = {
          sport,
          page: page + 1,
          offset: 0,
        };
      } else {
        paginationLimitReached = true;
      }
    }

    return json({
      testMode: true,
      supplierEnvironment: SOURCE_ENVIRONMENT,
      sport,
      page,
      offset,
      batchSize: BATCH_SIZE,
      availabilityConcurrency:
        AVAILABILITY_CONCURRENCY,
      databaseWrites,
      eventsOnSupplierPage:
        supplierEvents.length,
      eventsProcessed: processedEvents,
      eventsSaved: savedEvents,
      eventsSkipped: skippedEvents,
      availabilityFailures,
      failedAvailabilityEventIds,
      nextCursor,
      paginationLimitReached,
      complete:
        nextCursor === null &&
        !paginationLimitReached &&
        availabilityFailures === 0,
      durationMs: Date.now() - startedAt,
      completedAt: new Date().toISOString(),
      supplierReservationsCreated: false,
      supplierOrdersCreated: false,
    });
  } catch (error) {
    console.error(
      '[XS2Event sync] Failed:',
      error instanceof Error
        ? error.message
        : 'Unknown error'
    );

    return json(
      {
        error:
          'XS2Event test synchronisation failed.',
      },
      503
    );
  }
}
