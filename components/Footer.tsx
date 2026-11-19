
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck,
  Globe2,
  Headphones,
  Mail,
} from 'lucide-react';

export default function Footer() {
  return (
    <>
      <section className="bg-ice py-12">
        <div className="container-wide grid md:grid-cols-3 gap-8">
          <div className="flex gap-4">
            <div className="bg-white text-blue rounded-lg p-3 h-fit">
              <ShieldCheck />
            </div>
            <div>
              <h3 className="font-bold">
                Secure checkout planned
              </h3>
              <p className="text-sm muted mt-1">
                Payments will be enabled only after
                integration and testing.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-white text-blue rounded-lg p-3 h-fit">
              <Globe2 />
            </div>
            <div>
              <h3 className="font-bold">
                Events around the world
              </h3>
              <p className="text-sm muted mt-1">
                Football, motorsport, tennis and more
                in one place.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-white text-blue rounded-lg p-3 h-fit">
              <Headphones />
            </div>
            <div>
              <h3 className="font-bold">
                Customer-first experience
              </h3>
              <p className="text-sm muted mt-1">
                Clear ticket information and a
                straightforward booking journey.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-navy text-white py-12">
        <div className="container-wide grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <Link
              href="/"
              aria-label="Grandstand Pass homepage"
              className="inline-flex items-center"
            >
              <Image
                src="/grandstandpass-logo-footer-white.png"
                alt="Grandstand Pass"
                width={1800}
                height={520}
                className="block w-[210px] md:w-[250px] h-auto"
                unoptimized
              />
            </Link>

            <p className="text-slate-300 text-sm mt-3 max-w-sm">
              Your front-row pass to unforgettable
              sporting moments.
            </p>
          </div>

          <div className="text-sm text-slate-300">
            <p className="font-bold text-white mb-3">
              Explore
            </p>

            <div className="grid gap-2">
              <Link
                href="/football"
                className="hover:text-white transition-colors"
              >
                Football
              </Link>

              <Link
                href="/sport/formula-1"
                className="hover:text-white transition-colors"
              >
                Formula 1
              </Link>

              <Link
                href="/sport/motogp"
                className="hover:text-white transition-colors"
              >
                MotoGP
              </Link>

              <Link
                href="/sport/tennis"
                className="hover:text-white transition-colors"
              >
                Tennis
              </Link>
            </div>
          </div>

          <div className="text-sm text-slate-300">
            <p className="font-bold text-white mb-3">
              Contact &amp; Support
            </p>

            <div className="grid gap-3">
              <Link
                href="/contact"
                className="hover:text-white transition-colors"
              >
                Contact Us
              </Link>

              <Link
                href="/my-booking"
                className="hover:text-white transition-colors"
              >
                My Booking
              </Link>

              <Link
                href="/faq"
                className="hover:text-white transition-colors"
              >
                Frequently Asked Questions (FAQ)
              </Link>

              <Link
                href="/terms"
                className="hover:text-white transition-colors"
              >
                Terms &amp; Conditions
              </Link>

              <a
                href="mailto:info@grandstandpass.com"
                className="inline-flex items-center gap-2 hover:text-white transition-colors break-all"
              >
                <Mail
                  size={17}
                  aria-hidden="true"
                  className="shrink-0"
                />
                info@grandstandpass.com
              </a>
            </div>
          </div>
        </div>

        <div className="container-wide border-t border-slate-700 mt-8 pt-5 text-xs text-slate-400">
          © {new Date().getFullYear()} Grandstand Pass
          {' · '}
          Prototype only
          {' · '}
          No tickets available for purchase yet.
        </div>
      </footer>
    </>
  );
}
