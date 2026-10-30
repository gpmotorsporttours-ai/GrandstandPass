
Loading older messages…





1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
import Link from 'next/link';
import { CalendarDays, MapPin, Ticket } from 'lucide-react';
import { xs2eventGet } from '../../../lib/xs2event';
import { calculateSupplierTicketPrice } from '../../../lib/supplierPricing';
import { getTicketDisplayPrice } from '../../../lib/ticketPricing';
import { isSupportedCurrency } from '../../../lib/currency';
import FootballDisplayPrice from '../../../components/FootballDisplayPrice';
import SupplierTestCartButton from '../../../components/SupplierTestCartButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupplierEvent = {
  event_id?: string;
  event_name?: string;
  tournament_name?: string;
  venue_name?: string;
  city?: string;
  iso_country?: string;
  date_start?: string;
  date_stop?: string;
  event_status?: string;
};

type EventsResponse = {
  events?: SupplierEvent[];
};

type SupplierTicket = {
  ticket_id?: string;
  event_id?: string;
  ticket_title?: string;
  category_name?: string;
  category_id?: string;
  ticket_status?: string;
  stock?: number | null;
  min_order?: number | null;
  currency_code?: string;
  net_rate?: number | null;
  options?: {
    numbered_seat?: boolean;
    covered_seat?: boolean;
    pairs_only?: boolean;
  };
};

type TicketsResponse = {
  tickets?: SupplierTicket[];
};

type DisplayCurrency = 'ZAR' | 'EUR' | 'USD' | 'GBP' | 'AED';

type CurrencyAmounts = Partial<Record<DisplayCurrency, number>>;

type PricedTicket = {
  ticket: SupplierTicket;
  sellingPrice: number | null;
  displayPrices: CurrencyAmounts;
};

const displayCurrencies: DisplayCurrency[] = [
  'ZAR', 'EUR', 'USD', 'GBP', 'AED',
];

const EVENT_PAGE_SIZE = 50;
// Super Bowl LXI was found on page 59 of the supplier test catalogue.
// Stop immediately once the selected event is found.
const MAX_EVENT_PAGES = 65;
const TICKET_PAGE_SIZE = 50;

async function getDisplayPrices(
  sellingPrice: number | null,
  currency: string | undefined
): Promise<CurrencyAmounts> {
  if (sellingPrice === null || !isSupportedCurrency(currency)) {
    return {};
  }

  const results = await Promise.all(
    displayCurrencies.map(async targetCurrency => {
      if (targetCurrency === currency) {
        return [targetCurrency, sellingPrice] as const;
      }

      try {
        const converted = await getTicketDisplayPrice(
          { amount: sellingPrice, currency },
          targetCurrency
        );

        const amount = converted?.displayAmount;

        if (
          typeof amount === 'number' &&
          Number.isFinite(amount) &&
          amount > 0
