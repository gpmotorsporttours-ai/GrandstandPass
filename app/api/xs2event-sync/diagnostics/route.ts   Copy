import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

import {
  xs2eventGet,
  XS2EventAPIError,
} from '../../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PAGE_SIZE = 50;
const MAX_REQUESTS = 30;
const RUN_BUDGET_MS = 35000;

const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;

type SupplierEvent = {
  event_id?: string;
  event_name?: string;
  event_status?: string;
  sport_type?: string;
};

type SupplierTicket = {
  event_id?: string;
  ticket_id?: string;
  ticket_status?: string;
  stock?: number;
  net_rate?: number;
  currency_code?: string;
  updated?: string;
};

type Pagination = {
  total_size?: number;
  page_size?: number;
  page_number?: number;
  next_page?: string | null;
};

type EventsResponse = {
  events?: SupplierEvent[];
  pagination?: Pagination;
};

type TicketsResponse = {
  tickets?: SupplierTicket[];
  pagination?: Pagination;
};

type TicketSnapshot = {
  eventId: string;
  ticketId: string;
  stock: number | null;
  netRate: number | null;
  currency: string | null;
  status: string | null;
  updated: string | null;
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
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 32) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);

  const provided = Buffer.from(
    request.headers.get('authorization') ?? ''
  );

  return (
    expected.length === provided.length &&
    timingSafeEqual(expected, provided)
  );
}

function describeError(error: unknown) {
  if (error instanceof XS2EventAPIError) {
    return {
      type: error.name,
      status: error.status,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    const cause = (
      error as Error & {
        cause?: { code?: string };
      }
    ).cause;

    return {
      type: error.name,
      message: error.message,
      networkCode:
        typeof cause?.code === 'string'
          ? cause.code
          : null,
    };
  }

  return {
    type: 'UnknownError',
    message: 'Unknown diagnostic error.',
  };
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.XS2EVENT_SYNC_ENABLED !== 'true'
  ) {
    return json({ error: 'Not found.' }, 404);
  }

  if (!isAuthorised(request)) {
    return json({ error: 'Unauthorised.' }, 401);
  }

  const sport =
    request.nextUrl.searchParams.get('sport') ||
    'formula1';

  const allowedSports = [
    'formula1',
    'motogp',
    'soccer',
    'tennis',
    'basketball',
    'nba',
    'golf',
    'horseracing',
    'nfl',
    'rugby',
  ];

  if (!allowedSports.includes(sport)) {
    return json({ error: 'Invalid sport.' }, 400);
  }

  let supplierRequests = 0;

  async function supplierGet<T>(
    endpoint: string
  ): Promise<T> {
    if (supplierRequests >= MAX_REQUESTS) {
      throw new Error(
        'Diagnostic request limit reached.'
      );
    }

    if (Date.now() - startedAt >= RUN_BUDGET_MS) {
      throw new Error(
        'Diagnostic time budget reached.'
      );
    }

    supplierRequests++;

    return xs2eventGet<T>(endpoint, {
      environment: 'test',
    });
  }

  async function getTickets(
    filter: string,
    allowedEventIds: string[],
    fallbackEventId?: string
  ) {
    const started = Date.now();
    const tickets = new Map<string, TicketSnapshot>();

    const allowed = new Set(allowedEventIds);

    let pages = 0;
    let rawTickets = 0;
    let unexpectedEventIds = 0;
    let missingEventIds = 0;
    let invalidTicketIds = 0;
    let duplicateTickets = 0;
    let complete = false;
    let reportedTotal: number | null = null;

    for (let page = 1; page <= 10; page++) {
      const params = new URLSearchParams({
        event_id: filter,
        ticket_status: 'available',
        stock: 'gt:0',
        page_size: String(PAGE_SIZE),
        page: String(page),
      });

      const response =
        await supplierGet<TicketsResponse>(
          `/tickets?${params.toString()}`
        );

      if (!Array.isArray(response.tickets)) {
        throw new Error(
          'Unexpected tickets response.'
        );
      }

      pages++;
      rawTickets += response.tickets.length;

      if (
        typeof response.pagination?.total_size ===
        'number'
      ) {
        reportedTotal =
          response.pagination.total_size;
      }

      for (const ticket of response.tickets) {
        let eventId = ticket.event_id;

        if (!eventId) {
          missingEventIds++;
          eventId = fallbackEventId;
        }

        if (!eventId) {
          continue;
        }

        if (!allowed.has(eventId)) {
          unexpectedEventIds++;
          continue;
        }

        if (
          !ticket.ticket_id ||
          !SAFE_ID.test(ticket.ticket_id)
        ) {
          invalidTicketIds++;
          continue;
        }

        const key =
          `${eventId}:${ticket.ticket_id}`;

        if (tickets.has(key)) {
          duplicateTickets++;
        }

        tickets.set(key, {
          eventId,
          ticketId: ticket.ticket_id,
          stock:
            typeof ticket.stock === 'number'
              ? ticket.stock
              : null,
          netRate:
            typeof ticket.net_rate === 'number'
              ? ticket.net_rate
              : null,
          currency: ticket.currency_code ?? null,
          status: ticket.ticket_status ?? null,
          updated: ticket.updated ?? null,
        });
      }

      if (
        response.tickets.length === 0 ||
        (
          reportedTotal !== null &&
          rawTickets >= reportedTotal
        ) ||
        response.pagination?.next_page === '' ||
        response.pagination?.next_page === null
      ) {
        complete = true;
        break;
      }

      if (
        reportedTotal === null &&
        response.pagination?.next_page === undefined &&
        response.tickets.length < PAGE_SIZE
      ) {
        complete = true;
        break;
      }
    }

    return {
      tickets,
      pages,
      rawTickets,
      unexpectedEventIds,
      missingEventIds,
      invalidTicketIds,
      duplicateTickets,
      reportedTotal,
      complete,
      durationMs: Date.now() - started,
    };
  }

  try {
    const today = new Date()
      .toISOString()
      .slice(0, 10);

    const eventParams = new URLSearchParams({
      sport_type: sport,
      date_stop: `ge:${today}`,
      sorting: 'date_start:asc',
      page_size: '50',
      page: '1',
    });

    const eventResponse =
      await supplierGet<EventsResponse>(
        `/events?${eventParams.toString()}`
      );

    if (!Array.isArray(eventResponse.events)) {
      throw new Error(
        'Unexpected events response.'
      );
    }

    const selectedEvents: {
      eventId: string;
      eventName: string;
    }[] = [];

    const seen = new Set<string>();

    for (const event of eventResponse.events) {
      if (
        !event.event_id ||
        !SAFE_ID.test(event.event_id) ||
        !event.event_name ||
        event.event_status !== 'notstarted' ||
        seen.has(event.event_id) ||
        /\b(test|dummy|sample)\b/i.test(
          event.event_name
        ) ||
        (
          event.sport_type &&
          event.sport_type !== sport
        )
      ) {
        continue;
      }

      if (
        sport === 'formula1' &&
        (
          !/grand prix/i.test(event.event_name) ||
          /atp tour|motogp/i.test(event.event_name)
        )
      ) {
        continue;
      }

      seen.add(event.event_id);

      selectedEvents.push({
        eventId: event.event_id,
        eventName: event.event_name,
      });

      if (selectedEvents.length === 5) {
        break;
      }
    }

    if (selectedEvents.length < 2) {
      throw new Error(
        'Not enough valid events for bulk comparison.'
      );
    }

    const individualTickets =
      new Map<string, TicketSnapshot>();

    const individualResults: {
      eventId: string;
      eventName: string;
      tickets: number;
      pages: number;
      complete: boolean;
      unexpectedEventIds: number;
      missingEventIds: number;
      invalidTicketIds: number;
      duplicateTickets: number;
      durationMs: number;
    }[] = [];

    const individualStarted = Date.now();
    const requestsBeforeIndividual =
      supplierRequests;

    for (const event of selectedEvents) {
      const result = await getTickets(
        event.eventId,
        [event.eventId],
        event.eventId
      );

      for (const [key, ticket] of result.tickets) {
        individualTickets.set(key, ticket);
      }

      individualResults.push({
        eventId: event.eventId,
        eventName: event.eventName,
        tickets: result.tickets.size,
        pages: result.pages,
        complete: result.complete,
        unexpectedEventIds:
          result.unexpectedEventIds,
        missingEventIds:
          result.missingEventIds,
        invalidTicketIds:
          result.invalidTicketIds,
        duplicateTickets:
          result.duplicateTickets,
        durationMs: result.durationMs,
      });
    }

    const individualDurationMs =
      Date.now() - individualStarted;

    const individualRequestCount =
      supplierRequests - requestsBeforeIndividual;

    const eventIds = selectedEvents.map(
      (event) => event.eventId
    );

    const requestsBeforeBulk = supplierRequests;

    const bulk = await getTickets(
      `in:[${eventIds.join(',')}]`,
      eventIds
    );

    const bulkRequestCount =
      supplierRequests - requestsBeforeBulk;

    let matchingTickets = 0;
    let missingFromBulk = 0;
    let extraInBulk = 0;
    let stockDifferences = 0;
    let priceDifferences = 0;
    let statusDifferences = 0;
    let invalidComparableFields = 0;

    const ticketsPerEvent = eventIds.map(
      (eventId) => ({
        eventId,
        eventName:
          selectedEvents.find(
            (event) =>
              event.eventId === eventId
          )?.eventName ?? '',
        individual: 0,
        bulk: 0,
      })
    );

    for (
      const [key, ticket] of individualTickets
    ) {
      const summary = ticketsPerEvent.find(
        (event) =>
          event.eventId === ticket.eventId
      );

      if (summary) {
        summary.individual++;
      }

      const bulkTicket = bulk.tickets.get(key);

      if (!bulkTicket) {
        missingFromBulk++;
        continue;
      }

      matchingTickets++;

      const comparable = [ticket, bulkTicket].every(
        (value) =>
          Number.isInteger(value.stock) &&
          (value.stock ?? 0) > 0 &&
          Number.isInteger(value.netRate) &&
          (value.netRate ?? 0) > 0 &&
          /^[A-Z]{3}$/.test(
            value.currency ?? ''
          ) &&
          value.status === 'available'
      );

      if (!comparable) {
        invalidComparableFields++;
      }

      if (ticket.stock !== bulkTicket.stock) {
        stockDifferences++;
      }

      if (
        ticket.netRate !== bulkTicket.netRate ||
        ticket.currency !== bulkTicket.currency
      ) {
        priceDifferences++;
      }

      if (ticket.status !== bulkTicket.status) {
        statusDifferences++;
      }
    }

    for (const [key, ticket] of bulk.tickets) {
      const summary = ticketsPerEvent.find(
        (event) =>
          event.eventId === ticket.eventId
      );

      if (summary) {
        summary.bulk++;
      }

      if (!individualTickets.has(key)) {
        extraInBulk++;
      }
    }

    const individualComplete =
      individualResults.every(
        (result) =>
          result.complete &&
          result.invalidTicketIds === 0 &&
          result.unexpectedEventIds === 0 &&
          result.duplicateTickets === 0
      );

    const eventsWithBulkTickets =
      ticketsPerEvent.filter(
        (event) => event.bulk > 0
      ).length;

    const bulkFilterVerified =
      individualComplete &&
      bulk.complete &&
      eventsWithBulkTickets >= 2 &&
      bulk.unexpectedEventIds === 0 &&
      bulk.missingEventIds === 0 &&
      bulk.invalidTicketIds === 0 &&
      bulk.duplicateTickets === 0 &&
      missingFromBulk === 0 &&
      extraInBulk === 0;

    const inventoryComparisonPassed =
      bulkFilterVerified &&
      stockDifferences === 0 &&
      priceDifferences === 0 &&
      statusDifferences === 0 &&
      invalidComparableFields === 0;

    return json({
      ok: true,
      testMode: true,
      supplierEnvironment: 'test',
      mode: 'read_only_bulk_diagnostic',
      sport,
      selectedEvents: selectedEvents.length,

      supplierEventTotal:
        eventResponse.pagination?.total_size ??
        null,

      individual: {
        requests: individualRequestCount,
        tickets: individualTickets.size,
        complete: individualComplete,
        durationMs: individualDurationMs,
        events: individualResults,
      },

      bulk: {
        filter: `in:[${eventIds.join(',')}]`,
        requests: bulkRequestCount,
        tickets: bulk.tickets.size,
        rawTickets: bulk.rawTickets,
        reportedTotal: bulk.reportedTotal,
        pages: bulk.pages,
        complete: bulk.complete,
        unexpectedEventIds:
          bulk.unexpectedEventIds,
        missingEventIds: bulk.missingEventIds,
        invalidTicketIds: bulk.invalidTicketIds,
        duplicateTickets: bulk.duplicateTickets,
        eventsWithTickets:
          eventsWithBulkTickets,
        durationMs: bulk.durationMs,
      },

      comparison: {
        matchingTickets,
        missingFromBulk,
        extraInBulk,
        stockDifferences,
        priceDifferences,
        statusDifferences,
        invalidComparableFields,
        bulkFilterVerified,
        inventoryComparisonPassed,
        ticketsPerEvent,
      },

      performance: {
        individualRequests:
          individualRequestCount,
        bulkRequests: bulkRequestCount,
        requestsSaved:
          individualRequestCount -
          bulkRequestCount,
        totalSupplierRequests:
          supplierRequests,
        totalDurationMs:
          Date.now() - startedAt,
      },

      databaseModified: false,
      supplierReservationsCreated: false,
      supplierOrdersCreated: false,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    const details = describeError(error);

    console.error(
      '[XS2Event bulk diagnostic]',
      details
    );

    return json({
      ok: false,
      testMode: true,
      supplierEnvironment: 'test',
      mode: 'read_only_bulk_diagnostic',
      error: details,
      supplierRequests,
      durationMs: Date.now() - startedAt,
      databaseModified: false,
      supplierReservationsCreated: false,
      supplierOrdersCreated: false,
    }, 503);
  }
}
