
'use client';

import Link from 'next/link';
import {
  Search,
  Ticket,
  Menu,
  X,
  ChevronDown,
  ShoppingCart,
} from 'lucide-react';
import { useState } from 'react';
import { sports, sportSlug } from '../lib/data';
import { useCart } from './CartProvider';

const otherSports = [
  'Basketball',
  'Boxing',
  'Cricket',
  'Golf',
  'Horse Racing',
  'NFL',
  'Rugby',
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { itemCount } = useCart();

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
      <div className="container-wide h-20 flex items-center justify-between gap-5">
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0"
        >
          <span className="bg-blue text-white rounded-xl p-2">
            <Ticket size={23} />
          </span>

          <span className="font-black tracking-tight text-xl md:text-2xl">
            Grandstand
            <span className="text-blue">Pass</span>
          </span>
        </Link>

        <nav className="hidden lg:flex gap-7 items-center font-semibold text-sm">
          <Link
            href="/football"
            className="hover:text-blue"
          >
            Football
          </Link>

          {sports
            .filter(
              (s) =>
                s !== 'Football' &&
                s !== 'Other Events'
            )
            .map((s) => (
              <Link
                key={s}
                className="hover:text-blue"
                href={'/sport/' + sportSlug(s)}
              >
                {s}
              </Link>
            ))}

          <div className="relative group">
            <Link
              href="/sport/other-events"
              className="flex items-center gap-1 hover:text-blue py-4"
            >
              Other Events
              <ChevronDown size={16} />
            </Link>

            <div className="absolute left-0 top-full w-52 bg-white border border-slate-100 rounded-xl shadow-lg py-2 hidden group-hover:block group-focus-within:block">
              {otherSports.map((s) => (
                <Link
                  key={s}
                  href={'/sport/' + sportSlug(s)}
                  className="block px-4 py-2 hover:bg-slate-50 hover:text-blue"
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/#events"
              className="text-sm font-semibold hover:text-blue flex items-center gap-2"
            >
              <Search size={18} />
              Find tickets
            </Link>

            <span className="text-slate-300">
              |
            </span>

            <span className="text-sm font-semibold text-slate-500">
              Global events
            </span>
          </div>

          <Link
            href="/cart"
            aria-label={`Shopping cart with ${itemCount} tickets`}
            className="relative flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 hover:border-blue hover:text-blue transition"
          >
            <ShoppingCart size={21} />

            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-blue text-white text-xs font-bold min-w-5 h-5 px-1 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>

          <button
            type="button"
            className="lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="lg:hidden container-wide pb-5 grid gap-4 font-semibold">
          {sports.map((s) => (
            <Link
              key={s}
              onClick={() => setOpen(false)}
              href={
                s === 'Football'
                  ? '/football'
                  : '/sport/' + sportSlug(s)
              }
            >
              {s}
            </Link>
          ))}

          <div className="border-t border-slate-100 pt-3 grid gap-3 pl-4 text-sm">
            {otherSports.map((s) => (
              <Link
                key={s}
                onClick={() => setOpen(false)}
                href={'/sport/' + sportSlug(s)}
              >
                {s}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
