
'use client';

import { useState } from 'react';

type MapMode = 'legend' | 'plain';
type MapType = 'circuit' | 'stadium' | 'venue';

export default function SupplierVenueMap({
  venueId,
  venueName,
  mapType = 'circuit',
}: {
  venueId: string;
  venueName: string;
  mapType?: MapType;
}) {
  const [mode, setMode] = useState<MapMode>('legend');
  const [failedModes, setFailedModes] = useState<MapMode[]>([]);

  // Only use safe supplier IDs when constructing CDN URLs.
  if (!/^[a-zA-Z0-9_-]{1,150}$/.test(venueId)) {
    return null;
  }

  const mapLabel =
    mapType === 'stadium'
      ? 'Stadium map'
      : mapType === 'venue'
        ? 'Venue map'
        : 'Circuit map';

  const imageUrl =
    mode === 'legend'
      ? `https://cdn.xs2event.com/venues/static/${venueId}-legend.png`
      : `https://cdn.xs2event.com/venues/static/${venueId}.png`;

  const noMap =
    failedModes.includes('legend') &&
    failedModes.includes('plain');

  function handleImageError() {
    setFailedModes(previous =>
      previous.includes(mode)
        ? previous
        : [...previous, mode]
    );

    if (
      mode === 'legend' &&
      !failedModes.includes('plain')
    ) {
      setMode('plain');
    }
  }

  return (
    <section className="mt-10 rounded-2xl border bg-white p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-navy">
            {mapLabel}
          </h2>

          <p className="muted mt-1 text-sm">
            {venueName}
            {' \u00B7 '}
            XS2Event venue map
          </p>
        </div>

        {!noMap && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('legend')}
              aria-pressed={mode === 'legend'}
              disabled={failedModes.includes('legend')}
              className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                mode === 'legend'
                  ? 'bg-navy text-white'
                  : 'bg-white text-navy'
              } disabled:opacity-40`}
            >
              With legend
            </button>

            <button
              type="button"
              onClick={() => setMode('plain')}
              aria-pressed={mode === 'plain'}
              disabled={failedModes.includes('plain')}
              className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                mode === 'plain'
                  ? 'bg-navy text-white'
                  : 'bg-white text-navy'
              } disabled:opacity-40`}
            >
              Plain map
            </button>
          </div>
        )}
      </div>

      {noMap ? (
        <p
          role="status"
          className="muted mt-6 rounded-xl bg-ice p-6"
        >
          A {mapLabel.toLowerCase()} is not currently
          available for this event. Ticket categories
          are listed below.
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl bg-ice p-3 md:p-6">
          <img
            key={imageUrl}
            src={imageUrl}
            alt={`${venueName} ${mapLabel.toLowerCase()}${
              mode === 'legend'
                ? ' with ticket-category legend'
                : ''
            }`}
            onError={handleImageError}
            className="mx-auto h-auto max-h-[650px] w-full object-contain"
          />
        </div>
      )}

      <p className="muted mt-4 text-xs">
        Supplier-provided reference map. Layouts and
        categories may change. Select tickets using the
        verified test offers below; map areas are not
        yet linked to ticket inventory.
        {' TEST DATA \u2014 NOT FOR SALE.'}
      </p>
    </section>
  );
}
