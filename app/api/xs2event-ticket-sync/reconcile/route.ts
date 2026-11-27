import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { xs2eventGet } from '../../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ENVIRONMENT = 'test';
const TABLE = 'xs2event_tickets';
const MAX_TICKETS = 10;
const RUN_BUDGET_MS = 35000;

type SupplierTicket = {
  ticket_id?: unknown;
  event_id?: unknown;
  ticket_status?: unknown;
  stock?: unknown;
  net_rate?: unknown;
  currency_code?: unknown;
  updated?: unknown;
};

function json(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    {
      ...data,
      testMode: true,
      supplierEnvironment: ENVIRONMENT,
      customerOrdersModified: false,
      supplierReservationsCreated: false,
      supplierOrdersCreated: false,
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

function isAuthorised(request: NextRequest) {
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

function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9_-]{1,150}$/.test(value)
  );
}

function validInteger(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}

function normaliseTimestamp(
  value: unknown
): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const timestamp = value.trim();

  const withTimezone =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp)
      ? timestamp
      : `${timestamp}Z`;

  const parsed = Date.parse(withTimezone);

  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : null;
}

export async function GET(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.XS2EVENT_SYNC_ENABLED !== 'true'
  ) {
    return NextResponse.json(
      { error: 'Not found.' },
      { status: 404 }
    );
  }

  if (!isAuthorised(request)) {
    return NextResponse.json(
      { error: 'Unauthorised.' },
      { status: 401 }
    );
  }

  const startedAt = Date.now();

  // Explicitly require apply=true before writing.
  const apply =
    request.nextUrl.searchParams.get('apply') === 'true';

  // Initial manual reconciliation uses the verified
  // starting timestamp of the completed full cycle.
  const cutoff = normaliseTimestamp(
    request.nextUrl.searchParams.get('cutoff')
  );

  if (!cutoff || Date.parse(cutoff) >= Date.now()) {
    return json(
      {
        ok: false,
        error: 'A valid historical cutoff is required.',
      },
      400
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: progress, error: progressError } =
      await supabase
        .from('xs2event_ticket_sync_progress')
        .select('last_full_completed_at')
        .eq('source_environment', ENVIRONMENT)
        .eq('sport_type', 'all')
        .single();

    if (
      progressError ||
      !progress?.last_full_completed_at ||
      Date.parse(progress.last_full_completed_at) <=
        Date.parse(cutoff)
    ) {
      return json(
        {
          ok: false,
          error: 'Completed full synchronisation required.',
        },
        409
      );
    }

    const { data: candidates, error: candidateError } =
      await supabase
        .from(TABLE)
        .select(`
          supplier_ticket_id,
          supplier_event_id,
          ticket_status,
          stock,
          net_rate,
          currency_code,
          supplier_updated_at,
          ticket_checked_at,
          updated_at
        `)
        .eq('source_environment', ENVIRONMENT)
        .eq('ticket_status', 'available')
        .gt('stock', 0)
        .gt('net_rate', 0)
        .lt('ticket_checked_at', cutoff)
        .order('ticket_checked_at', {
          ascending: true,
        })
        .order('supplier_ticket_id', {
          ascending: true,
        })
        .limit(MAX_TICKETS);

    if (candidateError || !candidates) {
      throw new Error(
        'Unable to read reconciliation candidates.'
      );
    }

    let verified = 0;
    let updated = 0;
    let disabled = 0;
    let stillAvailable = 0;
    let unresolved = 0;
    let concurrentChanges = 0;

    const results: Record<string, unknown>[] = [];

    for (const candidate of candidates) {
      if (Date.now() - startedAt >= RUN_BUDGET_MS) {
        break;
      }

      const ticketId = candidate.supplier_ticket_id;

      try {
        if (
          !validId(ticketId) ||
          !validId(candidate.supplier_event_id)
        ) {
          throw new Error('Invalid stored identifiers.');
        }

        const ticket =
          await xs2eventGet<SupplierTicket>(
            `/tickets/${ticketId}`,
            { environment: 'test' }
          );

        if (
          ticket.ticket_id !== ticketId ||
          ticket.event_id !== candidate.supplier_event_id
        ) {
          throw new Error(
            'Supplier ticket identity mismatch.'
          );
        }

        if (
          ticket.ticket_status !== 'available' &&
          ticket.ticket_status !== 'disabled'
        ) {
          throw new Error(
            'Unrecognised supplier ticket status.'
          );
        }

        if (
          !validInteger(ticket.stock, 2147483647) ||
          !validInteger(ticket.net_rate) ||
          typeof ticket.currency_code !== 'string' ||
          !/^[A-Z]{3}$/.test(ticket.currency_code)
        ) {
          throw new Error(
            'Invalid supplier stock, price or currency.'
          );
        }

        const supplierUpdatedAt =
          normaliseTimestamp(ticket.updated);

        if (!supplierUpdatedAt) {
          throw new Error(
            'Invalid supplier update timestamp.'
          );
        }

        if (
          candidate.supplier_updated_at &&
          Date.parse(supplierUpdatedAt) <
            Date.parse(candidate.supplier_updated_at)
        ) {
          throw new Error(
            'Supplier response is older than stored data.'
          );
        }

        verified++;

        const potentiallySellable =
          ticket.ticket_status === 'available' &&
          ticket.stock > 0 &&
          ticket.net_rate > 0;

        if (potentiallySellable) {
          stillAvailable++;
        }

        if (ticket.ticket_status === 'disabled') {
          disabled++;
        }

        const result: Record<string, unknown> = {
          ticketId,
          previousStatus: candidate.ticket_status,
          supplierStatus: ticket.ticket_status,
          previousStock: candidate.stock,
          supplierStock: ticket.stock,
          previousNetRate: candidate.net_rate,
          supplierNetRate: ticket.net_rate,
          currency: ticket.currency_code,
          supplierUpdatedAt,
          potentiallySellable,
          databaseUpdated: false,
        };

        if (apply) {
          const checkedAt = new Date().toISOString();

          const { data: saved, error: saveError } =
            await supabase
              .from(TABLE)
              .update({
                ticket_status: ticket.ticket_status,
                stock: ticket.stock,
                net_rate: ticket.net_rate,
                currency_code: ticket.currency_code,
                supplier_updated_at: supplierUpdatedAt,
                supplier_data: ticket,
                ticket_checked_at: checkedAt,
                updated_at: checkedAt,
              })
              .eq('source_environment', ENVIRONMENT)
              .eq('supplier_ticket_id', ticketId)
              .eq(
                'supplier_event_id',
                candidate.supplier_event_id
              )
              .eq('updated_at', candidate.updated_at)
              .lt('ticket_checked_at', cutoff)
              .select('supplier_ticket_id')
              .maybeSingle();

          if (saveError) {
            throw new Error(
              'Unable to save verified ticket.'
            );
          }

          if (saved) {
            updated++;
            result.databaseUpdated = true;
          } else {
            concurrentChanges++;
            result.concurrentChange = true;
          }
        }

        results.push(result);
      } catch (error) {
        unresolved++;

        results.push({
          ticketId,
          status: 'unresolved',
          databaseUpdated: false,
          error:
            error instanceof Error
              ? error.message.slice(0, 200)
              : 'Ticket verification failed.',
        });
      }
    }

    return json(
      {
        ok: unresolved === 0,
        mode: 'missing_ticket_reconciliation',
        dryRun: !apply,
        cutoff,
        candidatesFound: candidates.length,
        candidatesProcessed: results.length,
        verified,
        updated,
        disabled,
        stillAvailable,
        unresolved,
        concurrentChanges,
        databaseModified: updated > 0,
        results,
        durationMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      },
      unresolved > 0 ? 503 : 200
    );
  } catch {
    return json(
      {
        ok: false,
        error: 'Missing-ticket reconciliation failed.',
      },
      503
    );
  }
}
