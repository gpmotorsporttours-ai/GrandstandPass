
'use client';

import { useCart } from './CartProvider';

const currencyNames: Record<string, string> = {
  EUR: 'Euro',
  ZAR: 'South African Rand',
  USD: 'US Dollar',
  GBP: 'British Pound',
  AED: 'UAE Dirham',
};

export default function SupplierCurrencyPreview() {
  const { displayCurrency } = useCart();

  return (
    <section
      style={{
        padding: '20px',
        marginBottom: '28px',
        border: '1px solid #bfdbfe',
        borderRadius: '12px',
        background: '#eff6ff',
        color: '#1e3a8a',
      }}
    >
      <h2
        style={{
          fontSize: '19px',
          fontWeight: 800,
          margin: '0 0 12px',
        }}
      >
        Currency Preview
      </h2>

      <p style={{ margin: '0 0 10px' }}>
        <strong>Your selected currency:</strong>{' '}
        {displayCurrency} (
        {currencyNames[displayCurrency]})
      </p>

      <p
        style={{
          margin: '0 0 10px',
          lineHeight: 1.6,
        }}
      >
        This currency is selected using the
        dropdown in the Grandstand Pass header.
        You can change it at any time.
      </p>

      <p
        style={{
          margin: 0,
          fontSize: '13px',
          lineHeight: 1.6,
        }}
      >
        <strong>Development notice:</strong>{' '}
        XS2Event ticket amounts are currently
        displayed in their original supplier
        currency. Conversion will be enabled
        once the supplier confirms how its
        monetary values are represented.
      </p>
    </section>
  );
}
