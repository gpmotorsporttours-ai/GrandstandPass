
import { notFound } from 'next/navigation';
import EventBrowser from '../../../components/EventBrowser';
import Formula1EventBrowser from '../../../components/Formula1EventBrowser';
import MotoGPEventBrowser from '../../../components/MotoGPEventBrowser';
import TennisEventBrowser from '../../../components/TennisEventBrowser';
import BasketballEventBrowser from '../../../components/BasketballEventBrowser';
import GolfEventBrowser from '../../../components/GolfEventBrowser';
import HorseRacingEventBrowser from '../../../components/HorseRacingEventBrowser';
import RugbyEventBrowser from '../../../components/RugbyEventBrowser';
import { sports, sportSlug } from '../../../lib/data';

const otherSports = [
  'Basketball',
  'Boxing',
  'Cricket',
  'Golf',
  'Horse Racing',
  'NFL',
  'Rugby',
];

export default async function SportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const sport = [...sports, ...otherSports].find(
    s => sportSlug(s) === slug
  );

  if (!sport || sport === 'Football') {
    notFound();
  }

  const isFormula1 = sport === 'Formula 1';
  const isMotoGP = sport === 'MotoGP';
  const isTennis = sport === 'Tennis';
  const isBasketball = sport === 'Basketball';
  const isGolf = sport === 'Golf';
  const isHorseRacing = sport === 'Horse Racing';
  const isRugby = sport === 'Rugby';
  const isCricket = sport === 'Cricket';

  return (
    <>
      <section className="bg-navy text-white py-16">
        <div className="container-wide">
          <div className="eyebrow text-blue-300">
            Grandstand Pass / {sport}
          </div>

          <h1 className="text-4xl md:text-5xl font-black mt-3">
            {sport} tickets
          </h1>

          <p className="text-slate-300 mt-4">
            {isFormula1
              ? 'Explore upcoming Formula 1 Grand Prix events and discover available XS2Event test ticket offers.'
              : isMotoGP
                ? 'Explore upcoming MotoGP Grand Prix events and discover available XS2Event test ticket offers.'
                : isTennis
                  ? 'Explore upcoming Tennis events and tournaments from the XS2Event test environment.'
                  : isBasketball
                    ? 'Explore upcoming Basketball events and discover available XS2Event test ticket offers.'
                    : isGolf
                      ? 'Explore upcoming Golf tournaments and discover available XS2Event test ticket offers.'
                      : isHorseRacing
                        ? 'Explore upcoming Horse Racing meetings and festivals, including Cheltenham, with XS2Event test ticket offers.'
                        : isRugby
                          ? 'Explore international Rugby matches, the Six Nations, Nations Championship and the 2027 Rugby World Championship using XS2Event test ticket offers.'
                          : isCricket
                            ? 'Explore Cricket tickets for international matches, tournaments and major competitions around the world.'
                            : `Discover upcoming ${sport.toLowerCase()} experiences around the world.`}
          </p>
        </div>
      </section>

      <div className="container-wide">
        {isFormula1 ? (
          <Formula1EventBrowser />
        ) : isMotoGP ? (
          <MotoGPEventBrowser />
        ) : isTennis ? (
          <TennisEventBrowser />
        ) : isBasketball ? (
          <BasketballEventBrowser />
        ) : isGolf ? (
          <GolfEventBrowser />
        ) : isHorseRacing ? (
          <HorseRacingEventBrowser />
        ) : isRugby ? (
          <RugbyEventBrowser />
        ) : isCricket ? (
          <section className="py-12">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>XS2Event TEST DATA — NOT FOR SALE.</strong>{' '}
              Cricket inventory is currently unavailable in
              our supplier test environment. No reservations
              or purchases can be made.
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
              <h2 className="text-2xl font-black text-navy">
                No Cricket Events Currently Available
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-slate-600">
                There are currently no Cricket events
                available through our XS2Event test
                integration. Please check back soon for
                upcoming matches and ticket availability.
              </p>

              <p className="mt-4 text-sm text-slate-500">
                Grandstand Pass is currently operating
                in development mode. Checkout is disabled.
              </p>
            </div>
          </section>
        ) : (
          <EventBrowser initialSport={sport} />
        )}
      </div>
    </>
  );
}
