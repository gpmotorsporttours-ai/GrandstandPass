
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { preflightXS2EventTicket } from '../../../../lib/xs2eventPreflight';
import { calculateSupplierTicketPrice } from '../../../../lib/supplierPricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 12000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TestItem = {
  eventId: string;
  supplierTicketId: string;
  quantity: number;
  testOnly: true;
  priceVerified: true;
  availabilityVerified: true;

  // Supplier pricing snapshot.
  supplierCurrency: 'EUR';
  supplierNetRateMinor: number;
  supplierTotalNetMinor: number;

  // Indicative customer pricing snapshot.
  indicativeUnitAmountMinor: number;
  indicativeTotalAmountMinor: number;
  indicativeCurrency: 'EUR';

  // Verification metadata.
  priceVerifiedAt: string;
  customerPriceConfirmed: false;
  finalPriceGuaranteed: false;
};

function fail(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

function validText(
  value: unknown,
  max: number
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= max
  );
}

export async function POST(request: NextRequest) {
  // Preview only. Never enabled in production.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return fail('Test checkout is disabled.', 404);
  }

  // Deployment Protection must remain enabled.
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

  let data: Record<string, unknown>;

  try {
    const raw = await request.text();

    if (
      Buffer.byteLength(raw, 'utf8') >
      MAX_BODY_BYTES
    ) {
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
    typeof data.requestId !== 'string' ||
    !UUID_PATTERN.test(data.requestId)
  ) {
    return fail('Invalid request ID.', 400);
  }

  const customer = data.customer;

  if (
    !customer ||
    typeof customer !== 'object' ||
    Array.isArray(customer)
  ) {
    return fail('Invalid customer.', 400);
  }

  const c = customer as Record<string, unknown>;

  if (
    !validText(c.firstName, 100) ||
    !validText(c.lastName, 100) ||
    !validText(c.email, 254) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) ||
    !validText(c.phone, 40) ||
    !validText(c.country, 100)
  ) {
    return fail('Invalid customer details.', 400);
  }

  // For this stage, verify one supplier
  // ticket selection at a time.
  if (
    !Array.isArray(data.items) ||
    data.items.length !== 1
  ) {
    return fail(
      'Test checkout currently supports exactly one ticket selection.',
      400
    );
  }

  const rawItem: unknown = data.items[0];

  if (
    !rawItem ||
    typeof rawItem !== 'object' ||
    Array.isArray(rawItem)
  ) {
    return fail('Invalid ticket.', 400);
  }

  const item = rawItem as Record<string, unknown>;

  if (
    typeof item.eventId !== 'string' ||
    !SAFE_ID.test(item.eventId) ||
    typeof item.supplierTicketId !== 'string' ||
    !SAFE_ID.test(item.supplierTicketId) ||
    item.supplier !== 'XS2Event' ||
    item.supplierEnvironment !== 'test' ||
    !Number.isSafeInteger(item.quantity) ||
    (item.quantity as number) < 1 ||
    (item.quantity as number) > 10
  ) {
    return fail('Invalid XS2Event test ticket.', 400);
  }

  const eventId = item.eventId;
  const ticketId = item.supplierTicketId;
  const quantity = item.quantity as number;

  let verifiedItem: TestItem;

  try {
    // Fresh read-only supplier verification.
    const preflight = await preflightXS2EventTicket({
      eventId,
      ticketId,
      quantity,
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
        'Ticket availability or supplier price could not be verified.',
        422
      );
    }

    const supplierNetRateMinor =
      preflight.supplierNetRateMinor as number;

    const supplierTotalNetMinor =
      supplierNetRateMinor * quantity;

    if (
      !Number.isSafeInteger(
        supplierTotalNetMinor
      )
    ) {
      return fail(
        'Invalid supplier total.',
        422
      );
    }

    // Apply existing Grandstand Pass pricing:
    // EUR 5 handling per ticket, then 15% markup.
    const pricing = calculateSupplierTicketPrice({
      netRateMinor: supplierNetRateMinor,
      supplierCurrency: 'EUR',
    });

    if (!pricing) {
      return fail(
        'Unable to calculate indicative pricing.',
        422
      );
    }

    const indicativeUnitAmountMinor =
      Math.round(
        pricing.indicativeSellingPrice * 100
      );

    const indicativeTotalAmountMinor =
      indicativeUnitAmountMinor * quantity;

    if (
      !Number.isSafeInteger(
        indicativeUnitAmountMinor
      ) ||
      indicativeUnitAmountMinor <= 0 ||
      !Number.isSafeInteger(
        indicativeTotalAmountMinor
      ) ||
      indicativeTotalAmountMinor <= 0
    ) {
      return fail(
        'Invalid calculated ticket price.',
        422
      );
    }

    // Store the supplier-verified price snapshot.
    // This is NOT an accepted final customer quote.
    verifiedItem = {
      eventId,
      supplierTicketId: ticketId,
      quantity,
      testOnly: true,

      priceVerified: true,
      availabilityVerified: true,

      supplierCurrency: 'EUR',
      supplierNetRateMinor,
      supplierTotalNetMinor,

      indicativeUnitAmountMinor,
      indicativeTotalAmountMinor,
      indicativeCurrency: 'EUR',

      priceVerifiedAt: preflight.checkedAt,

      customerPriceConfirmed: false,
      finalPriceGuaranteed: false,
    };
  } catch (error) {
    console.error(
      'Test checkout supplier verification error:',
      error instanceof Error
        ? error.name
        : 'Unknown'
    );

    return fail(
      'Supplier verification is temporarily unavailable.',
      502
    );
  }

  const orderReference =
    `GP-TEST-${data.requestId
      .replace(/-/g, '')
      .slice(0, 12)
      .toUpperCase()}`;

  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('orders')
      .insert({
        test_request_id: data.requestId,
        order_reference: orderReference,

        customer_first_name: c.firstName.trim(),
        customer_last_name: c.lastName.trim(),
        customer_email: c.email
          .trim()
          .toLowerCase(),
        customer_phone: c.phone.trim(),
        customer_country: c.country.trim(),

        // Keep the simulated payable amount at zero.
        // The indicative selling price is stored
        // separately inside the order's items JSON.
        currency: 'EUR',
        total_amount_minor: 0,

        order_status: 'test_draft',
        payment_provider: 'simulation',

        items: [verifiedItem],
      });

    if (error) {
      if (error.code === '23505') {
        return fail(
          'This test request has already been submitted.',
          409
        );
      }

      console.error(
        'Test checkout database error:',
        error.code
      );

      return fail(
        'Unable to save test order.',
        500
      );
    }

    return NextResponse.json(
      {
        ok: true,
        orderReference,
        status: 'test_draft',

        supplierVerified: true,
        priceVerified: true,
        availabilityVerified: true,

        // Customer-facing indicative pricing only.
        indicativeCurrency: 'EUR',
        indicativeUnitAmountMinor:
          verifiedItem.indicativeUnitAmountMinor,
        indicativeTotalAmountMinor:
          verifiedItem.indicativeTotalAmountMinor,

        priceVerifiedAt:
          verifiedItem.priceVerifiedAt,

        customerPriceConfirmed: false,
        finalPriceGuaranteed: false,
        paymentCreated: false,
        reservationCreated: false,

        message:
          'Test draft saved with verified indicative pricing. ' +
          'No payment or XS2Event reservation was created.',
      },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      'Test checkout error:',
      error instanceof Error
        ? error.name
        : 'Unknown'
    );

    return fail(
      'Unable to save test order.',
      500
    );
  }
}
