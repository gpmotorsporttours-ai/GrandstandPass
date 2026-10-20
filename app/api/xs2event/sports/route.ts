
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.XS2EVENT_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: 'XS2Event API key has not been configured yet.' },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(
      'https://testapi.xs2event.com/v1/sports',
      {
        headers: {
          'X-Api-Key': apiKey,
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { message: 'Unable to retrieve sports from XS2Event.' },
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

