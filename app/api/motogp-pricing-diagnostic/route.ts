
import { NextResponse } from 'next/server';
import { xs2eventGet } from '../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupplierTicket = {
  event_id?: string;
  ticket_title?: string;
  category_name?: string;
  ticket_id?: string;
  ticket_status?: string;
  stock?: number | null;
  currency_code?: string | null;
  net_rate?: number | null;
};

type TicketsResponse = {
  tickets?: SupplierTicket[];
};

const EVENT_ID =
  '6989aa93c69a4743945ee061a343cfbe_spp';

export async function GET() {
  try {
    const params = new URLSearchParams({
      event_id: EVENT_ID,
      ticket_status: 'available',
      stock: 'gt:0',
      page_size: '50',
      page: '1',
    });

    const response = await xs2eventGet<TicketsResponse>(
      `/tickets?${params.toString()}`
    );

    const tickets = Array.isArray(response.tickets)
      ? response.tickets
      : [];

    const diagnostics = tickets
      .filter(ticket =>
        ticket.ticket_status === 'available' &&
        typeof ticket.stock === 'number' &&
        Number.isInteger(ticket.stock) &&
        ticket.stock > 0 &&
        (!ticket.event_id ||
          ticket.event_id === EVENT_ID)
      )
      .map(ticket => {
        const currency = ticket.currency_code;
        const netRate = ticket.net_rate;

        const validNetRate =
          typeof netRate === 'number' &&
          Number.isSafeInteger(netRate) &&
          netRate > 0;

        const supportedPricingCurrency =
          currency === 'EUR' || currency === 'GBP';

        let pricingIssue = 'none';

        if (!validNetRate) {
          pricingIssue = 'missing_or_invalid_net_rate';
        } else if (!supportedPricingCurrency) {
          pricingIssue = 'unsupported_supplier_currency';
        }

        return {
          category:
            ticket.ticket_title ||
            ticket.category_name ||
            'Unnamed category',
          currencyCode: currency ?? null,
          netRatePresent:
            netRate !== undefined && netRate !== null,
          netRateValid: validNetRate,
          netRateIsZero: netRate === 0,
          supportedPricingCurrency,
          ticketIdPresent: Boolean(ticket.ticket_id),
          pricingIssue,
        };
      });

    return NextResponse.json(
      {
        testData: true,
        event: 'Portuguese MotoGP',
        categoriesChecked: diagnostics.length,
        diagnostics,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        testData: true,
        error: 'MotoGP pricing diagnostic unavailable',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
