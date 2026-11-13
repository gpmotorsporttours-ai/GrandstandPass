
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER_REFERENCE_PATTERN =
  /^GP-TEST-[A-F0-9]{12}$/;

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

function secretMatches(
  provided: string | null,
  expected: string
): boolean {
  if (!provided || !expected) return false;

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

export async function POST(request: NextRequest) {
  // Preview-only simulation.
  // This endpoint never contacts XS2Event.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return fail('Supplier simulation is disabled.', 404);
  }

  const secret = process.env.TEST_ORDER_ACCESS_SECRET;

  if (
    !secret ||
    secret.length < 32 ||
    !secretMatches(
      request.headers.get('x-test-order-secret'),
      secret
    )
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

  const { orderReference, outcome } =
    body as Record<string, unknown>;

  if (
    typeof orderReference !== 'string' ||
    !ORDER_REFERENCE_PATTERN.test(orderReference)
  ) {
    return fail('Invalid test order reference.', 400);
  }

  if (
    outcome !== 'success' &&
    outcome !== 'failure'
  ) {
    return fail(
      'Outcome must be success or failure.',
      400
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_reference', orderReference)
      .maybeSingle();

    if (error) {
      console.error(
        'Supplier simulation order read error:',
        error.code
      );

      return fail('Unable to read test order.', 500);
    }

    if (!data) {
      return fail('Test order not found.', 404);
    }

    const order = data as TestOrder;

    // Only previously claimed, zero-value
    // simulated-payment test orders qualify.
    if (
      order.order_status !== 'payment_confirmed' ||
      order.payment_provider !== 'simulation' ||
      order.total_amount_minor !== 0 ||
      !order.supplier_reservation_attempt_id
    ) {
      return fail(
        'Test order is not eligible for simulation.',
        409
      );
    }

    // Never simulate over a real supplier record.
    if (
      order.supplier_order_reference ||
      order.supplier_reservation_id
    ) {
      return fail(
        'Order already has supplier processing.',
        409
      );
    }

    // Construct a response only.
    // No database writes or supplier API calls.
    const simulated =
      outcome === 'success'
        ? {
            outcome: 'success',
            simulatedReservationId:
              `SIM-RES-${orderReference}`,
            simulatedStatus: 'reserved',
            customerMessage:
              'Test reservation accepted (simulation only).',
          }
        : {
            outcome: 'failure',
            simulatedReservationId: null,
            simulatedStatus: 'rejected',
            customerMessage:
              'Test reservation rejected (simulation only).',
          };

    return NextResponse.json(
      {
        ok: true,
        mode: 'supplier_response_simulation',
        orderReference,
        attemptId:
          order.supplier_reservation_attempt_id,
        ...simulated,
        databaseUpdated: false,
        supplierContacted: false,
        reservationCreated: false,
        bookingCreated: false,
        message:
          'Supplier response simulated successfully. ' +
          'No real reservation or booking was created.',
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error(
      'Supplier response simulation error:',
      error instanceof Error
        ? error.name
        : 'Unknown'
    );

    return fail(
      'Supplier response simulation unavailable.',
      500
    );
  }
}
