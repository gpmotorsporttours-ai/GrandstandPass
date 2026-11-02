'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Filter, RotateCcw } from 'lucide-react';

type Offer = {
  id: string;
  categoryKey: string;
  categoryName: string;
  content: ReactNode;
};

export default function Formula1OfferSelector({ offers }: { offers: Offer[] }) {
  const [selected, setSelected] = useState('all');
  const categories = useMemo(() => {
    const names = new Map<string, string>();
    for (const offer of offers) {
      if (!names.has(offer.categoryKey)) names.set(offer.categoryKey, offer.categoryName);
    }
    return [...names.entries()].map(([key, name]) => ({ key, name }));
  }, [offers]);
  const visible = selected === 'all' ? offers : offers.filter(offer => offer.categoryKey === selected);

  return (
    <div className="mt-6">
      <div className="rounded-2xl border bg-ice p-5 md:p-6">
        <div className="flex items-center gap-2 text-navy">
          <Filter size={20} className="text-blue" aria-hidden="true" />
          <h3 className="text-lg font-black">Find your grandstand or ticket category</h3>
        </div>
        <p className="muted mt-2 text-sm">
          Choose a supplier-listed category to narrow the offers below. The circuit map is for reference only; it does not identify clickable seating areas.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter ticket categories">
          <button type="button" aria-pressed={selected === 'all'} onClick={() => setSelected('all')}
            className={`rounded-xl border px-4 py-2 text-sm font-bold ${selected === 'all' ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-navy hover:border-blue'}`}>
            All categories ({offers.length})
          </button>
          {categories.map(category => {
            const count = offers.filter(offer => offer.categoryKey === category.key).length;
            return (
              <button key={category.key} type="button" aria-pressed={selected === category.key}
                onClick={() => setSelected(category.key)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold ${selected === category.key ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-navy hover:border-blue'}`}>
                {category.name} ({count})
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-navy" role="status">
          Showing {visible.length} of {offers.length} test ticket offers
        </p>
        {selected !== 'all' && (
          <button type="button" onClick={() => setSelected('all')} className="inline-flex items-center gap-2 text-sm font-bold text-blue hover:underline">
            <RotateCcw size={15} aria-hidden="true" /> Show all categories
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {visible.map(offer => <div key={offer.id} className="min-w-0">{offer.content}</div>)}
      </div>
    </div>
  );
}
