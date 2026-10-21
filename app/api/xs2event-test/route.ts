
import { NextRequest, NextResponse } from 'next/server';
import {
  getXS2EventSports,
  XS2EventAPIError,
} from '../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const configuredSecret =
    process.env.XS2EVENT_TEST_SECRET;

  const suppliedSecret =
    request.headers.get('x-test-secret');

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
    const sports = await getXS2EventSports();

    return NextResponse.json({
      success: true,
      message: 'XS2Event test connection successful.',
      data: sports,
    });
  } catch (error) {
    if (error instanceof XS2EventAPIError) {
      console.error(
        'XS2Event supplier HTTP status:',
        error.status
      );
    } else {
      console.error(
        'XS2Event test connection failed:',
        error instanceof Error
          ? error.name
          : 'Unknown error'
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          'XS2Event connection test could not be completed.',
      },
      { status: 502 }
    );
  }
}
