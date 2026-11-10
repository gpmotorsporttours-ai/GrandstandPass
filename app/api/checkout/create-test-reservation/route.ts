
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER_REFERENCE_PATTERN = /^GP-TEST-[A-F0-9]{12}$/;

type TestOrder = {
  order_reference: string;
  order_status: string;
  payment_provider: string;
  total_amount_minor: number;
  supplier_order_reference: string | null;
  supplier_reservation_id: string | null;
  supplier_reservation_attempt_id: string | null;
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
  // Never enable this endpoint in production.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return fail('Test reservation endpoint is disabled.', 404);
  }

  // Require the private test-order secret.
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

  // Accept JSON requests only.
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

    // Read the order and check initial eligibility.
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_reference', orderReference)
      .maybeSingle();

    if (error) {
      console.error(
        'Reservation claim database read error:',
        error.code
      );

      return fail('Unable to validate test order.', 500);
    }

    if (!data) {
      return fail('Test order not found.', 404);
    }

    const order = data as TestOrder;

    // Only zero-value simulated-payment test orders qualify.
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

    // Reject orders with existing supplier processing.
    if (
      order.supplier_order_reference ||
      order.supplier_reservation_id ||
      order.supplier_reservation_attempt_id
    ) {
      return fail(
        'Order already has supplier processing recorded.',
        409
      );
    }

    // Atomically claim this order in Supabase.
    // The database function rechecks all eligibility
    // conditions within the UPDATE operation.
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

    // Null means another request claimed the order,
    // or the order became ineligible.
    if (
      typeof attemptId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        attemptId
      )
    ) {
      return fail(
        'Order is no longer eligible or has already been claimed.',
        409
      );
    }

    // No XS2Event API call is made.
    return NextResponse.json(
      {
        ok: true,
        orderReference,
        claimed: true,
        mode: 'claim_only',
        attemptId,
        message:
          'Test reservation attempt claimed successfully. ' +
          'No XS2Event reservation was created.',
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Reservation claim error:', error);

    return fail('Unable to claim test reservation.', 500);
  }
}
