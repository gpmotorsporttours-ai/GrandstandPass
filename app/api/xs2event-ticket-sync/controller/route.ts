import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const ENVIRONMENT = 'test';
const DEFAULT_SPORT = 'all';
const TABLE = 'xs2event_ticket_sync_progress';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const FULL_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LOCK_DURATION_MS = 120 * 1000;
const REQUEST_TIMEOUT_MS = 65 * 1000;
const RUN_BUDGET_MS = 15 * 1000;
const MAX_PAGES_PER_RUN = 5;
const MAX_PAGE = 1000;
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000;

type SyncMode = 'full' | 'incremental';

type ProgressRow = {
  source_environment: string;
  sport_type: string;
  sync_mode: SyncMode;
  sync_stage: 'fetching' | 'reconciling';
  status: string;
  next_page: number;
  since_date: string | null;
  cycle_id: string | null;
  cycle_started_at: string | null;
  pages_processed: number;
  tickets_received: number;
  tickets_saved: number;
  tickets_skipped: number;
  duplicate_records: number;
  consecutive_failures: number;
  last_batch_at: string | null;
  last_completed_at: string | null;
  last_full_completed_at: string | null;
  last_incremental_completed_at: string | null;
  last_successful_watermark: string | null;
  next_retry_at: string | null;
  lock_token: string | null;
  locked_until: string | null;
  last_error: string | null;
  updated_at: string;
};

type TicketBatch = {
  ok: boolean;
  testMode: boolean;
  supplierEnvironment: string;
  sport: string;
  mode: SyncMode;
  sinceDate: string | null;
  page: number;
  pageSize: number;
  totalSupplierRecords: number;
  ticketsReceived: number;
  ticketsSaved: number;
  ticketsModified: number;
  ticketsNotModified: number;
  recoveredEventRecords: number;
  differentSportTickets: number;
  ticketsSkipped: number;
  unsupportedSportTickets: number;
  duplicateRecords: number;
  hasNextPage: boolean;
  nextCursor: {
    sport: string;
    mode: SyncMode;
    page: number;
    since: string | null;
  } | null;
  complete: boolean;
  databaseModified: boolean;
  customerOrdersModified: boolean;
  supplierReservationsCreated: boolean;
  supplierOrdersCreated: boolean;
};

function json(
  sport: string,
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    {
      ...data,
      testMode: true,
      supplierEnvironment: ENVIRONMENT,
      sport,
      refreshIntervalMinutes: 5,
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

function nonNegativeInteger(
  value: unknown
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function incrementalSinceDate(
  watermark: string
): string {
  const timestamp = Date.parse(watermark);

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      'Invalid synchronisation watermark.'
    );
  }

  // Re-read the preceding UTC date as an
  // overlap because XS2Event currently accepts
  // date-only incremental filters.
  return new Date(
    timestamp - 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);
}

function validateBatch(
  batch: TicketBatch,
  sport: string,
  mode: SyncMode,
  page: number,
  sinceDate: string | null
) {
  if (
    batch.ok !== true ||
    batch.testMode !== true ||
    batch.supplierEnvironment !== ENVIRONMENT ||
    batch.sport !== sport ||
    batch.mode !== mode ||
    batch.page !== page ||
    batch.pageSize !== 50 ||
    batch.sinceDate !== sinceDate ||
    batch.customerOrdersModified !== false ||
    batch.supplierReservationsCreated !== false ||
    batch.supplierOrdersCreated !== false
  ) {
    throw new Error(
      'Unexpected or unsafe ticket batch response.'
    );
  }

  const counters = [
    batch.totalSupplierRecords,
    batch.ticketsReceived,
    batch.ticketsSaved,
    batch.ticketsModified,
    batch.ticketsNotModified,
    batch.recoveredEventRecords,
    batch.differentSportTickets,
    batch.ticketsSkipped,
    batch.unsupportedSportTickets,
    batch.duplicateRecords,
  ];

  if (!counters.every(nonNegativeInteger)) {
    throw new Error(
      'Invalid ticket batch counters.'
    );
  }

  if (
    batch.ticketsReceived > 50 ||
    batch.ticketsSkipped !== batch.unsupportedSportTickets ||
    batch.ticketsModified + batch.ticketsNotModified !== batch.ticketsSaved ||
    batch.recoveredEventRecords > batch.ticketsReceived ||
    batch.differentSportTickets !== 0 ||
    batch.databaseModified !== (batch.ticketsModified > 0 || batch.recoveredEventRecords > 0) ||
    batch.ticketsSaved +
      batch.ticketsSkipped +
      batch.duplicateRecords !==
      batch.ticketsReceived
  ) {
    throw new Error(
      'Ticket batch reconciliation failed.'
    );
  }

  if (batch.complete === true) {
    if (
      batch.nextCursor !== null ||
      batch.hasNextPage !== false
    ) {
      throw new Error(
        'Invalid completed batch response.'
      );
    }

    return;
  }

  if (
    batch.complete !== false ||
    batch.hasNextPage !== true ||
    !batch.nextCursor ||
    batch.nextCursor.sport !== sport ||
    batch.nextCursor.mode !== mode ||
    batch.nextCursor.since !== sinceDate ||
    batch.nextCursor.page !== page + 1 ||
    batch.nextCursor.page > MAX_PAGE
  ) {
    throw new Error(
      'Invalid next ticket batch cursor.'
    );
  }
}

async function runBatch(
  request: NextRequest,
  sport: string,
  mode: SyncMode,
  page: number,
  sinceDate: string | null
): Promise<TicketBatch> {
  const deploymentHost =
    process.env.VERCEL_URL;

  if (
    !deploymentHost ||
    !/^[a-z0-9.-]+\.vercel\.app$/i.test(
      deploymentHost
    )
  ) {
    throw new Error(
      'Preview deployment URL unavailable.'
    );
  }

  const url = new URL(
    '/api/xs2event-ticket-sync',
    `https://${deploymentHost}`
  );

  url.searchParams.set('sport', sport);
  url.searchParams.set('mode', mode);
  url.searchParams.set('page', String(page));

  if (sinceDate !== null) {
    url.searchParams.set(
      'since',
      sinceDate
    );
  }

  const headers: Record<string, string> = {
    Authorization:
      `Bearer ${process.env.CRON_SECRET}`,
    Accept: 'application/json',
  };

  const bypassSecret =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    request.headers.get(
      'x-vercel-protection-bypass'
    );

  if (bypassSecret) {
    headers['x-vercel-protection-bypass'] =
      bypassSecret;
  }

  const response = await fetch(
    url.toString(),
    {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS
      ),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Ticket batch returned HTTP ${response.status}.`
    );
  }

  const batch =
    (await response.json()) as TicketBatch;

  validateBatch(
    batch,
    sport,
    mode,
    page,
    sinceDate
  );

  return batch;
}

export async function GET(
  request: NextRequest
) {
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

  const requestedSport =
    request.nextUrl.searchParams.get(
      'sport'
    ) ?? DEFAULT_SPORT;

  if (requestedSport !== DEFAULT_SPORT) {
    return json(requestedSport, 
      {
        ok: false,
        error:
          'Only consolidated all-sport synchronisation is supported.',
      },
      400
    );
  }

  const runStartedAt = Date.now();

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq(
        'source_environment',
        ENVIRONMENT
      )
      .eq('sport_type', requestedSport)
      .single();

    if (error || !data) {
      throw new Error(
        'Unable to read ticket synchronisation progress.'
      );
    }

    const row = data as ProgressRow;
    const now = Date.now();

    if (
      row.locked_until &&
      Date.parse(row.locked_until) > now
    ) {
      return json(requestedSport, {
        ok: true,
        status: 'busy',
        message:
          'Ticket synchronisation is already running.',
        nextPage: row.next_page,
      });
    }

    if (
      row.next_retry_at &&
      Date.parse(row.next_retry_at) > now
    ) {
      return json(requestedSport, {
        ok: true,
        status: 'waiting_for_retry',
        nextRetryAt: row.next_retry_at,
        nextPage: row.next_page,
      });
    }

    if (
      row.status === 'completed' &&
      row.cycle_started_at &&
      now - Date.parse(
        row.cycle_started_at
      ) < REFRESH_INTERVAL_MS
    ) {
      return json(requestedSport, {
        ok: true,
        status: 'idle',
        message:
          'Next ticket synchronisation is not yet due.',
        lastCompletedAt:
          row.last_completed_at,
      });
    }

    const newCycle =
      !row.cycle_id ||
      row.status === 'completed';

    const startedAt =
      new Date().toISOString();

    const lockToken = randomUUID();

    const cycleId = newCycle
      ? randomUUID()
      : row.cycle_id;

    const cycleStartedAt = newCycle
      ? startedAt
      : row.cycle_started_at;

    if (!cycleId || !cycleStartedAt) {
      throw new Error(
        'Invalid ticket synchronisation cycle.'
      );
    }

    const mode: SyncMode = newCycle
      ? (!row.last_full_completed_at || now - Date.parse(row.last_full_completed_at) >= FULL_INTERVAL_MS)
        ? 'full'
        : 'incremental'
      : row.sync_mode;

    let stage = newCycle ? 'fetching' : row.sync_stage;
    if (stage !== 'fetching' && (stage !== 'reconciling' || mode !== 'full')) {
      throw new Error('Invalid synchronisation stage.');
    }

    const sinceDate =
      mode === 'incremental'
        ? newCycle
          ? incrementalSinceDate(
              row.last_successful_watermark ??
              row.last_full_completed_at ??
              cycleStartedAt
            )
          : row.since_date
        : null;

    if (
      mode === 'incremental' &&
      !sinceDate
    ) {
      throw new Error(
        'Incremental synchronisation date unavailable.'
      );
    }

    let page = newCycle
      ? 1
      : row.next_page;

    let pagesProcessed = newCycle
      ? 0
      : row.pages_processed;

    let ticketsReceived = newCycle
      ? 0
      : row.tickets_received;

    let ticketsSaved = newCycle
      ? 0
      : row.tickets_saved;

    let ticketsSkipped = newCycle
      ? 0
      : row.tickets_skipped;

    let duplicateRecords = newCycle
      ? 0
      : row.duplicate_records;

    let consecutiveFailures = newCycle
      ? 0
      : row.consecutive_failures;

    const {
      data: claimed,
      error: claimError,
    } = await supabase
      .from(TABLE)
      .update({
        status: 'running',
        sync_mode: mode,
        sync_stage: stage,
        since_date: sinceDate,
        cycle_id: cycleId,
        cycle_started_at: cycleStartedAt,
        next_page: page,
        pages_processed: pagesProcessed,
        tickets_received: ticketsReceived,
        tickets_saved: ticketsSaved,
        tickets_skipped: ticketsSkipped,
        duplicate_records: duplicateRecords,
        consecutive_failures:
          consecutiveFailures,
        next_retry_at: null,
        lock_token: lockToken,
        locked_until: new Date(
          Date.now() + LOCK_DURATION_MS
        ).toISOString(),
        updated_at: startedAt,
      })
      .eq(
        'source_environment',
        ENVIRONMENT
      )
      .eq('sport_type', requestedSport)
      .eq('updated_at', row.updated_at)
      .or(
        `locked_until.is.null,locked_until.lte.${startedAt}`
      )
      .select('sport_type')
      .maybeSingle();

    if (claimError) {
      throw new Error(
        'Unable to acquire ticket synchronisation lock.'
      );
    }

    if (!claimed) {
      return json(requestedSport, {
        ok: true,
        status: 'busy',
        message:
          'Another controller acquired the lock.',
      });
    }

    let runPagesProcessed = 0;
    let runTicketsReceived = 0;
    let runTicketsSaved = 0;
    let runTicketsModified = 0;
    let runTicketsNotModified = 0;
    let runRecoveredEventRecords = 0;
    let runDifferentSportTickets = 0;
    let runUnsupportedSportTickets = 0;
    let totalSupplierRecords:
      number | null = null;

    let complete = false;

    try {
      while (
        stage === 'fetching' &&
        runPagesProcessed <
          MAX_PAGES_PER_RUN &&
        Date.now() - runStartedAt <
          RUN_BUDGET_MS
      ) {
        const batch = await runBatch(
          request,
          requestedSport,
          mode,
          page,
          sinceDate
        );

        const finishedAt =
          new Date().toISOString();

        const nextPage = batch.complete
          ? 1
          : batch.nextCursor!.page;

        const nextPagesProcessed =
          pagesProcessed + 1;

        const nextTicketsReceived =
          ticketsReceived +
          batch.ticketsReceived;

        const nextTicketsSaved =
          ticketsSaved +
          batch.ticketsSaved;

        const nextTicketsSkipped =
          ticketsSkipped +
          batch.ticketsSkipped;

        const nextDuplicateRecords =
          duplicateRecords +
          batch.duplicateRecords;

        const progressUpdate:
          Record<string, unknown> = {
            status: batch.complete && mode === 'incremental'
              ? 'completed'
              : 'running',
            sync_stage: batch.complete && mode === 'full' ? 'reconciling' : 'fetching',

            next_page: nextPage,

            pages_processed:
              nextPagesProcessed,

            tickets_received:
              nextTicketsReceived,

            tickets_saved:
              nextTicketsSaved,

            tickets_skipped:
              nextTicketsSkipped,

            duplicate_records:
              nextDuplicateRecords,

            consecutive_failures: 0,

            last_batch_at: finishedAt,

            next_retry_at: null,

            last_error: null,

            updated_at: finishedAt,
          };

        if (batch.complete && mode === 'incremental') {
          progressUpdate.last_completed_at =
            finishedAt;

          progressUpdate.last_successful_watermark =
            cycleStartedAt;

          progressUpdate.lock_token = null;

          progressUpdate.locked_until = null;

          progressUpdate.last_incremental_completed_at =
            finishedAt;
        }

        const {
          data: updated,
          error: updateError,
        } = await supabase
          .from(TABLE)
          .update(progressUpdate)
          .eq(
            'source_environment',
            ENVIRONMENT
          )
          .eq('sport_type', requestedSport)
          .eq('lock_token', lockToken)
          .select('sport_type')
          .maybeSingle();

        if (updateError || !updated) {
          throw new Error(
            'Unable to save ticket batch progress.'
          );
        }

        pagesProcessed =
          nextPagesProcessed;

        ticketsReceived =
          nextTicketsReceived;

        ticketsSaved =
          nextTicketsSaved;

        ticketsSkipped =
          nextTicketsSkipped;

        duplicateRecords =
          nextDuplicateRecords;

        consecutiveFailures = 0;

        runPagesProcessed++;

        runTicketsReceived +=
          batch.ticketsReceived;

        runTicketsSaved +=
          batch.ticketsSaved;
        runTicketsModified += batch.ticketsModified;
        runTicketsNotModified += batch.ticketsNotModified;
        runRecoveredEventRecords += batch.recoveredEventRecords;
        runDifferentSportTickets += batch.differentSportTickets;
        runUnsupportedSportTickets += batch.unsupportedSportTickets;

        totalSupplierRecords =
          batch.totalSupplierRecords;

        page = nextPage;

        if (batch.complete && mode === 'full') stage = 'reconciling';
        complete = batch.complete && mode === 'incremental';

        if (batch.complete) {
          break;
        }
      }

      let reconciliation: Record<string, unknown> | null = null;
      if (stage === 'reconciling' && runPagesProcessed === 0) {
        const host = process.env.VERCEL_URL;
        if (!host || !/^[a-z0-9.-]+\.vercel\.app$/i.test(host)) {
          throw new Error('Preview deployment URL unavailable.');
        }
        const url = new URL('/api/xs2event-ticket-sync/reconcile', `https://${host}`);
        url.searchParams.set('cutoff', cycleStartedAt);
        url.searchParams.set('apply', 'true');
        url.searchParams.set('automatic', 'true');
        url.searchParams.set('cycleId', cycleId);
        const headers: Record<string, string> = {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
          Accept: 'application/json',
          'x-sync-lock-token': lockToken,
        };
        const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || request.headers.get('x-vercel-protection-bypass');
        if (bypass) headers['x-vercel-protection-bypass'] = bypass;
        const response = await fetch(url, {
          method: 'GET', headers, cache: 'no-store', redirect: 'error',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`Reconciliation returned HTTP ${response.status}.`);
        const result = await response.json();
        if (result.ok !== true || result.dryRun !== false ||
            result.automatic !== true || result.cycleId !== cycleId ||
            result.mode !== 'missing_ticket_reconciliation' ||
            typeof result.cutoff !== 'string' || Date.parse(result.cutoff) !== Date.parse(cycleStartedAt) ||
            result.testMode !== true || result.supplierEnvironment !== ENVIRONMENT ||
            result.customerOrdersModified !== false || result.supplierReservationsCreated !== false ||
            result.supplierOrdersCreated !== false || result.unresolved !== 0 ||
            result.concurrentChanges !== 0 || !nonNegativeInteger(result.remainingCandidates) ||
            typeof result.complete !== 'boolean' || result.complete !== (result.remainingCandidates === 0)) {
          throw new Error('Unexpected or unsafe reconciliation response.');
        }
        reconciliation = result;
        const finishedAt = new Date().toISOString();
        const patch: Record<string, unknown> = {
          status: result.complete ? 'completed' : 'pending',
          sync_stage: result.complete ? 'fetching' : 'reconciling',
          consecutive_failures: 0, last_error: null, next_retry_at: null,
          last_batch_at: finishedAt, updated_at: finishedAt,
          lock_token: null, locked_until: null,
        };
        if (result.complete) {
          patch.last_completed_at = finishedAt;
          patch.last_full_completed_at = finishedAt;
          patch.last_successful_watermark = cycleStartedAt;
        }
        const { data: saved, error: saveError } = await supabase.from(TABLE)
          .update(patch).eq('source_environment', ENVIRONMENT)
          .eq('sport_type', requestedSport).eq('lock_token', lockToken)
          .select('sport_type').maybeSingle();
        if (saveError || !saved) throw new Error('Unable to save reconciliation progress.');
        complete = result.complete;
        if (complete) stage = 'fetching';
      }

      if (!complete && reconciliation === null) {
        const {
          data: released,
          error: releaseError,
        } = await supabase
          .from(TABLE)
          .update({
            status: 'pending',
            lock_token: null,
            locked_until: null,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'source_environment',
            ENVIRONMENT
          )
          .eq('sport_type', requestedSport)
          .eq('lock_token', lockToken)
          .select('sport_type')
          .maybeSingle();

        if (releaseError || !released) {
          throw new Error(
            'Unable to release ticket synchronisation lock.'
          );
        }
      }

      return json(requestedSport, {
        ok: true,

        mode: 'ticket_sync_controller',

        syncMode: mode,
        syncStage: stage,
        reconciliation,

        status: complete
          ? 'completed'
          : 'pending',

        cycleId,

        cycleStartedAt,

        sinceDate,

        runPagesProcessed,

        runTicketsReceived,

        runTicketsSaved,
        runTicketsModified,
        runTicketsNotModified,
        runRecoveredEventRecords,
        runDifferentSportTickets,
        runUnsupportedSportTickets,

        totalPagesProcessed:
          pagesProcessed,

        totalTicketsReceived:
          ticketsReceived,

        totalTicketsSaved:
          ticketsSaved,

        totalTicketsSkipped:
          ticketsSkipped,

        totalDuplicateRecords:
          duplicateRecords,

        totalSupplierRecords,

        nextPage: complete || stage === 'reconciling'
          ? null
          : page,

        complete,

        durationMs:
          Date.now() - runStartedAt,

        checkedAt:
          new Date().toISOString(),
      });
    } catch (batchError) {
      const failureCount =
        consecutiveFailures + 1;

      const retryDelay = Math.min(
        MAX_RETRY_DELAY_MS,
        60 * 1000 *
          Math.pow(
            2,
            Math.min(
              failureCount - 1,
              10
            )
          )
      );

      const failedAt =
        new Date().toISOString();

      const nextRetryAt = new Date(
        Date.now() + retryDelay
      ).toISOString();

      const message =
        batchError instanceof Error
          ? batchError.message
          : 'Unknown ticket batch error.';

      const {
        data: released,
        error: releaseError,
      } = await supabase
        .from(TABLE)
        .update({
          status: 'failed',

          consecutive_failures:
            failureCount,

          last_batch_at: failedAt,

          next_retry_at: nextRetryAt,

          last_error:
            message.slice(0, 500),

          lock_token: null,

          locked_until: null,

          updated_at: failedAt,
        })
        .eq(
          'source_environment',
          ENVIRONMENT
        )
        .eq('sport_type', requestedSport)
        .eq('lock_token', lockToken)
        .select('sport_type')
        .maybeSingle();

      console.error(
        '[XS2Event ticket controller]',
        message
      );

      return json(requestedSport, 
        {
          ok: false,

          mode: 'ticket_sync_controller',

          syncMode: mode,

          status: 'failed',

          cycleId,

          failedPage: page,

          runPagesProcessed,
          runTicketsReceived,
          runTicketsSaved,
          runTicketsModified,
          runTicketsNotModified,
          runRecoveredEventRecords,
          runDifferentSportTickets,
        runUnsupportedSportTickets,

          totalPagesProcessed:
            pagesProcessed,

          totalTicketsSaved:
            ticketsSaved,

          consecutiveFailures:
            failureCount,

          nextRetryAt,

          failureStateSaved:
            !releaseError &&
            Boolean(released),

          complete: false,

          durationMs:
            Date.now() - runStartedAt,
        },
        503
      );
    }
  } catch (error) {
    console.error(
      '[XS2Event ticket controller]',
      error instanceof Error
        ? error.message
        : 'Unknown controller error.'
    );

    return json(requestedSport, 
      {
        ok: false,
        status: 'failed',
        error:
          'Ticket synchronisation controller failed.',
        complete: false,
      },
      503
    );
  }
}
