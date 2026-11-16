
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER_REFERENCE_PATTERN =
  /^GP-TEST-[A-F0-9]{12}$/;

const MAX_BODY_BYTES = 2000;

type TestOrder = {
  order_reference: string;
  order_status: string;
  payment_provider: string;
  payment_status: string | null;
  payment_risk_status: string | null;
  total_amount_minor: number;
  supplier_order_reference: string | null;
  supplier_reservation_id: string | null;
  supplier_reservation_status: string | null;
  supplier_reservation_attempt_id: string | null;
};

function fail(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

function secretMatches(
  provided: string | null,
  expected: string
): boolean {
  if (!provided || expected.length < 32) {
    return false;
  }

  const actual = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return (
    actual.length === expectedBuffer.length &&
    timingSafeEqual(actual, expectedBuffer)
  );
}

function customerStatus(order: TestOrder): {
  code: string;
  message: string;
} {
  if (
    order.supplier_reservation_status ===
    'simulated_reserved'
  ) {
    return {
      code: 'supplier_simulated_success',
      message:
        'Supplier acceptance simulated successfully. ' +
        'No real reservation or booking was created.',
    };
  }

  if (
    order.supplier_reservation_status ===
    'simulated_rejected'
  ) {
    return {
      code: 'supplier_simulated_failure',
      message:
        'Supplier rejection simulated. ' +
        'No real reservation or booking was created.',
    };
  }

  if (order.payment_risk_status === 'rejected') {
    return {
      code: 'risk_rejected',
      message:
        'The simulated payment did not pass the risk assessment.',
    };
  }

  if (
    order.payment_risk_status === 'manual_review'
  ) {
    return {
      code: 'manual_review',
      message:
        'The test order requires manual review. ' +
        'No supplier booking is permitted.',
    };
  }

  if (
    order.supplier_reservation_attempt_id !== null
  ) {
    return {
      code: 'supplier_processing',
      message:
        'A supplier processing attempt has been recorded ' +
        'for testing. No real booking has been created.',
    };
  }

  if (
    order.order_status === 'payment_confirmed' &&
    order.payment_status === 'paid'
  ) {
    return {
      code: 'payment_simulated',
      message:
        'Simulated payment confirmed. ' +
        'No real money was collected.',
    };
  }

  if (order.order_status === 'test_draft') {
    return {
      code: 'test_draft',
      message:
        'Test order created. Awaiting simulated payment.',
    };
  }

  return {
    code: 'status_unavailable',
    message:
      'The test order status is not currently available.',
  };
}

export async function POST(request: NextRequest) {
  // Preview-only internal diagnostic endpoint.
  // Never enabled in Production.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return fail(
      'Test order status is disabled.',
      404
    );
  }

  const expectedSecret =
    process.env.TEST_ORDER_ACCESS_SECRET ?? '';

  if (
    !secretMatches(
      request.headers.get('x-test-order-secret'),
      expectedSecret
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

    if (
      Buffer.byteLength(raw, 'utf8') >
      MAX_BODY_BYTES
    ) {
      return fail('Request too large.', 413);
    }

    body = JSON.parse(raw);
  } catch {
    return fail('Invalid JSON request.', 400);
  }

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return fail('Invalid request.', 400);
  }

  const { orderReference } =
    body as Record<string, unknown>;

  if (
    typeof orderReference !== 'string' ||
    !ORDER_REFERENCE_PATTERN.test(orderReference)
  ) {
    return fail(
      'Invalid test order reference.',
      400
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    // Select only fields needed for status reporting.
    // Never retrieve customer personal information.
    const { data, error } = await supabase
      .from('orders')
      .select(
        [
          'order_reference',
          'order_status',
          'payment_provider',
          'payment_status',
          'payment_risk_status',
          'total_amount_minor',
          'supplier_order_reference',
          'supplier_reservation_id',
          'supplier_reservation_status',
          'supplier_reservation_attempt_id',
        ].join(',')
      )
      .eq('order_reference', orderReference)
      .maybeSingle();

    if (error) {
      console.error(
        'Test order status lookup failed:',
        error.code
      );

      return fail(
        'Unable to retrieve test order status.',
        500
      );
    }

    if (!data) {
      return fail('Test order not found.', 404);
    }

    const order = data as unknown as TestOrder;

    // This endpoint must never expose live orders.
    if (
      order.payment_provider !== 'simulation' ||
      order.total_amount_minor !== 0 ||
      !ORDER_REFERENCE_PATTERN.test(
        order.order_reference
      )
    ) {
      return fail('Test order not found.', 404);
    }

    const status = customerStatus(order);

    return NextResponse.json(
      {
        ok: true,
        mode: 'test_order_status',
        testOnly: true,
        orderReference: order.order_reference,
        status: status.code,
        message: status.message,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        paymentRiskStatus:
          order.payment_risk_status,
        supplierReservationStatus:
          order.supplier_reservation_status,
        realPaymentCollected: false,
        realSupplierBookingCreated: false,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      'Test order status error:',
      error instanceof Error
        ? error.name
        : 'Unknown'
    );

    return fail(
      'Test order status is temporarily unavailable.',
      500
    );
  }
}
