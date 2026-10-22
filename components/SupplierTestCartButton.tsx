'use client';

import { useState } from 'react';
import { useCart } from './CartProvider';
import { formatCurrency, isSupportedCurrency } from '../lib/currency';

type SupplierTestCartButtonProps = {
  ticketId: string;
  eventId: string;
  eventName: string;
  eventDate?: string;
  category: string;
  categoryId?: string;
  stock: number;
  minOrder: number;
  /** Legacy supplier net amount in major units; never used as cart price. */
  price: number;
  currency: string;
  rawNetRate: number;
  rawFaceValue?: number;
  /** Server-calculated Grandstand Pass price per ticket, in supplier currency. */
  sellingPrice?: number | null;
};

export default function SupplierTestCartButton({
  ticketId,
  eventId,
  eventName,
  eventDate,
  category,
  categoryId,
  stock,
  minOrder,
  price,
  currency,
  rawNetRate,
  rawFaceValue,
  sellingPrice,
}: SupplierTestCartButtonProps) {
  const { items, addItem, removeItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');

  const cartItemId = `xs2event-test:${ticketId}`;
  const existingItem = items.find(item => item.id === cartItemId);
  const validSellingPrice =
    typeof sellingPrice === 'number' &&
    Number.isFinite(sellingPrice) &&
    sellingPrice > 0;

  // An earlier version stored supplier net prices in the same cart ID.
  // Require removal before a newly priced ticket can be added.
  const staleCartItem = Boolean(
    existingItem &&
    (!validSellingPrice ||
      typeof existingItem.price !== 'number' ||
      Math.abs(existingItem.price - sellingPrice!) > 0.005 ||
      existingItem.currency !== currency ||
      existingItem.supplierRawNetRate !== rawNetRate)
  );

  const alreadyInCart = existingItem?.quantity ?? 0;
  const validStock = Number.isInteger(stock) && stock > 0;
  const maxQuantity = validStock ? Math.min(10, stock) : 0;
  const remainingQuantity = Math.max(0, maxQuantity - alreadyInCart);
  const minimumQuantity =
    Number.isInteger(minOrder) && minOrder > 0 ? minOrder : 1;

  const validSupplierValues =
    Number.isSafeInteger(rawNetRate) &&
    rawNetRate > 0 &&
    Number.isFinite(price) &&
    price > 0 &&
    (rawFaceValue === undefined ||
      (Number.isFinite(rawFaceValue) && rawFaceValue >= 0));

  const validTicket =
    ticketId.length > 0 &&
    eventId.length > 0 &&
    eventName.length > 0 &&
    category.length > 0 &&
    validStock &&
    validSupplierValues &&
    validSellingPrice &&
    isSupportedCurrency(currency);

  const canAdd =
    validTicket &&
    !staleCartItem &&
    remainingQuantity >= minimumQuantity;

  const selectedQuantity = Math.min(
    Math.max(quantity, minimumQuantity),
    Math.max(minimumQuantity, remainingQuantity)
  );

  function handleAddToCart() {
    if (!canAdd || !isSupportedCurrency(currency) || !validSellingPrice) {
      return;
    }

    addItem({
      id: cartItemId,
      eventId,
      eventName,
      sport: 'Football',
      eventDate,
      category,
      session: 'XS2Event TEST — Not for sale',
      quantity: selectedQuantity,
      price: sellingPrice!,
      currency,
      supplier: 'XS2Event',
      supplierTicketId: ticketId,
      supplierCategoryId: categoryId,
      supplierEnvironment: 'test',
      supplierRawNetRate: rawNetRate,
      supplierRawFaceValue: rawFaceValue,
      maxQuantity,
    });

    setMessage(
      `${selectedQuantity} test ticket${selectedQuantity === 1 ? '' : 's'} added to your cart.`
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
      <h5 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px' }}>
        Test Shopping Cart
      </h5>
      <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#475569', margin: '0 0 12px' }}>
        Add this XS2Event test offer to your development cart. No supplier
        reservation or payment will be created.
      </p>

      <p style={{ margin: '0 0 12px', fontSize: '14px' }}>
        <strong>Indicative Grandstand Pass price:</strong>{' '}
        {validSellingPrice && isSupportedCurrency(currency)
          ? formatCurrency(sellingPrice!, currency)
          : 'Awaiting verified calculation'}{' '}
        per ticket
      </p>

      <p style={{ margin: '0 0 12px', fontSize: '13px' }}>
        <strong>Already in cart:</strong> {alreadyInCart}
        {' | '}
        <strong>Remaining test quantity:</strong> {remainingQuantity}
      </p>

      {staleCartItem && (
        <div style={{ marginBottom: '12px', padding: '12px', borderRadius: '8px', background: '#fef3c7', color: '#92400e' }}>
          <p style={{ fontSize: '13px', margin: '0 0 10px' }}>
            An older or differently priced version of this test ticket is in your cart.
            Remove it before adding this offer at the current indicative price.
          </p>
          <button
            type="button"
            onClick={() => {
              removeItem(cartItemId);
              setMessage('Older test ticket removed.');
            }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #92400e', background: '#ffffff', color: '#92400e', fontWeight: 700, cursor: 'pointer' }}
          >
            Remove older test ticket
          </button>
        </div>
      )}

      {canAdd ? (
        <>
          <label
            htmlFor={`quantity-${ticketId}`}
            style={{ display: 'block', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}
          >
            Quantity
          </label>
          <select
            id={`quantity-${ticketId}`}
            value={selectedQuantity}
            onChange={event => {
              setQuantity(Number(event.target.value));
              setMessage('');
            }}
            style={{ display: 'block', width: '100%', padding: '10px', marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#111827' }}
          >
            {Array.from(
              { length: remainingQuantity - minimumQuantity + 1 },
              (_, index) => minimumQuantity + index
            ).map(value => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddToCart}
            style={{ width: '100%', padding: '12px 16px', border: 'none', borderRadius: '8px', background: '#1769e0', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}
          >
            Add to Test Cart
          </button>
        </>
      ) : !staleCartItem ? (
        <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>
          {validSellingPrice
            ? 'This offer cannot currently be added. The stock limit may have been reached, or the supplier details may be incomplete.'
            : 'Test cart temporarily unavailable until the Grandstand Pass selling price is passed from the server.'}
        </p>
      ) : null}

      {message && (
        <p role="status" style={{ margin: '12px 0 0', fontSize: '13px', fontWeight: 700, color: '#166534' }}>
          {message}
        </p>
      )}

      <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6, margin: '12px 0 0' }}>
        TEST DATA — NOT FOR SALE. Prices are indicative and not confirmed for
        checkout. Supplier availability can change. Checkout remains disabled.
      </p>
    </div>
  );
}
