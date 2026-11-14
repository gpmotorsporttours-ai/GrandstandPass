
import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import {
  assessTestPaymentRisk,
  type TestPaymentRiskInput,
} from '../../../../lib/paymentRiskAssessment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2000;
const ORDER_REFERENCE_PATTERN = /^GP-TEST-[A-F0-9]{12}$/;

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

export async function POST(request: NextRequest) {
  // Test-only endpoint. Never enable in Production.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.TEST_ORDER_CREATION_ENABLED !== 'true'
  ) {
    return fail('Risk simulation is disabled.', 404);
  }

  const secret = process.env.TEST_ORDER_ACCESS_SECRET;

  if (
    !secret ||
    secret.length < 32 ||
    !secretMatches(
      request.headers.get('x-test-order-secret'),
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

    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
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

  const { orderReference, simulatedRiskResult } =
    body as Record<string, unknown>;

  if (
    typeof orderReference !== 'string' ||
    !ORDER_REFERENCE_PATTERN.test(orderReference)
  ) {
    return fail('Invalid test order reference.', 400);
  }

  if (
    simulatedRiskResult !== 'approve' &&
    simulatedRiskResult !== 'review' &&
    simulatedRiskResult !== 'reject' &&
    simulatedRiskResult !== 'unavailable'
  ) {
    return fail('Invalid simulated risk result.', 400);
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_reference', orderReference)
      .maybeSingle();

    if (error) {
      console.error('Risk simulation order read error:', error.code);
      return fail('Unable to read test order.', 500);
    }

    if (!data) {
      return fail('Test order not found.', 404);
    }

    // Only existing confirmed, zero-value
    // simulation orders may be assessed.
    if (
      data.order_status !== 'payment_confirmed' ||
      data.payment_provider !== 'simulation' ||
      data.total_amount_minor !== 0 ||
      data.payment_risk_status !== null ||
      data.supplier_order_reference !== null ||
      data.supplier_reservation_id !== null ||
      data.supplier_reservation_attempt_id !== null
    ) {
      return fail(
        'Test order is not eligible for risk assessment.',
        409
      );
    }

    const input: TestPaymentRiskInput = {
      mode: 'test',
      paymentVerified: true,
      simulatedRiskResult,
    };

    const assessment = assessTestPaymentRisk(input);

    // Atomic database update. The function
    // repeats all eligibility checks.
    const { data: recorded, error: recordError } =
      await supabase.rpc('record_test_payment_risk', {
        p_order_reference: orderReference,
        p_risk_status: assessment.decision,
      });

    if (recordError) {
      console.error(
        'Risk simulation recording error:',
        recordError.code
      );

      return fail(
        'Unable to record risk assessment.',
        500
      );
    }

    if (recorded !== true) {
      return fail(
        'Risk assessment already recorded or order no longer eligible.',
        409
      );
    }

    return NextResponse.json(
      {
        ok: true,
        mode: 'test_risk_assessment',
        orderReference,
        riskDecision: assessment.decision,
        riskReason: assessment.reason,
        supplierBookingAllowed:
          assessment.supplierBookingAllowed,
        assessedAt: assessment.assessedAt,
        databaseUpdated: true,
        paymentCollected: false,
        supplierContacted: false,
        message:
          'Test risk decision recorded. No real payment or XS2Event order created.',
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error(
      'Risk simulation error:',
      error instanceof Error ? error.name : 'Unknown'
    );

    return fail('Risk assessment unavailable.', 500);
  }
}
