
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.XS2EVENT_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: 'XS2Event API key has not been configured yet.' },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const sportType = searchParams.get('sport_type');
  const tournamentId = searchParams.get('tournament_id');

  const today = new Date().toISOString().slice(0, 10);

  const apiUrl = new URL(
    'https://testapi.xs2event.com/v1/events'
  );

  // Retrieve upcoming events.
  // The date filter follows the XS2Event documentation.
  apiUrl.searchParams.set('date_stop', `ge:${today}`);

  if (sportType) {
    apiUrl.searchParams.set('sport_type', sportType);
  }

  if (tournamentId) {
    apiUrl.searchParams.set('tournament_id', tournamentId);
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
          message: 'Unable to retrieve events from XS2Event.',
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

