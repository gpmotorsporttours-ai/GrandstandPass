
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { preflightXS2EventTicket } from
  '../../../../../lib/xs2eventPreflight';
import { calculateSupplierTicketPrice } from
  '../../../../../lib/supplierPricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;
const MAX_BODY_BYTES = 2000;

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
  if (!provided || expected.length < 32) {
    return false;
  }

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

export async function POST(request: NextRequest) {
  // Internal diagnostic only, never production.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.XS2EVENT_PREFLIGHT_ENABLED !== 'true'
  ) {
    return fail('Price verification is disabled.', 404);
  }

  const secret =
    process.env.XS2EVENT_PREFLIGHT_SECRET ?? '';

  if (
    !secretMatches(
      request.headers.get('x-preflight-secret'),
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

    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
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

  const data = body as Record<string, unknown>;
  const { eventId, ticketId, quantity } = data;

  if (
    typeof eventId !== 'string' ||
    !SAFE_ID.test(eventId) ||
    typeof ticketId !== 'string' ||
    !SAFE_ID.test(ticketId) ||
    !Number.isSafeInteger(quantity) ||
    (quantity as number) < 1 ||
    (quantity as number) > 10
  ) {
    return fail('Invalid ticket selection.', 400);
  }

  try {
    const preflight = await preflightXS2EventTicket({
      eventId,
      ticketId,
      quantity: quantity as number,
    });

    if (
      !preflight.ok ||
      preflight.supplierNetRateValid !== true ||
      !Number.isSafeInteger(
        preflight.supplierNetRateMinor
      ) ||
      !preflight.supplierCurrency
    ) {
      return fail(
        'Supplier price or availability could not be verified.',
        422
      );
    }

    // EUR only for this initial diagnostic.
    // GBP requires a verified server-side FX rate.
    if (preflight.supplierCurrency !== 'EUR') {
      return fail(
        'Currency conversion is not configured for this verification.',
        422
      );
    }

    const pricing = calculateSupplierTicketPrice({
      netRateMinor: preflight.supplierNetRateMinor!,
      supplierCurrency: preflight.supplierCurrency,
    });

    if (!pricing) {
      return fail('Unable to calculate price.', 422);
    }

    const unitAmountMinor = Math.round(
      pricing.indicativeSellingPrice * 100
    );

    const totalAmountMinor =
      unitAmountMinor * (quantity as number);

    if (
      !Number.isSafeInteger(unitAmountMinor) ||
      unitAmountMinor <= 0 ||
      !Number.isSafeInteger(totalAmountMinor)
    ) {
      return fail('Invalid calculated price.', 422);
    }

    return NextResponse.json(
      {
        ok: true,
        mode: 'read_only_price_verification',
        eventId,
        ticketId,
        quantity,
        checkedAt: preflight.checkedAt,
        currency: 'EUR',
        indicativeUnitAmountMinor: unitAmountMinor,
        indicativeTotalAmountMinor: totalAmountMinor,
        indicativeUnitPrice: (
          unitAmountMinor / 100
        ).toFixed(2),
        indicativeTotalPrice: (
          totalAmountMinor / 100
        ).toFixed(2),
        availableStock: preflight.availableStock,
        supplierVerified: true,
        customerPriceConfirmed: false,
        finalPriceGuaranteed: false,
        paymentCreated: false,
        reservationCreated: false,
        message:
          'Read-only price verification passed. ' +
          'No payment or reservation was created.',
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error(
      'Price verification error:',
      error instanceof Error ? error.name : 'Unknown'
    );

    return fail('Price verification unavailable.', 502);
  }
}
