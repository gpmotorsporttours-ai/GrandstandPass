import { NextResponse } from 'next/server';
import { xs2eventGet } from '../../../lib/xs2event';

type XS2Event = {
  event_id?: unknown;
  event_name?: unknown;
  date_start?: unknown;
  date_stop?: unknown;
  city?: unknown;
  venue_name?: unknown;
  tournament_name?: unknown;
  iso_country?: unknown;
  country?: unknown;
  country_name?: unknown;
  event_status?: unknown;
};

type XS2Response = {
  events?: XS2Event[];
  pagination?: {
    next_page?: string | null;
    total_size?: number;
  };
};

const COUNTRY_REGIONS: Record<string, string> = {
  ita: 'Italy', italy: 'Italy', it: 'Italy',
  gbr: 'United Kingdom', 'united kingdom': 'United Kingdom', gb: 'United Kingdom', uk: 'United Kingdom',
  esp: 'Spain', spain: 'Spain', es: 'Spain',
  deu: 'Germany', germany: 'Germany', de: 'Germany',
  fra: 'France', france: 'France', fr: 'France',
  nld: 'Netherlands', netherlands: 'Netherlands', nl: 'Netherlands',
  prt: 'Portugal', portugal: 'Portugal', pt: 'Portugal',
  aut: 'Austria', austria: 'Austria', at: 'Austria',
  bel: 'Belgium', belgium: 'Belgium', be: 'Belgium',
  dnk: 'Denmark', denmark: 'Denmark', dk: 'Denmark',
  irl: 'Ireland', ireland: 'Ireland', ie: 'Ireland',
  che: 'Switzerland', switzerland: 'Switzerland', ch: 'Switzerland',
  swe: 'Sweden', sweden: 'Sweden', se: 'Sweden',
  nor: 'Norway', norway: 'Norway', no: 'Norway',
  fin: 'Finland', finland: 'Finland', fi: 'Finland',
  pol: 'Poland', poland: 'Poland', pl: 'Poland',
  tur: 'Turkey', turkey: 'Turkey', 'türkiye': 'Turkey', tr: 'Turkey',
  grc: 'Greece', greece: 'Greece', gr: 'Greece',
  hrv: 'Croatia', croatia: 'Croatia', hr: 'Croatia',
  srb: 'Serbia', serbia: 'Serbia', rs: 'Serbia',
  hun: 'Hungary', hungary: 'Hungary', hu: 'Hungary',
  rou: 'Romania', romania: 'Romania', ro: 'Romania',
  ukr: 'Ukraine', ukraine: 'Ukraine', ua: 'Ukraine',
  bra: 'Brazil', brazil: 'Brazil', br: 'Brazil',
  arg: 'Argentina', argentina: 'Argentina', ar: 'Argentina',
  mex: 'Mexico', mexico: 'Mexico', mx: 'Mexico',
  usa: 'USA', 'united states': 'USA', us: 'USA',
  can: 'Canada', canada: 'Canada', ca: 'Canada',
  jpn: 'Japan', japan: 'Japan', jp: 'Japan',
  aus: 'Australia', australia: 'Australia', au: 'Australia',
  zaf: 'South Africa', 'south africa': 'South Africa', za: 'South Africa',
  mar: 'Morocco', morocco: 'Morocco', ma: 'Morocco',
  egy: 'Egypt', egypt: 'Egypt', eg: 'Egypt',
  nga: 'Nigeria', nigeria: 'Nigeria', ng: 'Nigeria',
  sau: 'Saudi Arabia', 'saudi arabia': 'Saudi Arabia', sa: 'Saudi Arabia',
  qat: 'Qatar', qatar: 'Qatar', qa: 'Qatar',
  are: 'UAE', uae: 'UAE', 'united arab emirates': 'UAE', ae: 'UAE',
  and: 'Other Leagues', andorra: 'Other Leagues', ad: 'Other Leagues',
};

const SCOTTISH_CITIES = new Set([
  'glasgow', 'edinburgh', 'aberdeen', 'dundee', 'perth',
  'inverness', 'paisley', 'kilmarnock', 'motherwell',
  'st mirren', 'stirling', 'livingston', 'falkirk',
  'hamilton', 'dingwall', 'st johnstone',
]);

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Correct common double-encoded UTF-8 text from supplier TEST data.
function cleanText(value: unknown): string {
  const input = textValue(value);
  if (!/[ÃÂâ]/.test(input)) return input;
  try {
    const bytes = Uint8Array.from(
      Array.from(input, character => character.charCodeAt(0))
    );
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded || input;
  } catch {
    return input;
  }
}

function resolveRegion(event: XS2Event): string {
  const country = cleanText(
    event.iso_country || event.country_name || event.country
  ).toLowerCase();
  const city = cleanText(event.city).toLowerCase();
  const competition = cleanText(event.tournament_name).toLowerCase();

  if (
    (['gbr', 'gb', 'uk', 'united kingdom'].includes(country) || !country) &&
    (SCOTTISH_CITIES.has(city) || /scottish (premiership|championship|league|cup)/.test(competition))
  ) {
    return 'Scotland';
  }

  return COUNTRY_REGIONS[country] || 'Other Leagues';
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;
const MAX_PAGES = 10;
const EXCLUDED_STATUSES = new Set([
  'nosale', 'soldout', 'cancelled', 'canceled',
]);

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const allEvents: XS2Event[] = [];
    const seenIds = new Set<string>();
    let pagesChecked = 0;
    let searchComplete = false;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        sport_type: 'soccer',
        date_stop: `ge:${today}`,
        sorting: 'date_start:asc',
        page_size: String(PAGE_SIZE),
        page: String(page),
      });

      const response = await xs2eventGet<XS2Response>(
        `/events?${params.toString()}`
      );
      pagesChecked++;
      const pageEvents = Array.isArray(response.events) ? response.events : [];

      for (const event of pageEvents) {
        const id = textValue(event.event_id);
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        allEvents.push(event);
      }

      if (!pageEvents.length || !response.pagination?.next_page) {
        searchComplete = true;
        break;
      }
    }

    const validEvents = allEvents
      .filter(event => {
        const id = textValue(event.event_id);
        const name = cleanText(event.event_name);
        const date = textValue(event.date_start);
        const status = textValue(event.event_status).toLowerCase();
        return Boolean(id && name && date && !Number.isNaN(Date.parse(date))) &&
          date.slice(0, 10) >= today &&
          !EXCLUDED_STATUSES.has(status) &&
          !/bulk test|dummy|placeholder/i.test(name);
      })
      .sort((a, b) =>
        textValue(a.date_start).localeCompare(textValue(b.date_start))
      );

    const supplierFootballEvents = validEvents.map(event => {
      const id = textValue(event.event_id);
      const venue = cleanText(event.venue_name);
      const city = cleanText(event.city);
      return {
        id: `xs2event-test-${id}`,
        supplierEventId: id,
        name: cleanText(event.event_name),
        date: textValue(event.date_start),
        location: [venue, city].filter(Boolean).join(', ') || 'Venue to be confirmed',
        region: resolveRegion(event),
        competition: cleanText(event.tournament_name) || undefined,
      };
    });

    // The homepage component consumes this separate, standardised event shape.
    const events = validEvents.map(event => ({
      event_id: textValue(event.event_id),
      event_name: cleanText(event.event_name),
      tournament_name: cleanText(event.tournament_name),
      date_start: textValue(event.date_start),
      date_stop: textValue(event.date_stop),
      venue_name: cleanText(event.venue_name),
      city: cleanText(event.city),
      iso_country: cleanText(event.iso_country || event.country_name || event.country),
      event_status: textValue(event.event_status),
      region: resolveRegion(event),
    }));

    return NextResponse.json(
      {
        supplierFootballEvents,
        events,
        eventsReturned: events.length,
        pagesChecked,
        searchComplete,
        testData: true,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=300' } }
    );
  } catch {
    return NextResponse.json(
      {
        supplierFootballEvents: [],
        events: [],
        testData: true,
        error: 'Test supplier events unavailable',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
