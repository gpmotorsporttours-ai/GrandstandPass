
import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ITEMS = 20;
const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;

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

function validText(value: unknown, max = 150): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= max
  );
}

export async function POST(request: NextRequest) {
  // Disabled unless explicitly enabled in Vercel.
  if (process.env.TEST_ORDER_CREATION_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Test order creation is disabled.' },
      { status: 404 }
    );
  }

  // Never enable this endpoint for production.
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test orders are unavailable in production.' },
      { status: 404 }
    );
  }

  const origin = request.headers.get('origin');
  const expectedOrigin = request.nextUrl.origin;

  if (origin !== expectedOrigin) {
    return NextResponse.json(
      { error: 'Invalid request origin.' },
      { status: 403 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request.' },
      { status: 400 }
    );
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body)
  ) {
    return NextResponse.json(
      { error: 'Invalid order data.' },
      { status: 400 }
    );
  }

  const data = body as Record<string, unknown>;
  const customer = data.customer as
    | Record<string, unknown>
    | undefined;
  const items = data.items;

  if (
    !customer ||
    typeof customer !== 'object' ||
    Array.isArray(customer) ||
    !validText(customer.firstName, 100) ||
    !validText(customer.lastName, 100) ||
    !validText(customer.email, 254) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
    !validText(customer.phone, 40) ||
    !validText(customer.country, 100)
  ) {
    return NextResponse.json(
      { error: 'Please provide valid customer details.' },
      { status: 400 }
    );
  }

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > MAX_ITEMS
  ) {
    return NextResponse.json(
      { error: 'Invalid ticket selection.' },
      { status: 400 }
    );
  }

  const validatedItems: TestItem[] = [];

  for (const value of items) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return NextResponse.json(
        { error: 'Invalid ticket item.' },
        { status: 400 }
      );
    }

    const item = value as Record<string, unknown>;

    if (
      typeof item.eventId !== 'string' ||
      !SAFE_ID.test(item.eventId) ||
      typeof item.supplierTicketId !== 'string' ||
      !SAFE_ID.test(item.supplierTicketId) ||
      !Number.isSafeInteger(item.quantity) ||
      (item.quantity as number) < 1 ||
      (item.quantity as number) > 10
    ) {
      return NextResponse.json(
        { error: 'Invalid supplier ticket details.' },
        { status: 400 }
      );
    }

    validatedItems.push({
      eventId: item.eventId,
      supplierTicketId: item.supplierTicketId,
      quantity: item.quantity as number,
    });
  }

  const cleanCustomer: Customer = {
    firstName: customer.firstName.trim(),
    lastName: customer.lastName.trim(),
    email: customer.email.trim().toLowerCase(),
    phone: customer.phone.trim(),
    country: customer.country.trim(),
  };

  const orderReference =
    `GP-TEST-${randomUUID().slice(0, 12).toUpperCase()}`;

  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('orders').insert({
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
      console.error('Test order database error:', error.code);
      return NextResponse.json(
        { error: 'Unable to save the test order.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        orderReference,
        status: 'test_draft',
        message: 'Test draft saved. No payment or supplier order created.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Test order creation failed:', error);
    return NextResponse.json(
      { error: 'Unable to create the test order.' },
      { status: 500 }
    );
  }
}
