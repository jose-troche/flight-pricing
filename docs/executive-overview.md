# Flight Pricing Studio — Executive Overview

**Audience:** commercial / revenue leadership, finance, product sponsors.
**Companion document:** [`technical-methodology.md`](./technical-methodology.md) (for revenue management / data science review).

---

## 1. What this is

Flight Pricing Studio is a working dynamic pricing engine for a single flight
leg, plus an interactive tool for setting its parameters and seeing the
resulting price and revenue outcomes before anything touches production data.

It is built on **the same class of mathematics that airline revenue
management (RM) has run on since the 1990s** — expected marginal seat revenue
(EMSR) bid-price control, the technique American Airlines pioneered and that
became an industry standard. The implementation here generalizes it into a
**near-continuous price curve** rather than a handful of fixed fare buckets,
which is the direction the industry itself has moved over the last several
years (carriers have publicly discussed "continuous pricing" as a successor
to legacy fare-class systems).

This is a **decision-support and demonstration system**, not a production
booking engine. It does not touch real fares, real inventory, or real
customers. Its purpose is to let commercial and revenue-management
stakeholders evaluate the pricing logic, its assumptions, and its behavior
across realistic scenarios — and to serve as a credible, reviewable starting
point for a production build.

## 2. Why dynamic pricing, and why this approach

An airline seat is a **perishable asset**: unsold at departure, it is worth
nothing. Two customers rarely have the same willingness to pay for the same
seat — a business traveler booking three days out and a leisure traveler
booking three months out are different demand pools with different price
sensitivity. Flat, one-size-fits-all pricing leaves money on the table with
the first group and empty seats with the second.

The engine addresses this with three ideas, all standard in RM theory and
explained in depth for a technical audience in the companion document:

1. **Segment the demand.** Model leisure and business demand separately —
   different price sensitivity, different willingness to pay, different
   booking timing.
2. **Protect inventory for higher-value demand that hasn't shown up yet.**
   This is what EMSR bid-price control does: it decides, at each point in the
   booking horizon, how many seats to hold back for customers willing to pay
   more, versus how many to sell now.
3. **Re-optimize as bookings accrue.** The engine re-runs this logic
   repeatedly between booking open and departure, using demand-to-go
   forecasts, so the price curve responds to how the flight is actually
   filling relative to how it was expected to fill.

## 3. What the evidence shows

The repository ships a **synthetic validation exhibit** — 240 illustrative
flight-dates across 10 representative route types (short-haul leisure through
long-haul international business), each stress-tested with a 150-trial Monte
Carlo simulation comparing the dynamic policy against a single flat fare at
the same capacity. Full detail and methodology are in the companion document
and reproducible from the repository (`pnpm generate:synthetic-data`, fixed
seed, deterministic — the "Validation" tab in the running app shows this
exhibit live).

Headline results from that exhibit:

| Metric | Result |
|---|---|
| Mean revenue uplift vs. flat fare | **+4.3%** |
| Median revenue uplift vs. flat fare | **+3.4%** |
| Mean load factor, dynamic policy | **90.0%** |
| Mean load factor, flat-fare baseline | **87.1%** |

These figures are **deliberately modest and route-dependent** — some
synthetic flight-dates in the exhibit show a small loss relative to the flat
fare, not just gains, because the underlying demand draws are randomized.
This is intentional: a credible validation exhibit shows variance, not just a
cherry-picked win. The magnitude (single-digit percent, occasionally
double-digit on leisure-heavy short-haul routes) is consistent with the range
commonly cited in the RM literature for the incremental value of dynamic
pricing/inventory control over undifferentiated pricing.

**These are illustrative, synthetic numbers**, not a forecast for any real
airline, route, or fleet. They demonstrate that the model behaves the way RM
theory predicts it should, not what a specific airline would realize in
production — that requires calibrating the parameters below against real
booking and fare data.

## 4. What an executive can control (without touching code)

Every commercially meaningful assumption is an adjustable parameter with a
sensible, documented default — not a hard-coded constant. In the running
application's "Pricing Studio" tab, that includes:

- **Route economics** — capacity, base fare, distance, variable/fixed cost
  per seat, fuel surcharge.
- **Demand mix** — the leisure/business split, how price-sensitive each
  group is, and when each group typically books.
- **Seasonality** — month-by-month and day-of-week demand multipliers.
- **Competitive posture** — how the engine's price reacts to a competitor
  price index, and how strongly.
- **Guardrails** — a cost-based price floor, a brand/regulatory price
  ceiling, and a cap on how much the price can move between
  re-optimizations (an anti-"sticker shock" control).

Changing any of these updates the price curve, load-factor projection, and
revenue estimate **instantly** in the browser — there is no batch job or
waiting period to explore a scenario.

## 5. Risk and governance

- **The engine cannot quote a price outside the guardrails you set.** The
  price floor and ceiling are enforced in code, not by convention.
- **The engine does not crash on bad input.** Out-of-range or malformed
  parameters are automatically clamped to a safe range, and every adjustment
  made is reported back, not silently swallowed.
- **The model's assumptions are stated, not hidden.** The companion document
  lists explicitly what is and is not modeled (see "What's simplified"),
  so a revenue-management reviewer can assess fit-for-purpose before any
  production use.
- **Nothing here touches real customer or booking data.** All demonstration
  data is synthetic and clearly labeled as such throughout the application.

## 6. Cost to operate

The entire system — the user interface, the API, and the pricing engine
itself — runs as **a single Cloudflare Worker**, with no database and no
persistent infrastructure to manage:

- Interactive price-curve and simulation computation happens **in the
  visitor's browser** (the same engine code that runs on the server), so
  there is no server cost or latency for exploring scenarios.
- The server API exists for authoritative/integration use and responds in
  low single-digit milliseconds of compute per request.
- The full system is designed to run comfortably within **Cloudflare
  Workers' free tier** (100,000 requests/day, no paid add-ons, no database
  fees) — see the companion document, §7, for the specific numbers.

There is effectively no infrastructure cost to keep this running as a
standing demonstration or internal evaluation tool.

## 7. Suggested next steps

1. Have a revenue-management analyst review the companion technical
   document and validate the parameter defaults against known route
   economics.
2. Calibrate segment elasticity and booking-curve parameters against real
   historical booking data for one or two representative routes.
3. Extend the validation exhibit with those calibrated parameters and
   compare against actual historical revenue for the same routes/dates as a
   backtest.
4. Decide, with RM and engineering, what a production integration path
   would look like (this system is intentionally decoupled from any
   booking/inventory system so it can be evaluated independently first).
