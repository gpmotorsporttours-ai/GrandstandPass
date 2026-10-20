
'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  Ticket,
} from 'lucide-react';

import { useCart } from '../../components/CartProvider';

export default function CartPage() {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    itemCount,
    total,
    currency,
  } = useCart();

  const formatPrice = (amount: number) => {
    if (!currency) {
      return 'Price unavailable';
    }

    try {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency,
      }).format(amount);
    } catch {
      return 'Price unavailable';
    }
  };

  return (
    <>
      <section className="bg-ice border-b">
        <div className="container-wide py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-navy"
          >
            <ArrowLeft size={16} />
            Continue browsing events
          </Link>
        </div>
      </section>

      <section className="container-wide py-12">
        <div className="flex items-center gap-3 mb-8">
          <ShoppingCart
            size={30}
            className="text-blue"
          />

          <div>
            <h1 className="text-3xl md:text-4xl font-black text-navy">
              Your Shopping Cart
            </h1>

            <p className="muted mt-2">
              Review your ticket selections before
              proceeding to checkout.
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 md:p-12 text-center">
            <ShoppingCart
              size={48}
              className="mx-auto text-blue mb-5"
            />

            <h2 className="text-2xl font-bold text-navy">
              Your cart is empty
            </h2>

            <p className="muted mt-3 mb-7">
              Explore sporting events and choose your
              preferred tickets to get started.
            </p>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-navy px-7 py-4 text-white font-bold"
            >
              Explore Events
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border bg-white p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-ice p-3">
                      <Ticket
                        size={24}
                        className="text-blue"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-blue">
                        {item.sport}
                      </p>

                      <h2 className="text-xl font-black text-navy mt-1">
                        {item.eventName}
                      </h2>

                      {item.eventDate && (
                        <p className="muted text-sm mt-2">
                          Date: {item.eventDate}
                        </p>
                      )}

                      {item.session && (
                        <p className="muted text-sm mt-2">
                          Session: {item.session}
                        </p>
                      )}

                      <p className="text-sm mt-2">
                        <span className="muted">
                          Category:
                        </span>{' '}
                        <span className="font-semibold text-navy">
                          {item.category}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="border-t mt-5 pt-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.id,
                            item.quantity - 1
                          )
                        }
                        aria-label={`Decrease quantity for ${item.eventName}`}
                        className="w-10 h-10 rounded-lg border flex items-center justify-center"
                      >
                        <Minus size={17} />
                      </button>

                      <span className="font-black text-navy min-w-6 text-center">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.id,
                            item.quantity + 1
                          )
                        }
                        disabled={item.quantity >= 10}
                        aria-label={`Increase quantity for ${item.eventName}`}
                        className="w-10 h-10 rounded-lg border flex items-center justify-center disabled:opacity-40"
                      >
                        <Plus size={17} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeItem(item.id)
                      }
                      className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:underline"
                    >
                      <Trash2 size={17} />
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 text-sm font-semibold text-navy">
                    {typeof item.price === 'number' &&
                    item.currency
                      ? `Unit price: ${new Intl.NumberFormat(
                          'en-GB',
                          {
                            style: 'currency',
                            currency: item.currency,
                          }
                        ).format(item.price)}`
                      : 'Price: Awaiting live supplier pricing'}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={clearCart}
                className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:underline"
              >
                <Trash2 size={17} />
                Empty shopping cart
              </button>
            </div>

            <aside className="rounded-2xl border bg-ice p-6">
              <h2 className="text-xl font-black text-navy">
                Order Summary
              </h2>

              <div className="border-b py-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="muted">
                    Total tickets
                  </span>

                  <span className="font-bold text-navy">
                    {itemCount}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="muted">
                    Total price
                  </span>

                  <span className="font-bold text-navy text-right">
                    {total !== null
                      ? formatPrice(total)
                      : 'Awaiting live pricing'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled
                className="w-full mt-6 rounded-xl bg-navy py-4 font-bold text-white opacity-60 cursor-not-allowed"
              >
                Checkout Available Soon
              </button>

              <p className="muted text-xs mt-4 text-center">
                Booking and payment are not yet enabled.
                Ticket availability and prices will be
                confirmed when the live supplier
                integration is connected.
              </p>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
