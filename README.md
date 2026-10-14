# Grandstand Pass — Phase 1 prototype

A responsive sports ticketing storefront prototype built with Next.js 15, React 19 and Tailwind CSS.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy using GitHub + Vercel

1. Create a **private** GitHub repository called `grandstand-pass`.
2. Upload the **contents** of this folder to the repository root (package.json should be at the root).
3. In Vercel, select **Add New → Project → Import Git Repository**.
4. Select `grandstand-pass`; Vercel should detect Next.js. Click **Deploy**.
5. Share the Vercel preview URL with your business partner.
6. **Do not connect grandstandpass.com yet** if you prefer to keep the prototype private. Vercel preview URLs can be accessed by others unless deployment protection is enabled. Enable Vercel deployment protection if appropriate.

## Important limitations

- Every event, date, image, category and price is **illustrative demonstration content**, not XS2Event inventory. Some dates may not correspond to real fixtures.
- Ticket selector is a visual demo; checkout is disabled. No payment or reservation occurs.
- Venue-map area is a placeholder for supplier-provided maps.
- No XS2Event credentials are included. Never commit API secrets to GitHub or expose them in `NEXT_PUBLIC_` environment variables.
- No claims of official event authorisation or ticket guarantees are made.
- Before production: verify XS2Event catalogue and booking flow, pricing/currency, supplier terms, event images/rights, payment security, customer notifications, privacy compliance, refund policies, accessibility and load testing.

## Planned next phase

Integrate XS2Event through secure Next.js server-side routes, add live event inventory, category and venue-map support, booking state and payment reconciliation, then admin tooling and order fulfilment.
