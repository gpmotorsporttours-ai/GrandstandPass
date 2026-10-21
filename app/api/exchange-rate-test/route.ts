
import { NextRequest, NextResponse } from 'next/server';

import { getExchangeRate } from '../../../lib/exchangeRates';

import { isSupportedCurrency } from '../../../lib/currency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const configuredSecret =
    process.env.XS2EVENT_TEST_SECRET;

  const suppliedSecret =
    request.headers.get('x-test-secret');

  // Protect the testing endpoint.
  if (
    !configuredSecret ||
    !suppliedSecret ||
    suppliedSecret !== configuredSecret
  ) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  // Read the requested currencies.
  const from =
    request.nextUrl.searchParams.get('from');

  const to =
    request.nextUrl.searchParams.get('to');

  // Only allow our five supported currencies.
  if (
    !isSupportedCurrency(from) ||
    !isSupportedCurrency(to)
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'Unsupported currency pair.',
      },
      { status: 400 }
    );
  }

  // Request the exchange rate.
  const result = await getExchangeRate(from, to);

  if (!result) {
    return NextResponse.json(
      {
        success: false,
        message: 'Exchange rate unavailable.',
      },
      { status: 502 }
    );
  }

  // Return the verified exchange rate.
  return NextResponse.json({
    success: true,
    exchangeRate: result,
  });
}
