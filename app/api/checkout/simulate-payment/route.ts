
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2000;
const ORDER_REFERENCE_PATTERN = /^GP-TEST-[A-F0-9]{12}$/;

function fail(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

export async function POST(request: NextRequest) {
  // Never enable payment simulation in Production.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return fail('Payment simulation is disabled.', 404);
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

  let data: Record<string, unknown>;

  try {
    const raw = await request.text();

    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return fail('Request too large.', 413);
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return fail('Invalid request.', 400);
    }

    data = parsed as Record<string, unknown>;
  } catch {
    return fail('Invalid JSON.', 400);
  }

  if (
    typeof data.orderReference !== 'string' ||
    !ORDER_REFERENCE_PATTERN.test(data.orderReference)
  ) {
    return fail('Invalid test order reference.', 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    // Only transition an existing test draft.
    // The conditional update prevents repeated confirmations.
    const paymentReference =
      `SIM-${data.orderReference.slice(8)}`;

    const { data: updated, error } = await supabase
      .from('orders')
      .update({
        order_status: 'payment_confirmed',
        payment_reference: paymentReference,
      })
      .eq('order_reference', data.orderReference)
      .eq('order_status', 'test_draft')
      .eq('payment_provider', 'simulation')
      .eq('total_amount_minor', 0)
      .is('supplier_order_reference', null)
      .select('order_reference, order_status, payment_reference')
      .maybeSingle();

    if (error) {
      console.error('Payment simulation database error:', error.code);
      return fail('Unable to simulate payment.', 500);
    }

    if (!updated) {
      return fail(
        'Eligible test draft not found or already processed.',
        409
      );
    }

    return NextResponse.json(
      {
        ok: true,
        orderReference: updated.order_reference,
        status: updated.order_status,
        paymentReference: updated.payment_reference,
        message:
          'Payment simulated only. No money collected, invoice issued, or XS2Event order placed.',
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Payment simulation error:', error);
    return fail('Unable to simulate payment.', 500);
  }
}
