
import { NextRequest, NextResponse } from 'next/server';
import {
  xs2eventGet,
  XS2EventAPIError,
} from '../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  try {
    const today = new Date().toISOString().slice(0, 10);

    const params = new URLSearchParams({
      sport_type: 'soccer',
      date_stop: today,
    });

    const response = await xs2eventGet<unknown>(
      `/events?${params.toString()}`
    );

    return NextResponse.json({
      success: true,
      message: 'XS2Event football events retrieved successfully.',
      requestedSport: 'soccer',
      dateFilter: today,
      data: response,
    });
  } catch (error) {
    if (error instanceof XS2EventAPIError) {
      console.error(
        'XS2Event events supplier HTTP status:',
        error.status
      );
    } else {
      console.error(
        'XS2Event events test failed:',
        error instanceof Error
          ? error.name
          : 'Unknown error'
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Unable to retrieve XS2Event football events.',
      },
      { status: 502 }
    );
  }
}
