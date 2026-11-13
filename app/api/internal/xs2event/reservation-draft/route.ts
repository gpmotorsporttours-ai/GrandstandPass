
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { preflightXS2EventTicket } from '../../../../../lib/xs2eventPreflight';
import { xs2eventGet } from '../../../../../lib/xs2event';
import { validateXS2EventReservationDraft } from '../../../../../lib/xs2eventReservationDraft';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER_REFERENCE_PATTERN =
  /^GP-TEST-[A-F0-9]{12}$/;

const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;

type StoredTicket = {
  eventId?: unknown;
  supplierTicketId?: unknown;
  quantity?: unknown;
  testOnly?: unknown;
};

type TestOrder = {
  order_reference: string;
  order_status: string;
  payment_provider: string;
  total_amount_minor: number;
  supplier_order_reference: string | null;
  supplier_reservation_id: string | null;
  supplier_reservation_attempt_id: string | null;
  items: unknown;
};

type SupplierTicketDetail = {
  ticket_id?: string;
  event_id?: string | null;
  ticket_status?: string;
  stock?: number | null;
  min_order?: number | null;
  net_rate?: number | null;
  currency_code?: string;
  options?: {
    pairs_only?: boolean;
  } | null;
};

function fail(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

function secretMatches(
  provided: string | null,
  expected: string
): boolean {
  if (!provided || !expected) return false;

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  return (
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

function formatMoney(
  minorUnits: number,
  currency: string
): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export async function POST(request: NextRequest) {
  // Preview-only internal diagnostic.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.XS2EVENT_PREFLIGHT_ENABLED !== 'true'
  ) {
    return fail('Reservation preview is disabled.', 404);
  }

  const secret = process.env.XS2EVENT_PREFLIGHT_SECRET;

  if (
    !secret ||
    secret.length < 32 ||
    !secretMatches(
      request.headers.get('x-preflight-secret'),
      secret
    )
  ) {
    return fail('Unauthorized.', 401);
  }

  if (
    !(request.headers.get('content-type') ?? '')
      .toLowerCase()
      .startsWith('application/json')
  ) {
    return fail('JSON content required.', 415);
  }

  let body: unknown;

  try {
    const raw = await request.text();

    if (Buffer.byteLength(raw, 'utf8') > 2000) {
      return fail('Request too large.', 413);
    }

    body = JSON.parse(raw);
  } catch {
    return fail('Invalid JSON.', 400);
  }

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return fail('Invalid request.', 400);
  }

  const { orderReference, bookingEmail } =
    body as Record<string, unknown>;

  if (
    typeof orderReference !== 'string' ||
    !ORDER_REFERENCE_PATTERN.test(orderReference)
  ) {
    return fail('Invalid test order reference.', 400);
  }

  if (
    typeof bookingEmail !== 'string' ||
    bookingEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      bookingEmail
    )
  ) {
    return fail('Invalid booking email.', 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_reference', orderReference)
      .maybeSingle();

    if (error) {
      console.error(
        'Reservation preview order read error:',
        error.code
      );

      return fail('Unable to read test order.', 500);
    }

    if (!data) {
      return fail('Test order not found.', 404);
    }

    const order = data as TestOrder;

    if (
      order.order_status !== 'payment_confirmed' ||
      order.payment_provider !== 'simulation' ||
      order.total_amount_minor !== 0
    ) {
      return fail('Test order is not eligible.', 409);
    }

    // Allow an existing claim for read-only inspection.
    // Never create or modify a claim here.
    if (
      order.supplier_order_reference ||
      order.supplier_reservation_id
    ) {
      return fail(
        'Test order already has supplier processing.',
        409
      );
    }

    if (
      !Array.isArray(order.items) ||
      order.items.length !== 1
    ) {
      return fail(
        'Exactly one test ticket item is required.',
        422
      );
    }

    const ticket =
      order.items[0] as StoredTicket | null;

    if (
      !ticket ||
      typeof ticket !== 'object' ||
      Array.isArray(ticket) ||
      typeof ticket.eventId !== 'string' ||
      !SAFE_ID.test(ticket.eventId) ||
      typeof ticket.supplierTicketId !== 'string' ||
      !SAFE_ID.test(ticket.supplierTicketId) ||
      typeof ticket.quantity !== 'number' ||
      !Number.isSafeInteger(ticket.quantity) ||
      ticket.quantity < 1 ||
      ticket.quantity > 10 ||
      ticket.testOnly !== true
    ) {
      return fail(
        'Stored test ticket details are invalid.',
        422
      );
    }

    // Fresh read-only XS2Event TEST verification.
    const preflight =
      await preflightXS2EventTicket({
        eventId: ticket.eventId,
        ticketId: ticket.supplierTicketId,
        quantity: ticket.quantity,
      });

    if (
      !preflight.ok ||
      preflight.supplierNetRateValid !== true ||
      typeof preflight.supplierNetRateMinor !== 'number' ||
      !preflight.supplierCurrency
    ) {
      return fail(
        'Supplier preflight verification failed.',
        422
      );
    }

    const detail =
      await xs2eventGet<SupplierTicketDetail>(
        `/tickets/${encodeURIComponent(
          ticket.supplierTicketId
        )}`
      );

    if (
      !detail ||
      typeof detail !== 'object' ||
      Array.isArray(detail) ||
      detail.ticket_id !== ticket.supplierTicketId ||
      detail.event_id !== ticket.eventId ||
      detail.ticket_status !== 'available' ||
      typeof detail.stock !== 'number' ||
      !Number.isSafeInteger(detail.stock) ||
      detail.stock < ticket.quantity ||
      !Number.isSafeInteger(detail.min_order ?? 1) ||
      (detail.min_order ?? 1) < 1 ||
      ticket.quantity < (detail.min_order ?? 1) ||
      (
        detail.options?.pairs_only === true &&
        ticket.quantity % 2 !== 0
      ) ||
      detail.currency_code !==
        preflight.supplierCurrency ||
      detail.net_rate !==
        preflight.supplierNetRateMinor
    ) {
      return fail(
        'Supplier ticket details do not match preflight.',
        422
      );
    }

    const result =
      validateXS2EventReservationDraft({
        ticketId: ticket.supplierTicketId,
        eventId: ticket.eventId,
        quantity: ticket.quantity,
        supplierNetRateMinor:
          preflight.supplierNetRateMinor,
        supplierCurrency:
          preflight.supplierCurrency,
        bookingEmail,
        orderReference,
      });

    if (
      !result.ok ||
      !result.totals ||
      !result.indicativePricing
    ) {
      return fail(
        result.message ||
          'Reservation pricing validation failed.',
        422
      );
    }

    const pricing = result.indicativePricing;
    const currency = pricing.currency;

    // Display-only preview.
    // Do not construct or submit a supplier
    // reservation payload containing sales_price.
    const reservationPreview = {
      orderReference,
      eventId: ticket.eventId,
      ticketId: ticket.supplierTicketId,
      quantity: ticket.quantity,
      currency,

      supplierUnitNet: formatMoney(
        pricing.supplierUnitNetMinor,
        currency
      ),

      supplierTotalNet: formatMoney(
        result.totals.supplierTotalNetMinor,
        currency
      ),

      handlingPerTicket: formatMoney(
        pricing.handlingUnitMinor,
        currency
      ),

      markupPerTicket: formatMoney(
        pricing.markupUnitMinor,
        currency
      ),

      indicativeSellingUnit: formatMoney(
        pricing.sellingUnitMinor,
        currency
      ),

      indicativeSellingTotal: formatMoney(
        pricing.sellingTotalMinor,
        currency
      ),

      markupPercent: pricing.markupPercent,
      availableStock: detail.stock,
      supplierVerified: true,
      simulatedPaymentConfirmed: true,
      customerPriceConfirmed: false,
      readyForSupplierSubmission: false,
      reservationCreated: false,
    };

    return NextResponse.json(
      {
        ok: true,
        mode: 'reservation_preview',
        reservationPreview,
        validation: result,
        alreadyClaimed: Boolean(
          order.supplier_reservation_attempt_id
        ),
        message:
          'Read-only reservation preview generated. ' +
          'No supplier reservation was created.',
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error(
      'Reservation preview error:',
      error instanceof Error
        ? error.name
        : 'Unknown'
    );

    return fail(
      'Reservation preview unavailable.',
      502
    );
  }
}
