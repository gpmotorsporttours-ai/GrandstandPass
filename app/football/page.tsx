
'use client';

import { useEffect, useState } from 'react';
import { Globe2, MapPin } from 'lucide-react';
import { footballRegions, events } from '../../lib/data';
import EventBrowser from '../../components/EventBrowser';
import type { SupplierFootballEvent } from '../../components/EventBrowser';

const countryCodes: Record<string, string> = {
  Spain: 'es',
  'United Kingdom': 'gb',
  England: 'gb-eng',
  Scotland: 'gb-sct',
  Wales: 'gb-wls',
  Italy: 'it',
  Germany: 'de',
  France: 'fr',
  Netherlands: 'nl',
  Portugal: 'pt',
  Austria: 'at',
  Belgium: 'be',
  Denmark: 'dk',
  Ireland: 'ie',
  'Northern Ireland': 'gb-nir',
  Switzerland: 'ch',
  Sweden: 'se',
  Norway: 'no',
  Finland: 'fi',
  Poland: 'pl',
  Turkey: 'tr',
  Türkiye: 'tr',
  Greece: 'gr',
  Croatia: 'hr',
  Serbia: 'rs',
  Hungary: 'hu',
  Romania: 'ro',
  Ukraine: 'ua',
  Brazil: 'br',
  Argentina: 'ar',
  Mexico: 'mx',
  USA: 'us',
  'United States': 'us',
  Canada: 'ca',
  Japan: 'jp',
  Australia: 'au',
  'South Africa': 'za',
  Morocco: 'ma',
  Egypt: 'eg',
  Nigeria: 'ng',
  'Saudi Arabia': 'sa',
  Qatar: 'qa',
  UAE: 'ae',
  'United Arab Emirates': 'ae',
};

type SupplierFootballResponse = {
  supplierFootballEvents?: SupplierFootballEvent[];
  testData?: boolean;
};

function WorldMapBackground() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden bg-[#24456B]"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'url("https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.9,
          filter:
            'sepia(1) saturate(2) hue-rotate(345deg) brightness(1.8) contrast(1.2)',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(5,18,43,0.65) 0%, rgba(5,18,43,0.05) 65%)',
        }}
      />
    </div>
  );
}

export default function Football() {
  const [region, setRegion] = useState('All');

  const [supplierFootballEvents, setSupplierFootballEvents] =
    useState<SupplierFootballEvent[]>([]);

  const [supplierLoading, setSupplierLoading] = useState(true);
  const [supplierError, setSupplierError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSupplierEvents() {
      try {
        const response = await fetch(
          '/api/football-test-events',
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          throw new Error('Supplier feed unavailable');
        }

        const data: SupplierFootballResponse =
          await response.json();

        if (
          data.testData !== true ||
          !Array.isArray(data.supplierFootballEvents)
        ) {
          throw new Error('Unexpected supplier response');
        }

        if (!controller.signal.aborted) {
          setSupplierFootballEvents(
            data.supplierFootballEvents
          );
          setSupplierError(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSupplierFootballEvents([]);
          setSupplierError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSupplierLoading(false);
        }
      }
    }

    loadSupplierEvents();

    return () => {
      controller.abort();
    };
  }, []);

  const count = (selectedRegion: string) => {
    const demoCount = events.filter(
      event =>
        event.sport === 'Football' &&
        event.region === selectedRegion
    ).length;

    const supplierCount = supplierFootballEvents.filter(
      event => event.region === selectedRegion
    ).length;

    return demoCount + supplierCount;
  };

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
            Explore football by country and find your
            next matchday experience.
          </p>
        </div>
      </section>

      <div className="container-wide py-12">
        <h2 className="section-title mb-2">
          Explore by country
        </h2>

        <p className="muted mb-6">
          Choose a destination to explore demonstration
          listings and XS2Event test matches.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {footballRegions.map(r => {
            const countryCode = countryCodes[r];
            const hasFlag = Boolean(countryCode);
            const isOtherLeagues = r === 'Other Leagues';
            const hasBackground = hasFlag || isOtherLeagues;
            const listingCount = count(r);

            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRegion(r);

                  document
                    .getElementById('country-events')
                    ?.scrollIntoView({
                      behavior: 'smooth',
                    });
                }}
                className={
                  'relative isolate overflow-hidden rounded-xl border min-h-[170px] p-5 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 ' +
                  (region === r
                    ? 'border-blue ring-2 ring-blue'
                    : 'border-slate-200')
                }
              >
                {hasFlag ? (
                  <>
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `url("https://flagcdn.com/w640/${countryCode}.png")`,
                        filter:
                          'saturate(0.72) brightness(0.85)',
                      }}
                    />

                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(to top, rgba(5,18,43,0.88) 0%, rgba(5,18,43,0.35) 55%, rgba(5,18,43,0.12) 100%)',
                      }}
                    />
                  </>
                ) : isOtherLeagues ? (
                  <WorldMapBackground />
                ) : (
                  <div className="absolute inset-0 bg-slate-100" />
                )}

                <div className="relative z-10 flex h-full min-h-[128px] flex-col justify-between">
                  <div>
                    {!hasBackground &&
                      (r === 'All' ? (
                        <Globe2
                          size={28}
                          className="text-blue"
                        />
                      ) : (
                        <MapPin
                          size={28}
                          className="text-blue"
                        />
                      ))}
                  </div>

                  <div>
                    <div
                      className={
                        'text-lg font-extrabold ' +
                        (hasBackground
                          ? 'text-white'
                          : 'text-navy')
                      }
                    >
                      {r}
                    </div>

                    <div
                      className={
                        'text-xs mt-2 ' +
                        (hasBackground
                          ? 'text-white/90'
                          : 'muted')
                      }
                    >
                      {listingCount > 0
                        ? `${listingCount} listing${
                            listingCount === 1 ? '' : 's'
                          }`
                        : 'Listings coming with API'}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
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
                type="button"
                onClick={() => setRegion('All')}
                className="text-blue font-bold text-sm"
              >
                Show all countries
              </button>
            )}
          </div>

          {supplierLoading && (
            <p className="muted text-sm mt-4">
              Loading XS2Event test football matches...
            </p>
          )}

          {supplierError && (
            <p className="text-sm text-amber-800 mt-4">
              XS2Event test matches are temporarily
              unavailable. Demonstration listings
              remain accessible.
            </p>
          )}

          <EventBrowser
            key={region}
            initialSport="Football"
            initialRegion={region}
            supplierFootballEvents={supplierFootballEvents}
          />
        </div>
      </div>
    </>
  );
}
