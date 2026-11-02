import 'server-only';

const XS2EVENT_TEST_URL = 'https://testapi.xs2event.com/v1';

type XS2EventEnvironment = 'test' | 'production';
type XS2EventOptions = { environment?: XS2EventEnvironment };

export class XS2EventAPIError extends Error {
  status: number;
  constructor(status: number) {
    super(`XS2Event API request failed with status ${status}`);
    this.name = 'XS2EventAPIError';
    this.status = status;
  }
}

function buildTestUrl(endpoint: string, options: XS2EventOptions): URL {
  const environment = options.environment ?? 'test';
  if (environment !== 'test') {
    throw new Error('Production XS2Event access is not enabled yet.');
  }
  if (!endpoint.startsWith('/') || endpoint.startsWith('//')) {
    throw new Error('XS2Event endpoint must begin with a single slash.');
  }
  const url = new URL(XS2EVENT_TEST_URL + endpoint);
  if (
    url.origin !== 'https://testapi.xs2event.com' ||
    !url.pathname.startsWith('/v1/') ||
    url.username ||
    url.password
  ) {
    throw new Error('Invalid XS2Event API endpoint.');
  }
  return url;
}

function getApiKey(): string {
  const apiKey = process.env.XS2EVENT_API_KEY;
  if (!apiKey) throw new Error('XS2Event API key is not configured yet.');
  return apiKey;
}

export async function xs2eventGet<T = unknown>(
  endpoint: string,
  options: XS2EventOptions = {}
): Promise<T> {
  const url = buildTestUrl(endpoint, options);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'X-Api-Key': getApiKey(), Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new XS2EventAPIError(response.status);
  return (await response.json()) as T;
}

// Server-only, narrowly scoped reservation creation. Do not call this directly
// from a customer-accessible route until authentication, rate limiting, and
// server-side ticket/price verification are implemented.
export type XS2EventReservationItem = {
  ticket_id: string;
  quantity: number;
  net_rate: number; // Supplier minor units, fetched from XS2Event, never the cart.
  currency_code: string;
  sales_price: number; // Confirm supplier API semantics before first POST.
};

export type XS2EventReservationResponse = {
  reservation_id?: string;
  status?: string;
  valid_until?: string;
  items?: unknown[];
};

export async function xs2eventCreateTestReservation(
  payload: {
    items: XS2EventReservationItem[];
    booking_email: string;
    target_currency?: string;
    external_reference_id?: string;
  }
): Promise<XS2EventReservationResponse> {
  if (process.env.XS2EVENT_ENABLE_TEST_RESERVATIONS !== 'true') {
    throw new Error('XS2Event test reservation creation is disabled.');
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('At least one reservation item is required.');
  }
  for (const item of payload.items) {
    if (
      !/^[a-zA-Z0-9_-]{1,150}$/.test(item.ticket_id) ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
      !Number.isSafeInteger(item.net_rate) || item.net_rate <= 0 ||
      !Number.isSafeInteger(item.sales_price) || item.sales_price <= 0 ||
      !/^[A-Z]{3}$/.test(item.currency_code)
    ) {
      throw new Error('Invalid reservation item.');
    }
  }
  if (
    typeof payload.booking_email !== 'string' ||
    payload.booking_email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.booking_email)
  ) {
    throw new Error('A valid booking email is required.');
  }
  const url = buildTestUrl('/reservations', { environment: 'test' });
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'X-Api-Key': getApiKey(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new XS2EventAPIError(response.status);
  return (await response.json()) as XS2EventReservationResponse;
}

export async function getXS2EventSports() {
  return xs2eventGet('/sports');
}
