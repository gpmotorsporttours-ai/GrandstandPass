
import 'server-only';

const XS2EVENT_TEST_URL =
  'https://testapi.xs2event.com/v1';

type XS2EventEnvironment = 'test' | 'production';

type XS2EventOptions = {
  environment?: XS2EventEnvironment;
};

export class XS2EventAPIError extends Error {
  status: number;

  constructor(status: number) {
    super(
      `XS2Event API request failed with status ${status}`
    );

    this.name = 'XS2EventAPIError';
    this.status = status;
  }
}

export async function xs2eventGet<T = unknown>(
  endpoint: string,
  options: XS2EventOptions = {}
): Promise<T> {
  const environment = options.environment ?? 'test';

  if (environment !== 'test') {
    throw new Error(
      'Production XS2Event access is not enabled yet.'
    );
  }

  const apiKey = process.env.XS2EVENT_API_KEY;

  if (!apiKey) {
    throw new Error(
      'XS2Event API key is not configured yet.'
    );
  }

  if (
    !endpoint.startsWith('/') ||
    endpoint.startsWith('//')
  ) {
    throw new Error(
      'XS2Event endpoint must begin with a single slash.'
    );
  }

  const url = new URL(
    XS2EVENT_TEST_URL + endpoint
  );

  if (
    url.origin !== 'https://testapi.xs2event.com' ||
    !url.pathname.startsWith('/v1/') ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'Invalid XS2Event API endpoint.'
    );
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Api-Key': apiKey,
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new XS2EventAPIError(response.status);
  }

  return (await response.json()) as T;
}

export async function getXS2EventSports() {
  return xs2eventGet('/sports');
}
