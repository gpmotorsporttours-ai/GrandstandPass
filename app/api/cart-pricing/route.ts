
import { NextRequest, NextResponse } from 'next/server';
import { getTicketDisplayPrice } from '../../../lib/ticketPricing';
import { isSupportedCurrency } from '../../../lib/currency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const amountText = request.nextUrl.searchParams.get('amount');
  const sourceCurrency = request.nextUrl.searchParams.get('from');
  const displayCurrency = request.nextUrl.searchParams.get('to');

  const amount = amountText === null ? NaN : Number(amountText);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 10000000 ||
    !isSupportedCurrency(sourceCurrency) ||
    !isSupportedCurrency(displayCurrency)
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid ticket price or currency.',
      },
      { status: 400 }
    );
  }

  try {
    const pricing = await getTicketDisplayPrice(
      {
        amount,
        currency: sourceCurrency,
      },
      displayCurrency
    );

    if (!pricing) {
      return NextResponse.json(
        {
          success: false,
          message: 'Currency conversion is currently unavailable.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        pricing,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      'Cart pricing conversion failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );

    return NextResponse.json(
      {
        success: false,
        message: 'Currency conversion could not be completed.',
      },
      { status: 502 }
    );
  }
}
