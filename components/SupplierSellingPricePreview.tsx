
import {
  calculateSupplierTicketPrice,
} from '../lib/supplierPricing';

import {
  getTicketDisplayPrice,
} from '../lib/ticketPricing';

import {
  SUPPORTED_CURRENCIES,
  formatCurrency,
  isSupportedCurrency,
  type SupportedCurrency,
} from '../lib/currency';

type Props = {
  netRateMinor: number;
  supplierCurrency: string;
};

type CurrencyPreview = {
  currency: SupportedCurrency;
  amount: number | null;
};

export default async function SupplierSellingPricePreview({
  netRateMinor,
  supplierCurrency,
}: Props) {
  if (
    !isSupportedCurrency(supplierCurrency) ||
    !Number.isSafeInteger(netRateMinor) ||
    netRateMinor <= 0
  ) {
    return null;
  }

  let eurToSupplierRate: number | undefined;

  if (supplierCurrency !== 'EUR') {
    try {
      const conversion = await getTicketDisplayPrice(
        {
          amount: 1,
          currency: 'EUR',
        },
        supplierCurrency
      );

      if (
        !conversion ||
        !Number.isFinite(conversion.displayAmount) ||
        conversion.displayAmount <= 0
      ) {
        return null;
      }

      eurToSupplierRate = conversion.displayAmount;
    } catch {
      return null;
    }
  }

  const breakdown = calculateSupplierTicketPrice({
    netRateMinor,
    supplierCurrency,
    eurToSupplierRate,
  });

  if (!breakdown) {
    return null;
  }

  const conversions: CurrencyPreview[] =
    await Promise.all(
      SUPPORTED_CURRENCIES.map(async (currency) => {
        try {
          const result = await getTicketDisplayPrice(
            {
              amount: breakdown.indicativeSellingPrice,
              currency: supplierCurrency,
            },
            currency
          );

          return {
            currency,
            amount: result?.displayAmount ?? null,
          };
        } catch {
          return {
            currency,
            amount: null,
          };
        }
      })
    );

  return (
    <section
      style={{
        marginTop: '16px',
        padding: '18px',
        border: '1px solid #86efac',
        borderRadius: '12px',
        background: '#f0fdf4',
        color: '#14532d',
      }}
    >
      <h4
        style={{
          margin: '0 0 12px',
          fontSize: '17px',
          fontWeight: 800,
        }}
      >
        Grandstand Pass Pricing Preview
      </h4>

      <p style={{ margin: '0 0 8px' }}>
        Supplier net rate:{' '}
        <strong>
          {formatCurrency(
            breakdown.supplierNetRate,
            supplierCurrency
          )}
        </strong>
      </p>

      <p style={{ margin: '0 0 8px' }}>
        Handling allowance:{' '}
        <strong>
          {formatCurrency(
            breakdown.handlingAllowance,
            supplierCurrency
          )}
        </strong>
      </p>

      <p style={{ margin: '0 0 8px' }}>
        Cost before markup:{' '}
        <strong>
          {formatCurrency(
            breakdown.costBasis,
            supplierCurrency
          )}
        </strong>
      </p>

      <p style={{ margin: '0 0 12px' }}>
        15% markup:{' '}
        <strong>
          {formatCurrency(
            breakdown.markupAmount,
            supplierCurrency
          )}
        </strong>
      </p>

      <div
        style={{
          padding: '12px',
          borderRadius: '8px',
          background: '#dcfce7',
          marginBottom: '14px',
        }}
      >
        <p
          style={{
            fontSize: '12px',
            margin: '0 0 4px',
            fontWeight: 700,
          }}
        >
          INDICATIVE GRANDSTAND PASS PRICE
        </p>

        <p
          style={{
            fontSize: '26px',
            fontWeight: 800,
            margin: 0,
          }}
        >
          {formatCurrency(
            breakdown.indicativeSellingPrice,
            supplierCurrency
          )}
        </p>
      </div>

      <h5 style={{ margin: '0 0 10px' }}>
        Currency equivalents
      </h5>

      {conversions.map(({ currency, amount }) => (
        <div
          key={currency}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '7px 0',
            borderBottom: '1px solid #bbf7d0',
          }}
        >
          <strong>{currency}</strong>

          <strong>
            {amount !== null
              ? formatCurrency(amount, currency)
              : 'Unavailable'}
          </strong>
        </div>
      ))}

      <p
        style={{
          fontSize: '12px',
          lineHeight: 1.6,
          margin: '14px 0 0',
        }}
      >
        TEST PRICING ONLY — NOT FOR SALE.
        Includes a €5 handling allowance per
        ticket and a 15% markup. Currency
        conversions are indicative. Additional
        applicable taxes or payment charges
        have not been confirmed. This price
        is not available for checkout.
      </p>
    </section>
  );
}
