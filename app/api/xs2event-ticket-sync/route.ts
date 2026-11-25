import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { xs2eventGet } from '../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ENVIRONMENT = 'test';
const SPORT = 'soccer';
const TABLE = 'xs2event_tickets';
const PAGE_SIZE = 50;
const MAX_PAGE = 1000;

type SupplierTicket = {
  ticket_id?: string;
  event_id?: string;
  category_id?: string;
  category_name?: string;
  category_type?: string;
  ticket_title?: string;
  ticket_status?: string;
  stock?: number;
  net_rate?: number;
  currency_code?: string;
  min_order?: number;
  pairs_only?: boolean;
  created?: string;
  updated?: string;
  flags?: unknown;
};

type SupplierResponse = {
  tickets?: SupplierTicket[];
  pagination?: {
    total_size?: number;
    page_size?: number;
    page_number?: number;
    next_page?: string | null;
  };
};

function json(
  data: Record<string, unknown>,
  status = 200
) {
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

function validId(
  value: unknown
): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9_-]{1,150}$/.test(value)
  );
}

function optionalText(
  value: unknown
): string | null {
  return typeof value === 'string'
    ? value
    : null;
}

function optionalInteger(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER
): number | null {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  )
    ? value
    : null;
}

function optionalBoolean(
  value: unknown
): boolean | null {
  return typeof value === 'boolean'
    ? value
    : null;
}

function optionalTimestamp(
  value: unknown
): string | null {
  if (
    typeof value !== 'string' ||
    value.trim() === ''
  ) {
    return null;
  }

  const trimmed = value.trim();

  const hasTimezone =
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);

  const normalised = hasTimezone
    ? trimmed
    : `${trimmed.replace(' ', 'T')}Z`;

  const parsed = Date.parse(normalised);

  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : null;
}

function validDate(
  value: string
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(
    `${value}T00:00:00Z`
  );

  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
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

  const startedAt = Date.now();

  const page = Number(
    request.nextUrl.searchParams.get('page') ?? '1'
  );

  const mode =
    request.nextUrl.searchParams.get('mode') ??
    'full';

  const requestedSport =
    request.nextUrl.searchParams.get('sport') ??
    SPORT;

  if (requestedSport !== SPORT) {
    return json(
      {
        error:
          'Only Football synchronisation is enabled.',
      },
      400
    );
  }

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > MAX_PAGE
  ) {
    return json(
      { error: 'Invalid page number.' },
      400
    );
  }

  if (
    mode !== 'full' &&
    mode !== 'incremental'
  ) {
    return json(
      { error: 'Invalid synchronisation mode.' },
      400
    );
  }

  const requestedDate =
    request.nextUrl.searchParams.get('since');

  const todayUtc =
    new Date().toISOString().slice(0, 10);

  const sinceDate =
    mode === 'incremental'
      ? requestedDate ?? todayUtc
      : null;

  if (
    sinceDate !== null &&
    (
      !validDate(sinceDate) ||
      sinceDate > todayUtc
    )
  ) {
    return json(
      { error: 'Invalid supplier update date.' },
      400
    );
  }

  try {
    const params = new URLSearchParams({
      sport_type: SPORT,
      page_size: String(PAGE_SIZE),
      page: String(page),
      show_deleted: 'true',
    });

    if (sinceDate !== null) {
      params.set(
        'updated',
        `ge:${sinceDate}`
      );
    }

    const supplierResponse =
      await xs2eventGet<SupplierResponse>(
        `/tickets?${params.toString()}`,
        { environment: 'test' }
      );

    if (
      !Array.isArray(
        supplierResponse.tickets
      )
    ) {
      throw new Error(
        'Unexpected supplier ticket response.'
      );
    }

    const tickets =
      supplierResponse.tickets;

    if (tickets.length > PAGE_SIZE) {
      throw new Error(
        'Supplier returned more records than requested.'
      );
    }

    const pagination =
      supplierResponse.pagination;

    if (
      !pagination ||
      !Number.isSafeInteger(
        pagination.total_size
      ) ||
      Number(pagination.total_size) < 0 ||
      pagination.page_number !== page ||
      pagination.page_size !== PAGE_SIZE ||
      !(
        typeof pagination.next_page === 'string' ||
        pagination.next_page === null
      )
    ) {
      throw new Error(
        'Unexpected supplier pagination response.'
      );
    }

    const hasNextPage = Boolean(
      pagination.next_page
    );

    if (
      hasNextPage &&
      page >= MAX_PAGE
    ) {
      throw new Error(
        'Supplier pagination safety limit reached.'
      );
    }

    const checkedAt =
      new Date().toISOString();

    let ticketsSkipped = 0;
    let duplicateRecords = 0;

    const rowsByTicketId = new Map<
      string,
      Record<string, unknown>
    >();

    for (const ticket of tickets) {
      if (
        !validId(ticket.ticket_id) ||
        !validId(ticket.event_id)
      ) {
        ticketsSkipped++;
        continue;
      }

      const row = {
        source_environment: ENVIRONMENT,

        supplier_ticket_id:
          ticket.ticket_id,

        supplier_event_id:
          ticket.event_id,

        sport_type: SPORT,

        category_id:
          optionalText(ticket.category_id),

        category_name:
          optionalText(ticket.category_name),

        category_type:
          optionalText(ticket.category_type),

        ticket_title:
          optionalText(ticket.ticket_title),

        ticket_status:
          optionalText(ticket.ticket_status),

        stock:
          optionalInteger(
            ticket.stock,
            2147483647
          ),

        net_rate:
          optionalInteger(ticket.net_rate),

        currency_code:
          optionalText(ticket.currency_code),

        min_order:
          optionalInteger(
            ticket.min_order,
            2147483647
          ),

        pairs_only:
          optionalBoolean(ticket.pairs_only),

        supplier_created_at:
          optionalTimestamp(ticket.created),

        supplier_updated_at:
          optionalTimestamp(ticket.updated),

        supplier_data: ticket,

        ticket_checked_at: checkedAt,

        updated_at: checkedAt,
      };

      const previous =
        rowsByTicketId.get(
          ticket.ticket_id
        );

      if (previous) {
        duplicateRecords++;

        const previousTimestamp =
          typeof previous.supplier_updated_at ===
          'string'
            ? Date.parse(
                previous.supplier_updated_at
              )
            : 0;

        const currentTimestamp =
          row.supplier_updated_at
            ? Date.parse(
                row.supplier_updated_at
              )
            : 0;

        if (
          currentTimestamp <
          previousTimestamp
        ) {
          continue;
        }
      }

      rowsByTicketId.set(
        ticket.ticket_id,
        row
      );
    }

    if (ticketsSkipped > 0) {
      throw new Error(
        'Supplier returned invalid ticket or event IDs.'
      );
    }

    const rows = Array.from(
      rowsByTicketId.values()
    );

    if (rows.length > 0) {
      const supabase =
        getSupabaseAdmin();

      const { error } = await supabase
        .from(TABLE)
        .upsert(rows, {
          onConflict:
            'source_environment,supplier_ticket_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(
          '[XS2Event ticket sync] Database error:',
          error.code,
          error.message
        );

        throw new Error(
          'Unable to save supplier ticket inventory.'
        );
      }
    }

    const statusCounts: Record<
      string,
      number
    > = {};

    for (const row of rows) {
      const status =
        typeof row.ticket_status === 'string'
          ? row.ticket_status
          : 'unknown';

      statusCounts[status] =
        (statusCounts[status] ?? 0) + 1;
    }

    const availableTickets =
      rows.filter(
        (row) =>
          row.ticket_status === 'available' &&
          typeof row.stock === 'number' &&
          row.stock > 0 &&
          typeof row.net_rate === 'number' &&
          row.net_rate > 0 &&
          typeof row.currency_code === 'string' &&
          /^[A-Z]{3}$/.test(row.currency_code)
      ).length;

    return json({
      ok: true,
      testMode: true,
      supplierEnvironment: ENVIRONMENT,
      mode,
      sport: SPORT,
      sinceDate,
      page,
      pageSize: PAGE_SIZE,

      totalSupplierRecords:
        pagination.total_size,

      ticketsReceived: tickets.length,
      ticketsSaved: rows.length,
      ticketsSkipped,
      duplicateRecords,

      availableTickets,
      statusCounts,

      hasNextPage,

      nextCursor: hasNextPage
        ? {
            sport: SPORT,
            mode,
            page: page + 1,
            since: sinceDate,
          }
        : null,

      complete: !hasNextPage,

      databaseModified:
        rows.length > 0,

      customerOrdersModified: false,
      supplierReservationsCreated: false,
      supplierOrdersCreated: false,

      durationMs:
        Date.now() - startedAt,

      checkedAt,
    });
  } catch (error) {
    console.error(
      '[XS2Event ticket sync] Failed:',
      error instanceof Error
        ? error.message
        : 'Unknown error.'
    );

    return json(
      {
        ok: false,
        testMode: true,
        supplierEnvironment: ENVIRONMENT,
        mode,
        sport: SPORT,
        page,
        sinceDate,

        error:
          'Football ticket synchronisation failed.',

        complete: false,
        cursorAdvanced: false,

        customerOrdersModified: false,
        supplierReservationsCreated: false,
        supplierOrdersCreated: false,

        durationMs:
          Date.now() - startedAt,
      },
      503
    );
  }
}
