
import 'server-only';

import {
  calculateSupplierTicketPrice,
} from './supplierPricing';

/**
 * XS2Event reservation draft validation.
 *
 * Calculates indicative customer prices using
 * the existing Grandstand Pass pricing rules.
 *
 * No supplier reservations, bookings,
 * payments or database writes occur here.
 *
 * sales_price is deliberately excluded until
 * its API semantics have been confirmed.
 */

export type ReservationDraftInput = {
  ticketId: string;
  eventId: string;
  quantity: number;
  supplierNetRateMinor: number;
  supplierCurrency: string;
  bookingEmail: string;
  orderReference: string;
  eurToSupplierRate?: number;
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

  indicativePricing?: {
    currency: string;
    supplierUnitNetMinor: number;
    handlingUnitMinor: number;
    costBasisUnitMinor: number;
    markupPercent: number;
    markupUnitMinor: number;
    sellingUnitMinor: number;
    sellingTotalMinor: number;
    customerPriceConfirmed: false;
  };

  readyForSupplierSubmission: false;
};

const SAFE_ID = /^[A-Za-z0-9_-]{1,150}$/;
const SAFE_REFERENCE = /^[A-Za-z0-9_-]{1,100}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function failed(
  message: string
): ReservationDraftResult {
  return {
    ok: false,
    code: 'INVALID_RESERVATION_DRAFT',
    message,
    readyForSupplierSubmission: false,
  };
}

function toMinorUnits(
  majorUnits: number
): number | null {
  if (
    !Number.isFinite(majorUnits) ||
    majorUnits < 0
  ) {
    return null;
  }

  const minorUnits = Math.round(
    (majorUnits + Number.EPSILON) * 100
  );

  return Number.isSafeInteger(minorUnits)
    ? minorUnits
    : null;
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
    !Number.isSafeInteger(
      input.supplierNetRateMinor
    ) ||
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

  if (
    !Number.isSafeInteger(
      supplierTotalNetMinor
    )
  ) {
    return failed(
      'Supplier total exceeds safe limits.'
    );
  }

  // Reuse our established pricing rules:
  // supplier net + EUR 5 handling allowance,
  // then 15% markup on the cost basis.
  const pricing = calculateSupplierTicketPrice({
    netRateMinor: input.supplierNetRateMinor,
    supplierCurrency: input.supplierCurrency,
    eurToSupplierRate: input.eurToSupplierRate,
  });

  if (!pricing) {
    return failed(
      'Unable to calculate indicative pricing.'
    );
  }

  const handlingUnitMinor = toMinorUnits(
    pricing.handlingAllowance
  );

  const costBasisUnitMinor = toMinorUnits(
    pricing.costBasis
  );

  const sellingUnitMinor = toMinorUnits(
    pricing.indicativeSellingPrice
  );

  if (
    handlingUnitMinor === null ||
    costBasisUnitMinor === null ||
    sellingUnitMinor === null
  ) {
    return failed(
      'Calculated pricing is invalid.'
    );
  }

  const markupUnitMinor =
    sellingUnitMinor - costBasisUnitMinor;

  const sellingTotalMinor =
    sellingUnitMinor * input.quantity;

  if (
    !Number.isSafeInteger(sellingTotalMinor) ||
    markupUnitMinor < 0
  ) {
    return failed(
      'Calculated selling total is invalid.'
    );
  }

  return {
    ok: true,
    code: 'RESERVATION_DRAFT_VALID',
    message:
      'Reservation draft and indicative pricing ' +
      'validated. Supplier submission is disabled.',

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
      supplierUnitNetMinor:
        input.supplierNetRateMinor,
      supplierTotalNetMinor,
      currency: input.supplierCurrency,
    },

    indicativePricing: {
      currency: pricing.currency,
      supplierUnitNetMinor:
        input.supplierNetRateMinor,
      handlingUnitMinor,
      costBasisUnitMinor,
      markupPercent: pricing.markupPercent,
      markupUnitMinor,
      sellingUnitMinor,
      sellingTotalMinor,
      customerPriceConfirmed: false,
    },

    readyForSupplierSubmission: false,
  };
}
