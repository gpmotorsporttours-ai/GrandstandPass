
import { NextRequest, NextResponse } from 'next/server';

import { getTicketDisplayPrice } from '../../../lib/ticketPricing';
import { isSupportedCurrency } from '../../../lib/currency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SAMPLE_PRICE = 250;
const SAMPLE_CURRENCY = 'EUR';

export async function GET(request: NextRequest) {
  const configuredSecret = process.env.XS2EVENT_TEST_SECRET;
  const suppliedSecret = request.headers.get('x-test-secret');

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

  const targetCurrency =
    request.nextUrl.searchParams.get('to');

  if (!isSupportedCurrency(targetCurrency)) {
    return NextResponse.json(
      {
        success: false,
        message: 'Unsupported currency.',
      },
      { status: 400 }
    );
  }

  try {
    const result = await getTicketDisplayPrice(
      {
        amount: SAMPLE_PRICE,
        currency: SAMPLE_CURRENCY,
      },
      targetCurrency
    );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          message: 'Ticket pricing unavailable.',
        },
        { status: 502 }
      );
    }

    if (
      result.supplierAmount !== SAMPLE_PRICE ||
      result.supplierCurrency !== SAMPLE_CURRENCY
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Original supplier price was not preserved.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      demonstrationOnly: true,
      pricing: result,
    });
  } catch (error) {
    console.error(
      'Ticket pricing test failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );

    return NextResponse.json(
      {
        success: false,
        message: 'Ticket pricing test could not be completed.',
      },
      { status: 502 }
    );
  }
}
