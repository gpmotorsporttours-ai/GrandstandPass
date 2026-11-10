
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER_REFERENCE_PATTERN = /^GP-TEST-[A-F0-9]{12}$/;

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
  // Preview-only. Never allow this endpoint in production.
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

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
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

    const { data: order, error } = await supabase
      .from('orders')
      .select(
        'order_reference, order_status, payment_provider, ' +
        'total_amount_minor, supplier_order_reference, ' +
        'supplier_reservation_id, supplier_reservation_attempt_id'
      )
      .eq('order_reference', orderReference)
      .maybeSingle();

    if (error) {
      console.error('Reservation validation database error:', error.code);
      return fail('Unable to validate test order.', 500);
    }

    if (!order) {
      return fail('Test order not found.', 404);
    }

    if (
      order.order_status !== 'payment_confirmed' ||
      order.payment_provider !== 'simulation' ||
      order.total_amount_minor !== 0
    ) {
      return fail('Order is not eligible for test reservation.', 409);
    }

    if (
      order.supplier_order_reference ||
      order.supplier_reservation_id ||
      order.supplier_reservation_attempt_id
    ) {
      return fail('Order already has supplier processing recorded.', 409);
    }

    return NextResponse.json(
      {
        ok: true,
        orderReference,
        eligible: true,
        mode: 'validation_only',
        message:
          'Order passed initial eligibility checks. No reservation attempt was claimed and no XS2Event request was made.',
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Reservation validation error:', error);
    return fail('Unable to validate test order.', 500);
  }
}
