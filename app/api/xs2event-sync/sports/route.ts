
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

import { xs2eventGet } from '../../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function isAuthorised(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret || configuredSecret.length < 32) {
    return false;
  }

  const authorization =
    request.headers.get('authorization') || '';

  if (!authorization.startsWith('Bearer ')) {
    return false;
  }

  const expected = Buffer.from(
    configuredSecret,
    'utf8'
  );

  const provided = Buffer.from(
    authorization.slice(7),
    'utf8'
  );

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}

export async function GET(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.XS2EVENT_SYNC_ENABLED !== 'true'
  ) {
    return json(
      { error: 'Sport discovery is not enabled.' },
      404
    );
  }

  if (!isAuthorised(request)) {
    return json(
      { error: 'Unauthorised.' },
      401
    );
  }

  try {
    const supplierSports = await xs2eventGet<unknown>(
      '/sports',
      { environment: 'test' }
    );

    return json({
      ok: true,
      testMode: true,
      supplierEnvironment: 'test',
      mode: 'read_only_sport_discovery',
      supplierSports,
      checkedAt: new Date().toISOString(),
      databaseModified: false,
      supplierReservationsCreated: false,
      supplierOrdersCreated: false,
    });
  } catch (error) {
    console.error(
      '[XS2Event sport discovery] Failed:',
      error instanceof Error
        ? error.message
        : 'Unknown error'
    );

    return json(
      {
        ok: false,
        error: 'XS2Event sport discovery failed.',
      },
      503
    );
  }
}
