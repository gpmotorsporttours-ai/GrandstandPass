
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { timingSafeEqual } from 'node:crypto';

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
  // Never enable this test endpoint in production.
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

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: 'Grandstand Pass <notifications@grandstandpass.com>',
      to: [recipient],
      subject: 'Grandstand Pass - Email Integration Test',
      text:
        'This is a test email from Grandstand Pass.\n\n' +
        'The Resend email integration is working.\n\n' +
        'No booking has been created and no payment has been taken.',
    });

    if (error) {
      console.error('Resend email test failed:', error.name);

      return NextResponse.json(
        { ok: false, error: 'Email sending failed' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Test email accepted by Resend',
      emailId: data?.id,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Email test failed' },
      { status: 500 }
    );
  }
}
