
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Globe2,
  LockKeyhole,
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

  const countries = useMemo(() => getCountries(), []);

  const updateCustomer = (
    field: keyof CustomerDetails,
    value: string
  ) => {
    setCustomer((current) => ({
      ...current,
      [field]: value,
    }));
    setDetailsReviewed(false);
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

  const detailsComplete =
    customer.firstName.trim().length > 0 &&
    customer.lastName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      customer.email.trim()
    ) &&
    customer.phone.trim().length >= 6 &&
    customer.country.length > 0;

  const reviewDetails = () => {
    if (detailsComplete && items.length > 0) {
      setDetailsReviewed(true);
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
            <Globe2 size={28} className="text-blue" />
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-black text-navy">
              International Checkout
            </h1>
            <p className="muted mt-2">
              Complete your customer details and review
              your ticket selections.
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
              This page is for testing only. No payments,
              ticket reservations or supplier orders
              will be processed.
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
                      autoComplete="given-name"
                      value={customer.firstName}
                      onChange={(event) =>
                        updateCustomer(
                          'firstName',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border px-4 py-3"
                      placeholder="First name"
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
                      autoComplete="family-name"
                      value={customer.lastName}
                      onChange={(event) =>
                        updateCustomer(
                          'lastName',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border px-4 py-3"
                      placeholder="Last name"
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
                      autoComplete="email"
                      value={customer.email}
                      onChange={(event) =>
                        updateCustomer(
                          'email',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border px-4 py-3"
                      placeholder="name@example.com"
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
                      autoComplete="tel"
                      value={customer.phone}
                      onChange={(event) =>
                        updateCustomer(
                          'phone',
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border px-4 py-3"
                      placeholder="+27 82 123 4567"
                    />
                    <p className="text-xs muted mt-2">
                      Include your international dialling code.
                    </p>
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
                      autoComplete="country-name"
                      value={customer.country}
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
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-7 border-t pt-6">
                  <button
                    type="button"
                    disabled={!detailsComplete}
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
                        Customer details reviewed locally.
                        No information has been submitted
                        or saved to a server.
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

                {originalTotal === null && (
                  <p className="text-xs muted mt-2">
                    Tickets may have different original
                    currencies. A final checkout total
                    will be calculated securely later.
                  </p>
                )}
              </div>

              {hasTestTickets && (
                <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  XS2Event test inventory is not for sale.
                  Availability is not reserved.
                </p>
              )}

              <div className="mt-6">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-xl bg-navy py-4 font-bold text-white opacity-60 cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CreditCard size={19} />
                  Payment Coming Soon
                </button>
              </div>

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
