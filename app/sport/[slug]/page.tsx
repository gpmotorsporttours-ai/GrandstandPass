
import { notFound } from 'next/navigation';
import EventBrowser from '../../../components/EventBrowser';
import Formula1EventBrowser from '../../../components/Formula1EventBrowser';
import MotoGPEventBrowser from '../../../components/MotoGPEventBrowser';
import TennisEventBrowser from '../../../components/TennisEventBrowser';
import BasketballEventBrowser from '../../../components/BasketballEventBrowser';
import GolfEventBrowser from '../../../components/GolfEventBrowser';
import HorseRacingEventBrowser from '../../../components/HorseRacingEventBrowser';
import RugbyEventBrowser from '../../../components/RugbyEventBrowser';
import AvailabilityMessage from '../../../components/AvailabilityMessage';
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
  const isBoxing = sport === 'Boxing';

  const isUnavailableSport = isCricket || isBoxing;

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
                            : isBoxing
                              ? 'Explore upcoming Boxing events, championship fights and major international bouts.'
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
        ) : isUnavailableSport ? (
          <section className="py-12">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>
                TEST DATA — NOT FOR SALE.
              </strong>{' '}
              Grandstand Pass is currently operating in
              development mode. Ticket purchases and
              reservations are disabled.
            </div>

            <div className="mt-8">
              <AvailabilityMessage
                status="no-events"
                sport={sport}
              />
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">
              Ticket availability will be updated as
              new events become available.
            </p>
          </section>
        ) : (
          <EventBrowser initialSport={sport} />
        )}
      </div>
    </>
  );
}
