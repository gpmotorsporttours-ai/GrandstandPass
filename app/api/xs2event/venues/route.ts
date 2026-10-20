
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.XS2EVENT_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: 'XS2Event API key has not been configured yet.' },
      { status: 503 }
    );
  }

  const apiUrl = new URL(
    'https://testapi.xs2event.com/v1/venues'
  );

  // Allow venue filtering and pagination.
  const allowedParams = [
    'venue_id',
    'page',
    'page_size',
  ];

  for (const param of allowedParams) {
    const value = request.nextUrl.searchParams.get(param);

    if (value) {
      apiUrl.searchParams.set(param, value);
    }
  }

  try {
    const response = await fetch(apiUrl.toString(), {
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          message: 'Unable to retrieve venues from XS2Event.',
          status: response.status,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { message: 'Unable to connect to XS2Event.' },
      { status: 502 }
    );
  }
}
