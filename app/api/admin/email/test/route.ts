
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { timingSafeEqual } from 'node:crypto';
import { bookingConfirmationHtml } from
  '../../../../../lib/email/bookingConfirmation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function secretsMatch(
  provided: string,
  expected: string
): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

export async function POST(request: NextRequest) {
  // This test endpoint must never run in production.
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json(
      { error: 'Not available' },
      { status: 404 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const secret = process.env.EMAIL_TEST_SECRET;
  const recipient = process.env.EMAIL_TEST_RECIPIENT;

  if (!apiKey || !secret || !recipient || secret.length < 32) {
    return NextResponse.json(
      { error: 'Email test is not configured' },
      { status: 503 }
    );
  }

  const providedSecret =
    request.headers.get('x-email-test-secret') ?? '';

  if (!secretsMatch(providedSecret, secret)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // All information below is fictional test data.
  // No payment or booking is created.
  const html = bookingConfirmationHtml({
    customerName: 'Alex',
    bookingReference: 'GP-TEST-2026-001',
    eventName: '2027 Monaco Grand Prix',
    venue: 'Circuit de Monaco, Monte Carlo',
    eventDate: '2027 - Sample Event',
    ticketDescription: 'Grandstand Tickets',
    quantity: 2,
    totalPaid: 'EUR 1,250.00 (Sample Only)',
    isTest: true,
  });

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: 'Grandstand Pass <notifications@grandstandpass.com>',
      to: [recipient],
      subject:
        '[TEST] Grandstand Pass - Booking Confirmation',
      html,
      text:
        'GRANDSTAND PASS - TEST BOOKING CONFIRMATION\n\n' +
        'This is a simulated booking confirmation.\n' +
        'Booking reference: GP-TEST-2026-001\n' +
        'Event: 2027 Monaco Grand Prix\n' +
        'Quantity: 2\n\n' +
        'No real booking was created, no payment was taken, ' +
        'and no tickets were purchased.',
    });

    if (error) {
      console.error(
        'Booking email test failed:',
        error.name
      );

      return NextResponse.json(
        {
          ok: false,
          error: 'Email sending failed',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Sample booking email accepted by Resend',
      emailId: data?.id,
      testMode: true,
      bookingCreated: false,
      paymentTaken: false,
      supplierContacted: false,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'Email test failed',
      },
      { status: 500 }
    );
  }
}
