
import { notFound } from 'next/navigation';
import EventBrowser from '../../../components/EventBrowser';
import Formula1EventBrowser from '../../../components/Formula1EventBrowser';
import MotoGPEventBrowser from '../../../components/MotoGPEventBrowser';
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
                : `Discover upcoming ${sport.toLowerCase()} experiences around the world.`}
          </p>
        </div>
      </section>

      <div className="container-wide">
        {isFormula1 ? (
          <Formula1EventBrowser />
        ) : isMotoGP ? (
          <MotoGPEventBrowser />
        ) : (
          <EventBrowser initialSport={sport} />
        )}
      </div>
    </>
  );
}
