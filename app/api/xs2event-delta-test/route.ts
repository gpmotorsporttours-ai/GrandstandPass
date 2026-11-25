import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TEST_API_URL =
  'https://testapi.xs2event.com/v1';

type Resource = 'events' | 'tickets';

type DiagnosticTest = {
  name: string;
  resource: Resource;
  filters: Record<string, string>;
};

type SupplierRecord = {
  event_id?: string;
  ticket_id?: string;
  event_status?: string;
  ticket_status?: string;
  stock?: number;
  net_rate?: number;
  currency_code?: string;
  updated?: string;
  created?: string;
  deleted?: boolean | string | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
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

function isAuthorised(
  request: NextRequest
): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 32) {
    return false;
  }

  const expected = Buffer.from(
    `Bearer ${secret}`
  );

  const supplied = Buffer.from(
    request.headers.get('authorization') ?? ''
  );

  return (
    expected.length === supplied.length &&
    timingSafeEqual(expected, supplied)
  );
}

function sanitiseError(
  value: string,
  apiKey: string
): string {
  let result = value;

  const secrets = [
    apiKey,
    process.env.CRON_SECRET,
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  ];

  for (const secret of secrets) {
    if (secret) {
      result = result
        .split(secret)
        .join('[REDACTED]');
    }
  }

  return result.slice(0, 1500);
}

async function runDiagnostic(
  test: DiagnosticTest,
  apiKey: string
) {
  const startedAt = Date.now();

  const params = new URLSearchParams({
    page_size: '50',
    page: '1',
    ...test.filters,
  });

  const url = new URL(
    `${TEST_API_URL}/${test.resource}`
  );

  url.search = params.toString();

  try {
    const response = await fetch(
      url.toString(),
      {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          Accept: 'application/json',
        },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      }
    );

    const body = await response.text();

    if (!response.ok) {
      return {
        name: test.name,
        resource: test.resource,
        filters: test.filters,
        ok: false,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        supplierError: sanitiseError(
          body,
          apiKey
        ),
      };
    }

    const data = JSON.parse(
      body
    ) as SupplierResponse;

    const records = data[test.resource];

    if (!Array.isArray(records)) {
      return {
        name: test.name,
        resource: test.resource,
        filters: test.filters,
        ok: false,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        error: 'Unexpected supplier response.',
      };
    }

    const statusCounts: Record<
      string,
      number
    > = {};

    const updatedDateCounts: Record<
      string,
      number
    > = {};

    const fieldNames = new Set<string>();

    for (const record of records) {
      const status =
        test.resource === 'events'
          ? record.event_status ?? 'unknown'
          : record.ticket_status ?? 'unknown';

      statusCounts[status] =
        (statusCounts[status] ?? 0) + 1;

      for (const key of Object.keys(record)) {
        fieldNames.add(key);
      }

      if (
        typeof record.updated === 'string' &&
        /^\d{4}-\d{2}-\d{2}/.test(
          record.updated
        )
      ) {
        const date = record.updated.slice(
          0,
          10
        );

        updatedDateCounts[date] =
          (updatedDateCounts[date] ?? 0) + 1;
      }
    }

    const requestedUpdatedDate =
      test.filters.updated?.match(
        /^ge:(\d{4}-\d{2}-\d{2})/
      )?.[1] ?? null;

    const recordsBeforeRequestedDate =
      requestedUpdatedDate === null
        ? null
        : records.filter(
            (record) =>
              typeof record.updated === 'string' &&
              /^\d{4}-\d{2}-\d{2}/.test(
                record.updated
              ) &&
              record.updated.slice(0, 10) <
                requestedUpdatedDate
          ).length;

    return {
      name: test.name,
      resource: test.resource,
      filters: test.filters,
      ok: true,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      recordsReturned: records.length,
      totalRecords:
        data.pagination?.total_size ?? null,
      hasNextPage: Boolean(
        data.pagination?.next_page
      ),
      statusCounts,
      updatedDateCounts,
      requestedUpdatedDate,
      recordsBeforeRequestedDate,
      recordsWithUpdatedTimestamp:
        records.filter(
          (record) =>
            typeof record.updated === 'string'
        ).length,
      availableFieldNames:
        Array.from(fieldNames).sort(),
      sampleRecords: records
        .slice(0, 2)
        .map((record) => ({
          eventId: record.event_id ?? null,
          ticketId: record.ticket_id ?? null,
          eventStatus:
            record.event_status ?? null,
          ticketStatus:
            record.ticket_status ?? null,
          stock: record.stock ?? null,
          netRate: record.net_rate ?? null,
          currency:
            record.currency_code ?? null,
          updated: record.updated ?? null,
          created: record.created ?? null,
          deleted: record.deleted ?? null,
          deletedAt: record.deleted_at ?? null,
          isDeleted: record.is_deleted ?? null,
        })),
    };
  } catch (error) {
    return {
      name: test.name,
      resource: test.resource,
      filters: test.filters,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: sanitiseError(
        error instanceof Error
          ? error.message
          : 'Unknown supplier error.',
        apiKey
      ),
    };
  }
}

export async function GET(
  request: NextRequest
) {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.XS2EVENT_SYNC_ENABLED !== 'true'
  ) {
    return json(
      { error: 'Not found.' },
      404
    );
  }

  if (!isAuthorised(request)) {
    return json(
      { error: 'Unauthorised.' },
      401
    );
  }

  const apiKey =
    process.env.XS2EVENT_API_KEY;

  if (!apiKey) {
    return json(
      { error: 'Supplier API key unavailable.' },
      503
    );
  }

  const minutes = Number(
    request.nextUrl.searchParams.get(
      'minutes'
    ) ?? '5'
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

  const sinceIso = new Date(
    startedAt - minutes * 60 * 1000
  ).toISOString();

  const todayUtc = new Date(
    startedAt
  ).toISOString().slice(0, 10);

  const yesterdayUtc = new Date(
    startedAt - 24 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  const sinceDate = sinceIso.slice(0, 10);

  const midnightWithoutTimezone =
    `${sinceDate}T00:00:00`;

  const midnightWithTimezone =
    `${sinceDate}T00:00:00Z`;

  const tests: DiagnosticTest[] = [
    {
      name: 'events_updated_date_only',
      resource: 'events',
      filters: {
        sport_type: 'soccer',
        updated: `ge:${sinceDate}`,
      },
    },
    {
      name: 'tickets_updated_date_only',
      resource: 'tickets',
      filters: {
        sport_type: 'soccer',
        updated: `ge:${sinceDate}`,
      },
    },
    {
      name: 'events_updated_midnight',
      resource: 'events',
      filters: {
        sport_type: 'soccer',
        updated: `ge:${midnightWithoutTimezone}`,
      },
    },
    {
      name: 'tickets_updated_midnight',
      resource: 'tickets',
      filters: {
        sport_type: 'soccer',
        updated: `ge:${midnightWithoutTimezone}`,
      },
    },
    {
      name: 'events_updated_midnight_utc',
      resource: 'events',
      filters: {
        sport_type: 'soccer',
        updated: `ge:${midnightWithTimezone}`,
      },
    },
    {
      name: 'tickets_updated_midnight_utc',
      resource: 'tickets',
      filters: {
        sport_type: 'soccer',
        updated: `ge:${midnightWithTimezone}`,
      },
    },
    {
      name: 'events_updated_yesterday',
      resource: 'events',
      filters: {
        sport_type: 'soccer',
        updated: `ge:${yesterdayUtc}`,
      },
    },
    {
      name: 'tickets_updated_yesterday',
      resource: 'tickets',
      filters: {
        sport_type: 'soccer',
        updated: `ge:${yesterdayUtc}`,
      },
    },
    {
      name: 'tickets_updated_date_with_deleted',
      resource: 'tickets',
      filters: {
        sport_type: 'soccer',
        updated: `ge:${sinceDate}`,
        show_deleted: 'true',
      },
    },
    {
      name: 'tickets_updated_yesterday_with_deleted',
      resource: 'tickets',
      filters: {
        sport_type: 'soccer',
        updated: `ge:${yesterdayUtc}`,
        show_deleted: 'true',
      },
    },
  ];

  const results = [];

  for (
    let index = 0;
    index < tests.length;
    index += 2
  ) {
    const group = tests.slice(
      index,
      index + 2
    );

    const groupResults = await Promise.all(
      group.map((test) =>
        runDiagnostic(test, apiKey)
      )
    );

    results.push(...groupResults);
  }

  return json({
    ok: results.every(
      (result) => result.ok
    ),
    testMode: true,
    supplierEnvironment: 'test',
    mode: 'date_only_incremental_diagnostic',
    sport: 'soccer',
    lookbackMinutes: minutes,
    updatedSinceUtc: sinceIso,
    todayUtc,
    yesterdayUtc,
    testedDate: sinceDate,
    testsExecuted: results.length,
    testsPassed: results.filter(
      (result) => result.ok
    ).length,
    testsFailed: results.filter(
      (result) => !result.ok
    ).length,
    results,
    durationMs: Date.now() - startedAt,
    databaseModified: false,
    supplierReservationsCreated: false,
    supplierOrdersCreated: false,
    checkedAt: new Date().toISOString(),
  });
}
