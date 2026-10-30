
'use client';

import Link from 'next/link';
import {
  Search,
  Menu,
  X,
  ChevronDown,
  ShoppingCart,
  Globe2,
} from 'lucide-react';
import { useState } from 'react';
import { sports, sportSlug } from '../lib/data';
import {
  useCart,
  type DisplayCurrency,
} from './CartProvider';

const otherSports = [
  'Basketball',
  'Boxing',
  'Cricket',
  'Golf',
  'Horse Racing',
  'NFL',
  'Rugby',
];

const currencies: {
  code: DisplayCurrency;
  label: string;
}[] = [
  { code: 'ZAR', label: '🇿🇦 ZAR' },
  { code: 'EUR', label: '🇪🇺 EUR' },
  { code: 'USD', label: '🇺🇸 USD' },
  { code: 'GBP', label: '🇬🇧 GBP' },
  { code: 'AED', label: '🇦🇪 AED' },
];

// Original Grandstand Pass ticket mark.
// Custom SVG with subtle GP initials.
function GrandstandPassLogo() {
  return (
    <span
      className="flex items-center gap-2 shrink-0"
      aria-label="Grandstand Pass"
    >
      <span className="flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-xl bg-[#1463E6] shrink-0">
        <svg
          viewBox="0 0 64 64"
          width="36"
          height="36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M10 16H54V25C49.5 25 46 28.5 46 32S49.5 39 54 39V48H10V39C14.5 39 18 35.5 18 32S14.5 25 10 25V16Z"
            stroke="white"
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <text
            x="32"
            y="36.5"
            textAnchor="middle"
            fill="white"
            fontSize="15"
            fontWeight="800"
            fontFamily="Arial, Helvetica, sans-serif"
            fontStyle="italic"
            letterSpacing="-1"
          >
            GP
          </text>
        </svg>
      </span>

      <span className="font-black tracking-tight text-xl md:text-2xl text-[#0B2145] whitespace-nowrap">
        Grandstand
        <span className="text-[#1463E6]">Pass</span>
      </span>
    </span>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);

  const {
    itemCount,
    displayCurrency,
    setDisplayCurrency,
  } = useCart();

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
      <div className="container-wide h-20 flex items-center justify-between gap-5">
        <Link
          href="/"
          className="flex items-center shrink-0"
        >
          <GrandstandPassLogo />
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

        <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-2 py-2 hover:border-blue transition">
            <Globe2
              size={17}
              className="text-slate-500 hidden sm:block"
            />

            <select
              value={displayCurrency}
              onChange={(event) =>
                setDisplayCurrency(
                  event.target.value as DisplayCurrency
                )
              }
              aria-label="Preferred display currency"
              title="Choose your preferred display currency"
              className="bg-transparent text-xs sm:text-sm font-bold text-navy cursor-pointer outline-none max-w-[82px]"
            >
              {currencies.map((item) => (
                <option
                  key={item.code}
                  value={item.code}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/cart"
            aria-label={`Shopping cart with ${itemCount} tickets`}
            className="relative flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 hover:border-blue hover:text-blue transition shrink-0"
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
