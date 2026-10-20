
'use client';

import { useState } from 'react';
import { Globe2, MapPin } from 'lucide-react';
import { footballRegions, events } from '../../lib/data';
import EventBrowser from '../../components/EventBrowser';

const countryFlags: Record<string, string> = {
  England: '🏴',
  Scotland: '🏴',
  Wales: '🏴',
  Ireland: '🇮🇪',
  'Northern Ireland': '🇬🇧',
  Spain: '🇪🇸',
  Italy: '🇮🇹',
  Germany: '🇩🇪',
  France: '🇫🇷',
  Portugal: '🇵🇹',
  Netherlands: '🇳🇱',
  Belgium: '🇧🇪',
  Switzerland: '🇨🇭',
  Austria: '🇦🇹',
  Turkey: '🇹🇷',
  Türkiye: '🇹🇷',
  Greece: '🇬🇷',
  Denmark: '🇩🇰',
  Sweden: '🇸🇪',
  Norway: '🇳🇴',
  Finland: '🇫🇮',
  Poland: '🇵🇱',
  Croatia: '🇭🇷',
  Serbia: '🇷🇸',
  Czechia: '🇨🇿',
  'Czech Republic': '🇨🇿',
  Hungary: '🇭🇺',
  Romania: '🇷🇴',
  Ukraine: '🇺🇦',
  Brazil: '🇧🇷',
  Argentina: '🇦🇷',
  Uruguay: '🇺🇾',
  Mexico: '🇲🇽',
  USA: '🇺🇸',
  'United States': '🇺🇸',
  Canada: '🇨🇦',
  Japan: '🇯🇵',
  China: '🇨🇳',
  'South Korea': '🇰🇷',
  Australia: '🇦🇺',
  'South Africa': '🇿🇦',
  Morocco: '🇲🇦',
  Egypt: '🇪🇬',
  Nigeria: '🇳🇬',
  'Saudi Arabia': '🇸🇦',
  Qatar: '🇶🇦',
  UAE: '🇦🇪',
  'United Arab Emirates': '🇦🇪',
};

function CountryFlag({ country }: { country: string }) {
  if (country === 'All') {
    return <Globe2 size={30} className="text-blue" />;
  }

  const flag = countryFlags[country];

  if (!flag) {
    return <MapPin size={30} className="text-blue" />;
  }

  return (
    <span
      role="img"
      aria-label={`${country} flag`}
      className="text-3xl leading-none"
    >
      {flag}
    </span>
  );
}

export default function Football() {
  const [region, setRegion] = useState('All');

  const count = (r: string) =>
    events.filter(
      (e) => e.sport === 'Football' && e.region === r
    ).length;

  return (
    <>
      <section className="bg-navy text-white py-16">
        <div className="container-wide">
          <div className="eyebrow text-blue-300">
            Grandstand Pass / Football
          </div>

          <h1 className="text-4xl md:text-5xl font-black mt-3">
            Football tickets
          </h1>

          <p className="text-slate-300 max-w-xl mt-4">
            Explore football by country and find your next
            matchday experience.
          </p>
        </div>
      </section>

      <div className="container-wide py-12">
        <h2 className="section-title mb-2">
          Explore by country
        </h2>

        <p className="muted mb-6">
          Choose a destination to explore sample listings.
          More countries and leagues will be populated by
          the supplier integration.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {footballRegions.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRegion(r);
                document
                  .getElementById('country-events')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={
                'text-left rounded-xl border p-5 hover:border-blue hover:shadow-md ' +
                (region === r
                  ? 'border-blue bg-blue/5'
                  : 'border-slate-200 bg-white')
              }
            >
              <div className="mb-3 h-9 flex items-center">
                <CountryFlag country={r} />
              </div>

              <div className="font-extrabold">{r}</div>

              <div className="text-xs muted mt-2">
                {count(r)
                  ? `${count(r)} sample event${
                      count(r) > 1 ? 's' : ''
                    }`
                  : 'Listings coming with API'}
              </div>
            </button>
          ))}
        </div>

        <div id="country-events" className="pt-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-extrabold">
              {region === 'All'
                ? 'Football events'
                : region + ' football'}
            </h2>

            {region !== 'All' && (
              <button
                onClick={() => setRegion('All')}
                className="text-blue font-bold text-sm"
              >
                Show all countries
              </button>
            )}
          </div>

          <EventBrowser
            key={region}
            initialSport="Football"
            initialRegion={region}
          />
        </div>
      </div>
    </>
  );
}
