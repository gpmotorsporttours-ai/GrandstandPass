
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { bookingConfirmationHtml } from '../../../../lib/email/bookingConfirmation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER_REFERENCE_PATTERN =
  /^GP-TEST-[A-F0-9]{12}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TestItem = {
  eventName?: string;
  eventDate?: string;
  ticketCategory?: string;
  quantity?: number;
  indicativeCurrency?: string;
  indicativeTotalAmountMinor?: number;
};

type TestOrder = {
  order_reference: string;
  order_status: string;
  payment_provider: string;
  total_amount_minor: number;
  customer_first_name: string | null;
  customer_last_name: string | null;
  items: unknown;
  supplier_order_reference: string | null;
  supplier_reservation_id: string | null;
  supplier_reservation_status: string | null;
  supplier_reservation_attempt_id: string | null;
};

type EmailResult =
  | 'sent'
  | 'failed'
  | 'not_configured'
  | 'already_claimed'
  | 'not_applicable';

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
  if (!provided || !expected) return false;

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

function firstItem(value: unknown): TestItem {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value[0] ||
    typeof value[0] !== 'object'
  ) {
    return {};
  }

  return value[0] as TestItem;
}

function safeText(
  value: unknown,
  fallback: string
): string {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : fallback;
}

function formatIndicativeTotal(item: TestItem): string {
  const amount = item.indicativeTotalAmountMinor;

  if (
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    amount < 0
  ) {
    return 'Indicative price unavailable';
  }

  const currency = safeText(
    item.indicativeCurrency,
    'EUR'
  );

  return `${currency} ${(amount / 100).toFixed(2)} (Indicative test price)`;
}

async function sendTestBookingConfirmation(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  order: TestOrder
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.EMAIL_TEST_RECIPIENT;

  // Never send a test confirmation to the
  // customer's submitted email address.
  if (!apiKey || !recipient) {
    console.error(
      'Booking confirmation email not configured.'
    );
    return 'not_configured';
  }

  // Atomically claim the email for this order.
  // Only one concurrent request can change
  // the status from NULL to "sending".
  const { data: claimed, error: claimError } =
    await supabase
      .from('orders')
      .update({
        booking_confirmation_email_status: 'sending',
      })
      .eq('order_reference', order.order_reference)
      .eq('payment_provider', 'simulation')
      .eq('total_amount_minor', 0)
      .eq(
        'supplier_reservation_status',
        'simulated_reserved'
      )
      .is('booking_confirmation_email_status', null)
      .select('order_reference')
      .maybeSingle();

  if (claimError) {
    console.error(
      'Booking confirmation claim error:',
      claimError.code
    );
    return 'failed';
  }

  if (!claimed) {
    return 'already_claimed';
  }

  try {
    const item = firstItem(order.items);

    const customerName = [
      order.customer_first_name,
      order.customer_last_name,
    ]
      .filter(
        (part): part is string =>
          typeof part === 'string' &&
          part.trim().length > 0
      )
      .join(' ') || 'Customer';

    const html = bookingConfirmationHtml({
      customerName,
      bookingReference: order.order_reference,
      eventName: safeText(
        item.eventName,
        'Sporting event'
      ),
      venue: 'Venue details as shown on your order',
      eventDate: safeText(
        item.eventDate,
        'Event date to be confirmed'
      ),
      ticketDescription: safeText(
        item.ticketCategory,
        'Selected ticket category'
      ),
      quantity:
        typeof item.quantity === 'number' &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
          ? item.quantity
          : 1,
      totalPaid: formatIndicativeTotal(item),
      isTest: true,
    });

    const logoBuffer = await readFile(
      path.join(
        process.cwd(),
        'public',
        'grandstandpass-logo-email.png'
      )
    );

    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from:
        'Grandstand Pass <notifications@grandstandpass.com>',
      to: [recipient],
      subject:
        '[TEST] Grandstand Pass - Booking Confirmation',
      html,
      text:
        'GRANDSTAND PASS - TEST BOOKING CONFIRMATION\n\n' +
        `Booking reference: ${order.order_reference}\n` +
        `Customer: ${customerName}\n` +
        `Event: ${safeText(item.eventName, 'Sporting event')}\n` +
        `Ticket category: ${safeText(item.ticketCategory, 'Selected ticket category')}\n` +
        `Indicative total: ${formatIndicativeTotal(item)}\n\n` +
        'A successful supplier reservation was simulated.\n' +
        'No real payment was taken, no supplier booking was ' +
        'created, and no tickets were purchased.',
      attachments: [
        {
          filename: 'grandstandpass-logo-email.png',
          content: logoBuffer,
          contentType: 'image/png',
          contentId: 'grandstand-pass-logo',
        },
      ],
    });

    if (error || !data?.id) {
      console.error(
        'Booking confirmation Resend error:',
        error?.name ?? 'Missing email ID'
      );

      await supabase
        .from('orders')
        .update({
          booking_confirmation_email_status: 'failed',
        })
        .eq('order_reference', order.order_reference)
        .eq('booking_confirmation_email_status', 'sending');

      return 'failed';
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        booking_confirmation_email_status: 'sent',
        booking_confirmation_email_sent_at:
          new Date().toISOString(),
        booking_confirmation_email_id: data.id,
      })
      .eq('order_reference', order.order_reference)
      .eq('booking_confirmation_email_status', 'sending');

    if (updateError) {
      console.error(
        'Booking confirmation tracking error:',
        updateError.code
      );

      // Resend accepted the email, but database
      // tracking could not be confirmed.
      // Do not automatically send another copy.
      return 'failed';
    }

    return 'sent';
  } catch (error) {
    console.error(
      'Booking confirmation email error:',
      error instanceof Error ? error.name : 'Unknown'
    );

    await supabase
      .from('orders')
      .update({
        booking_confirmation_email_status: 'failed',
      })
      .eq('order_reference', order.order_reference)
      .eq('booking_confirmation_email_status', 'sending');

    return 'failed';
  }
}

export async function POST(request: NextRequest) {
  // Preview-only simulation.
  // This endpoint never contacts XS2Event.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return fail('Supplier simulation is disabled.', 404);
  }

  const secret = process.env.TEST_ORDER_ACCESS_SECRET;

  if (
    !secret ||
    secret.length < 32 ||
    !secretMatches(
      request.headers.get('x-test-order-secret'),
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

    if (Buffer.byteLength(raw, 'utf8') > 2000) {
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

  const { orderReference, outcome } =
    body as Record<string, unknown>;

  if (
    typeof orderReference !== 'string' ||
    !ORDER_REFERENCE_PATTERN.test(orderReference)
  ) {
    return fail('Invalid test order reference.', 400);
  }

  if (
    outcome !== 'success' &&
    outcome !== 'failure'
  ) {
    return fail(
      'Outcome must be success or failure.',
      400
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_reference', orderReference)
      .maybeSingle();

    if (error) {
      console.error(
        'Supplier simulation order read error:',
        error.code
      );

      return fail('Unable to read test order.', 500);
    }

    if (!data) {
      return fail('Test order not found.', 404);
    }

    const order = data as TestOrder;

    // Only claimed, zero-value simulated
    // payment orders qualify.
    if (
      order.order_status !== 'payment_confirmed' ||
      order.payment_provider !== 'simulation' ||
      order.total_amount_minor !== 0 ||
      typeof order.supplier_reservation_attempt_id !==
        'string' ||
      !UUID_PATTERN.test(
        order.supplier_reservation_attempt_id
      )
    ) {
      return fail(
        'Test order is not eligible for simulation.',
        409
      );
    }

    // Never overwrite an existing supplier record
    // or an already recorded simulation result.
    if (
      order.supplier_order_reference ||
      order.supplier_reservation_id ||
      order.supplier_reservation_status !== null
    ) {
      return fail(
        'Order already has a supplier result recorded.',
        409
      );
    }

    // Record the result atomically in Supabase.
    // The database function repeats eligibility
    // checks and rejects duplicate processing.
    const { data: recorded, error: recordError } =
      await supabase.rpc(
        'record_test_supplier_response',
        {
          p_order_reference: orderReference,
          p_attempt_id:
            order.supplier_reservation_attempt_id,
          p_outcome: outcome,
        }
      );

    if (recordError) {
      console.error(
        'Supplier simulation recording error:',
        recordError.code
      );

      return fail(
        'Unable to record simulated supplier response.',
        500
      );
    }

    if (recorded !== true) {
      return fail(
        'Supplier response already recorded or order is no longer eligible.',
        409
      );
    }

    const simulated =
      outcome === 'success'
        ? {
            outcome: 'success',
            simulatedReservationId:
              `SIM-RES-${orderReference}`,
            simulatedStatus: 'simulated_reserved',
            customerMessage:
              'Test reservation accepted (simulation only).',
          }
        : {
            outcome: 'failure',
            simulatedReservationId: null,
            simulatedStatus: 'manual_review_required',
            customerMessage:
              'Test reservation rejected (simulation only).',
          };

    // Send the confirmation only after the
    // successful database-recorded simulation.
    // Email failure must never undo the
    // simulated supplier result.
    let bookingConfirmationEmailStatus:
      EmailResult = 'not_applicable';

    if (outcome === 'success') {
      bookingConfirmationEmailStatus =
        await sendTestBookingConfirmation(
          supabase,
          order
        );
    }

    return NextResponse.json(
      {
        ok: true,
        mode: 'supplier_response_simulation',
        orderReference,
        attemptId:
          order.supplier_reservation_attempt_id,
        ...simulated,
        databaseUpdated: true,
        bookingConfirmationEmailStatus,
        supplierContacted: false,
        reservationCreated: false,
        bookingCreated: false,
        message:
          'Simulated supplier response recorded in Supabase. ' +
          'No real reservation or booking was created.',
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error(
      'Supplier response simulation error:',
      error instanceof Error
        ? error.name
        : 'Unknown'
    );

    return fail(
      'Supplier response simulation unavailable.',
      500
    );
  }
}
