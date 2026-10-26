
import { NextResponse } from 'next/server';
import { getXS2EventSports } from '../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Sport = Record<string, unknown>;

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

    const sports = data
      .filter(
        (item: unknown): item is Sport =>
          typeof item === 'object' &&
          item !== null &&
          !Array.isArray(item)
      )
      .map(item => ({
        sport_type:
          typeof item.sport_type === 'string'
            ? item.sport_type
            : null,
        name:
          typeof item.name === 'string'
            ? item.name
            : null,
      }));

    return NextResponse.json(
      {
        testData: true,
        sports,
        total: sports.length,
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
        error: 'Unable to retrieve test sports.',
      },
      { status: 503 }
    );
  }
}
