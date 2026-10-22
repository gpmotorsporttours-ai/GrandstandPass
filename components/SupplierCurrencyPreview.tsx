
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
        Grandstand Pass supports five display
        currencies: ZAR, EUR, USD, GBP and AED.
        Your preferred currency can be changed
        using the dropdown in the website header.
      </p>

      <p
        style={{
          margin: '0 0 10px',
          lineHeight: 1.6,
        }}
      >
        The supplier ticket offers below show
        indicative currency equivalents in all
        five supported currencies, using our
        connected exchange-rate service.
      </p>

      <p
        style={{
          margin: 0,
          fontSize: '13px',
          lineHeight: 1.6,
        }}
      >
        <strong>Development notice:</strong>{' '}
        These conversions are based on XS2Event
        test supplier net rates. They are not
        final customer selling prices. Supplier
        fees, applicable taxes and Grandstand
        Pass margins have not yet been applied.
        Ticket reservations and checkout remain
        disabled.
      </p>
    </section>
  );
}
