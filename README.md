# Flight Pricing Studio

A dynamic pricing engine for airline flight legs — EMSRb-based revenue
management, a shared TypeScript pricing engine, and an interactive UI for
setting parameters and visualizing the resulting price/revenue curves —
deployed as a **single Cloudflare Worker** (UI + API + engine, no database),
designed to run comfortably within Cloudflare's free tier.

> Synthetic data and illustrative parameters throughout. Not real airline
> fares, schedules, or revenue figures.

**Documentation:**

- [`docs/executive-overview.md`](./docs/executive-overview.md) — business
  rationale, for commercial/executive stakeholders.
- [`docs/technical-methodology.md`](./docs/technical-methodology.md) — the
  full mathematical methodology, assumptions, and validation results, for
  revenue-management/data-science review.

## Architecture

![Architecture diagram: packages/engine (shared TypeScript source) is bundled into both the visitor's browser (React UI + client-side engine) and the Cloudflare Worker (static assets + Hono API + server-side engine), communicating over HTTP, all fitting within Cloudflare's free tier.](./apps/web/public/architecture.svg)

```
flight-pricing/
├── packages/engine/     @flight-pricing/engine — pure TypeScript pricing engine
│                        (EMSRb, demand/elasticity model, booking curves,
│                        Monte Carlo simulator, synthetic data generator).
│                        Zero runtime dependencies; runs identically in
│                        Node, the browser, and the Workers runtime.
├── apps/worker/         @flight-pricing/worker — Cloudflare Worker (Hono).
│                        Serves the built frontend as static assets and
│                        exposes /api/defaults, /api/price, /api/simulate,
│                        /api/scenarios. This is the single deployable.
└── apps/web/             @flight-pricing/web — React + TypeScript + Vite UI.
                          Imports @flight-pricing/engine directly for
                          instant, client-side interactivity; calls the
                          Worker API on demand for server-side cross-checks.
```

The frontend and backend share one engine implementation — the same code
computes prices in the browser and on the server, so there is no drift
between "what the UI shows" and "what the API returns."

## Quickstart

Requires Node ≥ 20 and [pnpm](https://pnpm.io).

```bash
pnpm install

# Run the engine's unit tests
pnpm test

# Regenerate the synthetic validation dataset (writes apps/web/public/data/validation-dataset.json)
pnpm generate:synthetic-data

# Build the frontend, then run the Worker locally (serves UI + API on one port)
pnpm build
pnpm --filter @flight-pricing/worker dev
# → http://localhost:8787
```

For frontend-only iteration with hot reload (proxies /api to a locally
running worker on :8787):

```bash
pnpm --filter @flight-pricing/worker dev   # terminal 1
pnpm dev:web                                # terminal 2 → http://localhost:5173
```

## Deployment

The whole system deploys as one Cloudflare Worker:

```bash
pnpm build                                   # builds apps/web/dist
pnpm --filter @flight-pricing/worker deploy  # wrangler deploy
```

This requires a Cloudflare account and authentication — either run
`npx wrangler login` interactively, or set a `CLOUDFLARE_API_TOKEN`
environment variable (see
[Cloudflare's token creation guide](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)).
Neither is configured in this environment, so deployment has not been
executed as part of this change — `wrangler deploy --dry-run` has been used
to confirm the build and configuration are valid (see
`apps/worker/wrangler.toml`).

The Worker config (`apps/worker/wrangler.toml`) uses only Workers Static
Assets for the UI — no KV, D1, Durable Objects, or Queues — so there is
nothing else to provision. See `docs/technical-methodology.md §9` for the
free-tier CPU/request budget analysis.

## Testing

```bash
pnpm test        # 28 unit tests: EMSRb correctness, price-curve invariants,
                  # simulation reproducibility, input-sanitization robustness
pnpm typecheck    # strict TypeScript across all three packages
```
