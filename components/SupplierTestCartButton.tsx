
'use client';

import { useState } from 'react';
import { useCart } from './CartProvider';
import {
  formatCurrency,
  isSupportedCurrency,
} from '../lib/currency';

type SupplierTestCartButtonProps = {
  ticketId: string;
  eventId: string;
  eventName: string;
  eventDate?: string;
  category: string;
  stock: number;
  minOrder: number;
  price: number;
  currency: string;
};

export default function SupplierTestCartButton({
  ticketId,
  eventId,
  eventName,
  eventDate,
  category,
  stock,
  minOrder,
  price,
  currency,
}: SupplierTestCartButtonProps) {
  const { items, addItem } = useCart();

  const existingItem = items.find(
    (item) => item.id === `xs2event-test:${ticketId}`
  );

  const alreadyInCart = existingItem?.quantity ?? 0;

  const availableStock = Math.max(
    0,
    Math.min(10, Math.floor(stock)) - alreadyInCart
  );

  const minimumQuantity = Math.max(
    1,
    Math.ceil(minOrder)
  );

  const canAdd =
    ticketId.length > 0 &&
    eventId.length > 0 &&
    Number.isInteger(stock) &&
    stock > 0 &&
    Number.isFinite(price) &&
    price > 0 &&
    isSupportedCurrency(currency) &&
    availableStock >= minimumQuantity;

  const [quantity, setQuantity] = useState(minimumQuantity);
  const [message, setMessage] = useState('');

  const selectedQuantity = Math.min(
    Math.max(quantity, minimumQuantity),
    Math.max(minimumQuantity, availableStock)
  );

  function handleAddToCart() {
    if (!canAdd || !isSupportedCurrency(currency)) {
      return;
    }

    addItem({
      id: `xs2event-test:${ticketId}`,
      eventId,
      eventName,
      sport: 'Football',
      eventDate,
      category,
      session: 'XS2Event TEST — Not for sale',
      quantity: selectedQuantity,
      price,
      currency,
    });

    setMessage(
      `${selectedQuantity} test ticket${
        selectedQuantity === 1 ? '' : 's'
      } added to your cart.`
    );
  }

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '16px',
        border: '1px solid #bfdbfe',
        borderRadius: '10px',
        background: '#ffffff',
        color: '#111827',
      }}
    >
      <h5
        style={{
          fontSize: '16px',
          fontWeight: 800,
          margin: '0 0 8px',
        }}
      >
        Test Shopping Cart
      </h5>

      <p
        style={{
          fontSize: '13px',
          lineHeight: 1.6,
          color: '#475569',
          margin: '0 0 12px',
        }}
      >
        Add this supplier ticket to your development
        shopping cart. This does not reserve tickets
        with XS2Event or create a purchase.
      </p>

      <p style={{ margin: '0 0 12px', fontSize: '14px' }}>
        <strong>Supplier net rate:</strong>{' '}
        {isSupportedCurrency(currency)
          ? formatCurrency(price, currency)
          : 'Unavailable'}
        {' '}per ticket
      </p>

      <p style={{ margin: '0 0 12px', fontSize: '13px' }}>
        <strong>Already in cart:</strong> {alreadyInCart}
        {' | '}
        <strong>Remaining test quantity:</strong>{' '}
        {availableStock}
      </p>

      {canAdd ? (
        <>
          <label
            htmlFor={`quantity-${ticketId}`}
            style={{
              display: 'block',
              fontWeight: 700,
              fontSize: '13px',
              marginBottom: '6px',
            }}
          >
            Quantity
          </label>

          <select
            id={`quantity-${ticketId}`}
            value={selectedQuantity}
            onChange={(event) => {
              setQuantity(Number(event.target.value));
              setMessage('');
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginBottom: '12px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              background: '#ffffff',
              color: '#111827',
            }}
          >
            {Array.from(
              {
                length:
                  availableStock - minimumQuantity + 1,
              },
              (_, index) => minimumQuantity + index
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleAddToCart}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              borderRadius: '8px',
              background: '#1769e0',
              color: '#ffffff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Add to Test Cart
          </button>
        </>
      ) : (
        <p
          style={{
            fontSize: '13px',
            color: '#92400e',
            margin: 0,
          }}
        >
          This offer cannot currently be added to
          the test cart. The stock limit may have
          been reached, or ticket details may be
          incomplete.
        </p>
      )}

      {message && (
        <p
          role="status"
          style={{
            margin: '12px 0 0',
            fontSize: '13px',
            fontWeight: 700,
            color: '#166534',
          }}
        >
          {message}
        </p>
      )}

      <p
        style={{
          fontSize: '12px',
          color: '#64748b',
          lineHeight: 1.6,
          margin: '12px 0 0',
        }}
      >
        TEST ONLY — Supplier net rates are not
        final customer selling prices. Checkout
        remains disabled.
      </p>
    </div>
  );
}
