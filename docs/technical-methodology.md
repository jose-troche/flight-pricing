# Flight Pricing Studio — Technical Methodology

**Audience:** revenue management analysts, pricing scientists, engineers reviewing the model for correctness and fitness for purpose.
**Companion document:** [`executive-overview.md`](./executive-overview.md) (non-technical business rationale).
**Code:** all algorithms described here live in `packages/engine/src/`, dependency-free TypeScript, unit-tested with Vitest (`packages/engine/test/`).

---

## 1. Problem framing

We price a single flight leg (one origin-destination-date-cabin) over a
booking horizon of `H` days before departure. At any point in that horizon we
must choose a price to quote, knowing:

- how many seats remain (`remainingCapacity`),
- how much more demand, and at what price sensitivity, is still expected to
  arrive before departure (`demand-to-go`),
- and that an unsold seat at departure earns zero revenue (the seat
  *perishes*).

This is the canonical **single-resource revenue management** problem
(Talluri & van Ryzin, *The Theory and Practice of Revenue Management*, 2004).
We solve it with **EMSRb** (Belobaba, 1989, 1992), the nested
protection-level heuristic that has been industry-standard for single-leg
inventory control since the 1990s, applied across a **discretized continuous
willingness-to-pay curve** rather than a small number of hand-coded fare
classes — the generalization several major carriers have since adopted under
the label "continuous pricing."

## 2. Demand model

### 2.1 Segments

Demand is split into named segments (default: *Leisure*, *Business*), each
with:

- `demandShare` — fraction of total market demand,
- `priceElasticity` — price sensitivity,
- `referenceFareMultiplier` — typical willingness to pay, as a multiple of
  the route's base fare,
- `demandCv` — coefficient of variation (forecast uncertainty),
- a `bookingCurve` (peak days-to-departure and spread) governing when the
  segment books.

This is a standard simplification in RM literature: model heterogeneous
demand as a small number of segments with different price-response curves,
rather than a single aggregate curve, without going as far as full
individual-choice modeling. See §6 for the limits of this simplification.

### 2.2 Total market demand

`packages/engine/src/demand.ts::segmentTotalDemandMean`

```
marketDemand = capacity × MARKET_DEMAND_TO_CAPACITY_RATIO   (default 1.15)
segmentMean  = marketDemand × seasonalityMultiplier(month, dow) × segmentShare
```

The 1.15 ratio means the underlying market, at the reference fare, could
theoretically fill 115% of the cabin — i.e. there is genuine scarcity to
manage. This is what makes the RM problem non-trivial: if demand never
exceeded capacity, price discrimination would add little value. Seasonality
enters here, as a driver of **demand volume**, not as a direct price
multiplier — the price response to seasonality is *emergent*: more demand
against fixed capacity raises EMSRb's bid price on its own. This is a
deliberate modeling choice or an SME reviewer's checklist should confirm.

### 2.3 Price-response (willingness-to-pay) curve

`packages/engine/src/demand.ts::segmentSurvival`

For a segment with total mean demand `μ`, we use the standard **exponential
(constant semi-elasticity) demand curve** (Talluri & van Ryzin, ch. 7) as a
*survival function* — expected number of that segment's customers willing to
pay `price` or more:

```
S(price) = μ × exp(−elasticity × (price − refFare) / refFare)
```

clamped to `[0, 2.5μ]` to avoid unbounded growth as price → 0. `refFare =
baseFare × referenceFareMultiplier`.

## 3. Virtual fare-bucket ladder

`packages/engine/src/pricing-engine.ts::buildBuckets`

Continuous pricing is approximated by discretizing the fare range
`[floor, ceiling]` into `N` (default 26, adjustable) **log-spaced** virtual
buckets — geometric spacing, matching how real fare ladders step (percentage
increments, not fixed dollar increments). For bucket `k` with fare `f_k`
(sorted descending), its demand mean/std is the **difference in segment
survival** between adjacent fares:

```
segmentContribution(k, s) = S_s(f_k) − S_s(f_{k−1})      [S_s(f_0) for k=0]
bucketMean(k)  = Σ_s segmentContribution(k, s)
bucketStd(k)   = sqrt(Σ_s (segmentContribution(k,s) × segment_s.demandCv)²)
```

This decomposition is computed once per pricing run (it does not vary with
time — see §6) and is the basis for both the full-horizon bucket ladder
shown in the UI and the time-varying demand-to-go forecast in §4.

## 4. Booking curves and demand-to-go

`packages/engine/src/booking-curve.ts`

Each segment's booking timing is modeled as a lognormal-shaped arrival
**intensity** over days-to-departure, peaking at `bookingCurve.peakDaysToDeparture`
with spread `bookingCurve.spreadDays` (business books late with a tight
spread; leisure books early with a wide spread). Integrating this density
over `[0, H]` on a daily grid gives a proper probability distribution over
arrival day, from which we derive, for any checkpoint `t`:

- `remainingFraction_s(t)` — fraction of segment `s`'s total demand still to
  arrive at or before day `t` (a survival function over time),
- `intervalFraction_s(i)` — fraction arriving in the window between
  consecutive checkpoints.

**Demand-to-go for bucket `k` at checkpoint `t`** is then each segment's
contribution to that bucket, thinned by the segment's remaining fraction:

```
meanToGo(k, t) = Σ_s segmentContribution(k, s) × remainingFraction_s(t)
```

Variance is thinned consistently with **Poisson thinning**: if a Poisson(λ)
arrival process is thinned by keeping each arrival independently with
probability `f`, the result is Poisson(λf) — mean and variance both scale by
`f`. We apply this scaling to our (possibly over-dispersed, CV-parameterized)
demand variance as a reasonable analogous approximation:

```
varToGo(k, t) = Σ_s (segmentContribution(k,s) × segment_s.demandCv)² × remainingFraction_s(t)
```

## 5. EMSRb and the checkpoint re-optimization loop

### 5.1 EMSRb

`packages/engine/src/emsr.ts::computeEmsrB`

Given buckets sorted by fare descending and remaining capacity `C`, for each
pair of adjacent aggregated classes `(1..j)` vs. `(j+1)`:

```
M_j  = Σ_{i≤j} meanToGo(i)                       (aggregate demand-to-go)
σ_j  = sqrt(Σ_{i≤j} varToGo(i))
f̄_j  = Σ_{i≤j} meanToGo(i)·fare(i) / M_j          (weighted average fare)
CR   = fare(j+1) / f̄_j                            (critical ratio)
protection_j = M_j + Φ⁻¹(1 − CR) × σ_j
```

This is the direct n-class generalization of **Littlewood's rule**: protect
seats for the higher-value aggregate up to the point where the probability
its demand exceeds the protection level equals the ratio of the lower fare
to the higher aggregate's average fare. `Φ⁻¹` (inverse standard normal CDF)
is implemented via Acklam's rational approximation with a Halley refinement
step (`packages/engine/src/stats.ts`), verified against known quantiles in
`test/stats.test.ts`.

Nested booking limits follow: `bookingLimit(0) = C`,
`bookingLimit(j) = clamp(C − protection_{j−1}, 0, C)`. The **bid price** is
the fare of the lowest-fare bucket still open (`bookingLimit > 0`) — the
marginal value of the next seat sold.

`test/emsr.test.ts` verifies this against the textbook two-class Littlewood
example by hand, plus monotonicity (bid price never falls as capacity
shrinks) and boundary behavior (zero capacity, single bucket).

### 5.2 Checkpoints and the forward march

`packages/engine/src/pricing-engine.ts::generatePriceCurve`,
`booking-curve.ts::generateCheckpoints`

Re-optimization checkpoints (data-collection points, "DCPs" in RM parlance)
are generated with **denser spacing near departure**
(`t_i = H × ((K−i)/K)^1.6`), matching how real RM systems schedule more
frequent re-optimizations as departure nears and forecast uncertainty
shrinks. At each checkpoint, in order from the booking-horizon start to
departure:

1. Compute demand-to-go per bucket (§4) using the *current* remaining
   fraction.
2. Run EMSRb (§5.1) against current remaining capacity → raw bid price.
3. Apply the **competitive overlay**:
   `price = bidPrice × (1 + competitiveSensitivity × (competitorIndex − 1))`.
4. Clamp to the **guardrails**: a cost-based floor
   (`variableCost × minFareToCostRatio + fuelSurcharge`), a brand/regulatory
   ceiling (`baseFare × maxFareMultiplier`), and a maximum fractional
   step-change versus the previous checkpoint's price (anti-sticker-shock).
5. Compute expected bookings for the interval until the next checkpoint —
   each segment's interval arrivals (§4) times its acceptance share at the
   quoted price (§2.3, normalized) — capped at remaining capacity (excess is
   recorded as spilled demand).
6. Deduct accepted bookings from remaining capacity and move to the next
   checkpoint.

The result is a full price curve, load-factor curve, and revenue estimate
across the booking horizon — recomputed from scratch (not simulated
stochastically) as the *expected* trajectory under the mean forecast. §5.3
discusses the emergent behavior this produces near departure.

### 5.3 A note on near-departure behavior

Because demand-to-go (§4) is thinned toward zero as `t → 0`, EMSRb correctly
stops protecting inventory once expected future high-fare demand is
negligible — and, with capacity still remaining, opens the lowest buckets
rather than let seats depart empty. This is not a bug: it is the direct,
unforced consequence of EMSRb's marginal-value logic (an empty seat earns
$0; almost any positive fare beats that). It is also sensitive to the tail
shape of the booking-curve density near `t=0`, and real carriers often
override it with an explicit close-in inventory hold-back policy to guard
against underforecasting last-minute high-fare demand. The
`maxStepChangeFraction` guardrail (§5.2 step 4) is the control surface for
softening this in the current model; a reviewer calibrating this for a real
route should sanity-check the near-departure price trajectory against that
route's actual walk-up fare behavior.

## 6. Explicit simplifications

Stated plainly, for reviewer sign-off:

- **Single-leg, not network.** No origin-destination network effects, no
  connecting-passenger displacement value, no fleet-level optimization.
- **Independent segments.** No cross-elasticity or diversion between
  segments (e.g. a business traveler "buying down" into a leisure fare is
  not modeled as a separate behavior beyond the shared WTP curve).
- **Time-invariant bucket decomposition.** The fare-bucket-to-segment
  demand split (§3) is computed once from the full-horizon forecast and only
  *thinned* over time (§4); it does not itself shift shape as booking
  progresses.
- **Deterministic price curve vs. stochastic simulation are two different
  code paths.** `generatePriceCurve` produces the *expected* trajectory
  under mean forecasts; `runSimulation` (§7) separately stress-tests that
  fixed policy against randomized demand draws. The model does not
  re-forecast mid-simulation based on observed bookings (no Bayesian
  updating of the demand forecast itself).
- **No overbooking cancellation/no-show dynamics beyond a static factor.**
  `overbookingFactor` and `expectedNoShowRate` are reported and used to size
  sellable capacity, but no-show risk is not itself priced.

## 7. Validation

### 7.1 Unit tests (`packages/engine/test/`, 28 tests, run via `pnpm test`)

- `stats.test.ts` — normal CDF/inverse-CDF accuracy against known quantiles;
  PRNG determinism and distributional sanity of the normal sampler.
- `emsr.test.ts` — EMSRb against the textbook two-class Littlewood example;
  booking limits always in `[0, capacity]`; bid price monotonic in capacity;
  boundary cases (zero capacity, single bucket).
- `pricing-engine.test.ts` — price curve stays within guardrail bounds;
  checkpoints ordered and terminate at departure; cumulative bookings
  non-decreasing; higher demand (seasonality) raises revenue/seat; higher
  competitor index raises the opening quoted price; floor is respected even
  under near-zero demand; capacity is never oversold beyond the overbooking
  factor; and — a robustness test — the engine returns finite, sane output
  even when fed deliberately malformed parameters (negative fares,
  out-of-range shares).
- `simulate.test.ts` — simulation reproducibility given a fixed seed; finite
  and non-negative outputs; the dynamic policy is not systematically beaten
  by the flat-fare baseline on default parameters; trial-count clamping.
- `validate.test.ts` — `sanitizeParameters` clamps every out-of-range field,
  renormalizes segment shares, replaces non-finite values, and resolves
  internally-inconsistent guardrails, all without throwing.

### 7.2 Monte Carlo policy validation (`packages/engine/src/simulate.ts`)

For a given parameter set, `runSimulation` draws `trials` stochastic
demand realizations per segment (`Normal(segmentMean, segmentMean × CV)`,
clipped ≥ 0) and replays **both** (a) the dynamic price sequence from
`generatePriceCurve` and (b) a single flat fare (the route's base fare) as a
counterfactual, against each realization — capping bookings at capacity each
interval and recording spillage. This is the standard way to answer "how
robust is a policy derived from a mean forecast to forecast error?" — the
question a revenue-management analyst asks before trusting the deterministic
curve. Percentiles (P10/P50/P90) and means are reported for both arms.

### 7.3 Synthetic validation exhibit (`packages/engine/src/synthetic-data.ts`)

`pnpm generate:synthetic-data` (fixed seed `20240115`, fully reproducible)
prices 24 randomized flight-dates (month, day-of-week, ±10–15% competitive
noise) across 10 route archetypes spanning short-haul leisure to long-haul
international business, runs a 150-trial simulation (§7.2) on each, and
writes `apps/web/public/data/validation-dataset.json`. The running
application's "Validation" tab renders this exhibit live. Current results
(see `docs/executive-overview.md §3` for the business framing):

- Mean revenue uplift vs. flat fare: **+4.3%**, median **+3.4%**
- Mean load factor: **90.0%** dynamic vs. **87.1%** flat-fare baseline
- Per-route mean uplift ranges from **+1.2%** (a business-heavy transcon
  route, where flat pricing already captures most of the reference fare) to
  **+9.1%** (a price-sensitive short-haul leisure route, where segmentation
  has the most to add) — the range itself is informative: dynamic pricing's
  value is not uniform, and the model correctly shows more/less benefit
  depending on route demand structure, rather than a flat uplift everywhere.

**These are synthetic numbers for a synthetic dataset** — they validate that
the *implementation* behaves consistently with RM theory, not that a real
carrier would realize this uplift. Real deployment requires calibrating
`segments`, `seasonality`, and `bookingCurve` parameters against actual
booking data per route, and backtesting against realized revenue.

## 8. Robustness

`packages/engine/src/validate.ts::sanitizeParameters` is the single choke
point through which all externally-supplied parameters pass before reaching
the pricing math (both the client UI and the Worker API call it). It:

- clamps every numeric field to a documented safe range
  (`packages/engine/src/defaults.ts::PARAMETER_BOUNDS`),
- replaces non-finite values,
- renormalizes segment demand shares to sum to 1,
- resets malformed seasonality arrays to neutral,
- widens an internally-inconsistent fare ceiling/floor rather than leaving
  an infeasible guardrail band,

and returns a list of every adjustment made, surfaced to the caller (visible
in the UI as "Input adjustments applied"). The engine is designed to never
throw or return `NaN`/negative prices regardless of what a client sends —
verified by the robustness test in §7.1.

## 9. Free-tier deployment budget

The system is a single Cloudflare Worker (`apps/worker`) serving both the
built frontend (via Workers Static Assets, no separate hosting) and the API
(via Hono). No KV, D1, Durable Objects, or Queues are used — the engine is
pure computation with no persisted state, so there is nothing to provision
or pay for beyond the Worker itself.

- **CPU budget.** The Workers Free plan allows up to 10ms of CPU time per
  request. `generatePriceCurve` over the default configuration (26 buckets ×
  ~66 checkpoints) runs in low single-digit milliseconds. `/api/simulate`
  caps server-side trial count at 300 for the same reason. Larger Monte
  Carlo runs (up to 1,000 trials, adjustable in the UI) run **client-side**,
  in the visitor's browser, using the identical `@flight-pricing/engine`
  package — unmetered, and outside the server's CPU budget entirely.
- **Request budget.** Free plan allows 100,000 requests/day. Static asset
  requests (the UI bundle) are served directly by Cloudflare's asset
  handling without invoking the Worker's JavaScript at all when there's an
  exact path match; only `/api/*` calls and unmatched (SPA-routed) paths
  invoke the Worker script.
- **No database, no bandwidth-metered storage.** The synthetic validation
  dataset (~120KB JSON) ships as a static asset, not a database read.

## 10. References

- Belobaba, P. P. (1989). "Application of a probabilistic decision model to
  airline seat inventory control." *Operations Research*, 37(2).
- Belobaba, P. P. (1992). "Optimal vs. heuristic methods for nested seat
  allocation." AGIFORS Reservations Study Group.
- Littlewood, K. (1972). "Forecasting and control of passenger bookings."
  AGIFORS Symposium Proceedings.
- Talluri, K. T., & van Ryzin, G. J. (2004). *The Theory and Practice of
  Revenue Management*. Springer.
- Smith, B. C., Leimkuhler, J. F., & Darrow, R. M. (1992). "Yield management
  at American Airlines." *Interfaces*, 22(1).
