
import 'server-only';

/**
 * Grandstand Pass — Payment Risk Assessment
 *
 * Priority 2: Test-safe foundation.
 *
 * No payment gateway is connected.
 * No real payment is processed.
 * No XS2Event order is created.
 *
 * No automatic high-value order threshold.
 */

export type PaymentRiskDecision =
  | 'approved'
  | 'manual_review'
  | 'rejected';

export type PaymentRiskReason =
  | 'VERIFIED_TEST_APPROVAL'
  | 'FRAUD_REVIEW_REQUIRED'
  | 'FRAUD_REJECTED'
  | 'RISK_ASSESSMENT_UNAVAILABLE';

export type PaymentRiskAssessment = {
  decision: PaymentRiskDecision;
  reason: PaymentRiskReason;
  supplierBookingAllowed: boolean;
  assessedAt: string;
};

export type TestPaymentRiskInput = {
  mode: 'test';
  paymentVerified: boolean;
  simulatedRiskResult:
    | 'approve'
    | 'review'
    | 'reject'
    | 'unavailable';
};

export function assessTestPaymentRisk(
  input: TestPaymentRiskInput
): PaymentRiskAssessment {
  const assessedAt = new Date().toISOString();

  // Payment verification must succeed before
  // any risk assessment can approve booking.
  if (!input.paymentVerified) {
    return {
      decision: 'manual_review',
      reason: 'RISK_ASSESSMENT_UNAVAILABLE',
      supplierBookingAllowed: false,
      assessedAt,
    };
  }

  // This is an explicit TEST decision only.
  // Never treat a browser-provided value
  // as a genuine payment provider risk result.
  switch (input.simulatedRiskResult) {
    case 'approve':
      return {
        decision: 'approved',
        reason: 'VERIFIED_TEST_APPROVAL',
        supplierBookingAllowed: true,
        assessedAt,
      };

    case 'review':
      return {
        decision: 'manual_review',
        reason: 'FRAUD_REVIEW_REQUIRED',
        supplierBookingAllowed: false,
        assessedAt,
      };

    case 'reject':
      return {
        decision: 'rejected',
        reason: 'FRAUD_REJECTED',
        supplierBookingAllowed: false,
        assessedAt,
      };

    default:
      return {
        decision: 'manual_review',
        reason: 'RISK_ASSESSMENT_UNAVAILABLE',
        supplierBookingAllowed: false,
        assessedAt,
      };
  }
}
