
import TennisEventBrowser from '../../components/TennisEventBrowser';

export default function TennisPage() {
  return (
    <main>
      <section className="bg-[#0b1f41] px-4 py-12 text-white md:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-400">
            Grandstand Pass / Tennis
          </p>

          <h1 className="mt-5 text-4xl font-black md:text-5xl">
            Tennis tickets
          </h1>

          <p className="mt-5 text-lg text-slate-300">
            Explore upcoming Tennis tournaments and
            discover XS2Event test ticket offers.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <TennisEventBrowser />
      </div>
    </main>
  );
}
