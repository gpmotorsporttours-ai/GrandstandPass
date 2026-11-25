import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ENVIRONMENT = 'test';
const TABLE = 'xs2event_sync_progress';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const SCHEDULING_TOLERANCE_MS = 15 * 1000;
const LOCK_DURATION_MS = 120 * 1000;
const BATCH_TIMEOUT_MS = 40 * 1000;
const NEXT_BATCH_START_LIMIT_MS = 10 * 1000;
const MAX_BATCHES_PER_RUN = 5;
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000;

const SPORTS = [
  'formula1',
  'motogp',
  'soccer',
  'tennis',
  'basketball',
  'nba',
  'golf',
  'horseracing',
  'nfl',
  'rugby',
] as const;

type Sport = (typeof SPORTS)[number];

type ProgressRow = {
  source_environment: string;
  sport_type: Sport;
  status: string;
  next_page: number;
  next_offset: number;
  events_processed: number;
  events_saved: number;
  events_skipped: number;
  availability_failures: number;
  consecutive_failures: number;
  cycle_id: string | null;
  cycle_started_at: string | null;
  last_batch_at: string | null;
  last_completed_at: string | null;
  next_retry_at: string | null;
  lock_token: string | null;
  locked_until: string | null;
  last_error: string | null;
  updated_at: string;
};

type BatchCursor = {
  sport: string;
  page: number;
  offset: number;
};

type BatchResult = {
  testMode: boolean;
  supplierEnvironment: string;
  sport: string;
  page: number;
  offset: number;
  eventsProcessed: number;
  eventsSaved: number;
  eventsSkipped: number;
  availabilityFailures: number;
  failedAvailabilityEventIds?: string[];
  nextCursor: BatchCursor | null;
  paginationLimitReached: boolean;
  complete: boolean;
  supplierReservationsCreated: boolean;
  supplierOrdersCreated: boolean;
};

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
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

  const supplied = Buffer.from(
    request.headers.get('authorization') ?? ''
  );

  const expected = Buffer.from(`Bearer ${secret}`);

  return (
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected)
  );
}

function isNonNegativeInteger(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isEligible(
  row: ProgressRow,
  now: number
): boolean {
  if (
    row.locked_until &&
    Date.parse(row.locked_until) > now
  ) {
    return false;
  }

  if (
    row.next_retry_at &&
    Date.parse(row.next_retry_at) > now
  ) {
    return false;
  }

  if (row.status === 'completed') {
    // Measure the refresh interval from the previous cycle's start,
    // not its completion. Never restart an unfinished cycle.
    const previousStart =
      row.cycle_started_at ?? row.last_completed_at;

    if (!previousStart) {
      return true;
    }

    const previousStartMs = Date.parse(previousStart);

    return (
      !Number.isFinite(previousStartMs) ||
      now - previousStartMs >=
        REFRESH_INTERVAL_MS - SCHEDULING_TOLERANCE_MS
    );
  }

  return ['pending', 'running', 'failed'].includes(
    row.status
  );
}

function validateBatch(
  batch: BatchResult,
  sport: Sport,
  page: number,
  offset: number
) {
  if (
    batch.testMode !== true ||
    batch.supplierEnvironment !== ENVIRONMENT ||
    batch.sport !== sport ||
    batch.page !== page ||
    batch.offset !== offset ||
    batch.supplierReservationsCreated !== false ||
    batch.supplierOrdersCreated !== false
  ) {
    throw new Error(
      'Unexpected or unsafe batch response.'
    );
  }

  const counters = [
    batch.eventsProcessed,
    batch.eventsSaved,
    batch.eventsSkipped,
    batch.availabilityFailures,
  ];

  if (!counters.every(isNonNegativeInteger)) {
    throw new Error('Invalid batch counters.');
  }

  if (batch.paginationLimitReached !== false) {
    throw new Error(
      'Supplier pagination limit reached.'
    );
  }

  if (batch.availabilityFailures > 0) {
    throw new Error(
      'One or more availability checks failed.'
    );
  }

  if (batch.complete === true) {
    if (batch.nextCursor !== null) {
      throw new Error(
        'Completed batch returned an unexpected cursor.'
      );
    }

    return;
  }

  if (batch.complete !== false) {
    throw new Error('Invalid completion status.');
  }

  const cursor = batch.nextCursor;

  if (
    !cursor ||
    cursor.sport !== sport ||
    !Number.isInteger(cursor.page) ||
    cursor.page < 1 ||
    cursor.page > 1000 ||
    !Number.isInteger(cursor.offset) ||
    cursor.offset < 0 ||
    cursor.offset > 49
  ) {
    throw new Error('Invalid next batch cursor.');
  }

  if (
    cursor.page < page ||
    (cursor.page === page && cursor.offset <= offset)
  ) {
    throw new Error(
      'Batch cursor did not advance.'
    );
  }
}

async function runBatch(
  request: NextRequest,
  sport: Sport,
  page: number,
  offset: number
): Promise<BatchResult> {
  const deploymentHost = process.env.VERCEL_URL;

  if (
    !deploymentHost ||
    !/^[a-z0-9.-]+\.vercel\.app$/i.test(
      deploymentHost
    )
  ) {
    throw new Error(
      'Preview deployment URL is unavailable.'
    );
  }

  const url = new URL(
    '/api/xs2event-sync',
    `https://${deploymentHost}`
  );

  url.searchParams.set('sport', sport);
  url.searchParams.set('page', String(page));
  url.searchParams.set('offset', String(offset));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.CRON_SECRET}`,
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

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(BATCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Batch endpoint returned HTTP ${response.status}.`
    );
  }

  const batch =
    (await response.json()) as BatchResult;

  validateBatch(batch, sport, page, offset);

  return batch;
}

export async function GET(request: NextRequest) {
  const invocationStartedAt = Date.now();

  if (process.env.VERCEL_ENV !== 'preview') {
    return json({ error: 'Not found.' }, 404);
  }

  if (process.env.XS2EVENT_SYNC_ENABLED !== 'true') {
    return json({ error: 'Not found.' }, 404);
  }

  if (!isAuthorised(request)) {
    return json({ error: 'Unauthorised.' }, 401);
  }

  const requestedSport =
    request.nextUrl.searchParams.get('sport');

  if (
    requestedSport &&
    !SPORTS.includes(requestedSport as Sport)
  ) {
    return json({ error: 'Invalid sport.' }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('source_environment', ENVIRONMENT);

    if (error) {
      throw new Error(
        'Unable to read synchronisation progress.'
      );
    }

    const rows = (data ?? []) as ProgressRow[];
    const now = Date.now();

    const eligible = rows
      .filter((row) => {
        return (
          SPORTS.includes(row.sport_type) &&
          (!requestedSport ||
            row.sport_type === requestedSport) &&
          isEligible(row, now)
        );
      })
      .sort((a, b) => {
        const aTime = a.last_batch_at
          ? Date.parse(a.last_batch_at)
          : 0;

        const bTime = b.last_batch_at
          ? Date.parse(b.last_batch_at)
          : 0;

        return (
          aTime - bTime ||
          SPORTS.indexOf(a.sport_type) -
            SPORTS.indexOf(b.sport_type)
        );
      });

    if (eligible.length === 0) {
      return json({
        ok: true,
        testMode: true,
        supplierEnvironment: ENVIRONMENT,
        mode: 'controller',
        status: 'idle',
        refreshIntervalMinutes: 5,
        message: 'No eligible batch is currently due.',
        supplierReservationsCreated: false,
        supplierOrdersCreated: false,
      });
    }

    for (const row of eligible) {
      const lockToken = randomUUID();
      const startedAt = new Date().toISOString();

      const newCycle =
        !row.cycle_id ||
        row.status === 'completed';

      const cycleId = newCycle
        ? randomUUID()
        : row.cycle_id;

      let page = newCycle ? 1 : row.next_page;
      let offset = newCycle ? 0 : row.next_offset;

      let processed = newCycle
        ? 0
        : row.events_processed;

      let saved = newCycle
        ? 0
        : row.events_saved;

      let skipped = newCycle
        ? 0
        : row.events_skipped;

      let failures = newCycle
        ? 0
        : row.availability_failures;

      let consecutiveFailures = newCycle
        ? 0
        : row.consecutive_failures;

      const { data: claimed, error: claimError } =
        await supabase
          .from(TABLE)
          .update({
            status: 'running',
            cycle_id: cycleId,
            cycle_started_at: newCycle
              ? startedAt
              : row.cycle_started_at,
            next_page: page,
            next_offset: offset,
            events_processed: processed,
            events_saved: saved,
            events_skipped: skipped,
            availability_failures: failures,
            consecutive_failures: consecutiveFailures,
            lock_token: lockToken,
            locked_until: new Date(
              Date.now() + LOCK_DURATION_MS
            ).toISOString(),
            next_retry_at: null,
            updated_at: startedAt,
          })
          .eq('source_environment', ENVIRONMENT)
          .eq('sport_type', row.sport_type)
          .eq('updated_at', row.updated_at)
          .or(
            `locked_until.is.null,locked_until.lte.${startedAt}`
          )
          .select('sport_type')
          .maybeSingle();

      if (claimError) {
        throw new Error(
          'Unable to acquire synchronisation lock.'
        );
      }

      if (!claimed) {
        continue;
      }

      let batchesCompleted = 0;
      let runProcessed = 0;
      let runSaved = 0;
      let runSkipped = 0;

      try {
        while (true) {
          const batch = await runBatch(
            request,
            row.sport_type,
            page,
            offset
          );

          const finishedAt =
            new Date().toISOString();

          const continueRun =
            !batch.complete &&
            batchesCompleted + 1 < MAX_BATCHES_PER_RUN &&
            Date.now() - invocationStartedAt <
              NEXT_BATCH_START_LIMIT_MS;

          const { data: updated, error: updateError } =
            await supabase
              .from(TABLE)
              .update({
                status: batch.complete
                  ? 'completed'
                  : continueRun
                    ? 'running'
                    : 'pending',

                next_page: batch.nextCursor?.page ?? 1,
                next_offset: batch.nextCursor?.offset ?? 0,

                events_processed:
                  processed + batch.eventsProcessed,

                events_saved:
                  saved + batch.eventsSaved,

                events_skipped:
                  skipped + batch.eventsSkipped,

                availability_failures:
                  failures + batch.availabilityFailures,

                consecutive_failures: 0,

                last_batch_at: finishedAt,

                last_completed_at: batch.complete
                  ? finishedAt
                  : row.last_completed_at,

                next_retry_at: null,
                last_error: null,

                lock_token: continueRun
                  ? lockToken
                  : null,

                locked_until: continueRun
                  ? new Date(
                      Date.now() + LOCK_DURATION_MS
                    ).toISOString()
                  : null,

                updated_at: finishedAt,
              })
              .eq('source_environment', ENVIRONMENT)
              .eq('sport_type', row.sport_type)
              .eq('lock_token', lockToken)
              .select('sport_type')
              .maybeSingle();

          if (updateError || !updated) {
            throw new Error(
              'Unable to save batch progress.'
            );
          }

          batchesCompleted++;

          runProcessed += batch.eventsProcessed;
          runSaved += batch.eventsSaved;
          runSkipped += batch.eventsSkipped;

          processed += batch.eventsProcessed;
          saved += batch.eventsSaved;
          skipped += batch.eventsSkipped;
          failures += batch.availabilityFailures;

          consecutiveFailures = 0;

          if (continueRun && batch.nextCursor) {
            page = batch.nextCursor.page;
            offset = batch.nextCursor.offset;

            continue;
          }

          return json({
            ok: true,
            testMode: true,
            supplierEnvironment: ENVIRONMENT,
            mode: 'controller',
            refreshIntervalMinutes: 5,

            batchesCompleted,

            runEventsProcessed: runProcessed,
            runEventsSaved: runSaved,
            runEventsSkipped: runSkipped,

            sport: row.sport_type,
            cycleId,

            status: batch.complete
              ? 'completed'
              : 'pending',

            page,
            offset,

            batchEventsProcessed:
              batch.eventsProcessed,

            batchEventsSaved:
              batch.eventsSaved,

            batchEventsSkipped:
              batch.eventsSkipped,

            totalEventsProcessed: processed,
            totalEventsSaved: saved,
            totalEventsSkipped: skipped,

            nextCursor: batch.nextCursor,
            complete: batch.complete,

            supplierReservationsCreated: false,
            supplierOrdersCreated: false,

            completedAt: finishedAt,
          });
        }
      } catch (batchError) {
        const failureCount =
          consecutiveFailures + 1;

        const retryDelay = Math.min(
          MAX_RETRY_DELAY_MS,
          60 * 1000 *
            Math.pow(
              2,
              Math.min(failureCount - 1, 10)
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
            : 'Unknown batch failure.';

        const { data: released, error: releaseError } =
          await supabase
            .from(TABLE)
            .update({
              status: 'failed',
              consecutive_failures: failureCount,
              last_batch_at: failedAt,
              next_retry_at: nextRetryAt,
              last_error: message.slice(0, 500),
              lock_token: null,
              locked_until: null,
              updated_at: failedAt,
            })
            .eq('source_environment', ENVIRONMENT)
            .eq('sport_type', row.sport_type)
            .eq('lock_token', lockToken)
            .select('sport_type')
            .maybeSingle();

        if (releaseError || !released) {
          console.error(
            '[XS2Event controller] Unable to save failure state.'
          );
        }

        console.error(
          '[XS2Event controller] Batch failed:',
          row.sport_type,
          message
        );

        return json(
          {
            ok: false,
            testMode: true,
            supplierEnvironment: ENVIRONMENT,
            mode: 'controller',
            refreshIntervalMinutes: 5,

            sport: row.sport_type,
            status: 'failed',

            page,
            offset,

            consecutiveFailures: failureCount,
            nextRetryAt,

            failureStateSaved:
              !releaseError && Boolean(released),

            batchesCompleted,
            cursorAdvanced: batchesCompleted > 0,

            supplierReservationsCreated: false,
            supplierOrdersCreated: false,
          },
          503
        );
      }
    }

    return json({
      ok: true,
      testMode: true,
      supplierEnvironment: ENVIRONMENT,
      mode: 'controller',
      refreshIntervalMinutes: 5,
      status: 'busy',
      message:
        'Eligible batches are already being processed.',
      supplierReservationsCreated: false,
      supplierOrdersCreated: false,
    });
  } catch (error) {
    console.error(
      '[XS2Event controller] Failed:',
      error instanceof Error
        ? error.message
        : 'Unknown error.'
    );

    return json(
      {
        ok: false,
        testMode: true,
        supplierEnvironment: ENVIRONMENT,
        mode: 'controller',
        error: 'Synchronisation controller failed.',
        supplierReservationsCreated: false,
        supplierOrdersCreated: false,
      },
      503
    );
  }
}
