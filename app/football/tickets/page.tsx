import Link from 'next/link';
import { CalendarDays, MapPin, Ticket } from 'lucide-react';
import { xs2eventGet } from '../../../lib/xs2event';
import { calculateSupplierTicketPrice } from '../../../lib/supplierPricing';
import { getTicketDisplayPrice } from '../../../lib/ticketPricing';
import { isSupportedCurrency } from '../../../lib/currency';
import FootballDisplayPrice from '../../../components/FootballDisplayPrice';
import SupplierTestCartButton from '../../../components/SupplierTestCartButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupplierEvent = {
  event_id?: string;
  event_name?: string;
  tournament_name?: string;
  venue_name?: string;
  city?: string;
  iso_country?: string;
  date_start?: string;
};

type EventsResponse = { events?: SupplierEvent[]; pagination?: { next_page?: string } };

type SupplierTicket = {
  ticket_id?: string;
  event_id?: string;
  ticket_title?: string;
  category_name?: string;
  category_id?: string;
  ticket_status?: string;
  stock?: number | null;
  min_order?: number | null;
  currency_code?: string;
  net_rate?: number | null;
  face_value?: number | null;
  options?: { numbered_seat?: boolean; covered_seat?: boolean; pairs_only?: boolean };
};

type TicketsResponse = { tickets?: SupplierTicket[] };

type DisplayCurrency = 'ZAR' | 'EUR' | 'USD' | 'GBP' | 'AED';
type CurrencyAmounts = Partial<Record<DisplayCurrency, number>>;
type PricedTicket = {
  ticket: SupplierTicket;
  sellingPrice: number | null;
  displayPrices: CurrencyAmounts;
};

const displayCurrencies: DisplayCurrency[] = ['ZAR', 'EUR', 'USD', 'GBP', 'AED'];

async function getDisplayPrices(
  sellingPrice: number | null,
  currency: string | undefined
): Promise<CurrencyAmounts> {
  if (sellingPrice === null || !isSupportedCurrency(currency)) return {};

  const results = await Promise.all(
    displayCurrencies.map(async targetCurrency => {
      if (targetCurrency === currency) {
        return [targetCurrency, sellingPrice] as const;
      }
      try {
        const converted = await getTicketDisplayPrice(
          { amount: sellingPrice, currency },
          targetCurrency
        );
        const amount = converted?.displayAmount;
        if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
          return [targetCurrency, amount] as const;
        }
      } catch {
        // The original selling price remains available if FX fails.
      }
      return [targetCurrency, null] as const;
    })
  );

  const prices: CurrencyAmounts = {};
  for (const [targetCurrency, amount] of results) {
    if (amount !== null) prices[targetCurrency] = amount;
  }
  return prices;
}

function formatEventDate(value?: string): string {
  if (!value) return 'Date to be confirmed';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }).format(date);
}

async function getSellingPrice(ticket: SupplierTicket): Promise<number | null> {
  const currency = ticket.currency_code;
  const netRateMinor = ticket.net_rate;
  if (
    (currency !== 'EUR' && currency !== 'GBP') ||
    !Number.isSafeInteger(netRateMinor) ||
    typeof netRateMinor !== 'number' || netRateMinor <= 0
  ) return null;

  try {
    let eurToSupplierRate: number | undefined;
    if (currency !== 'EUR') {
      const conversion = await getTicketDisplayPrice(
        { amount: 1, currency: 'EUR' }, currency
      );
      if (!conversion || !Number.isFinite(conversion.displayAmount) || conversion.displayAmount <= 0) return null;
      eurToSupplierRate = conversion.displayAmount;
    }
    const breakdown = calculateSupplierTicketPrice({
      netRateMinor, supplierCurrency: currency, eurToSupplierRate,
    });
    return breakdown
      ? Math.round((breakdown.indicativeSellingPrice + Number.EPSILON) * 100) / 100
      : null;
  } catch {
    return null;
  }
}

export default async function FootballTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string | string[] }>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === 'string' ? params.eventId : '';
  if (!eventId || eventId.length > 150) {
    return (
      <main className="container-wide py-10 md:py-14">
        <Link href="/football" className="text-blue font-bold hover:underline">
          ← Back to Football
        </Link>
        <section className="mt-8 rounded-2xl border bg-white p-8 md:p-12">
          <div className="flex items-center gap-3">
            <Ticket size={28} className="text-blue" />
            <h1 className="text-2xl md:text-3xl font-black text-navy">
              Choose a football match first
            </h1>
          </div>
          <p className="muted mt-4 max-w-2xl">
            Browse football matches and select an event to view its ticket
            categories, indicative Grandstand Pass prices and availability.
          </p>
          <Link
            href="/football"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-navy px-6 py-3 font-bold text-white hover:opacity-90"
          >
            Browse Football Matches →
          </Link>
          <p className="muted mt-6 text-xs">
            XS2Event test tickets are not for sale. No reservations or payments
            can be made, and checkout remains disabled.
          </p>
        </section>
      </main>
    );
  }

  let event: SupplierEvent | undefined;
  let tickets: PricedTicket[] = [];
  let loadError = false;

  try {
    const today = new Date().toISOString().slice(0, 10);
    // Match the same event feed used by the existing supplier preview.
    const eventQuery = new URLSearchParams({
      sport_type: 'soccer', date_stop: today, page_size: '20', page: '1',
    });
    const eventResponse = await xs2eventGet<EventsResponse>(`/events?${eventQuery.toString()}`);
    event = eventResponse.events?.find(item => item.event_id === eventId);

    if (event) {
      const ticketQuery = new URLSearchParams({
        event_id: eventId, ticket_status: 'available', stock: 'gt:0',
        page_size: '50', page: '1',
      });
      const response = await xs2eventGet<TicketsResponse>(`/tickets?${ticketQuery.toString()}`);
      const available = (response.tickets ?? []).filter(ticket =>
        ticket.ticket_status === 'available' &&
        typeof ticket.stock === 'number' &&
        Number.isInteger(ticket.stock) && ticket.stock > 0 &&
        (!ticket.event_id || ticket.event_id === eventId)
      );
      tickets = await Promise.all(available.map(async ticket => {
        const sellingPrice = await getSellingPrice(ticket);
        return {
          ticket,
          sellingPrice,
          displayPrices: await getDisplayPrices(sellingPrice, ticket.currency_code),
        };
      }));
    }
  } catch (error) {
    console.error('Football ticket page failed to load:', error instanceof Error ? error.name : 'Unknown error');
    loadError = true;
  }

  return (
    <main className="container-wide py-10 md:py-14">
      <Link href="/football" className="text-blue font-bold hover:underline">
        ← Back to Football
      </Link>

      <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <strong>TEST DATA — NOT FOR SALE.</strong> Ticket offers are for development only.
        No reservation or payment can be made. Checkout remains disabled.
      </div>

      {loadError ? (
        <div role="alert" className="mt-8 rounded-2xl border bg-white p-8">
          Football ticket information is temporarily unavailable. Please try again later.
        </div>
      ) : !event ? (
        <div className="mt-8 rounded-2xl border bg-white p-8">
          <h1 className="text-2xl font-black text-navy">Match unavailable</h1>
          <p className="muted mt-3">This match is not in the current XS2Event test feed. Test inventory can change or expire.</p>
        </div>
      ) : (
        <>
          <header className="mt-8 rounded-2xl bg-ice p-6 md:p-10">
            <p className="text-sm font-bold uppercase tracking-wide text-blue">
              {event.tournament_name || 'Football'}
            </p>
            <h1 className="mt-3 text-3xl md:text-5xl font-black text-navy">
              {event.event_name || 'Football match'}
            </h1>
            <div className="mt-6 flex flex-col gap-3 text-sm md:text-base text-navy">
              <p className="flex items-center gap-2"><CalendarDays size={19} className="text-blue" />{formatEventDate(event.date_start)}</p>
              <p className="flex items-center gap-2"><MapPin size={19} className="text-blue" />{[event.venue_name, event.city, event.iso_country].filter(Boolean).join(', ') || 'Venue to be confirmed'}</p>
            </div>
          </header>

          <section className="mt-10">
            <div className="flex items-center gap-3">
              <Ticket size={26} className="text-blue" />
              <h2 className="text-2xl md:text-3xl font-black text-navy">Choose your tickets</h2>
            </div>
            <p className="muted mt-3">Browse reported ticket categories and add test selections to your development cart.</p>

            {tickets.length === 0 ? (
              <div className="mt-6 rounded-2xl border bg-white p-6 muted">
                No available ticket offers were returned for this match.
              </div>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {tickets.map(({ ticket, sellingPrice, displayPrices }, index) => {
                  const currency = ticket.currency_code;
                  const validCurrency = isSupportedCurrency(currency);
                  const validNet = typeof ticket.net_rate === 'number' && Number.isSafeInteger(ticket.net_rate) && ticket.net_rate > 0;
                  const canAdd = Boolean(ticket.ticket_id && validNet && validCurrency && sellingPrice !== null);
                  return (
                    <article key={ticket.ticket_id || index} className="rounded-2xl border bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-black text-navy">
                        {ticket.ticket_title || ticket.category_name || 'Ticket category'}
                      </h3>
                      <p className="muted text-sm mt-3">
                        Reported availability: {ticket.stock ?? 'Unknown'} tickets
                        {' · '}Minimum order: {ticket.min_order ?? 1}
                      </p>
                      {ticket.options?.numbered_seat && <p className="muted text-sm mt-2">Numbered seating reported</p>}
                      {ticket.options?.covered_seat && <p className="muted text-sm mt-2">Covered seating reported</p>}
                      {ticket.options?.pairs_only && <p className="muted text-sm mt-2">Tickets may require purchase in pairs</p>}
                      <div className="mt-5 rounded-xl bg-ice p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-blue">Indicative Grandstand Pass price</p>
                        {sellingPrice !== null && validCurrency ? (
                          <FootballDisplayPrice
                            sellingPrice={sellingPrice}
                            currency={currency}
                            displayPrices={displayPrices}
                          />
                        ) : (
                          <p className="mt-1 text-2xl font-black text-navy">Price unavailable</p>
                        )}
                      </div>
                      {canAdd ? (
                        <SupplierTestCartButton
                          ticketId={ticket.ticket_id!}
                          eventId={eventId}
                          eventName={event.event_name || 'Football match'}
                          eventDate={formatEventDate(event.date_start)}
                          category={ticket.ticket_title || ticket.category_name || 'Ticket category'}
                          categoryId={ticket.category_id}
                          stock={ticket.stock!}
                          minOrder={ticket.min_order ?? 1}
                          price={ticket.net_rate! / 100}
                          sellingPrice={sellingPrice}
                          currency={currency!}
                          rawNetRate={ticket.net_rate!}
                          rawFaceValue={typeof ticket.face_value === 'number' && Number.isFinite(ticket.face_value) && ticket.face_value >= 0 ? ticket.face_value : undefined}
                        />
                      ) : (
                        <p className="mt-4 text-sm text-amber-800">This offer cannot be added to the test cart because pricing or supplier details are unavailable.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <p className="muted mt-8 text-xs">Indicative prices include a €5 handling allowance per ticket and 15% markup. Taxes, payment charges and other costs are not yet confirmed. Supplier availability may change.</p>
        </>
      )}
    </main>
  );
}
