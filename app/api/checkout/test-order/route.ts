
import 'server-only';

import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ITEMS = 5;
const MAX_BODY_BYTES = 12_000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Customer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
};

type TestItem = {
  eventId: string;
  supplierTicketId: string;
  quantity: number;
};

function response(
  message: string,
  status: number
) {
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
  max = 150
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= max
  );
}

function secretMatches(
  provided: string | null,
  expected: string
): boolean {
  if (!provided || expected.length < 32) {
    return false;
  }

  const actualBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function POST(request: NextRequest) {
  // This endpoint is never enabled in Production.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return response('Test order creation is disabled.', 404);
  }

  // Additional private API access protection.
  const expectedSecret =
    process.env.TEST_ORDER_ACCESS_SECRET ?? '';

  if (
    !secretMatches(
      request.headers.get('x-test-order-secret'),
      expectedSecret
    )
  ) {
    return response('Unauthorised test request.', 401);
  }

  const origin = request.headers.get('origin');

  if (origin !== request.nextUrl.origin) {
    return response('Invalid request origin.', 403);
  }

  const contentType =
    request.headers.get('content-type') ?? '';

  if (!contentType.toLowerCase().startsWith('application/json')) {
    return response('JSON content required.', 415);
  }

  const contentLength = Number(
    request.headers.get('content-length') ?? '0'
  );

  if (
    !Number.isFinite(contentLength) ||
    contentLength > MAX_BODY_BYTES
  ) {
    return response('Request too large.', 413);
  }

  let body: unknown;

  try {
    const raw = await request.text();

    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return response('Request too large.', 413);
    }

    body = JSON.parse(raw);
  } catch {
    return response('Invalid JSON request.', 400);
  }

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return response('Invalid order data.', 400);
  }

  const data = body as Record<string, unknown>;

  if (
    typeof data.requestId !== 'string' ||
    !UUID_PATTERN.test(data.requestId)
  ) {
    return response('A valid request ID is required.', 400);
  }

  const customer = data.customer;

  if (
    !customer ||
    typeof customer !== 'object' ||
    Array.isArray(customer)
  ) {
    return response('Invalid customer details.', 400);
  }

  const details = customer as Record<string, unknown>;

  if (
    !validText(details.firstName, 100) ||
    !validText(details.lastName, 100) ||
    !validText(details.email, 254) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email) ||
    !validText(details.phone, 40) ||
    !validText(details.country, 100)
  ) {
    return response('Please provide valid customer details.', 400);
  }

  const items = data.items;

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > MAX_ITEMS
  ) {
    return response('Invalid ticket selection.', 400);
  }

  const validatedItems: TestItem[] = [];
  const seenTickets = new Set<string>();

  for (const value of items) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return response('Invalid ticket item.', 400);
    }

    const item = value as Record<string, unknown>;

    if (
      typeof item.eventId !== 'string' ||
      !SAFE_ID.test(item.eventId) ||
      typeof item.supplierTicketId !== 'string' ||
      !SAFE_ID.test(item.supplierTicketId) ||
      !Number.isSafeInteger(item.quantity) ||
      (item.quantity as number) < 1 ||
      (item.quantity as number) > 10 ||
      item.supplier !== 'XS2Event' ||
      item.supplierEnvironment !== 'test'
    ) {
      return response('Invalid XS2Event test ticket.', 400);
    }

    const ticketKey =
      `${item.eventId}:${item.supplierTicketId}`;

    if (seenTickets.has(ticketKey)) {
      return response('Duplicate ticket selection.', 400);
    }

    seenTickets.add(ticketKey);

    validatedItems.push({
      eventId: item.eventId,
      supplierTicketId: item.supplierTicketId,
      quantity: item.quantity as number,
    });
  }

  const cleanCustomer: Customer = {
    firstName: details.firstName.trim(),
    lastName: details.lastName.trim(),
    email: details.email.trim().toLowerCase(),
    phone: details.phone.trim(),
    country: details.country.trim(),
  };

  const orderReference =
    `GP-TEST-${randomUUID().replace(/-/g, '')
      .slice(0, 12).toUpperCase()}`;

  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('orders').insert({
      test_request_id: data.requestId,
      order_reference: orderReference,
      customer_first_name: cleanCustomer.firstName,
      customer_last_name: cleanCustomer.lastName,
      customer_email: cleanCustomer.email,
      customer_phone: cleanCustomer.phone,
      customer_country: cleanCustomer.country,
      currency: 'EUR',
      total_amount_minor: 0,
      order_status: 'test_draft',
      payment_provider: 'simulation',
      items: validatedItems.map((item) => ({
        ...item,
        testOnly: true,
        priceVerified: false,
        availabilityVerified: false,
      })),
    });

    if (error) {
      // A repeated request ID cannot create a second order.
      if (error.code === '23505') {
        return response(
          'This test request was already submitted.',
          409
        );
      }

      console.error('Test order insert failed:', error.code);

      return response('Unable to save test order.', 500);
    }

    return NextResponse.json(
      {
        ok: true,
        orderReference,
        status: 'test_draft',
        message:
          'Test order saved. No payment or supplier booking was made.',
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Test order creation error:', error);

    return response('Unable to create test order.', 500);
  }
}
