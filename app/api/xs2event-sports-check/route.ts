
import { NextResponse } from 'next/server';
import { xs2eventGet } from '../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const params = new URLSearchParams({
      sport_type: 'formula1',
      date_stop: `ge:${today}`,
      sorting: 'date_start:asc',
      page_size: '50',
      page: '1',
    });

    const response = await xs2eventGet<unknown>(
      `/events?${params.toString()}`
    );

    const data =
      response &&
      typeof response === 'object' &&
      'events' in response &&
      Array.isArray(response.events)
        ? response.events
        : [];

    const events = data.map((item: unknown) => {
      if (
        !item ||
        typeof item !== 'object' ||
        Array.isArray(item)
      ) {
        return {};
      }

      const record = item as Record<string, unknown>;

      return Object.fromEntries(
        Object.entries(record).filter(
          ([key, value]) =>
            !/price|cost|net|commission|token|secret|key/i.test(key) &&
            (
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean'
            )
        )
      );
    });

    return NextResponse.json(
      {
        testData: true,
        requestedSport: 'formula1',
        dateFilter: today,
        eventsReturned: events.length,
        events,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to retrieve Formula 1 test events.',
      },
      { status: 502 }
    );
  }
}
