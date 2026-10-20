import { NextResponse } from 'next/server';

// This diagnostic endpoint is deliberately disabled on public deployments.
// We will replace it with an authenticated, server-only integration once
// XS2Event supplies the API credentials.
export async function GET() {
  return NextResponse.json(
    { message: 'XS2Event diagnostic endpoint is disabled.' },
    {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
