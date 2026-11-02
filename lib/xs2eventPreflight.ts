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
  options?: { pairs_only?: boolean } | null;
};

type TicketList = {
  tickets?: SupplierTicket[];
  pagination?: { next_page?: string | null };
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

/** Read-only supplier verification. Does not reserve, book or charge. */
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
  const fail = (code: string, message: string, extra: Partial<PreflightResult> = {}): PreflightResult =>
    ({ ...base, ok: false, code, message, ...extra });

  if (!SAFE_ID.test(input.eventId) || !SAFE_ID.test(input.ticketId)) {
    return fail('INVALID_ID', 'A valid event ID and ticket ID are required.');
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) {
    return fail('INVALID_QUANTITY', 'Quantity must be a whole number between 1 and 10.');
  }

  // Fetch fresh test API data. Never trust price, stock or currency from the browser.
  // Search by event ID, then match the ticket ID ourselves. This uses the same
  // event_id filter already used by the working Formula 1 ticket page.
  let found: SupplierTicket | undefined;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      event_id: input.eventId,
      page_size: String(PAGE_SIZE),
      page: String(page),
    });
    const data = await xs2eventGet<TicketList>(`/tickets?${params.toString()}`);
    const tickets = Array.isArray(data.tickets) ? data.tickets : [];
    found = tickets.find(t => t.ticket_id === input.ticketId && t.event_id === input.eventId);
    if (found) break;
    if (tickets.length < PAGE_SIZE || !data.pagination?.next_page) break;
  }
  if (!found) {
    return fail('TICKET_NOT_FOUND', 'Ticket not found in the checked supplier pages. No reservation was made.');
  }

  const stock = found.stock;
  const minOrder = found.min_order ?? 1;
  const pairsOnly = found.options?.pairs_only === true;
  const currency = found.currency_code;
  const netRateValid = typeof found.net_rate === 'number' &&
    Number.isSafeInteger(found.net_rate) && found.net_rate > 0;
  const details = {
    availableStock: typeof stock === 'number' ? stock : undefined,
    minimumOrder: minOrder,
    pairsOnly,
    supplierCurrency: currency,
    supplierNetRateValid: netRateValid,
  };

  if (found.ticket_status !== 'available') {
    return fail('UNAVAILABLE', 'Supplier ticket is not marked available.', details);
  }
  if (!Number.isSafeInteger(stock) || (stock as number) < input.quantity) {
    return fail('INSUFFICIENT_STOCK', 'Supplier stock is insufficient or unknown.', details);
  }
  if (!Number.isSafeInteger(minOrder) || minOrder < 1 || input.quantity < minOrder) {
    return fail('MINIMUM_ORDER', 'Quantity does not meet the supplier minimum order.', details);
  }
  if (pairsOnly && input.quantity % 2 !== 0) {
    return fail('PAIRS_ONLY', 'This ticket must be ordered in pairs.', details);
  }
  // Current website pricing supports EUR and GBP supplier net rates only.
  if (!['EUR', 'GBP'].includes(currency ?? '') || !netRateValid) {
    return fail('INVALID_SUPPLIER_PRICE', 'Supplier currency or net rate is not usable.', details);
  }

  return {
    ...base,
    ...details,
    ok: true,
    code: 'PREFLIGHT_PASSED',
    message: 'Latest supplier ticket checks passed. This is not a reservation or price guarantee.',
  };
}
