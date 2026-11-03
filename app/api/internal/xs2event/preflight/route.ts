
import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { preflightXS2EventTicket } from '../../../../../lib/xs2eventPreflight';
import { xs2eventGet } from '../../../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupplierTicket = {
  ticket_id?: string;
  event_id?: string;
};

type TicketList = {
  tickets?: SupplierTicket[];
  pagination?: {
    next_page?: string | null;
  };
};

const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;
const PAGE_SIZE = 50;
const MAX_PAGES = 5;

function secretMatches(
  provided: string | null,
  expected: string
): boolean {
  if (!provided || !expected) return false;

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  return a.length === b.length && timingSafeEqual(a, b);
}

function respond(data: unknown, status: number) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Secret-protected, read-only XS2Event TEST diagnostic.
 *
 * Default mode: existing ticket preflight.
 * Diagnostic mode: compare supplier ticket IDs.
 *
 * Does not create reservations or process payments.
 */
export async function POST(request: NextRequest) {
  if (process.env.XS2EVENT_PREFLIGHT_ENABLED !== 'true') {
    return respond({ error: 'Preflight is disabled.' }, 404);
  }

  const secret = process.env.XS2EVENT_PREFLIGHT_SECRET;

  if (
    !secret ||
    secret.length < 32 ||
    !secretMatches(
      request.headers.get('x-preflight-secret'),
      secret
    )
  ) {
    return respond({ error: 'Unauthorized.' }, 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return respond({ error: 'Invalid JSON.' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return respond({ error: 'Invalid request.' }, 400);
  }

  const input = body as Record<string, unknown>;

  if (
    typeof input.eventId !== 'string' ||
    typeof input.ticketId !== 'string' ||
    typeof input.quantity !== 'number'
  ) {
    return respond({
      error: 'eventId, ticketId and quantity are required.',
    }, 400);
  }

  if (
    !SAFE_ID.test(input.eventId) ||
    !SAFE_ID.test(input.ticketId)
  ) {
    return respond({ error: 'Invalid supplier IDs.' }, 400);
  }

  if (
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 10
  ) {
    return respond({ error: 'Invalid quantity.' }, 400);
  }

  if (input.mode === 'ticket-id-diagnostic') {
    try {
      const ticketIds: string[] = [];
      let pagesChecked = 0;
      let ticketsReturned = 0;
      let matchingTicketCount = 0;
      let matchingEventId: boolean | null = null;

      for (let page = 1; page <= MAX_PAGES; page++) {
        const params = new URLSearchParams({
          event_id: input.eventId,
          ticket_status: 'available',
          stock: 'gt:0',
          page_size: String(PAGE_SIZE),
          page: String(page),
        });

        const data = await xs2eventGet<TicketList>(
          `/tickets?${params.toString()}`
        );

        const tickets = Array.isArray(data.tickets)
          ? data.tickets
          : [];

        pagesChecked++;
        ticketsReturned += tickets.length;

        for (const ticket of tickets) {
          if (
            typeof ticket.ticket_id === 'string' &&
            SAFE_ID.test(ticket.ticket_id)
          ) {
            ticketIds.push(ticket.ticket_id);
          }

          if (ticket.ticket_id === input.ticketId) {
            matchingTicketCount++;

            if (ticket.event_id === input.eventId) {
              matchingEventId = true;
            } else if (
              ticket.event_id != null &&
              matchingEventId !== true
            ) {
              matchingEventId = false;
            }
          }
        }

        if (
          tickets.length < PAGE_SIZE ||
          !data.pagination?.next_page
        ) {
          break;
        }
      }

      return respond({
        mode: 'ticket-id-diagnostic',
        checkedAt: new Date().toISOString(),
        eventId: input.eventId,
        requestedTicketId: input.ticketId,
        pagesChecked,
        ticketsReturned,
        requestedTicketPresent: matchingTicketCount > 0,
        matchingTicketCount,
        matchingEventId,
        ticketIds,
        note:
          'Read-only XS2Event TEST diagnostic. No reservation or payment was made.',
      }, 200);
    } catch (error) {
      console.error(
        'XS2Event diagnostic failed',
        error instanceof Error ? error.name : 'Unknown error'
      );

      return respond({
        error: 'Supplier diagnostic unavailable.',
      }, 502);
    }
  }

  if (
    input.mode !== undefined &&
    input.mode !== 'preflight'
  ) {
    return respond({ error: 'Unsupported mode.' }, 400);
  }

  try {
    const result = await preflightXS2EventTicket({
      eventId: input.eventId,
      ticketId: input.ticketId,
      quantity: input.quantity,
    });

    return respond(result, result.ok ? 200 : 422);
  } catch (error) {
    console.error(
      'XS2Event preflight failed',
      error instanceof Error ? error.name : 'Unknown error'
    );

    return respond({
      error: 'Supplier verification unavailable.',
    }, 502);
  }
}
