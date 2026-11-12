
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { preflightXS2EventTicket } from '../../../../../lib/xs2eventPreflight';
import { xs2eventGet } from '../../../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;

type TicketDetail = {
  ticket_id?: string;
  event_id?: string | null;
  ticket_status?: string;
  stock?: number | null;
  min_order?: number | null;
  net_rate?: number | null;
  currency_code?: string;
  options?: {
    pairs_only?: boolean;
  } | null;
};

function secretMatches(
  provided: string | null,
  expected: string
): boolean {
  if (!provided || !expected) {
    return false;
  }

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

function respond(
  data: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Internal, secret-protected XS2Event TEST diagnostic.
 *
 * Supported modes:
 *
 * 1. preflight (default)
 *    Existing supplier inventory verification.
 *
 * 2. compare_ticket_detail
 *    Compares the preflight result with the
 *    individual supplier ticket-detail response.
 *
 * This endpoint is read-only.
 * It never creates reservations or bookings.
 */
export async function POST(request: NextRequest) {
  // Restrict this diagnostic to Preview.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.XS2EVENT_PREFLIGHT_ENABLED !== 'true'
  ) {
    return respond(
      { error: 'Preflight is disabled.' },
      404
    );
  }

  // Authenticate the internal request.
  const secret = process.env.XS2EVENT_PREFLIGHT_SECRET;

  if (
    !secret ||
    secret.length < 32 ||
    !secretMatches(
      request.headers.get('x-preflight-secret'),
      secret
    )
  ) {
    return respond(
      { error: 'Unauthorized.' },
      401
    );
  }

  // Accept JSON requests only.
  const contentType =
    request.headers.get('content-type') ?? '';

  if (
    !contentType.toLowerCase().startsWith(
      'application/json'
    )
  ) {
    return respond(
      { error: 'JSON content required.' },
      415
    );
  }

  let body: unknown;

  try {
    const raw = await request.text();

    if (
      Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES
    ) {
      return respond(
        { error: 'Request too large.' },
        413
      );
    }

    body = JSON.parse(raw);
  } catch {
    return respond(
      { error: 'Invalid JSON.' },
      400
    );
  }

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return respond(
      { error: 'Invalid request.' },
      400
    );
  }

  const input = body as Record<string, unknown>;

  if (
    typeof input.eventId !== 'string' ||
    !SAFE_ID.test(input.eventId) ||
    typeof input.ticketId !== 'string' ||
    !SAFE_ID.test(input.ticketId) ||
    typeof input.quantity !== 'number' ||
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 10
  ) {
    return respond(
      {
        error:
          'Valid eventId, ticketId and quantity are required.',
      },
      400
    );
  }

  const mode = input.mode ?? 'preflight';

  if (
    mode !== 'preflight' &&
    mode !== 'compare_ticket_detail'
  ) {
    return respond(
      { error: 'Invalid verification mode.' },
      400
    );
  }

  try {
    // Run our existing XS2Event preflight.
    const preflight = await preflightXS2EventTicket({
      eventId: input.eventId,
      ticketId: input.ticketId,
      quantity: input.quantity,
    });

    // Preserve the existing endpoint behaviour.
    if (mode === 'preflight') {
      return respond(
        { ...preflight },
        preflight.ok ? 200 : 422
      );
    }

    // Do not proceed if preflight fails.
    if (!preflight.ok) {
      return respond(
        {
          ok: false,
          mode: 'compare_ticket_detail',
          code: preflight.code,
          message: preflight.message,
          preflightPassed: false,
          detailVerified: false,
        },
        422
      );
    }

    // Retrieve the individual ticket directly
    // from the XS2Event TEST API.
    const detail = await xs2eventGet<TicketDetail>(
      `/tickets/${encodeURIComponent(input.ticketId)}`
    );

    // Verify the returned response is an object.
    if (
      !detail ||
      typeof detail !== 'object' ||
      Array.isArray(detail)
    ) {
      return respond(
        {
          ok: false,
          code: 'INVALID_TICKET_DETAIL',
          message: 'Supplier ticket detail is invalid.',
        },
        422
      );
    }

    // Validate the exact supplier net rate.
    const detailNetRateValid =
      typeof detail.net_rate === 'number' &&
      Number.isSafeInteger(detail.net_rate) &&
      detail.net_rate > 0;

    // Validate stock and minimum order.
    const detailStockValid =
      typeof detail.stock === 'number' &&
      Number.isSafeInteger(detail.stock) &&
      detail.stock >= input.quantity;

    const minimumOrder = detail.min_order ?? 1;

    const minimumOrderValid =
      Number.isSafeInteger(minimumOrder) &&
      minimumOrder >= 1 &&
      input.quantity >= minimumOrder;

    const pairsOnly =
      detail.options?.pairs_only === true;

    const pairsValid =
      !pairsOnly || input.quantity % 2 === 0;

    // Compare the two independent supplier reads.
    // A missing event ID in the detail response
    // is not accepted for this stricter check.
    const checks = {
      ticketIdMatches:
        detail.ticket_id === input.ticketId,

      eventIdMatches:
        detail.event_id === input.eventId,

      ticketAvailable:
        detail.ticket_status === 'available',

      sufficientStock:
        detailStockValid,

      minimumOrderSatisfied:
        minimumOrderValid,

      pairsRequirementSatisfied:
        pairsValid,

      currencyMatches:
        detail.currency_code ===
          preflight.supplierCurrency &&
        ['EUR', 'GBP'].includes(
          detail.currency_code ?? ''
        ),

      netRateMatches:
        detailNetRateValid &&
        preflight.supplierNetRateValid === true &&
        detail.net_rate ===
          preflight.supplierNetRateMinor,
    };

    const allChecksPassed =
      Object.values(checks).every(
        (value) => value === true
      );

    return respond(
      {
        ok: allChecksPassed,
        mode: 'compare_ticket_detail',
        code: allChecksPassed
          ? 'TICKET_DETAIL_VERIFIED'
          : 'TICKET_DETAIL_MISMATCH',

        message: allChecksPassed
          ? 'Supplier ticket details match the preflight result. No reservation was created.'
          : 'Supplier ticket details did not pass all verification checks. No reservation was created.',

        checkedAt: new Date().toISOString(),

        ticketId: input.ticketId,
        eventId: input.eventId,
        requestedQuantity: input.quantity,

        preflightPassed: true,
        detailVerified: allChecksPassed,

        checks,

        supplierCurrency:
          detail.currency_code,

        supplierNetRateMinor:
          detailNetRateValid
            ? detail.net_rate
            : undefined,

        availableStock:
          detail.stock,

        minimumOrder,

        pairsOnly,

        reservationCreated: false,
      },
      allChecksPassed ? 200 : 422
    );
  } catch (error) {
    console.error(
      'XS2Event ticket verification failed:',
      error instanceof Error
        ? error.name
        : 'Unknown error'
    );

    return respond(
      {
        ok: false,
        error:
          'Supplier verification is temporarily unavailable.',
      },
      502
    );
  }
}
