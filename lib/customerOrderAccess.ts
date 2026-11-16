
import 'server-only';

import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

// Customer access tokens expire after 7 days.
const TOKEN_VALIDITY_DAYS = 7;
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export type CustomerOrderAccessToken = {
  token: string;
  tokenHash: string;
  expiresAt: string;
};

/**
 * Generate a cryptographically secure customer
 * order-access token.
 *
 * Only the SHA-256 hash should be stored in Supabase.
 * The original token must remain private.
 */
export function createCustomerOrderAccessToken():
  CustomerOrderAccessToken {
  const token = randomBytes(TOKEN_BYTES).toString('hex');

  const tokenHash = hashCustomerOrderAccessToken(token);

  const expiresAt = new Date(
    Date.now() +
      TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  return {
    token,
    tokenHash,
    expiresAt,
  };
}

/**
 * Hash a customer order-access token.
 */
export function hashCustomerOrderAccessToken(
  token: string
): string {
  return createHash('sha256')
    .update(token, 'utf8')
    .digest('hex');
}

/**
 * Verify a customer token against its stored hash
 * and expiration date.
 */
export function verifyCustomerOrderAccessToken(
  providedToken: unknown,
  storedHash: string | null,
  expiresAt: string | null
): boolean {
  if (
    typeof providedToken !== 'string' ||
    !TOKEN_PATTERN.test(providedToken) ||
    typeof storedHash !== 'string' ||
    !TOKEN_PATTERN.test(storedHash) ||
    typeof expiresAt !== 'string'
  ) {
    return false;
  }

  const expirationTime = Date.parse(expiresAt);

  if (
    !Number.isFinite(expirationTime) ||
    expirationTime <= Date.now()
  ) {
    return false;
  }

  const providedHash =
    hashCustomerOrderAccessToken(providedToken);

  const actual = Buffer.from(providedHash, 'hex');
  const expected = Buffer.from(storedHash, 'hex');

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}
