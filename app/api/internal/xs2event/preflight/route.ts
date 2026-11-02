import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { preflightXS2EventTicket } from '../../../../../lib/xs2eventPreflight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

// Internal admin-only read-only diagnostic. Do not call from browser/cart.
export async function POST(request: NextRequest) {
  if (process.env.XS2EVENT_PREFLIGHT_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Preflight is disabled.' }, { status: 404 });
  }

  const secret = process.env.XS2EVENT_PREFLIGHT_SECRET;
  if (!secret || secret.length < 32 ||
      !secretMatches(request.headers.get('x-preflight-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (typeof input.eventId !== 'string' || typeof input.ticketId !== 'string' ||
      typeof input.quantity !== 'number') {
    return NextResponse.json({ error: 'eventId, ticketId and quantity are required.' }, { status: 400 });
  }

  try {
    const result = await preflightXS2EventTicket({
      eventId: input.eventId,
      ticketId: input.ticketId,
      quantity: input.quantity,
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : 422,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('XS2Event preflight failed', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ error: 'Supplier verification unavailable.' }, { status: 502 });
  }
}
