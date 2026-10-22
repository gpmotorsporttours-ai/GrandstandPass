
import { xs2eventGet } from '../../lib/xs2event';

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

export default async function SupplierPreviewPage() {
  const today = new Date().toISOString().slice(0, 10);

  let events: SupplierEvent[] = [];
  let totalEvents = 0;
  let errorMessage = '';

  try {
    const params = new URLSearchParams({
      sport_type: 'soccer',
      date_stop: today,
    });

    const response =
      await xs2eventGet<SupplierEventsResponse>(
        `/events?${params.toString()}`
      );

    events = Array.isArray(response.events)
      ? response.events
      : [];

    totalEvents =
      response.pagination?.total_size ?? events.length;
  } catch (error) {
    console.error(
      'XS2Event supplier preview failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );

    errorMessage =
      'We could not load XS2Event events right now. Please try again later.';
  }

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
          This page displays supplier test data for
          development purposes. Tickets cannot be purchased
          or reserved through this page.
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
          Explore sporting events retrieved directly from
          the XS2Event test API. We are starting with
          football and will expand to other sports and
          ticket categories as integration progresses.
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
        {errorMessage ? 'Unavailable' : 'Connected'}

        <span style={{ margin: '0 12px' }}>|</span>

        <strong>Sport:</strong> Football

        <span style={{ margin: '0 12px' }}>|</span>

        <strong>Events found:</strong> {totalEvents}
      </div>

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

      {!errorMessage && events.length === 0 && (
        <div
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            border: '1px solid #ddd',
            borderRadius: '14px',
          }}
        >
          <h2>No upcoming football events found</h2>

          <p>
            The XS2Event test environment has not returned
            any upcoming football events for this request.
          </p>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '24px',
        }}
      >
        {events.map((event, index) => (
          <article
            key={event.event_id ?? index}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              overflow: 'hidden',
              background: '#fff',
              color: '#111827',
              boxShadow: '0 6px 24px rgba(0,0,0,0.05)',
            }}
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
              <p style={{ margin: '0 0 12px' }}>
                <strong>Date:</strong>{' '}
                {formatEventDate(event.date_start)}
              </p>

              <p style={{ margin: '0 0 12px' }}>
                <strong>Venue:</strong>{' '}
                {event.venue_name ??
                  'Venue to be confirmed'}
              </p>

              <p style={{ margin: '0 0 12px' }}>
                <strong>Location:</strong>{' '}
                {[event.city, event.iso_country]
                  .filter(Boolean)
                  .join(', ') || 'To be confirmed'}
              </p>

              <p style={{ margin: '0 0 20px' }}>
                <strong>Event status:</strong>{' '}
                {event.event_status ?? 'Unknown'}
              </p>

              <div
                style={{
                  borderTop: '1px solid #e5e7eb',
                  paddingTop: '20px',
                }}
              >
                <p
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '6px',
                  }}
                >
                  Supplier-reported minimum price
                </p>

                <p
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    margin: '0 0 10px',
                  }}
                >
                  {typeof event.min_ticket_price_eur ===
                    'number'
                    ? `${event.min_ticket_price_eur} EUR (raw supplier value)`
                    : 'Price unavailable'}
                </p>

                <p
                  style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    margin: '0 0 12px',
                  }}
                >
                  Price units will be verified before
                  customer-facing pricing is enabled.
                </p>

                <p
                  style={{
                    fontSize: '14px',
                    margin: '0 0 16px',
                  }}
                >
                  <strong>Reported ticket count:</strong>{' '}
                  {event.number_of_tickets ?? 'Unknown'}
                </p>

                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: '#f3f4f6',
                    color: '#374151',
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  Ticket details coming next
                </div>
              </div>
            </div>
          </article>
        ))}
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

        <p style={{ margin: '8px 0 0', lineHeight: 1.7 }}>
          We will connect the XS2Event tickets and categories
          endpoints to display real ticket types, supplier
          prices, availability and seating information.
          Checkout will remain disabled during development.
        </p>
      </div>
    </main>
  );
}
