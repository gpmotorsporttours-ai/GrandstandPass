
import Link from 'next/link';
import {
  AlertCircle,
  CalendarX,
  RefreshCw,
  TicketX,
} from 'lucide-react';

export type AvailabilityStatus =
  | 'no-events'
  | 'no-tickets'
  | 'sold-out'
  | 'error';

export type AvailabilityMessageProps = {
  status: AvailabilityStatus;
  sport?: string;
  eventName?: string;
  backHref?: string;
  showRetry?: boolean;
  onRetry?: () => void;
};

export default function AvailabilityMessage({
  status,
  sport,
  eventName,
  backHref,
  showRetry = false,
  onRetry,
}: AvailabilityMessageProps) {
  let title = '';
  let description = '';

  if (status === 'no-events') {
    title = 'No Events Currently Available';
    description = sport
      ? `There are currently no upcoming ${sport} events available. Please check back soon for new events and ticket availability.`
      : 'There are currently no upcoming events available. Please check back soon.';
  }

  if (status === 'no-tickets') {
    title = 'No Tickets Currently Available';
    description = eventName
      ? `Tickets for ${eventName} are currently unavailable. Please check back soon for updates.`
      : 'There are currently no tickets available for this event. Please check back soon.';
  }

  if (status === 'sold-out') {
    title = 'Tickets Currently Sold Out';
    description = eventName
      ? `There are currently no tickets available for ${eventName}. Please check back soon in case additional tickets become available.`
      : 'Tickets are currently sold out. Please check back soon.';
  }

  if (status === 'error') {
    title = 'Availability Temporarily Unavailable';
    description =
      'We could not check ticket availability right now. Please try again shortly.';
  }

  const Icon =
    status === 'no-events'
      ? CalendarX
      : status === 'error'
        ? AlertCircle
        : TicketX;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
        <Icon
          className="h-8 w-8 text-blue-600"
          aria-hidden="true"
        />
      </div>

      <h2 className="mt-6 text-2xl font-black text-slate-900">
        {title}
      </h2>

      <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">
        {description}
      </p>

      {(backHref || (showRetry && onRetry)) && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700"
            >
              Back to Events
            </Link>
          )}

          {showRetry && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-900 transition hover:bg-slate-50"
            >
              <RefreshCw
                className="h-4 w-4"
                aria-hidden="true"
              />
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
