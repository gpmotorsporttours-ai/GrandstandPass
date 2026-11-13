
'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Globe2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Ticket,
} from 'lucide-react';

import { useCart } from '../../components/CartProvider';
import {
  formatCurrency,
  isSupportedCurrency,
} from '../../lib/currency';

type CustomerDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
};

type VerifiedQuote = {
  currency: 'EUR';
  indicativeUnitAmountMinor: number;
  indicativeTotalAmountMinor: number;
  checkedAt: string;
  eventId: string;
  ticketId: string;
  quantity: number;
};

type PriceVerificationResult = {
  ok?: boolean;
  error?: string;
  currency?: string;
  indicativeUnitAmountMinor?: number;
  indicativeTotalAmountMinor?: number;
  checkedAt?: string;
};

type TestOrderResult = {
  ok?: boolean;
  orderReference?: string;
  status?: string;
  customerPriceConfirmed?: boolean;
  error?: string;
};

const QUOTE_VALIDITY_MS = 5 * 60 * 1000;

const INITIAL_CUSTOMER: CustomerDetails = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  country: '',
};

function getCountries(): string[] {
  try {
    const names = new Intl.DisplayNames(['en'], {
      type: 'region',
    });

    const countries: string[] = [];

    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code =
          String.fromCharCode(a) +
          String.fromCharCode(b);

        const name = names.of(code);

        if (
          name &&
          name !== code &&
          !name.startsWith('Unknown Region')
        ) {
          countries.push(name);
        }
      }
    }

    return [...new Set(countries)].sort((a, b) =>
      a.localeCompare(b)
    );
  } catch {
    return [
      'Australia',
      'Canada',
      'France',
      'Germany',
      'India',
      'Netherlands',
      'South Africa',
      'United Arab Emirates',
      'United Kingdom',
      'United States',
    ];
  }
}

export default function CheckoutPage() {
  const { items, itemCount, displayCurrency } = useCart();

  const [customer, setCustomer] =
    useState<CustomerDetails>(INITIAL_CUSTOMER);

  const [detailsReviewed, setDetailsReviewed] =
    useState(false);

  const [verifying, setVerifying] = useState(false);

  const [verifiedQuote, setVerifiedQuote] =
    useState<VerifiedQuote | null>(null);

  const [quoteSignature, setQuoteSignature] =
    useState<string | null>(null);

  const [priceAccepted, setPriceAccepted] =
    useState(false);

  const [verificationError, setVerificationError] =
    useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const [orderReference, setOrderReference] =
    useState<string | null>(null);

  const [submitError, setSubmitError] =
    useState<string | null>(null);

  const requestIdRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const verifyingRef = useRef(false);

  const countries = useMemo(getCountries, []);

  const updateCustomer = (
    field: keyof CustomerDetails,
    value: string
  ) => {
    if (submittingRef.current || orderReference) {
      return;
    }

    setCustomer((current) => ({
      ...current,
      [field]: value,
    }));

    setDetailsReviewed(false);
    setSubmitError(null);
    requestIdRef.current = null;
  };

  const validPrices =
    items.length > 0 &&
    items.every(
      (item) =>
        typeof item.price === 'number' &&
        Number.isFinite(item.price) &&
        item.price > 0 &&
        isSupportedCurrency(item.currency)
    );

  const singleCurrency =
    validPrices &&
    items.every(
      (item) => item.currency === items[0].currency
    );

  const originalTotal =
    validPrices && singleCurrency
      ? items.reduce(
          (sum, item) =>
            sum + (item.price ?? 0) * item.quantity,
          0
        )
      : null;

  const originalCurrency =
    singleCurrency && items.length > 0
      ? items[0].currency
      : null;

  const hasTestTickets = items.some(
    (item) =>
      item.supplier === 'XS2Event' &&
      item.supplierEnvironment === 'test'
  );

  const allTestTickets =
    items.length === 1 &&
    items.every(
      (item) =>
        item.supplier === 'XS2Event' &&
        item.supplierEnvironment === 'test' &&
        typeof item.supplierTicketId === 'string' &&
        item.supplierTicketId.length > 0 &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 10
    );

  const ticketSignature = JSON.stringify(
    items.map((item) => [
      item.eventId,
      item.supplierTicketId,
      item.quantity,
      item.supplier,
      item.supplierEnvironment,
    ])
  );

  const quoteMatchesSelection =
    verifiedQuote !== null &&
    quoteSignature === ticketSignature;

  const quoteNotExpired =
    verifiedQuote !== null &&
    Number.isFinite(Date.parse(verifiedQuote.checkedAt)) &&
    Date.now() - Date.parse(verifiedQuote.checkedAt) >= 0 &&
    Date.now() - Date.parse(verifiedQuote.checkedAt) <
      QUOTE_VALIDITY_MS;

  const quoteIsCurrent =
    quoteMatchesSelection && quoteNotExpired;

  const detailsComplete =
    customer.firstName.trim().length > 0 &&
    customer.lastName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      customer.email.trim()
    ) &&
    customer.phone.trim().length >= 6 &&
    customer.country.length > 0;

  const canSubmit =
    detailsReviewed &&
    detailsComplete &&
    allTestTickets &&
    quoteIsCurrent &&
    priceAccepted &&
    !verifying &&
    !submitting &&
    !orderReference;

  const verifyTicketPrice = async () => {
    if (
      verifyingRef.current ||
      submittingRef.current ||
      orderReference ||
      !allTestTickets
    ) {
      return;
    }

    verifyingRef.current = true;
    setVerifying(true);
    setVerifiedQuote(null);
    setQuoteSignature(null);
    setPriceAccepted(false);
    setVerificationError(null);
    setSubmitError(null);
    requestIdRef.current = null;

    try {
      const item = items[0];

      const supplierTicketId =
        item.supplierTicketId;

      if (
        typeof supplierTicketId !== 'string' ||
        supplierTicketId.length === 0
      ) {
        throw new Error(
          'A valid supplier ticket ID is required.'
        );
      }

      const response = await fetch(
        '/api/checkout/verify-test-price',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          body: JSON.stringify({
            eventId: item.eventId,
            ticketId: supplierTicketId,
            quantity: item.quantity,
          }),
        }
      );

      const result: PriceVerificationResult =
        await response.json();

      if (!response.ok || result.ok !== true) {
        throw new Error(
          result.error ??
            'Unable to verify the ticket price.'
        );
      }

      const unitAmount =
        result.indicativeUnitAmountMinor;

      const totalAmount =
        result.indicativeTotalAmountMinor;

      const checkedAt = result.checkedAt;

      if (
        result.currency !== 'EUR' ||
        typeof unitAmount !== 'number' ||
        !Number.isSafeInteger(unitAmount) ||
        unitAmount <= 0 ||
        typeof totalAmount !== 'number' ||
        !Number.isSafeInteger(totalAmount) ||
        totalAmount <= 0 ||
        totalAmount !== unitAmount * item.quantity ||
        typeof checkedAt !== 'string' ||
        !Number.isFinite(Date.parse(checkedAt))
      ) {
        throw new Error(
          'The server returned invalid pricing.'
        );
      }

      setVerifiedQuote({
        currency: 'EUR',
        indicativeUnitAmountMinor: unitAmount,
        indicativeTotalAmountMinor: totalAmount,
        checkedAt,
        eventId: item.eventId,
        ticketId: supplierTicketId,
        quantity: item.quantity,
      });

      setQuoteSignature(ticketSignature);
    } catch (error) {
      setVerificationError(
        error instanceof Error
          ? error.message
          : 'Price verification failed.'
      );
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  const reviewDetails = () => {
    if (detailsComplete && items.length > 0) {
      setDetailsReviewed(true);
      setSubmitError(null);
    }
  };

  const createTestOrder = async () => {
    if (
      !canSubmit ||
      !verifiedQuote ||
      !quoteIsCurrent ||
      !priceAccepted ||
      submittingRef.current ||
      orderReference
    ) {
      return;
    }

    const quote = verifiedQuote;

    // The server independently checks the acknowledged
    // ticket, quantity and price before saving the order.
    const priceAcknowledgement = {
      accepted: true,
      eventId: quote.eventId,
      ticketId: quote.ticketId,
      quantity: quote.quantity,
      currency: quote.currency,
      indicativeUnitAmountMinor:
        quote.indicativeUnitAmountMinor,
      indicativeTotalAmountMinor:
        quote.indicativeTotalAmountMinor,
      checkedAt: quote.checkedAt,
    };

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    if (!requestIdRef.current) {
      requestIdRef.current = crypto.randomUUID();
    }

    try {
      const response = await fetch(
        '/api/checkout/submit-test',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          body: JSON.stringify({
            requestId: requestIdRef.current,

            customer: {
              firstName: customer.firstName.trim(),
              lastName: customer.lastName.trim(),
              email: customer.email.trim(),
              phone: customer.phone.trim(),
              country: customer.country.trim(),
            },

            items: items.map((item) => ({
              eventId: item.eventId,
              supplierTicketId: item.supplierTicketId,
              supplier: item.supplier,
              supplierEnvironment:
                item.supplierEnvironment,
              quantity: item.quantity,
            })),

            // Explicit customer acknowledgement.
            // The server does not trust the amount
            // without a fresh supplier price check.
            priceAcknowledgement,
          }),
        }
      );

      const result: TestOrderResult =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            'Unable to create the test order.'
        );
      }

      if (
        result.ok !== true ||
        !result.orderReference ||
        result.customerPriceConfirmed !== true
      ) {
        throw new Error(
          'The server did not confirm the acknowledged test order.'
        );
      }

      setOrderReference(result.orderReference);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.';

      setSubmitError(message);

      // A rejected price acknowledgement must
      // be reverified before another attempt.
      if (
        message.toLowerCase().includes('price') ||
        message.toLowerCase().includes('acknowledg') ||
        message.toLowerCase().includes('ticket selection')
      ) {
        setVerifiedQuote(null);
        setQuoteSignature(null);
        setPriceAccepted(false);
        requestIdRef.current = null;
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="bg-ice border-b">
        <div className="container-wide py-5">
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 text-sm font-semibold text-navy hover:underline"
          >
            <ArrowLeft size={16} />
            Return to shopping cart
          </Link>
        </div>
      </section>

      <section className="container-wide py-10 md:py-14">
        <div className="flex items-start gap-4 mb-8">
          <div className="rounded-2xl bg-ice p-3">
            <Globe2
              size={28}
              className="text-blue"
            />
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-black text-navy">
              International Checkout
            </h1>

            <p className="muted mt-2">
              Complete your customer details and
              review your ticket selections.
            </p>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3">
          <LockKeyhole
            size={20}
            className="text-blue shrink-0"
          />

          <div>
            <p className="font-bold text-navy">
              Checkout development mode
            </p>

            <p className="text-sm text-navy mt-1">
              TEST MODE ONLY. Use fictional customer
              information. No payments, ticket reservations
              or XS2Event supplier orders will be processed.
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            <ShoppingCart
              size={44}
              className="mx-auto text-blue mb-4"
            />

            <h2 className="text-2xl font-black text-navy">
              Your shopping cart is empty
            </h2>

            <p className="muted mt-3 mb-6">
              Please select your tickets before
              proceeding to checkout.
            </p>

            <Link
              href="/"
              className="inline-flex rounded-xl bg-navy px-7 py-4 text-white font-bold"
            >
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
              <section className="rounded-2xl border bg-white p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Globe2
                    size={23}
                    className="text-blue"
                  />

                  <h2 className="text-xl font-black text-navy">
                    Customer Information
                  </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="block text-sm font-bold text-navy mb-2"
                    >
                      First name
                    </label>

                    <input
                      id="firstName"
                      value={customer.firstName}
                      disabled={
                        submitting || !!orderReference
                      }
                      onChange={(event) =>
                        updateCustomer(
                          'firstName',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border px-4 py-3"
                      placeholder="Test"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="lastName"
                      className="block text-sm font-bold text-navy mb-2"
                    >
                      Last name
                    </label>

                    <input
                      id="lastName"
                      value={customer.lastName}
                      disabled={
                        submitting || !!orderReference
                      }
                      onChange={(event) =>
                        updateCustomer(
                          'lastName',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border px-4 py-3"
                      placeholder="Customer"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-bold text-navy mb-2"
                    >
                      Email address
                    </label>

                    <input
                      id="email"
                      type="email"
                      value={customer.email}
                      disabled={
                        submitting || !!orderReference
                      }
                      onChange={(event) =>
                        updateCustomer(
                          'email',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border px-4 py-3"
                      placeholder="test@example.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-bold text-navy mb-2"
                    >
                      Telephone number
                    </label>

                    <input
                      id="phone"
                      type="tel"
                      value={customer.phone}
                      disabled={
                        submitting || !!orderReference
                      }
                      onChange={(event) =>
                        updateCustomer(
                          'phone',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border px-4 py-3"
                      placeholder="+27 00 000 0000"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor="country"
                      className="block text-sm font-bold text-navy mb-2"
                    >
                      Country of residence
                    </label>

                    <select
                      id="country"
                      value={customer.country}
                      disabled={
                        submitting || !!orderReference
                      }
                      onChange={(event) =>
                        updateCustomer(
                          'country',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border px-4 py-3 bg-white"
                    >
                      <option value="">
                        Select your country
                      </option>

                      {countries.map((country) => (
                        <option
                          key={country}
                          value={country}
                        >
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-7 border-t pt-6">
                  <button
                    type="button"
                    disabled={
                      !detailsComplete ||
                      submitting ||
                      !!orderReference
                    }
                    onClick={reviewDetails}
                    className="rounded-xl bg-navy px-6 py-3 font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review Customer Details
                  </button>

                  {detailsReviewed && (
                    <div
                      role="status"
                      className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 flex gap-3"
                    >
                      <CheckCircle2
                        size={20}
                        className="text-green-700 shrink-0"
                      />

                      <p className="text-sm text-green-900">
                        Customer details reviewed.
                        Please verify and acknowledge
                        the indicative ticket price.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border bg-white p-6 md:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <Ticket
                    size={23}
                    className="text-blue"
                  />

                  <h2 className="text-xl font-black text-navy">
                    Your Ticket Selections
                  </h2>
                </div>

                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="border-b pb-4 last:border-b-0 last:pb-0"
                    >
                      <p className="font-black text-navy">
                        {item.eventName}
                      </p>

                      <p className="text-sm muted mt-1">
                        {item.category}
                      </p>

                      {item.eventDate && (
                        <p className="text-sm muted mt-1">
                          Date: {item.eventDate}
                        </p>
                      )}

                      {item.session && (
                        <p className="text-sm muted mt-1">
                          Session: {item.session}
                        </p>
                      )}

                      <p className="text-sm font-semibold text-navy mt-2">
                        Quantity: {item.quantity}
                      </p>

                      {typeof item.price === 'number' &&
                      item.price > 0 &&
                      isSupportedCurrency(item.currency) ? (
                        <p className="text-sm text-blue font-bold mt-2">
                          Indicative line price:{' '}
                          {formatCurrency(
                            item.price * item.quantity,
                            item.currency
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-red-600 mt-2">
                          Price unavailable
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="rounded-2xl border bg-ice p-6 lg:sticky lg:top-6">
              <h2 className="text-xl font-black text-navy">
                Order Summary
              </h2>

              <div className="mt-5 space-y-3 border-b pb-5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="muted">
                    Total tickets
                  </span>

                  <span className="font-bold text-navy">
                    {itemCount}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="muted">
                    Preferred display currency
                  </span>

                  <span className="font-bold text-navy">
                    {displayCurrency}
                  </span>
                </div>
              </div>

              <div className="py-5 border-b">
                <p className="text-sm muted">
                  Indicative ticket total
                </p>

                <p className="text-2xl font-black text-navy mt-2">
                  {originalTotal !== null &&
                  originalCurrency &&
                  isSupportedCurrency(originalCurrency)
                    ? formatCurrency(
                        originalTotal,
                        originalCurrency
                      )
                    : 'Final pricing pending'}
                </p>

                <p className="text-xs muted mt-2">
                  Display only. Test drafts are saved
                  with a payable amount of zero.
                </p>
              </div>

              {hasTestTickets && (
                <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  XS2Event test inventory is not for sale.
                  Availability is not reserved.
                </p>
              )}

              {!allTestTickets && (
                <p className="mt-4 text-sm text-amber-900">
                  Test checkout currently supports
                  exactly one XS2Event test ticket
                  selection.
                </p>
              )}

              <section className="mt-6 rounded-xl border bg-white p-4 space-y-3">
                <h3 className="font-black text-navy">
                  Verify Ticket Price
                </h3>

                <p className="text-sm muted">
                  Check the latest indicative price
                  with XS2Event before creating a
                  test order. Availability is not reserved.
                </p>

                <button
                  type="button"
                  disabled={
                    verifying ||
                    submitting ||
                    !!orderReference ||
                    !allTestTickets
                  }
                  onClick={verifyTicketPrice}
                  className="w-full rounded-xl border border-navy px-4 py-3 font-bold text-navy disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className="inline mr-2"
                  />

                  {verifying
                    ? 'Verifying...'
                    : 'Verify Ticket Price'}
                </button>

                {verificationError && (
                  <p
                    role="alert"
                    className="text-sm text-red-700"
                  >
                    {verificationError}
                  </p>
                )}

                {quoteIsCurrent && verifiedQuote && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
                    <p className="font-bold text-green-900">
                      Supplier price checked
                    </p>

                    <p className="text-2xl font-black text-navy">
                      {formatCurrency(
                        verifiedQuote.indicativeTotalAmountMinor / 100,
                        'EUR'
                      )}
                    </p>

                    <p className="text-xs text-green-900">
                      Indicative total for{' '}
                      {verifiedQuote.quantity} ticket(s),
                      checked at{' '}
                      {new Date(
                        verifiedQuote.checkedAt
                      ).toLocaleString()}.
                      Not a guaranteed final price.
                      Taxes and payment fees may apply.
                    </p>

                    {!orderReference && (
                      <label className="flex items-start gap-3 text-sm text-navy cursor-pointer">
                        <input
                          type="checkbox"
                          checked={priceAccepted}
                          disabled={submitting}
                          onChange={(event) =>
                            setPriceAccepted(
                              event.target.checked
                            )
                          }
                          className="mt-1"
                        />

                        <span>
                          I acknowledge this verified
                          indicative price for testing.
                          This does not authorise a
                          payment or reservation.
                        </span>
                      </label>
                    )}
                  </div>
                )}

                {verifiedQuote && !quoteIsCurrent && (
                  <p className="text-sm text-amber-900">
                    The quote has expired or your
                    ticket selection has changed.
                    Please verify the price again.
                  </p>
                )}
              </section>

              {orderReference ? (
                <div
                  role="status"
                  className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4"
                >
                  <div className="flex items-center gap-2 text-green-800 font-bold">
                    <CheckCircle2 size={20} />
                    Test Draft Created
                  </div>

                  <p className="text-sm mt-3 text-green-900">
                    Order reference:
                  </p>

                  <p className="font-black text-navy break-all mt-1">
                    {orderReference}
                  </p>

                  <p className="text-sm text-green-900 mt-3">
                    Customer price acknowledgement
                    recorded with the test order.
                  </p>

                  <p className="text-xs text-green-900 mt-3">
                    Saved in Supabase. No payment
                    collected or supplier order placed.
                  </p>
                </div>
              ) : (
                <div className="mt-6">
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={createTestOrder}
                    className="w-full rounded-xl bg-navy py-4 font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CreditCard size={19} />

                    {submitting
                      ? 'Creating Test Order...'
                      : 'Create Test Order'}
                  </button>
                </div>
              )}

              {submitError && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {submitError}
                </div>
              )}

              <p className="text-xs muted text-center mt-4">
                No payment will be collected and no
                XS2Event order will be placed.
              </p>

              <div className="flex items-center justify-center gap-2 text-xs text-navy font-semibold mt-5">
                <ShieldCheck size={16} />
                Secure checkout development
              </div>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
