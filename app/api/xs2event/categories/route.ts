
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.XS2EVENT_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: 'XS2Event API key has not been configured yet.' },
      { status: 503 }
    );
  }

  const eventId = request.nextUrl.searchParams.get('event_id');
  const categoryId = request.nextUrl.searchParams.get('category_id');

  if (!eventId && !categoryId) {
    return NextResponse.json(
      {
        message:
          'An event_id or category_id is required to retrieve categories.',
      },
      { status: 400 }
    );
  }

  const apiUrl = new URL(
    'https://testapi.xs2event.com/v1/categories'
  );

  if (eventId) {
    apiUrl.searchParams.set('event_id', eventId);
  }

  if (categoryId) {
    apiUrl.searchParams.set('category_id', categoryId);
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
          message: 'Unable to retrieve categories from XS2Event.',
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

