
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck,
  Globe2,
  Headphones,
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
                Payments will be enabled only after integration and testing.
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
                Football, motorsport, tennis and more in one place.
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
                Clear ticket information and a straightforward booking journey.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-navy text-white py-12">
        <div className="container-wide flex flex-col md:flex-row justify-between gap-8">
          <div>
            <Link
              href="/"
              aria-label="Grandstand Pass homepage"
              className="inline-flex items-center"
            >
              <Image
                src="/grandstandpass-logo-footer.png"
                alt="Grandstand Pass"
                width={1800}
                height={520}
                className="block w-[210px] md:w-[250px] h-auto"
                unoptimized
              />
            </Link>

            <p className="text-slate-300 text-sm mt-3 max-w-sm">
              Your front-row pass to unforgettable sporting moments.
            </p>
          </div>

          <div className="text-sm text-slate-300">
            <p className="font-bold text-white mb-3">
              Explore
            </p>
            <div className="grid gap-2">
              <Link href="/football">
                Football
              </Link>
              <Link href="/sport/formula-1">
                Formula 1
              </Link>
              <Link href="/sport/motogp">
                MotoGP
              </Link>
              <Link href="/sport/tennis">
                Tennis
              </Link>
            </div>
          </div>
        </div>

        <div className="container-wide border-t border-slate-700 mt-8 pt-5 text-xs text-slate-400">
          © {new Date().getFullYear()} Grandstand Pass · Prototype only · No tickets available for purchase yet.
        </div>
      </footer>
    </>
  );
}
