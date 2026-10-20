
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

  if (!eventId) {
    return NextResponse.json(
      { message: 'An event_id is required to retrieve tickets.' },
      { status: 400 }
    );
  }

  const apiUrl = new URL(
    'https://testapi.xs2event.com/v1/tickets'
  );

  apiUrl.searchParams.set('event_id', eventId);
  apiUrl.searchParams.set('ticket_status', 'available');
  apiUrl.searchParams.set('stock', 'gt:0');

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
          message: 'Unable to retrieve tickets from XS2Event.',
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

