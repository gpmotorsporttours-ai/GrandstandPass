
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyCustomerOrderAccessToken } from '../../../../lib/customerOrderAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2000;
const ORDER_REFERENCE_PATTERN = /^GP-TEST-[A-F0-9]{12}$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function respond(
  body: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function denyAccess() {
  // Use the same message whether the order reference,
  // token, or expiry is incorrect.
  return respond(
    {
      ok: false,
      error: 'Booking access is invalid or has expired.',
    },
    403
  );
}

export async function POST(request: NextRequest) {
  // Never expose test orders in production.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return respond(
      { ok: false, error: 'Test booking access is disabled.' },
      404
    );
  }

  // Reject requests from other browser origins.
  const origin = request.headers.get('origin');

  if (origin !== request.nextUrl.origin) {
    return respond(
      { ok: false, error: 'Invalid request origin.' },
      403
    );
  }

  if (
    !(request.headers.get('content-type') ?? '')
      .toLowerCase()
      .startsWith('application/json')
  ) {
    return respond(
      { ok: false, error: 'JSON content required.' },
      415
    );
  }

  let data: Record<string, unknown>;

  try {
    const raw = await request.text();

    if (
      Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES
    ) {
      return respond(
        { ok: false, error: 'Request too large.' },
        413
      );
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return respond(
        { ok: false, error: 'Invalid request.' },
        400
      );
    }

    data = parsed as Record<string, unknown>;
  } catch {
    return respond(
      { ok: false, error: 'Invalid request.' },
      400
    );
  }

  const orderReference = data.orderReference;
  const accessToken = data.accessToken;

  if (
    typeof orderReference !== 'string' ||
    !ORDER_REFERENCE_PATTERN.test(orderReference) ||
    typeof accessToken !== 'string' ||
    !TOKEN_PATTERN.test(accessToken)
  ) {
    return denyAccess();
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: order, error } = await supabase
      .from('orders')
      .select(
        [
          'order_reference',
          'created_at',
          'order_status',
          'payment_status',
          'payment_provider',
          'supplier_reservation_status',
          'currency',
          'total_amount_minor',
          'items',
          'customer_access_token_hash',
          'customer_access_token_expires_at',
        ].join(',')
      )
      .eq('order_reference', orderReference)
      .eq('payment_provider', 'simulation')
      .eq('total_amount_minor', 0)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        'Customer booking lookup failed:',
        error.code
      );

      return respond(
        {
          ok: false,
          error: 'Booking lookup is temporarily unavailable.',
        },
        503
      );
    }

    if (!order) {
      return denyAccess();
    }

    const validToken = verifyCustomerOrderAccessToken(
      accessToken,
      order.customer_access_token_hash,
      order.customer_access_token_expires_at
    );

    if (!validToken) {
      return denyAccess();
    }

    // Only expose a restricted, read-only booking view.
    // Do not return customer contact details,
    // supplier ticket IDs, internal pricing or token hashes.
    const safeItems = Array.isArray(order.items)
      ? order.items.map((item: unknown) => {
          const value =
            item &&
            typeof item === 'object' &&
            !Array.isArray(item)
              ? (item as Record<string, unknown>)
              : {};

          return {
            quantity:
              typeof value.quantity === 'number' &&
              Number.isInteger(value.quantity) &&
              value.quantity > 0
                ? value.quantity
                : null,
            indicativeCurrency:
              value.indicativeCurrency === 'EUR'
                ? 'EUR'
                : null,
            indicativeTotalAmountMinor:
              typeof value.indicativeTotalAmountMinor ===
                'number' &&
              Number.isSafeInteger(
                value.indicativeTotalAmountMinor
              ) &&
              value.indicativeTotalAmountMinor > 0
                ? value.indicativeTotalAmountMinor
                : null,
          };
        })
      : [];

    return respond(
      {
        ok: true,
        booking: {
          orderReference: order.order_reference,
          createdAt: order.created_at,
          orderStatus: order.order_status,
          paymentStatus: order.payment_status,
          supplierReservationStatus:
            order.supplier_reservation_status,
          currency: order.currency,
          totalAmountMinor: order.total_amount_minor,
          items: safeItems,
          testOnly: true,
          realPaymentCollected: false,
          realSupplierBookingCreated: false,
        },
      },
      200
    );
  } catch {
    return respond(
      {
        ok: false,
        error: 'Booking lookup is temporarily unavailable.',
      },
      503
    );
  }
}
