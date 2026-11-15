
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getPaymentGatewayConfig } from
  '../../../../lib/paymentGatewayConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const config = getPaymentGatewayConfig();

  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true' ||
    config.mode !== 'test' ||
    config.provider !== 'simulation'
  ) {
    return fail('Test workflow is disabled.', 404);
  }

  const expectedSecret =
    process.env.TEST_ORDER_ACCESS_SECRET;

  const providedSecret =
    request.headers.get('x-test-order-secret');

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

  return NextResponse.json(
    {
      ok: true,
      mode: 'test',
      provider: 'simulation',
      workflowReady: true,
      paymentProcessed: false,
      supplierBookingCreated: false,
      message:
        'Test workflow entry point is ready. ' +
        'No payment or supplier processing was performed.',
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
