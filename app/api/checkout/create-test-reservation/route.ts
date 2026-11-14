
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { preflightXS2EventTicket } from '../../../../lib/xs2eventPreflight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER_REFERENCE_PATTERN = /^GP-TEST-[A-F0-9]{12}$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoredTicket = {
  eventId?: unknown;
  supplierTicketId?: unknown;
  quantity?: unknown;
  testOnly?: unknown;
};

type TestOrder = {
  order_reference: string;
  order_status: string;
  payment_provider: string;
  payment_risk_status: string | null;
  total_amount_minor: number;
  supplier_order_reference: string | null;
  supplier_reservation_id: string | null;
  supplier_reservation_status: string | null;
  supplier_reservation_attempt_id: string | null;
  items: unknown;
};

function fail(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

export async function POST(request: NextRequest) {
  // Preview-only testing.
  // Never enable this endpoint in Production.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return fail('Test reservation endpoint is disabled.', 404);
  }

  const expectedSecret = process.env.TEST_ORDER_ACCESS_SECRET;
  const providedSecret = request.headers.get('x-test-order-secret');

  if (
    !expectedSecret ||
    expectedSecret.length < 32 ||
    !providedSecret
  ) {
    return fail('Unauthorized.', 401);
  }

  const expected = Buffer.from(expectedSecret, 'utf8');
  const provided = Buffer.from(providedSecret, 'utf8');

  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return fail('Unauthorized.', 401);
  }

  if (
    !(request.headers.get('content-type') ?? '')
      .toLowerCase()
      .startsWith('application/json')
  ) {
    return fail('JSON content required.', 415);
  }

  let body: unknown;

  try {
    const raw = await request.text();

    if (Buffer.byteLength(raw, 'utf8') > 2000) {
      return fail('Request too large.', 413);
    }

    body = JSON.parse(raw);
  } catch {
    return fail('Invalid JSON.', 400);
  }

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return fail('Invalid request.', 400);
  }

  const { orderReference } = body as Record<string, unknown>;

  if (
    typeof orderReference !== 'string' ||
    !ORDER_REFERENCE_PATTERN.test(orderReference)
  ) {
    return fail('Invalid test order reference.', 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_reference', orderReference)
      .maybeSingle();

    if (error) {
      console.error('Test order read error:', error.code);
      return fail('Unable to validate test order.', 500);
    }

    if (!data) {
      return fail('Test order not found.', 404);
    }

    const order = data as TestOrder;

    // Require confirmed simulated payment.
    if (
      order.order_status !== 'payment_confirmed' ||
      order.payment_provider !== 'simulation' ||
      order.total_amount_minor !== 0
    ) {
      return fail(
        'Order is not eligible for test reservation.',
        409
      );
    }

    // PRIORITY 2:
    // Require explicit payment risk approval.
    //
    // NULL, manual_review and rejected decisions
    // must not proceed to supplier processing.
    if (order.payment_risk_status !== 'approved') {
      return fail(
        'Payment risk approval is required before supplier processing.',
        409
      );
    }

    // Reject any existing supplier processing.
    if (
      order.supplier_order_reference !== null ||
      order.supplier_reservation_id !== null ||
      order.supplier_reservation_status !== null ||
      order.supplier_reservation_attempt_id !== null
    ) {
      return fail(
        'Order already has supplier processing recorded.',
        409
      );
    }

    // Exactly one test ticket item is permitted.
    if (
      !Array.isArray(order.items) ||
      order.items.length !== 1
    ) {
      return fail(
        'Test order must contain exactly one ticket item.',
        422
      );
    }

    const ticket = order.items[0] as StoredTicket | null;

    if (
      !ticket ||
      typeof ticket !== 'object' ||
      Array.isArray(ticket) ||
      typeof ticket.eventId !== 'string' ||
      !SAFE_ID.test(ticket.eventId) ||
      typeof ticket.supplierTicketId !== 'string' ||
      !SAFE_ID.test(ticket.supplierTicketId) ||
      typeof ticket.quantity !== 'number' ||
      !Number.isSafeInteger(ticket.quantity) ||
      ticket.quantity < 1 ||
      ticket.quantity > 10 ||
      ticket.testOnly !== true
    ) {
      return fail(
        'Stored test ticket details are invalid.',
        422
      );
    }

    // Fresh, read-only XS2Event TEST inventory check.
    // No supplier reservation or booking is created.
    let verification;

    try {
      verification = await preflightXS2EventTicket({
        eventId: ticket.eventId,
        ticketId: ticket.supplierTicketId,
        quantity: ticket.quantity,
      });
    } catch (error) {
      console.error(
        'Supplier preflight error:',
        error instanceof Error ? error.name : 'Unknown'
      );

      return fail(
        'Supplier verification is temporarily unavailable.',
        502
      );
    }

    if (!verification.ok) {
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          claimed: false,
          code: verification.code,
          error: verification.message,
          message: 'No reservation attempt was claimed.',
        },
        {
          status: 422,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    // Atomically claim the test order.
    //
    // IMPORTANT:
    // The Supabase function must independently
    // require payment_risk_status = 'approved'.
    const { data: attemptId, error: claimError } =
      await supabase.rpc(
        'claim_test_reservation_attempt',
        {
          p_order_reference: orderReference,
        }
      );

    if (claimError) {
      console.error(
        'Reservation claim RPC error:',
        claimError.code
      );

      return fail('Unable to claim test reservation.', 500);
    }

    if (
      typeof attemptId !== 'string' ||
      !UUID_PATTERN.test(attemptId)
    ) {
      return fail(
        'Order is no longer eligible or has already been claimed.',
        409
      );
    }

    // Stop here. No actual supplier order is sent.
    return NextResponse.json(
      {
        ok: true,
        orderReference,
        paymentRiskApproved: true,
        verified: true,
        claimed: true,
        mode: 'verified_claim_only',
        attemptId,
        supplierCheck: {
          code: verification.code,
          checkedAt: verification.checkedAt,
          ticketId: verification.ticketId,
          eventId: verification.eventId,
          requestedQuantity: verification.requestedQuantity,
          availableStock: verification.availableStock,
          minimumOrder: verification.minimumOrder,
          pairsOnly: verification.pairsOnly,
          supplierCurrency: verification.supplierCurrency,
          supplierNetRateValid:
            verification.supplierNetRateValid,
        },
        supplierContactedForBooking: false,
        reservationCreated: false,
        bookingCreated: false,
        message:
          'Payment risk approved. Supplier verification passed ' +
          'and test order claimed. No XS2Event reservation created.',
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error(
      'Verified reservation claim error:',
      error instanceof Error ? error.name : 'Unknown'
    );

    return fail(
      'Unable to process test reservation verification.',
      500
    );
  }
}
