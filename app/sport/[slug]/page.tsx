
import Link from 'next/link';
import { notFound } from 'next/navigation';
import EventBrowser from '../../../components/EventBrowser';
import Formula1EventBrowser from '../../../components/Formula1EventBrowser';
import MotoGPEventBrowser from '../../../components/MotoGPEventBrowser';
import TennisEventBrowser from '../../../components/TennisEventBrowser';
import BasketballEventBrowser from '../../../components/BasketballEventBrowser';
import GolfEventBrowser from '../../../components/GolfEventBrowser';
import HorseRacingEventBrowser from '../../../components/HorseRacingEventBrowser';
import RugbyEventBrowser from '../../../components/RugbyEventBrowser';
import NFLEventBrowser from '../../../components/NFLEventBrowser';
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

  const isOtherEvents = sport === 'Other Events';
  const isFormula1 = sport === 'Formula 1';
  const isMotoGP = sport === 'MotoGP';
  const isTennis = sport === 'Tennis';
  const isBasketball = sport === 'Basketball';
  const isGolf = sport === 'Golf';
  const isHorseRacing = sport === 'Horse Racing';
  const isRugby = sport === 'Rugby';
  const isNFL = sport === 'NFL';
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
            {isOtherEvents
              ? 'Explore Basketball, Boxing, Cricket, Golf, Horse Racing, NFL and Rugby events.'
              : isFormula1
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
                            : isNFL
                              ? 'Explore NFL International Games and Super Bowl events using XS2Event test ticket offers.'
                              : isCricket
                                ? 'Explore Cricket tickets for international matches, tournaments and major competitions around the world.'
                                : isBoxing
                                  ? 'Explore upcoming Boxing events, championship fights and major international bouts.'
                                  : `Discover upcoming ${sport.toLowerCase()} experiences around the world.`}
          </p>
        </div>
      </section>

      <div className="container-wide">
        {isOtherEvents ? (
          <section className="py-12">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>TEST DATA — NOT FOR SALE.</strong>{' '}
              Grandstand Pass is operating in development mode.
              Ticket purchases and reservations are disabled.
            </div>

            <div className="mt-10">
              <p className="text-sm font-bold uppercase tracking-wider text-blue">
                Explore Other Events
              </p>

              <h2 className="mt-3 text-3xl font-black text-navy">
                Choose your sport
              </h2>

              <p className="mt-3 text-slate-600">
                Select a sport to browse its event listings
                and available test ticket offers.
              </p>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {otherSports.map(otherSport => (
                <Link
                  key={otherSport}
                  href={`/sport/${sportSlug(otherSport)}`}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue hover:shadow-md"
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue">
                      Other Events
                    </p>

                    <h3 className="mt-3 text-2xl font-black text-navy">
                      {otherSport}
                    </h3>

                    <p className="mt-3 text-sm text-slate-600">
                      {otherSport === 'Boxing' || otherSport === 'Cricket'
                        ? 'Explore this sport. Test ticket availability is not yet confirmed.'
                        : 'Browse upcoming events and XS2Event test ticket offers.'}
                    </p>
                  </div>

                  <span className="mt-6 inline-flex items-center font-bold text-blue group-hover:underline">
                    Explore {otherSport} →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : isFormula1 ? (
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
        ) : isNFL ? (
          <NFLEventBrowser />
        ) : isUnavailableSport ? (
          <section className="py-12">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>TEST DATA — NOT FOR SALE.</strong>{' '}
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
