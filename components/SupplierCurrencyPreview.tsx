
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
        Ticket prices are calculated using the
        Grandstand Pass pricing structure, which
        includes a €5 handling allowance per
        ticket and a 15% markup.
      </p>

      <p
        style={{
          margin: '0 0 10px',
          lineHeight: 1.6,
        }}
      >
        Indicative currency equivalents use
        our connected exchange-rate service.
        Exchange rates may change, and the
        final customer price is not yet confirmed.
      </p>

      <p
        style={{
          margin: 0,
          fontSize: '13px',
          lineHeight: 1.6,
        }}
      >
        <strong>Development notice:</strong>{' '}
        XS2Event test tickets are not for sale.
        Displayed prices are indicative and may
        exclude applicable taxes, payment charges
        and other costs. Ticket availability is
        not guaranteed. No supplier reservation
        or payment is created, and checkout
        remains disabled.
      </p>
    </section>
  );
}
