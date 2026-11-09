
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 12000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  // Only available in Vercel's protected Preview environment.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return fail('Test checkout is disabled.', 404);
  }

  // Browser-origin protection. Vercel Deployment Protection
  // must also remain enabled for this Preview deployment.
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

  const validText = (value: unknown, max: number) =>
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= max;

  if (
    !validText(c.firstName, 100) ||
    !validText(c.lastName, 100) ||
    !validText(c.email, 254) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      String(c.email)
    ) ||
    !validText(c.phone, 40) ||
    !validText(c.country, 100)
  ) {
    return fail('Invalid customer details.', 400);
  }

  if (
    !Array.isArray(data.items) ||
    data.items.length < 1 ||
    data.items.length > 5
  ) {
    return fail('Invalid ticket selection.', 400);
  }

  const items = [];
  const seen = new Set<string>();

  for (const value of data.items) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return fail('Invalid ticket.', 400);
    }

    const item = value as Record<string, unknown>;

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

    const key =
      `${item.eventId}:${item.supplierTicketId}`;

    if (seen.has(key)) {
      return fail('Duplicate ticket selection.', 400);
    }

    seen.add(key);

    items.push({
      eventId: item.eventId,
      supplierTicketId: item.supplierTicketId,
      quantity: item.quantity,
      testOnly: true,
      priceVerified: false,
      availabilityVerified: false,
    });
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
        customer_first_name: String(c.firstName).trim(),
        customer_last_name: String(c.lastName).trim(),
        customer_email: String(c.email)
          .trim()
          .toLowerCase(),
        customer_phone: String(c.phone).trim(),
        customer_country: String(c.country).trim(),
        currency: 'EUR',
        total_amount_minor: 0,
        order_status: 'test_draft',
        payment_provider: 'simulation',
        items,
      });

    if (error) {
      if (error.code === '23505') {
        return fail(
          'This test request has already been submitted.',
          409
        );
      }

      console.error('Test checkout database error:', error.code);

      return fail('Unable to save test order.', 500);
    }

    return NextResponse.json(
      {
        ok: true,
        orderReference,
        status: 'test_draft',
        message:
          'Test draft saved. No payment or XS2Event order created.',
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Test checkout error:', error);
    return fail('Unable to save test order.', 500);
  }
}
