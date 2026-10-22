import Link from 'next/link';
import { xs2eventGet } from '../lib/xs2event';
import { isSupportedCurrency, formatCurrency } from '../lib/currency';
import SupplierSellingPricePreview from './SupplierSellingPricePreview';
import SupplierTestCartButton from './SupplierTestCartButton';

type SupplierEvent = {
  event_id?: string;
  event_name?: string;
  tournament_name?: string;
  venue_name?: string;
  city?: string;
  date_start?: string;
};

type SupplierTicket = {
  ticket_id?: string;
  ticket_title?: string;
  category_name?: string;
  category_id?: string;
  currency_code?: string;
  net_rate?: number | null;
  face_value?: number | null;
  stock?: number | null;
  min_order?: number | null;
  ticket_status?: string;
};

type EventResponse = { events?: SupplierEvent[] };
type TicketResponse = { tickets?: SupplierTicket[] };

type EventListing = {
  event: SupplierEvent;
  tickets: SupplierTicket[];
};

export default async function XS2EventFootballTestListings() {
  let listings: EventListing[] = [];
  let error = false;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const eventParams = new URLSearchParams({
      sport_type: 'soccer',
      date_stop: today,
      page_size: '20',
      page: '1',
    });
    const response = await xs2eventGet<EventResponse>(
      `/events?${eventParams.toString()}`
    );
    const events = Array.isArray(response.events) ? response.events : [];

    listings = await Promise.all(
      events.filter((event) => Boolean(event.event_id)).map(async (event) => {
        try {
          const ticketParams = new URLSearchParams({
            event_id: event.event_id!,
            ticket_status: 'available',
            stock: 'gt:0',
            page_size: '50',
            page: '1',
          });
          const ticketResponse = await xs2eventGet<TicketResponse>(
            `/tickets?${ticketParams.toString()}`
          );
          const tickets = Array.isArray(ticketResponse.tickets)
            ? ticketResponse.tickets.filter(
                (ticket) =>
                  ticket.ticket_status === 'available' &&
                  typeof ticket.stock === 'number' &&
                  Number.isInteger(ticket.stock) &&
                  ticket.stock > 0
              )
            : [];
          return { event, tickets };
        } catch {
          return { event, tickets: [] };
        }
      })
    );
  } catch {
    error = true;
  }

  return (
    <section className="container-wide pb-16" aria-label="XS2Event test football listings">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 mb-6 text-amber-950">
        <h2 className="text-2xl font-black">XS2Event test football matches</h2>
        <p className="mt-2 text-sm">
          TEST DATA — NOT FOR SALE. These are development-only supplier offers,
          not live inventory. Prices include an indicative €5 handling allowance
          and 15% markup. Stock is not reserved, and checkout is disabled.
        </p>
      </div>

      {error ? (
        <p className="muted">Test supplier listings are temporarily unavailable.</p>
      ) : listings.length === 0 ? (
        <p className="muted">No test supplier football matches are available right now.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {listings.map(({ event, tickets }) => (
            <article key={event.event_id} className="rounded-2xl border bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-blue">
                {event.tournament_name || 'Football'} · TEST ONLY
              </p>
              <h3 className="text-xl font-black text-navy mt-2">
                {event.event_name || 'Football match'}
              </h3>
              <p className="muted text-sm mt-2">
                {[event.venue_name, event.city, event.date_start]
                  .filter(Boolean)
                  .join(' · ')}
              </p>

              {tickets.length === 0 ? (
                <p className="muted text-sm mt-5">No available test ticket offers reported.</p>
              ) : (
                <div className="space-y-5 mt-5">
                  {tickets.map((ticket, index) => {
                    const currency = ticket.currency_code;
                    const validPrice =
                      isSupportedCurrency(currency) &&
                      typeof ticket.net_rate === 'number' &&
                      Number.isSafeInteger(ticket.net_rate) &&
                      ticket.net_rate > 0;
                    return (
                      <div key={ticket.ticket_id || index} className="rounded-xl border bg-slate-50 p-4">
                        <h4 className="font-bold text-navy">
                          {ticket.ticket_title || ticket.category_name || 'Ticket category'}
                        </h4>
                        <p className="text-sm mt-2">Reported stock: {ticket.stock}</p>
                        <p className="text-sm mt-1">
                          Supplier net rate: {validPrice
                            ? formatCurrency(ticket.net_rate! / 100, currency as import('../lib/currency').SupportedCurrency)
                            : 'Unavailable'}
                        </p>
                        {validPrice && (
                          <SupplierSellingPricePreview
                            netRateMinor={ticket.net_rate!}
                            supplierCurrency={currency}
                          />
                        )}
                        {validPrice && ticket.ticket_id && event.event_id && (
                          <div className="mt-4">
                            <SupplierTestCartButton
                              ticketId={ticket.ticket_id}
                              eventId={event.event_id}
                              eventName={event.event_name || 'Football match'}
                              eventDate={event.date_start}
                              category={ticket.ticket_title || ticket.category_name || 'Ticket category'}
                              categoryId={ticket.category_id}
                              stock={ticket.stock!}
                              minOrder={ticket.min_order ?? 1}
                              price={ticket.net_rate! / 100}
                              currency={currency}
                              rawNetRate={ticket.net_rate!}
                              rawFaceValue={typeof ticket.face_value === 'number' ? ticket.face_value : undefined}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="muted text-sm mt-6">
        More supplier diagnostics are available in the{' '}
        <Link href="/supplier-preview" className="text-blue font-bold underline">
          XS2Event Supplier Preview
        </Link>.
      </p>
    </section>
  );
}
