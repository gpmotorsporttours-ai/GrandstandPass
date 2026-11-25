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
const MAX_EVENT_PAGES = 1000;
const MAX_BULK_TICKET_PAGES = 30;

const BATCH_SIZE = 50;
const BULK_GROUP_SIZE = 10;

const RUN_BUDGET_MS = 30000;
const GROUP_START_LIMIT_MS = 12000;

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
  pagination?: {
    total_size?: number;
    page_size?: number;
    page_number?: number;
    next_page?: string | null;
  };
};

type Availability = {
  hasAvailableTickets: boolean;
  availableCategories: number;
};

type BulkAvailabilityResult = {
  availability: Map<string, Availability>;
  requests: number;
  tickets: number;
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

  if (
    !Array.isArray(response.events) ||
    response.events.length > EVENT_PAGE_SIZE
  ) {
    throw new Error(
      'Unexpected XS2Event events response.'
    );
  }

  return response.events;
}

async function fetchBulkTicketAvailability(
  eventIds: string[],
  startedAt: number
): Promise<BulkAvailabilityResult> {
  const uniqueEventIds = Array.from(
    new Set(eventIds)
  );

  const availability =
    new Map<string, Availability>();

  if (uniqueEventIds.length === 0) {
    return {
      availability,
      requests: 0,
      tickets: 0,
    };
  }

  if (
    uniqueEventIds.length > BULK_GROUP_SIZE ||
    uniqueEventIds.some(
      (eventId) => !SAFE_ID.test(eventId)
    )
  ) {
    throw new Error(
      'Invalid bulk availability event IDs.'
    );
  }

  const requestedEventIds =
    new Set(uniqueEventIds);

  const ticketsByEvent =
    new Map<string, Set<string>>();

  for (const eventId of uniqueEventIds) {
    ticketsByEvent.set(
      eventId,
      new Set<string>()
    );
  }

  let requests = 0;
  let complete = false;
  let rawTickets = 0;
  let expectedTotal: number | null = null;

  const seenTicketIds =
    new Map<string, string>();

  for (
    let page = 1;
    page <= MAX_BULK_TICKET_PAGES;
    page++
  ) {
    checkRunBudget(startedAt);

    const params = new URLSearchParams({
      event_id:
        uniqueEventIds.length === 1
          ? uniqueEventIds[0]
          : `in:[${uniqueEventIds.join(',')}]`,
      ticket_status: 'available',
      stock: 'gt:0',
      page_size: String(TICKET_PAGE_SIZE),
      page: String(page),
    });

    requests++;

    const response =
      await xs2eventGet<SupplierTicketsResponse>(
        `/tickets?${params.toString()}`
      );

    checkRunBudget(startedAt);

    if (
      !Array.isArray(response.tickets) ||
      response.tickets.length > TICKET_PAGE_SIZE
    ) {
      throw new Error(
        'Unexpected XS2Event bulk tickets response.'
      );
    }

    const pagination = response.pagination;

    if (
      pagination?.page_number !== undefined &&
      pagination.page_number !== page
    ) {
      throw new Error(
        'Unexpected bulk ticket page number.'
      );
    }

    if (pagination?.total_size !== undefined) {
      const total = pagination.total_size;

      if (
        !Number.isSafeInteger(total) ||
        total < 0
      ) {
        throw new Error(
          'Invalid bulk ticket pagination total.'
        );
      }

      if (
        expectedTotal !== null &&
        expectedTotal !== total
      ) {
        throw new Error(
          'Bulk ticket inventory changed during pagination.'
        );
      }

      expectedTotal = total;
    }

    rawTickets += response.tickets.length;

    for (const ticket of response.tickets) {
      const eventId = ticket.event_id;
      const ticketId = ticket.ticket_id;

      if (
        !eventId ||
        !requestedEventIds.has(eventId)
      ) {
        throw new Error(
          'Bulk response contains a missing or unexpected event ID.'
        );
      }

      if (
        !ticketId ||
        !SAFE_ID.test(ticketId)
      ) {
        throw new Error(
          'Bulk response contains an invalid ticket ID.'
        );
      }

      if (
        ticket.ticket_status !== 'available' ||
        !Number.isSafeInteger(ticket.stock) ||
        (ticket.stock ?? 0) <= 0
      ) {
        throw new Error(
          'Bulk response contains unexpected ticket availability.'
        );
      }

      if (seenTicketIds.has(ticketId)) {
        throw new Error(
          'Duplicate ticket detected during bulk pagination.'
        );
      }

      seenTicketIds.set(ticketId, eventId);

      ticketsByEvent.get(eventId)!.add(ticketId);
    }

    if (
      expectedTotal !== null &&
      rawTickets > expectedTotal
    ) {
      throw new Error(
        'Bulk ticket count exceeds reported total.'
      );
    }

    const hasNextPage =
      typeof pagination?.next_page === 'string' &&
      pagination.next_page.trim().length > 0;

    if (
      expectedTotal !== null &&
      rawTickets === expectedTotal
    ) {
      if (hasNextPage) {
        throw new Error(
          'Inconsistent bulk ticket pagination.'
        );
      }

      complete = true;
      break;
    }

    if (
      pagination?.next_page !== undefined &&
      !hasNextPage
    ) {
      if (
        expectedTotal !== null &&
        rawTickets !== expectedTotal
      ) {
        throw new Error(
          'Bulk ticket pagination ended prematurely.'
        );
      }

      complete = true;
      break;
    }

    if (
      response.tickets.length < TICKET_PAGE_SIZE &&
      !hasNextPage
    ) {
      if (
        expectedTotal !== null &&
        rawTickets !== expectedTotal
      ) {
        throw new Error(
          'Incomplete bulk ticket inventory.'
        );
      }

      complete = true;
      break;
    }

    if (response.tickets.length === 0) {
      throw new Error(
        'Unexpected empty bulk ticket page.'
      );
    }
  }

  if (!complete) {
    throw new Error(
      'Bulk ticket pagination limit reached.'
    );
  }

  for (const eventId of uniqueEventIds) {
    const count =
      ticketsByEvent.get(eventId)?.size ?? 0;

    availability.set(eventId, {
      hasAvailableTickets: count > 0,
      availableCategories: count,
    });
  }

  return {
    availability,
    requests,
    tickets: seenTicketIds.size,
  };
}

function buildEventRecord(
  event: SupplierEvent,
  sport: string,
  availability: Availability | null
): EventRecord {
  const checkedAt = new Date().toISOString();

  return {
    source_environment: SOURCE_ENVIRONMENT,
    supplier_event_id: event.event_id!,
    sport_type: sport,
    event_name: event.event_name!,
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
    ...(availability !== null
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

    let bulkGroupsAttempted = 0;
    let bulkGroupsCompleted = 0;
    let bulkTicketRequests = 0;
    let bulkTicketsRetrieved = 0;

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
        currentOffset + BULK_GROUP_SIZE,
        batchEnd
      );

      const group = supplierEvents.slice(
        currentOffset,
        groupEnd
      );

      const validEvents = group.filter(
        (event) => isValidEvent(event, sport)
      );

      processedEvents += group.length;

      skippedEvents +=
        group.length - validEvents.length;

      if (validEvents.length === 0) {
        currentOffset = groupEnd;
        continue;
      }

      const eventIds = validEvents.map(
        (event) => event.event_id!
      );

      bulkGroupsAttempted++;

      let result: BulkAvailabilityResult;

      try {
        result =
          await fetchBulkTicketAvailability(
            eventIds,
            startedAt
          );

        bulkGroupsCompleted++;
        bulkTicketRequests += result.requests;
        bulkTicketsRetrieved += result.tickets;
      } catch (error) {
        availabilityFailures += validEvents.length;

        failedAvailabilityEventIds.push(
          ...Array.from(new Set(eventIds))
        );

        console.error(
          '[XS2Event sync] Bulk availability failed:',
          sport,
          page,
          currentOffset,
          error instanceof Error
            ? error.message
            : 'Unknown error'
        );

        for (const event of validEvents) {
          const eventId = event.event_id!;

          if (
            !recordsWithAvailability.has(eventId)
          ) {
            recordsWithoutAvailability.set(
              eventId,
              buildEventRecord(
                event,
                sport,
                null
              )
            );
          }
        }

        // Do not advance beyond a failed group.
        // The controller will retry the original batch.
        break;
      }

      for (const event of validEvents) {
        const eventId = event.event_id!;

        const availability =
          result.availability.get(eventId);

        if (!availability) {
          throw new Error(
            'Missing bulk availability result.'
          );
        }

        recordsWithoutAvailability.delete(
          eventId
        );

        recordsWithAvailability.set(
          eventId,
          buildEventRecord(
            event,
            sport,
            availability
          )
        );
      }

      currentOffset = groupEnd;
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

      savedEvents +=
        recordsWithAvailability.size;

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

      savedEvents +=
        recordsWithoutAvailability.size;

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
      mode: 'bulk_inventory',
      sport,
      page,
      offset,
      batchSize: BATCH_SIZE,
      bulkGroupSize: BULK_GROUP_SIZE,
      bulkGroupsAttempted,
      bulkGroupsCompleted,
      bulkTicketRequests,
      bulkTicketsRetrieved,
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
        testMode: true,
        supplierEnvironment: SOURCE_ENVIRONMENT,
        error:
          'XS2Event test synchronisation failed.',
        supplierReservationsCreated: false,
        supplierOrdersCreated: false,
      },
      503
    );
  }
}
