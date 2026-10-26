
import { NextResponse } from 'next/server';
import { getXS2EventSports } from '../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response: unknown = await getXS2EventSports();

    const data =
      response &&
      typeof response === 'object' &&
      'sports' in response &&
      Array.isArray(response.sports)
        ? response.sports
        : [];

    const sports = data.map((item: unknown) => {
      if (
        !item ||
        typeof item !== 'object' ||
        Array.isArray(item)
      ) {
        return { fields: [] };
      }

      const record = item as Record<string, unknown>;

      return {
        fields: Object.keys(record),
        values: Object.fromEntries(
          Object.entries(record).filter(
            ([, value]) =>
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean'
          )
        ),
      };
    });

    return NextResponse.json(
      {
        testData: true,
        total: sports.length,
        sports,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: 'Unable to retrieve test sports.' },
      { status: 503 }
    );
  }
}
