
import Link from 'next/link';
import RugbyEventBrowser from '../../../components/RugbyEventBrowser';

export const metadata = {
  title: 'Rugby Tickets | Grandstand Pass',
  description:
    'Browse Rugby matches and tournaments using XS2Event test data on Grandstand Pass.',
};

export default function RugbyPage() {
  return (
    <main className="container-wide py-10 md:py-14">
      <Link
        href="/"
        className="text-blue font-bold hover:underline"
      >
        ← Back to Home
      </Link>

      <header className="mt-8 rounded-2xl bg-ice p-6 md:p-10">
        <p className="text-sm font-bold uppercase tracking-wide text-blue">
          Other Events · Rugby
        </p>

        <h1 className="mt-3 text-3xl md:text-5xl font-black text-navy">
          Rugby Tickets
        </h1>

        <p className="muted mt-4 max-w-3xl text-base md:text-lg">
          Explore international Rugby matches, the Six Nations,
          Nations Championship and the 2027 Rugby World Championship.
          Browse XS2Event test events and view indicative ticket
          prices and reported availability.
        </p>
      </header>

      <RugbyEventBrowser />
    </main>
  );
}
