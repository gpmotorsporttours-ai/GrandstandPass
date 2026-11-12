
import 'server-only';

/**
 * XS2Event reservation draft validation.
 *
 * This module does not contact XS2Event,
 * create a reservation, or charge a customer.
 *
 * sales_price is deliberately excluded until
 * its unit/total semantics are confirmed.
 */

export type ReservationDraftInput = {
  ticketId: string;
  eventId: string;
  quantity: number;
  supplierNetRateMinor: number;
  supplierCurrency: string;
  bookingEmail: string;
  orderReference: string;
};

export type ReservationDraftResult = {
  ok: boolean;
  code: string;
  message: string;
  draft?: {
    items: Array<{
      ticket_id: string;
      quantity: number;
      net_rate: number;
      currency_code: string;
    }>;
    booking_email: string;
    external_reference_id: string;
    target_currency: string;
  };
  totals?: {
    supplierUnitNetMinor: number;
    supplierTotalNetMinor: number;
    currency: string;
  };
  readyForSupplierSubmission: false;
};

const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;
const SAFE_REFERENCE = /^[A-Za-z0-9_-]{1,100}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function failed(message: string): ReservationDraftResult {
  return {
    ok: false,
    code: 'INVALID_RESERVATION_DRAFT',
    message,
    readyForSupplierSubmission: false,
  };
}

export function validateXS2EventReservationDraft(
  input: ReservationDraftInput
): ReservationDraftResult {
  if (
    !SAFE_ID.test(input.ticketId) ||
    !SAFE_ID.test(input.eventId)
  ) {
    return failed('Invalid ticket or event ID.');
  }

  if (
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 10
  ) {
    return failed('Invalid ticket quantity.');
  }

  if (
    !Number.isSafeInteger(input.supplierNetRateMinor) ||
    input.supplierNetRateMinor <= 0
  ) {
    return failed('Invalid supplier net rate.');
  }

  if (
    input.supplierCurrency !== 'EUR' &&
    input.supplierCurrency !== 'GBP'
  ) {
    return failed('Unsupported supplier currency.');
  }

  if (
    typeof input.bookingEmail !== 'string' ||
    input.bookingEmail.length > 254 ||
    !EMAIL.test(input.bookingEmail)
  ) {
    return failed('Invalid booking email.');
  }

  if (
    typeof input.orderReference !== 'string' ||
    !SAFE_REFERENCE.test(input.orderReference)
  ) {
    return failed('Invalid order reference.');
  }

  const supplierTotalNetMinor =
    input.supplierNetRateMinor * input.quantity;

  if (!Number.isSafeInteger(supplierTotalNetMinor)) {
    return failed('Supplier total exceeds safe limits.');
  }

  return {
    ok: true,
    code: 'RESERVATION_DRAFT_VALID',
    message:
      'Reservation draft fields are valid. ' +
      'Supplier submission is not enabled.',

    draft: {
      items: [
        {
          ticket_id: input.ticketId,
          quantity: input.quantity,
          net_rate: input.supplierNetRateMinor,
          currency_code: input.supplierCurrency,
        },
      ],
      booking_email: input.bookingEmail,
      external_reference_id: input.orderReference,
      target_currency: input.supplierCurrency,
    },

    totals: {
      supplierUnitNetMinor: input.supplierNetRateMinor,
      supplierTotalNetMinor,
      currency: input.supplierCurrency,
    },

    readyForSupplierSubmission: false,
  };
}
