
import type { ReactNode } from 'react';
import XS2EventFootballTestListings from '../../components/XS2EventFootballTestListings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function FootballLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <XS2EventFootballTestListings />
    </>
  );
}
