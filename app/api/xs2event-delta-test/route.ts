import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { xs2eventGet } from '../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type SupplierRecord = {
  event_id?: string;
  ticket_id?: string;
  category_id?: string;
  event_status?: string;
  ticket_status?: string;
  stock?: number;
  net_rate?: number;
  currency_code?: string;
  updated?: string;
  created?: string;
};

type SupplierResponse = {
  events?: SupplierRecord[];
  tickets?: SupplierRecord[];
  pagination?: {
    total_size?: number;
    page_size?: number;
    page_number?: number;
    next_page?: string | null;
  };
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 32) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);

  const supplied = Buffer.from(
    request.headers.get('authorization') ?? ''
  );

  return (
    expected.length === supplied.length &&
    timingSafeEqual(expected, supplied)
  );
}

async function inspectEndpoint(
  resource: 'events' | 'tickets',
  since: string
) {
  const startedAt = Date.now();

  const params = new URLSearchParams({
    sport_type: 'soccer',
    updated: `ge:${since}`,
    page_size: '50',
    page: '1',
  });

  if (resource === 'tickets') {
    params.set('show_deleted', 'true');
  }

  try {
    const response =
      await xs2eventGet<SupplierResponse>(
        `/${resource}?${params.toString()}`
      );

    const records = response[resource];

    if (!Array.isArray(records)) {
      throw new Error('Unexpected supplier response.');
    }

    const statusCounts: Record<string, number> = {};

    for (const record of records) {
      const status =
        resource === 'events'
          ? record.event_status ?? 'unknown'
          : record.ticket_status ?? 'unknown';

      statusCounts[status] =
        (statusCounts[status] ?? 0) + 1;
    }

    return {
      ok: true,
      resource,
      updatedSince: since,
      durationMs: Date.now() - startedAt,
      recordsReturned: records.length,
      totalRecords:
        response.pagination?.total_size ?? null,
      hasNextPage: Boolean(
        response.pagination?.next_page
      ),
      statusCounts,
      recordsWithUpdatedTimestamp:
        records.filter(
          (record) =>
            typeof record.updated === 'string'
        ).length,
      recordsWithoutUpdatedTimestamp:
        records.filter(
          (record) =>
            typeof record.updated !== 'string'
        ).length,
      zeroStockRecords:
        resource === 'tickets'
          ? records.filter(
              (record) => record.stock === 0
            ).length
          : null,
      sampleRecords: records
        .slice(0, 5)
        .map((record) => ({
          eventId: record.event_id ?? null,
          ticketId: record.ticket_id ?? null,
          categoryId: record.category_id ?? null,
          eventStatus: record.event_status ?? null,
          ticketStatus: record.ticket_status ?? null,
          stock: record.stock ?? null,
          netRate: record.net_rate ?? null,
          currency: record.currency_code ?? null,
          updated: record.updated ?? null,
          created: record.created ?? null,
        })),
    };
  } catch (error) {
    return {
      ok: false,
      resource,
      updatedSince: since,
      durationMs: Date.now() - startedAt,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown supplier error.',
    };
  }
}

export async function GET(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.XS2EVENT_SYNC_ENABLED !== 'true'
  ) {
    return json({ error: 'Not found.' }, 404);
  }

  if (!isAuthorised(request)) {
    return json({ error: 'Unauthorised.' }, 401);
  }

  const minutes = Number(
    request.nextUrl.searchParams.get('minutes') ?? '5'
  );

  if (
    !Number.isSafeInteger(minutes) ||
    minutes < 1 ||
    minutes > 1440
  ) {
    return json(
      { error: 'Invalid diagnostic time window.' },
      400
    );
  }

  const startedAt = Date.now();

  const since = new Date(
    startedAt - minutes * 60 * 1000
  ).toISOString().slice(0, 19);

  const events = await inspectEndpoint(
    'events',
    since
  );

  const tickets = await inspectEndpoint(
    'tickets',
    since
  );

  return json({
    ok: events.ok && tickets.ok,
    testMode: true,
    supplierEnvironment: 'test',
    mode: 'incremental_sync_diagnostic',
    sport: 'soccer',
    lookbackMinutes: minutes,
    updatedSinceUtc: since,
    events,
    tickets,
    durationMs: Date.now() - startedAt,
    databaseModified: false,
    supplierReservationsCreated: false,
    supplierOrdersCreated: false,
    checkedAt: new Date().toISOString(),
  });
}
