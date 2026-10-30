
import { NextRequest, NextResponse } from 'next/server';
import { xs2eventGet } from '../../../lib/xs2event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupplierTicket = {
  event_id?: string;
  ticket_status?: string;
  stock?: number | null;
};

type TicketsResponse = {
  tickets?: SupplierTicket[];
};

export async function GET(request: NextRequest) {
  const eventId =
    request.nextUrl.searchParams.get('eventId')?.trim() || '';

  if (
    !eventId ||
    eventId.length > 150 ||
    !/^[a-zA-Z0-9_-]+$/.test(eventId)
  ) {
    return NextResponse.json(
      { error: 'Invalid NFL event ID' },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({
      event_id: eventId,
      ticket_status: 'available',
      stock: 'gt:0',
      page_size: '50',
      page: '1',
    });

    const response = await xs2eventGet<TicketsResponse>(
      `/tickets?${params.toString()}`
    );

    const availableTickets = (
      Array.isArray(response.tickets)
        ? response.tickets
        : []
    ).filter(ticket =>
      ticket.ticket_status === 'available' &&
      typeof ticket.stock === 'number' &&
      Number.isInteger(ticket.stock) &&
      ticket.stock > 0 &&
      (!ticket.event_id || ticket.event_id === eventId)
    );

    return NextResponse.json(
      {
        testData: true,
        sport: 'NFL',
        eventId,
        hasAvailableTickets: availableTickets.length > 0,
        availableCategories: availableTickets.length,
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
        sport: 'NFL',
        eventId,
        error: 'NFL test availability could not be checked',
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
