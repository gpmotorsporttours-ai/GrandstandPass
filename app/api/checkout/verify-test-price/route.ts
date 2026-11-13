
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { preflightXS2EventTicket } from
  '../../../../lib/xs2eventPreflight';

import { calculateSupplierTicketPrice } from
  '../../../../lib/supplierPricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;

function fail(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  // Test-only endpoint. Never enabled in production.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return fail('Test price verification is disabled.', 404);
  }

  // Requires the protected Preview deployment.
  // Do not disable Vercel Deployment Protection.
  if (
    request.headers.get('origin') !==
    request.nextUrl.origin
  ) {
    return fail('Invalid request origin.', 403);
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

    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
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

  const data = body as Record<string, unknown>;

  if (
    typeof data.eventId !== 'string' ||
    !SAFE_ID.test(data.eventId) ||
    typeof data.ticketId !== 'string' ||
    !SAFE_ID.test(data.ticketId) ||
    !Number.isSafeInteger(data.quantity) ||
    (data.quantity as number) < 1 ||
    (data.quantity as number) > 10
  ) {
    return fail('Invalid test ticket details.', 400);
  }

  try {
    // Read-only supplier availability and price check.
    const preflight = await preflightXS2EventTicket({
      eventId: data.eventId,
      ticketId: data.ticketId,
      quantity: data.quantity as number,
    });

    if (
      !preflight.ok ||
      preflight.supplierNetRateValid !== true ||
      preflight.supplierCurrency !== 'EUR' ||
      !Number.isSafeInteger(
        preflight.supplierNetRateMinor
      ) ||
      (preflight.supplierNetRateMinor ?? 0) <= 0
    ) {
      return fail(
        'Supplier price or availability could not be verified.',
        422
      );
    }

    const pricing = calculateSupplierTicketPrice({
      netRateMinor:
        preflight.supplierNetRateMinor as number,
      supplierCurrency: 'EUR',
    });

    if (!pricing) {
      return fail(
        'Unable to calculate indicative ticket price.',
        422
      );
    }

    const indicativeUnitAmountMinor = Math.round(
      pricing.indicativeSellingPrice * 100
    );

    const indicativeTotalAmountMinor =
      indicativeUnitAmountMinor *
      (data.quantity as number);

    if (
      !Number.isSafeInteger(indicativeUnitAmountMinor) ||
      indicativeUnitAmountMinor <= 0 ||
      !Number.isSafeInteger(indicativeTotalAmountMinor) ||
      indicativeTotalAmountMinor <= 0
    ) {
      return fail(
        'Calculated ticket price is invalid.',
        422
      );
    }

    return NextResponse.json(
      {
        ok: true,
        mode: 'read_only_test_price_verification',

        eventId: data.eventId,
        ticketId: data.ticketId,
        quantity: data.quantity,

        currency: 'EUR',
        indicativeUnitAmountMinor,
        indicativeTotalAmountMinor,

        checkedAt: preflight.checkedAt,

        supplierVerified: true,
        priceVerified: true,
        availabilityVerified: true,

        customerPriceConfirmed: false,
        finalPriceGuaranteed: false,

        paymentCreated: false,
        reservationCreated: false,

        message:
          'Indicative ticket price verified. ' +
          'No payment or supplier reservation was created.',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      'Test price verification error:',
      error instanceof Error
        ? error.name
        : 'Unknown'
    );

    return fail(
      'Supplier verification is temporarily unavailable.',
      502
    );
  }
}
