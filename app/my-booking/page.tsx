
'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  LockKeyhole,
  Search,
  ShieldCheck,
  Ticket,
} from 'lucide-react';

type BookingItem = {
  quantity: number | null;
  indicativeCurrency: string | null;
  indicativeTotalAmountMinor: number | null;
};

type Booking = {
  orderReference: string;
  createdAt: string;
  orderStatus: string;
  paymentStatus: string;
  supplierReservationStatus: string | null;
  currency: string | null;
  totalAmountMinor: number;
  items: BookingItem[];
  testOnly: boolean;
  realPaymentCollected: boolean;
  realSupplierBookingCreated: boolean;
};

type BookingResponse = {
  ok: boolean;
  booking?: Booking;
  error?: string;
};

function readableStatus(value: string | null | undefined) {
  if (!value) return 'Pending';

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function readableDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function MyBookingPage() {
  const [orderReference, setOrderReference] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [booking, setBooking] = useState<Booking | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setBooking(null);
    setLoading(true);

    try {
      const response = await fetch(
        '/api/checkout/customer-order-status',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          body: JSON.stringify({
            orderReference: orderReference.trim().toUpperCase(),
            accessToken: accessToken.trim(),
          }),
        }
      );

      const result =
        (await response.json()) as BookingResponse;

      if (!response.ok || !result.ok || !result.booking) {
        throw new Error(
          result.error ||
            'We could not retrieve your booking.'
        );
      }

      setBooking(result.booking);
      setAccessToken('');
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : 'We could not retrieve your booking.'
      );
    } finally {
      setLoading(false);
    }
  }

  const paymentConfirmed =
    booking?.paymentStatus === 'paid';

  const supplierSimulated =
    booking?.supplierReservationStatus ===
    'simulated_reserved';

  const supplierRejected =
    booking?.supplierReservationStatus ===
    'simulated_rejected';

  const totalTickets =
    booking?.items.reduce(
      (total, item) => total + (item.quantity ?? 0),
      0
    ) ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Grandstand Pass
        </Link>

        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-blue-700">
            <Ticket className="h-5 w-5" />
            Grandstand Pass
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            My Booking
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Access your booking information securely using
            your order reference and private access token.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
              <LockKeyhole className="h-6 w-6" />
            </div>

            <div>
              <h2 className="text-xl font-semibold">
                Find your booking
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Your access token is private. Never share it
                with anyone who should not see your booking.
              </p>
            </div>
          </div>

          <form onSubmit={handleLookup} className="space-y-5">
            <div>
              <label
                htmlFor="orderReference"
                className="mb-2 block text-sm font-semibold"
              >
                Order reference
              </label>

              <input
                id="orderReference"
                type="text"
                autoComplete="off"
                required
                value={orderReference}
                onChange={(event) =>
                  setOrderReference(event.target.value)
                }
                placeholder="GP-TEST-XXXXXXXXXXXX"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="accessToken"
                className="mb-2 block text-sm font-semibold"
              >
                Private access token
              </label>

              <input
                id="accessToken"
                type="password"
                autoComplete="off"
                required
                value={accessToken}
                onChange={(event) =>
                  setAccessToken(event.target.value)
                }
                placeholder="Paste your private access token"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
            >
              <Search className="h-5 w-5" />
              {loading ? 'Finding booking...' : 'View My Booking'}
            </button>
          </form>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}
        </div>

        {booking && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-6 w-6 text-amber-700" />

                <div>
                  <h2 className="font-semibold text-amber-900">
                    Test booking — no real purchase
                  </h2>

                  <p className="mt-1 text-sm text-amber-800">
                    This is a simulated test order. No real
                    customer payment has been collected and
                    no live supplier booking has been made.
                  </p>
                </div>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">
                    Grandstand Pass booking reference
                  </p>

                  <h2 className="mt-1 break-all text-2xl font-bold">
                    {booking.orderReference}
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    Created {readableDate(booking.createdAt)}
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  {readableStatus(booking.orderStatus)}
                </span>
              </div>

              <div className="mt-8 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-slate-500">
                    Tickets
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {totalTickets || 'Not available'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Payment status
                  </p>
                  <p className="mt-1 font-semibold">
                    {paymentConfirmed
                      ? 'Simulated payment confirmed'
                      : readableStatus(booking.paymentStatus)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Supplier status
                  </p>
                  <p className="mt-1 font-semibold">
                    {supplierSimulated
                      ? 'Simulated reservation successful'
                      : readableStatus(
                          booking.supplierReservationStatus
                        )}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-bold">
                Booking progress
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                Follow the current state of your test booking.
              </p>

              <div className="mt-7 space-y-6">
                <div className="flex items-start gap-4">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
                  <div>
                    <p className="font-semibold">
                      Order received
                    </p>
                    <p className="text-sm text-slate-600">
                      Your test order has been recorded.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  {paymentConfirmed ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
                  ) : (
                    <Clock3 className="h-6 w-6 shrink-0 text-slate-400" />
                  )}

                  <div>
                    <p className="font-semibold">
                      Simulated payment
                    </p>
                    <p className="text-sm text-slate-600">
                      {paymentConfirmed
                        ? 'The test payment has been confirmed.'
                        : 'No test payment confirmation yet.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  {supplierSimulated ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
                  ) : (
                    <Circle className="h-6 w-6 shrink-0 text-slate-400" />
                  )}

                  <div>
                    <p className="font-semibold">
                      Simulated supplier reservation
                    </p>
                    <p className="text-sm text-slate-600">
                      {supplierSimulated
                        ? 'A successful supplier response was simulated. No real reservation was created.'
                        : supplierRejected
                          ? 'The simulated supplier response was unsuccessful.'
                          : 'No successful supplier reservation simulation has been recorded.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Circle className="h-6 w-6 shrink-0 text-slate-400" />

                  <div>
                    <p className="font-semibold">
                      Tickets ready
                    </p>
                    <p className="text-sm text-slate-600">
                      No real ticket documents are available
                      for this test booking.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-slate-500">
          <LockKeyhole className="mr-1 inline h-4 w-4" />
          Booking access is protected by your private token.
        </p>
      </div>
    </main>
  );
}
