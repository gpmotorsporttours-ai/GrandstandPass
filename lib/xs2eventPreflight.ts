
import 'server-only';

import { xs2eventGet } from './xs2event';

type SupplierTicket = {
  ticket_id?: string;
  event_id?: string;
  ticket_status?: string;
  stock?: number | null;
  min_order?: number | null;
  net_rate?: number | null;
  currency_code?: string;
  options?: {
    pairs_only?: boolean;
  } | null;
};

type TicketList = {
  tickets?: SupplierTicket[];
  pagination?: {
    next_page?: string | null;
  };
};

export type PreflightInput = {
  eventId: string;
  ticketId: string;
  quantity: number;
};

export type PreflightResult = {
  ok: boolean;
  code: string;
  message: string;
  checkedAt: string;
  ticketId: string;
  eventId: string;
  requestedQuantity: number;
  availableStock?: number;
  minimumOrder?: number;
  pairsOnly?: boolean;
  supplierCurrency?: string;
  supplierNetRateValid?: boolean;
};

const MAX_PAGES = 5;
const PAGE_SIZE = 50;
const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;

/**
 * Grandstand Pass — XS2Event test ticket preflight.
 *
 * Read-only supplier verification.
 *
 * This function:
 * - Retrieves fresh ticket data from XS2Event TEST.
 * - Checks ticket identity and event association.
 * - Checks availability and stock.
 * - Checks minimum order and pairs-only rules.
 * - Validates supplier currency and net rate.
 *
 * This function does NOT:
 * - Reserve tickets.
 * - Create supplier bookings.
 * - Process payments.
 * - Guarantee a customer selling price.
 */

export async function preflightXS2EventTicket(
  input: PreflightInput
): Promise<PreflightResult> {
  const checkedAt = new Date().toISOString();

  const base = {
    checkedAt,
    ticketId: input.ticketId,
    eventId: input.eventId,
    requestedQuantity: input.quantity,
  };

  const fail = (
    code: string,
    message: string,
    extra: Partial<PreflightResult> = {}
  ): PreflightResult => ({
    ...base,
    ok: false,
    code,
    message,
    ...extra,
  });

  // Validate supplier identifiers.
  if (
    !SAFE_ID.test(input.eventId) ||
    !SAFE_ID.test(input.ticketId)
  ) {
    return fail(
      'INVALID_ID',
      'A valid event ID and ticket ID are required.'
    );
  }

  // Limit test quantities to 1–10 tickets.
  if (
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 10
  ) {
    return fail(
      'INVALID_QUANTITY',
      'Quantity must be a whole number between 1 and 10.'
    );
  }

  /**
   * Retrieve current XS2Event test inventory.
   *
   * Use the same supplier filters as the working
   * Formula 1 ticket listing:
   *
   * event_id
   * ticket_status=available
   * stock=gt:0
   *
   * Never trust ticket prices or stock from the cart.
   */

  let found: SupplierTicket | undefined;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      event_id: input.eventId,
      ticket_status: 'available',
      stock: 'gt:0',
      page_size: String(PAGE_SIZE),
      page: String(page),
    });

    const data = await xs2eventGet<TicketList>(
      `/tickets?${params.toString()}`
    );

    const tickets = Array.isArray(data.tickets)
      ? data.tickets
      : [];

    /**
     * Some supplier responses may omit event_id
     * from individual ticket records.
     *
     * We rely on the supplier's event_id query
     * filter and reject any explicitly mismatched
     * event_id.
     *
     * Stronger identity verification will be
     * required before live reservations.
     */

    found = tickets.find(
      (ticket) =>
        ticket.ticket_id === input.ticketId &&
        (
          ticket.event_id == null ||
          ticket.event_id === input.eventId
        )
    );

    if (found) {
      break;
    }

    // Stop when there are no further supplier pages.
    if (
      tickets.length < PAGE_SIZE ||
      !data.pagination?.next_page
    ) {
      break;
    }
  }

  if (!found) {
    return fail(
      'TICKET_NOT_FOUND',
      'Ticket not found in the checked supplier pages. No reservation was made.'
    );
  }

  // Read the latest supplier ticket details.
  const stock = found.stock;
  const minOrder = found.min_order ?? 1;
  const pairsOnly = found.options?.pairs_only === true;
  const currency = found.currency_code;

  const netRateValid =
    typeof found.net_rate === 'number' &&
    Number.isSafeInteger(found.net_rate) &&
    found.net_rate > 0;

  const details = {
    availableStock:
      typeof stock === 'number'
        ? stock
        : undefined,
    minimumOrder: minOrder,
    pairsOnly,
    supplierCurrency: currency,
    supplierNetRateValid: netRateValid,
  };

  // Verify supplier ticket availability.
  if (found.ticket_status !== 'available') {
    return fail(
      'UNAVAILABLE',
      'Supplier ticket is not marked available.',
      details
    );
  }

  // Verify sufficient stock.
  if (
    !Number.isSafeInteger(stock) ||
    (stock as number) < input.quantity
  ) {
    return fail(
      'INSUFFICIENT_STOCK',
      'Supplier stock is insufficient or unknown.',
      details
    );
  }

  // Verify minimum-order restrictions.
  if (
    !Number.isSafeInteger(minOrder) ||
    minOrder < 1 ||
    input.quantity < minOrder
  ) {
    return fail(
      'MINIMUM_ORDER',
      'Quantity does not meet the supplier minimum order.',
      details
    );
  }

  // Verify pairs-only restrictions.
  if (
    pairsOnly &&
    input.quantity % 2 !== 0
  ) {
    return fail(
      'PAIRS_ONLY',
      'This ticket must be ordered in pairs.',
      details
    );
  }

  /**
   * Current Grandstand Pass pricing supports
   * EUR and GBP supplier net rates only.
   *
   * Supplier net_rate must be a positive
   * integer in minor currency units.
   */

  if (
    !['EUR', 'GBP'].includes(currency ?? '') ||
    !netRateValid
  ) {
    return fail(
      'INVALID_SUPPLIER_PRICE',
      'Supplier currency or net rate is not usable.',
      details
    );
  }

  // All read-only supplier checks passed.
  return {
    ...base,
    ...details,
    ok: true,
    code: 'PREFLIGHT_PASSED',
    message:
      'Latest supplier ticket checks passed. This is not a reservation or price guarantee.',
  };
}
