
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Globe2,
  MapPin,
  Search,
  X,
} from 'lucide-react';
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

  const [countrySearch, setCountrySearch] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

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

  const listingCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const event of events) {
      if (event.sport === 'Football') {
        counts[event.region] =
          (counts[event.region] || 0) + 1;
      }
    }

    for (const event of supplierFootballEvents) {
      counts[event.region] =
        (counts[event.region] || 0) + 1;
    }

    return counts;
  }, [supplierFootballEvents]);

  const totalListings = Object.values(listingCounts).reduce(
    (total, count) => total + count,
    0
  );

  const filteredRegions = useMemo(() => {
    const search = countrySearch.trim().toLowerCase();

    return footballRegions.filter(r => {
      const matchesSearch =
        search.length === 0 ||
        r.toLowerCase().includes(search) ||
        (r === 'Other Leagues' &&
          'world international global'.includes(search));

      const matchesAvailability =
        !availableOnly ||
        r === 'All' ||
        (listingCounts[r] || 0) > 0;

      return matchesSearch && matchesAvailability;
    });
  }, [countrySearch, availableOnly, listingCounts]);

  const selectRegion = (selectedRegion: string) => {
    setRegion(selectedRegion);

    window.requestAnimationFrame(() => {
      document
        .getElementById('country-events')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    });
  };

  const clearCountryFilters = () => {
    setCountrySearch('');
    setAvailableOnly(false);
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
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="section-title mb-2">
              Explore by country
            </h2>

            <p className="muted">
              Choose a destination to explore demonstration
              listings and XS2Event test matches.
            </p>
          </div>

          <div className="text-sm font-semibold text-navy">
            {supplierLoading
              ? 'Loading test matches...'
              : `${totalListings} football listings`}
          </div>
        </div>

        {/* Country search and availability controls */}
        <div className="rounded-xl border border-slate-200 bg-ice p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 md:items-center">
            <div className="relative flex-1">
              <Search
                size={19}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={countrySearch}
                onChange={e =>
                  setCountrySearch(e.target.value)
                }
                placeholder="Search for a country..."
                aria-label="Search football countries"
                className="field w-full"
                style={{
                  paddingLeft: '2.75rem',
                  paddingRight: '2.75rem',
                }}
              />

              {countrySearch.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCountrySearch('')}
                  aria-label="Clear country search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-navy"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={e =>
                  setAvailableOnly(e.target.checked)
                }
                className="h-4 w-4 accent-blue-600"
              />

              <span className="text-sm font-semibold text-navy">
                Available matches only
              </span>
            </label>

            {(countrySearch || availableOnly) && (
              <button
                type="button"
                onClick={clearCountryFilters}
                className="text-sm font-bold text-blue hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="mt-3 text-xs text-slate-600">
            {availableOnly
              ? 'Showing destinations with demonstration listings or XS2Event test matches.'
              : 'Browse all destinations, including those awaiting additional matches.'}
          </div>
        </div>

        {/* Country selection cards */}
        {filteredRegions.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredRegions.map(r => {
              const countryCode = countryCodes[r];
              const hasFlag = Boolean(countryCode);
              const isOtherLeagues = r === 'Other Leagues';
              const hasBackground =
                hasFlag || isOtherLeagues;

              const listingCount =
                r === 'All'
                  ? totalListings
                  : listingCounts[r] || 0;

              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={region === r}
                  onClick={() => selectRegion(r)}
                  className={
                    'relative isolate overflow-hidden rounded-xl border min-h-[170px] p-5 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ' +
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
                              listingCount === 1
                                ? ''
                                : 's'
                            }`
                          : 'Listings coming with API'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white py-12 px-6 text-center">
            <Search
              size={32}
              className="mx-auto mb-3 text-slate-400"
            />

            <h3 className="text-lg font-extrabold text-navy">
              No matching countries found
            </h3>

            <p className="muted mt-2 text-sm">
              Try another country name or turn off
              the available matches filter.
            </p>

            <button
              type="button"
              onClick={clearCountryFilters}
              className="btn-outline mt-5"
            >
              Show all countries
            </button>
          </div>
        )}

        {/* Selected country and event listings */}
        <div
          id="country-events"
          className="pt-10 scroll-mt-8"
        >
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-blue mb-2">
                Selected destination
              </div>

              <h2 className="text-2xl font-extrabold text-navy">
                {region === 'All'
                  ? 'All football events'
                  : `${region} football`}
              </h2>
            </div>

            {region !== 'All' && (
              <button
                type="button"
                onClick={() => setRegion('All')}
                className="text-blue font-bold text-sm hover:underline"
              >
                Show all countries
              </button>
            )}
          </div>

          {supplierLoading && (
            <p
              role="status"
              className="muted text-sm mt-4"
            >
              Loading XS2Event test football matches...
            </p>
          )}

          {supplierError && (
            <p
              role="status"
              className="text-sm text-amber-800 mt-4"
            >
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
