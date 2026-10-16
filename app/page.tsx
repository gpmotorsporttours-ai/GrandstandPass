
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import EventBrowser from '../components/EventBrowser';
import { sportSlug } from '../lib/data';

const tiles = [
  {
    name: 'Football',
    image: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Formula 1',
    image: 'https://images.unsplash.com/photo-1504817343863-5092a923803e?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'MotoGP',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Tennis',
    image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Other Events',
    image: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=900&q=85',
  },
];

export default function Home() {
  return (
    <>
      {/* New Grandstand Pass homepage banner */}
      <section className="relative bg-navy overflow-hidden">
        <img
          src="/grandstand-pass-banner.jpg"
          alt="Grandstand Pass sports tickets featuring Formula 1, football, tennis and MotoGP"
          className="block w-full h-auto"
        />

        {/* Invisible clickable area over the banner's Browse Events button */}
        <Link
          href="/#events"
          aria-label="Browse sporting events"
          className="absolute left-[4%] top-[69%] w-[15%] h-[11%] z-10"
        />
      </section>

      {/* Browse by sport */}
      <section className="container-wide py-14">
        <div className="eyebrow mb-2">
          Something for every fan
        </div>

        <h2 className="section-title mb-7">
          Browse by sport
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {tiles.map((tile) => (
            <Link
              key={tile.name}
              href={
                tile.name === 'Football'
                  ? '/football'
                  : '/sport/' + sportSlug(tile.name)
              }
              className="relative h-44 md:h-52 rounded-xl overflow-hidden group"
            >
              <img
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                src={tile.image}
                alt={tile.name}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#051934e8] via-transparent to-transparent" />

              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white font-extrabold">
                <span>{tile.name}</span>
                <ChevronRight size={18} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Event listings */}
      <div className="container-wide">
        <EventBrowser />
      </div>

      {/* Bottom promotional section */}
      <section className="bg-navy text-white">
        <div className="container-wide py-16 flex flex-col md:flex-row justify-between items-center gap-7">
          <div>
            <div className="eyebrow text-blue-300 mb-2">
              Make it unforgettable
            </div>

            <h2 className="text-3xl font-black">
              Every moment starts with a ticket.
            </h2>

            <p className="text-slate-300 mt-2">
              Explore events around the globe with Grandstand Pass.
            </p>
          </div>

          <Link
            className="btn-primary shrink-0"
            href="/#events"
          >
            Find an event <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
