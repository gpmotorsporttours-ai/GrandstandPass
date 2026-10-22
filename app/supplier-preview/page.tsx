
import { xs2eventGet } from '../../lib/xs2event';
import SupplierCurrencyPreview from '../../components/SupplierCurrencyPreview';
import SupplierTestCartButton from '../../components/SupplierTestCartButton';
import SupplierSellingPricePreview from '../../components/SupplierSellingPricePreview';
import { calculateSupplierTicketPrice } from '../../lib/supplierPricing';
import {
  getTicketDisplayPrice,
  type TicketDisplayPrice,
} from '../../lib/ticketPricing';
import {
  SUPPORTED_CURRENCIES,
  formatCurrency,
  isSupportedCurrency,
  type SupportedCurrency,
} from '../../lib/currency';

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
  date_stop?: string;
  event_status?: string;
  min_ticket_price_eur?: number | null;
  number_of_tickets?: number | null;
};

type SupplierEventsResponse = {
  events?: SupplierEvent[];
  pagination?: {
    total_size?: number;
    page_size?: number;
    page_number?: number;
    next_page?: string;
  };
};

type SupplierTicket = {
  ticket_id?: string;
  event_id?: string;
  ticket_title?: string;
  category_name?: string;
  category_type?: string;
  type_ticket?: string;
  ticket_status?: string;
  ticket_validity?: string;
  stock?: number | null;
  min_order?: number | null;
  currency_code?: string;
  net_rate?: number | null;
  face_value?: number | null;
  category_id?: string;
  options?: {
    numbered_seat?: boolean;
    covered_seat?: boolean;
    pairs_only?: boolean;
  };
};

type SupplierTicketsResponse = {
  tickets?: SupplierTicket[];
  pagination?: {
    total_size?: number;
    page_size?: number;
    page_number?: number;
    next_page?: string;
  };
};

type PreviewPrice = {
  currency: SupportedCurrency;
  result: TicketDisplayPrice | null;
};

type TicketWithPrices = SupplierTicket & {
  previewPrices: PreviewPrice[];
  sellingPrice: number | null;
};

type EventWithTickets = {
  event: SupplierEvent;
  tickets: TicketWithPrices[];
  ticketCount: number;
  ticketError: boolean;
};

const cardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: '16px',
  overflow: 'hidden',
  background: '#fff',
  color: '#111827',
  boxShadow: '0 6px 24px rgba(0,0,0,0.05)',
} as const;

const rowStyle = {
  margin: '0 0 10px',
  lineHeight: 1.6,
} as const;

function formatEventDate(value?: string) {
  if (!value) return 'Date to be confirmed';

  const date = new Date(value.replace(' ', 'T'));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

// Only EUR and GBP supplier test price units are
// currently supported by this preview.
//
// Keep the original API integer unchanged.
// Divide by 100 only when displaying money or
// calculating indicative currency equivalents.
function getMajorUnitAmount(
  amount: number | null | undefined,
  currency?: string
): number | null {
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return null;
  }

  if (currency !== 'EUR' && currency !== 'GBP') {
    return null;
  }

  return amount / 100;
}

function formatSupplierAmount(
  amount: number | null | undefined,
  currency?: string
) {
  const majorAmount = getMajorUnitAmount(
    amount,
    currency
  );

  if (
    majorAmount !== null &&
    isSupportedCurrency(currency)
  ) {
    return formatCurrency(majorAmount, currency);
  }

  if (
    typeof amount === 'number' &&
    Number.isFinite(amount)
  ) {
    return `Unverified amount: ${amount.toLocaleString(
      'en-GB'
    )} ${currency ?? ''}`;
  }

  return 'Price unavailable';
}

async function addPreviewPrices(
  ticket: SupplierTicket
): Promise<TicketWithPrices> {
  const sourceCurrency = ticket.currency_code;

  const amount = getMajorUnitAmount(
    ticket.net_rate,
    sourceCurrency
  );

  if (
    amount === null ||
    amount <= 0 ||
    !isSupportedCurrency(sourceCurrency)
  ) {
    return {
      ...ticket,
      previewPrices: [],
      sellingPrice: null,
    };
  }

  const previewPrices = await Promise.all(
    SUPPORTED_CURRENCIES.map(async (currency) => {
      try {
        const result = await getTicketDisplayPrice(
          {
            amount,
            currency: sourceCurrency,
          },
          currency
        );

        return {
          currency,
          result,
        };
      } catch (error) {
        console.error(
          'Supplier currency preview failed:',
          error instanceof Error
            ? error.name
            : 'Unknown error'
        );

        return {
          currency,
          result: null,
        };
      }
    })
  );

  // Use the same server-side pricing rules as the green selling-price preview.
  // Never substitute the supplier net rate if FX or pricing is unavailable.
  let sellingPrice: number | null = null;
  if (typeof ticket.net_rate === 'number' && Number.isSafeInteger(ticket.net_rate)) {
    try {
      let eurToSupplierRate: number | undefined;
      if (sourceCurrency !== 'EUR') {
        const conversion = await getTicketDisplayPrice(
          { amount: 1, currency: 'EUR' },
          sourceCurrency
        );
        if (
          conversion &&
          Number.isFinite(conversion.displayAmount) &&
          conversion.displayAmount > 0
        ) {
          eurToSupplierRate = conversion.displayAmount;
        }
      }
      const breakdown = calculateSupplierTicketPrice({
        netRateMinor: ticket.net_rate,
        supplierCurrency: sourceCurrency,
        eurToSupplierRate,
      });
      if (breakdown) {
        // Cart amounts are in major units, rounded to the nearest minor unit.
        sellingPrice = Math.round((breakdown.indicativeSellingPrice + Number.EPSILON) * 100) / 100;
      }
    } catch {
      sellingPrice = null;
    }
  }

  return {
    ...ticket,
    previewPrices,
    sellingPrice,
  };
}

async function getEventTickets(
  event: SupplierEvent
): Promise<EventWithTickets> {
  if (!event.event_id) {
    return {
      event,
      tickets: [],
      ticketCount: 0,
      ticketError: true,
    };
  }

  try {
    const params = new URLSearchParams({
      event_id: event.event_id,
      ticket_status: 'available',
      stock: 'gt:0',
      page_size: '50',
      page: '1',
    });

    const response =
      await xs2eventGet<SupplierTicketsResponse>(
        `/tickets?${params.toString()}`
      );

    const availableTickets = Array.isArray(
      response.tickets
    )
      ? response.tickets.filter(
          (ticket) =>
            ticket.ticket_status === 'available' &&
            typeof ticket.stock === 'number' &&
            ticket.stock > 0
        )
      : [];

    const tickets = await Promise.all(
      availableTickets.map(addPreviewPrices)
    );

    return {
      event,
      tickets,
      ticketCount:
        response.pagination?.total_size ??
        tickets.length,
      ticketError: false,
    };
  } catch (error) {
    console.error(
      'XS2Event ticket retrieval failed:',
      error instanceof Error
        ? error.name
        : 'Unknown error'
    );

    return {
      event,
      tickets: [],
      ticketCount: 0,
      ticketError: true,
    };
  }
}

function TicketPricePreview({
  ticket,
}: {
  ticket: TicketWithPrices;
}) {
  return (
    <div
      style={{
        marginTop: '16px',
        padding: '16px',
        border: '1px solid #bfdbfe',
        borderRadius: '10px',
        background: '#eff6ff',
        color: '#1e3a8a',
      }}
    >
      <h5
        style={{
          fontSize: '16px',
          fontWeight: 800,
          margin: '0 0 8px',
        }}
      >
        Indicative Currency Conversions
      </h5>

      <p
        style={{
          fontSize: '13px',
          lineHeight: 1.6,
          margin: '0 0 14px',
        }}
      >
        Currency equivalents of the XS2Event
        supplier net rate. These are development
        figures, not customer selling prices.
      </p>

      {ticket.previewPrices.length === 0 ? (
        <p style={{ fontSize: '13px', margin: 0 }}>
          Currency conversion is unavailable
          for this supplier amount or currency.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '8px',
          }}
        >
          {ticket.previewPrices.map(
            ({ currency, result }) => (
              <div
                key={currency}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  paddingBottom: '8px',
                  borderBottom:
                    '1px solid #dbeafe',
                }}
              >
                <strong>{currency}</strong>

                <span
                  style={{
                    textAlign: 'right',
                    fontWeight: 700,
                  }}
                >
                  {result
                    ? formatCurrency(
                        result.displayAmount,
                        result.displayCurrency
                      )
                    : 'Unavailable'}
                </span>
              </div>
            )
          )}
        </div>
      )}

      <p
        style={{
          fontSize: '12px',
          lineHeight: 1.6,
          margin: '12px 0 0',
        }}
      >
        Indicative exchange rates may change.
        Supplier fees, taxes, payment charges
        and Grandstand Pass margins are not
        included. Test tickets cannot be
        reserved or purchased.
      </p>
    </div>
  );
}

function TicketOffer({
  ticket,
  event,
}: {
  ticket: TicketWithPrices;
  event: SupplierEvent;
}) {
  return (
    <div
      style={{
        border: '1px solid #dbe3ef',
        borderRadius: '12px',
        padding: '16px',
        background: '#f8fafc',
      }}
    >
      <h4
        style={{
          fontSize: '18px',
          fontWeight: 800,
          margin: '0 0 14px',
          lineHeight: 1.4,
        }}
      >
        {ticket.ticket_title ||
          ticket.category_name ||
          'Unnamed ticket category'}
      </h4>

      <p style={rowStyle}>
        <strong>Category:</strong>{' '}
        {ticket.category_type || 'Unknown'}
      </p>

      <p style={rowStyle}>
        <strong>Ticket type:</strong>{' '}
        {ticket.type_ticket || 'Unknown'}
      </p>

      <p style={rowStyle}>
        <strong>Validity:</strong>{' '}
        {ticket.ticket_validity || 'Unknown'}
      </p>

      <p style={rowStyle}>
        <strong>Status:</strong>{' '}
        {ticket.ticket_status || 'Unknown'}
      </p>

      <p style={rowStyle}>
        <strong>Reported stock:</strong>{' '}
        {ticket.stock ?? 'Unknown'}
      </p>

      <p style={rowStyle}>
        <strong>Minimum order:</strong>{' '}
        {ticket.min_order ?? 'Unknown'}
      </p>

      <div
        style={{
          borderTop: '1px solid #dbe3ef',
          paddingTop: '16px',
          marginTop: '14px',
        }}
      >
        <p
          style={{
            fontSize: '13px',
            color: '#6b7280',
            margin: '0 0 6px',
          }}
        >
          XS2Event supplier net rate
        </p>

        <p
          style={{
            fontSize: '25px',
            fontWeight: 800,
            margin: '0 0 14px',
          }}
        >
          {formatSupplierAmount(
            ticket.net_rate,
            ticket.currency_code
          )}
        </p>

        <p style={rowStyle}>
          <strong>Face value:</strong>{' '}
          {formatSupplierAmount(
            ticket.face_value,
            ticket.currency_code
          )}
        </p>

        <p
          style={{
            fontSize: '12px',
            lineHeight: 1.6,
            color: '#6b7280',
            margin: '8px 0 0',
          }}
        >
          Supplier test prices are displayed
          in normal currency units. Original
          API values remain unchanged in the
          retrieved data. These are not final
          Grandstand Pass selling prices.
        </p>
      </div>

      <TicketPricePreview ticket={ticket} />      {typeof ticket.net_rate === 'number' &&
      Number.isSafeInteger(ticket.net_rate) &&
      ticket.net_rate > 0 &&
      isSupportedCurrency(ticket.currency_code) && (
        <SupplierSellingPricePreview
          netRateMinor={ticket.net_rate}
          supplierCurrency={ticket.currency_code}
        />
      )}

      {ticket.ticket_id &&
      event.event_id &&
      typeof ticket.stock === 'number' &&
      Number.isInteger(ticket.stock) &&
      ticket.stock > 0 &&
      typeof ticket.net_rate === 'number' &&
      Number.isFinite(ticket.net_rate) &&
      ticket.net_rate > 0 &&
      (ticket.currency_code === 'EUR' ||
        ticket.currency_code === 'GBP') ? (
        <SupplierTestCartButton
          ticketId={ticket.ticket_id}
          eventId={event.event_id}
          eventName={event.event_name || 'Unnamed football event'}
          eventDate={formatEventDate(event.date_start)}
          category={ticket.ticket_title || ticket.category_name || 'Unnamed ticket category'}
          categoryId={ticket.category_id}
          stock={ticket.stock}
          minOrder={ticket.min_order ?? 1}
          price={ticket.net_rate / 100}
          sellingPrice={ticket.sellingPrice}
          currency={ticket.currency_code}
          rawNetRate={ticket.net_rate}
          rawFaceValue={
            typeof ticket.face_value === 'number' &&
            Number.isFinite(ticket.face_value) &&
            ticket.face_value >= 0
              ? ticket.face_value
              : undefined
          }
        />
      ) : (
        <p style={{ margin: '14px 0 0', fontSize: '13px', color: '#92400e' }}>
          Test cart unavailable for this offer: ticket identifier,
          stock or supported supplier pricing is missing.
        </p>
      )}

      {ticket.options?.numbered_seat && (
        <p
          style={{
            margin: '14px 0 0',
            fontSize: '13px',
          }}
        >
          Numbered seating reported
        </p>
      )}

      <div
        style={{
          marginTop: '14px',
          padding: '10px',
          borderRadius: '8px',
          background: '#fff3cd',
          color: '#5c4500',
          fontSize: '12px',
          fontWeight: 700,
          textAlign: 'center',
        }}
      >
        TEST DATA — NOT FOR SALE
      </div>
    </div>
  );
}

export default async function SupplierPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ eventId?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedEventId =
    typeof resolvedSearchParams?.eventId === 'string'
      ? resolvedSearchParams.eventId
      : '';

  const today = new Date().toISOString().slice(0, 10);

  let events: SupplierEvent[] = [];
  let totalEvents = 0;
  let errorMessage = '';

  try {
    const params = new URLSearchParams({
      sport_type: 'soccer',
      date_stop: today,
      page_size: '20',
      page: '1',
    });

    const response =
      await xs2eventGet<SupplierEventsResponse>(
        `/events?${params.toString()}`
      );

    events = Array.isArray(response.events)
      ? response.events
      : [];

    totalEvents =
      response.pagination?.total_size ??
      events.length;
  } catch (error) {
    console.error(
      'XS2Event supplier preview failed:',
      error instanceof Error
        ? error.name
        : 'Unknown error'
    );

    errorMessage =
      'We could not load XS2Event events right now. Please try again later.';
  }

  // A link from the Football browser selects one XS2Event match.
  // Direct visits without an eventId still show the full test catalogue.
  const visibleEvents = requestedEventId
    ? events.filter(event => event.event_id === requestedEventId)
    : events;

  const eventsWithTickets = await Promise.all(
    visibleEvents.map(getEventTickets)
  );

  return (
    <main
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '48px 20px 80px',
      }}
    >
      <div
        style={{
          background: '#fff3cd',
          color: '#5c4500',
          border: '1px solid #e8cf76',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '32px',
        }}
      >
        <strong>
          XS2Event Test Environment — Not for Sale
        </strong>

        <p style={{ margin: '8px 0 0' }}>
          This page displays supplier test data
          for development purposes. Tickets
          cannot be purchased or reserved.
          Supplier net rates and indicative
          Grandstand Pass selling-price calculations
          are shown separately. Neither is a confirmed
          checkout price.
        </p>
      </div>

      <div style={{ marginBottom: '36px' }}>
        <p
          style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#888',
          }}
        >
          GRANDSTAND PASS
        </p>

        <h1
          style={{
            fontSize: 'clamp(30px, 5vw, 48px)',
            fontWeight: 800,
            margin: '12px 0',
          }}
        >
          XS2Event Supplier Preview
        </h1>

        <p
          style={{
            fontSize: '17px',
            lineHeight: 1.7,
            color: '#777',
            maxWidth: '750px',
          }}
        >
          Explore football events and ticket
          inventory retrieved directly from
          the XS2Event test API. All information
          is for development and testing only.
        </p>
      </div>

      <div
        style={{
          padding: '20px',
          borderRadius: '12px',
          background: '#f3f4f6',
          color: '#111827',
          marginBottom: '28px',
        }}
      >
        <strong>Supplier connection:</strong>{' '}
        {errorMessage
          ? 'Unavailable'
          : 'Connected'}

        <span style={{ margin: '0 12px' }}>
          |
        </span>

        <strong>Sport:</strong> Football

        <span style={{ margin: '0 12px' }}>
          |
        </span>

        <strong>Events found:</strong>{' '}
        {totalEvents}
      </div>

      {requestedEventId && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <p className="font-bold text-navy">
            {visibleEvents.length > 0
              ? `Viewing tickets for ${visibleEvents[0].event_name || 'selected match'}`
              : 'Selected match is not available in the current test feed'}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {visibleEvents.length > 0
              ? 'Only ticket offers for this match are shown below.'
              : 'XS2Event test inventory can change or expire. Return to Football to select another match.'}
          </p>
          <a href="/football" className="mt-3 inline-block font-bold text-blue-700 underline">
            Back to Football
          </a>
        </div>
      )}

      <SupplierCurrencyPreview />

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '24px',
            borderRadius: '12px',
            background: '#fee2e2',
            color: '#991b1b',
            marginBottom: '24px',
          }}
        >
          {errorMessage}
        </div>
      )}

      {!errorMessage &&
        visibleEvents.length === 0 &&
        !requestedEventId && (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              border: '1px solid #ddd',
              borderRadius: '14px',
            }}
          >
            <h2>
              No upcoming football events found
            </h2>

            <p>
              The XS2Event test environment
              has not returned any upcoming
              football events for this request.
            </p>
          </div>
        )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {eventsWithTickets.map(
          (
            {
              event,
              tickets,
              ticketCount,
              ticketError,
            },
            index
          ) => (
            <article
              key={event.event_id ?? index}
              style={cardStyle}
            >
              <div
                style={{
                  background:
                    'linear-gradient(135deg, #141414, #343434)',
                  color: '#fff',
                  padding: '22px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    color: '#f5d77a',
                    textTransform: 'uppercase',
                    marginBottom: '14px',
                  }}
                >
                  {event.tournament_name ??
                    'Football Event'}
                </div>

                <h2
                  style={{
                    fontSize: '23px',
                    fontWeight: 800,
                    lineHeight: 1.35,
                    margin: 0,
                  }}
                >
                  {event.event_name ??
                    'Event name unavailable'}
                </h2>
              </div>

              <div style={{ padding: '24px' }}>
                <p style={rowStyle}>
                  <strong>Date:</strong>{' '}
                  {formatEventDate(
                    event.date_start
                  )}
                </p>

                <p style={rowStyle}>
                  <strong>Venue:</strong>{' '}
                  {event.venue_name ??
                    'Venue to be confirmed'}
                </p>

                <p style={rowStyle}>
                  <strong>Location:</strong>{' '}
                  {[
                    event.city,
                    event.iso_country,
                  ]
                    .filter(Boolean)
                    .join(', ') ||
                    'To be confirmed'}
                </p>

                <p
                  style={{
                    ...rowStyle,
                    marginBottom: '20px',
                  }}
                >
                  <strong>Event status:</strong>{' '}
                  {event.event_status ??
                    'Unknown'}
                </p>

                <div
                  style={{
                    borderTop:
                      '1px solid #e5e7eb',
                    paddingTop: '20px',
                  }}
                >
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      margin: '0 0 6px',
                    }}
                  >
                    Supplier-reported minimum price
                  </p>

                  <p
                    style={{
                      fontSize: '24px',
                      fontWeight: 800,
                      margin: '0 0 10px',
                    }}
                  >
                    {formatSupplierAmount(
                      event.min_ticket_price_eur,
                      'EUR'
                    )}
                  </p>

                  <p
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      lineHeight: 1.6,
                      margin: '0 0 14px',
                    }}
                  >
                    Event-level minimum price
                    reported by XS2Event.
                    This is not a customer
                    selling price.
                  </p>

                  <p
                    style={{
                      fontSize: '14px',
                      margin: '0 0 16px',
                    }}
                  >
                    <strong>
                      Reported ticket count:
                    </strong>{' '}
                    {event.number_of_tickets ??
                      'Unknown'}
                  </p>

                  <div
                    style={{
                      borderTop:
                        '1px solid #e5e7eb',
                      paddingTop: '18px',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '19px',
                        fontWeight: 800,
                        margin: '0 0 14px',
                      }}
                    >
                      Supplier ticket offers
                    </h3>

                    {ticketError && (
                      <p
                        style={{
                          color: '#b45309',
                        }}
                      >
                        Ticket information
                        could not be loaded
                        for this event.
                      </p>
                    )}

                    {!ticketError &&
                      tickets.length === 0 && (
                        <p
                          style={{
                            color: '#6b7280',
                          }}
                        >
                          No available ticket
                          offers with positive
                          stock were returned.
                        </p>
                      )}

                    {!ticketError &&
                      tickets.length > 0 && (
                        <>
                          <p
                            style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              margin: '0 0 14px',
                            }}
                          >
                            Showing{' '}
                            {tickets.length} of{' '}
                            {ticketCount}{' '}
                            matching supplier
                            offers.
                          </p>

                          <div
                            style={{
                              display: 'grid',
                              gap: '12px',
                            }}
                          >
                            {tickets.map(
                              (
                                ticket,
                                ticketIndex
                              ) => (
                                <TicketOffer
                                  key={
                                    ticket.ticket_id ??
                                    ticketIndex
                                  }
                                  ticket={ticket}
                                  event={event}
                                />
                              )
                            )}
                          </div>
                        </>
                      )}
                  </div>
                </div>
              </div>
            </article>
          )
        )}
      </div>

      <div
        style={{
          marginTop: '40px',
          padding: '20px',
          border: '1px dashed #aaa',
          borderRadius: '12px',
          color: 'inherit',
        }}
      >
        <strong>What comes next?</strong>

        <p
          style={{
            margin: '8px 0 0',
            lineHeight: 1.7,
          }}
        >
          Indicative selling-price calculations
          use a €5 handling allowance per ticket
          and a 15% markup across all events.
          Supplier charges, applicable taxes,
          and payment fees still require
          confirmation before live sales.
          The test cart continues to show
          supplier net rates. Checkout remains
          disabled.
        </p>
      </div>
    </main>
  );
}
