export function TechnicalMethodologyPage() {
  return (
    <div>
      <a className="doc-back-link" href="#/docs">
        ← Back to Documentation
      </a>
      <div className="panel">
        <div className="panel-title">Flight Pricing Studio — Technical Methodology</div>
        <p className="doc-byline">
          Audience: revenue management analysts, pricing scientists, engineers reviewing the model for correctness and
          fitness for purpose. Companion document: <a href="#/docs/executive-overview">Executive Overview</a>{" "}
          (non-technical business rationale). Code: all algorithms described here live in{" "}
          <a href="https://github.com/jose-troche/flight-pricing">https://github.com/jose-troche/flight-pricing</a>,
          dependency-free TypeScript, unit-tested with Vitest.
        </p>
        <div className="prose">
          <h2>1. Problem framing</h2>
          <p>
            We price a single flight leg (one origin-destination-date-cabin) over a booking horizon of <code>H</code>{" "}
            days before departure. At any point in that horizon we must choose a price to quote, knowing:
          </p>
          <ul>
            <li>how many seats remain (<code>remainingCapacity</code>),</li>
            <li>
              how much more demand, and at what price sensitivity, is still expected to arrive before departure (
              <code>demand-to-go</code>),
            </li>
            <li>and that an unsold seat at departure earns zero revenue (the seat <em>perishes</em>).</li>
          </ul>
          <p>
            This is the canonical <strong>single-resource revenue management</strong> problem (Talluri &amp; van
            Ryzin, <em>The Theory and Practice of Revenue Management</em>, 2004). We solve it with{" "}
            <strong>EMSRb</strong> (Belobaba, 1989, 1992), the nested protection-level heuristic that has been
            industry-standard for single-leg inventory control since the 1990s, applied across a{" "}
            <strong>discretized continuous willingness-to-pay curve</strong> rather than a small number of hand-coded
            fare classes — the generalization several major carriers have since adopted under the label "continuous
            pricing."
          </p>

          <h2>2. Demand model</h2>
          <h3>2.1 Segments</h3>
          <p>
            Demand is split into named segments (default: <em>Leisure</em>, <em>Business</em>), each with:
          </p>
          <ul>
            <li><code>demandShare</code> — fraction of total market demand,</li>
            <li><code>priceElasticity</code> — price sensitivity,</li>
            <li>
              <code>referenceFareMultiplier</code> — typical willingness to pay, as a multiple of the route's base
              fare,
            </li>
            <li><code>demandCv</code> — coefficient of variation (forecast uncertainty),</li>
            <li>
              a <code>bookingCurve</code> (peak days-to-departure and spread) governing when the segment books.
            </li>
          </ul>
          <p>
            This is a standard simplification in RM literature: model heterogeneous demand as a small number of
            segments with different price-response curves, rather than a single aggregate curve, without going as far
            as full individual-choice modeling. See §6 for the limits of this simplification.
          </p>

          <h3>2.2 Total market demand</h3>
          <p>
            <code>packages/engine/src/demand.ts::segmentTotalDemandMean</code>
          </p>
          <pre>
            <code>{`marketDemand = capacity × MARKET_DEMAND_TO_CAPACITY_RATIO   (default 1.15)
segmentMean  = marketDemand × seasonalityMultiplier(month, dow) × segmentShare`}</code>
          </pre>
          <p>
            The 1.15 ratio means the underlying market, at the reference fare, could theoretically fill 115% of the
            cabin — i.e. there is genuine scarcity to manage. This is what makes the RM problem non-trivial: if demand
            never exceeded capacity, price discrimination would add little value. Seasonality enters here, as a
            driver of <strong>demand volume</strong>, not as a direct price multiplier — the price response to
            seasonality is <em>emergent</em>: more demand against fixed capacity raises EMSRb's bid price on its own.
            This is a deliberate modeling choice or an SME reviewer's checklist should confirm.
          </p>

          <h3>2.3 Price-response (willingness-to-pay) curve</h3>
          <p>
            <code>packages/engine/src/demand.ts::segmentSurvival</code>
          </p>
          <p>
            For a segment with total mean demand <code>μ</code>, we use the standard{" "}
            <strong>exponential (constant semi-elasticity) demand curve</strong> (Talluri &amp; van Ryzin, ch. 7) as a{" "}
            <em>survival function</em> — expected number of that segment's customers willing to pay <code>price</code>{" "}
            or more:
          </p>
          <pre>
            <code>S(price) = μ × exp(−elasticity × (price − refFare) / refFare)</code>
          </pre>
          <p>
            clamped to <code>[0, 2.5μ]</code> to avoid unbounded growth as price → 0. <code>refFare = baseFare ×
            referenceFareMultiplier</code>.
          </p>

          <h2>3. Virtual fare-bucket ladder</h2>
          <p>
            <code>packages/engine/src/pricing-engine.ts::buildBuckets</code>
          </p>
          <p>
            Continuous pricing is approximated by discretizing the fare range <code>[floor, ceiling]</code> into{" "}
            <code>N</code> (default 26, adjustable) <strong>log-spaced</strong> virtual buckets — geometric spacing,
            matching how real fare ladders step (percentage increments, not fixed dollar increments). For bucket{" "}
            <code>k</code> with fare <code>f_k</code> (sorted descending), its demand mean/std is the{" "}
            <strong>difference in segment survival</strong> between adjacent fares:
          </p>
          <pre>
            <code>{`segmentContribution(k, s) = S_s(f_k) − S_s(f_{k−1})      [S_s(f_0) for k=0]
bucketMean(k)  = Σ_s segmentContribution(k, s)
bucketStd(k)   = sqrt(Σ_s (segmentContribution(k,s) × segment_s.demandCv)²)`}</code>
          </pre>
          <p>
            This decomposition is computed once per pricing run (it does not vary with time — see §6) and is the
            basis for both the full-horizon bucket ladder shown in the UI and the time-varying demand-to-go forecast
            in §4.
          </p>

          <h2>4. Booking curves and demand-to-go</h2>
          <p>
            <code>packages/engine/src/booking-curve.ts</code>
          </p>
          <p>
            Each segment's booking timing is modeled as a lognormal-shaped arrival <strong>intensity</strong> over
            days-to-departure, peaking at <code>bookingCurve.peakDaysToDeparture</code> with spread{" "}
            <code>bookingCurve.spreadDays</code> (business books late with a tight spread; leisure books early with a
            wide spread). Integrating this density over <code>[0, H]</code> on a daily grid gives a proper
            probability distribution over arrival day, from which we derive, for any checkpoint <code>t</code>:
          </p>
          <ul>
            <li>
              <code>remainingFraction_s(t)</code> — fraction of segment <code>s</code>'s total demand still to arrive
              at or before day <code>t</code> (a survival function over time),
            </li>
            <li>
              <code>intervalFraction_s(i)</code> — fraction arriving in the window between consecutive checkpoints.
            </li>
          </ul>
          <p>
            <strong>Demand-to-go for bucket <code>k</code> at checkpoint <code>t</code></strong> is then each
            segment's contribution to that bucket, thinned by the segment's remaining fraction:
          </p>
          <pre>
            <code>meanToGo(k, t) = Σ_s segmentContribution(k, s) × remainingFraction_s(t)</code>
          </pre>
          <p>
            Variance is thinned consistently with <strong>Poisson thinning</strong>: if a Poisson(λ) arrival process
            is thinned by keeping each arrival independently with probability <code>f</code>, the result is
            Poisson(λf) — mean and variance both scale by <code>f</code>. We apply this scaling to our (possibly
            over-dispersed, CV-parameterized) demand variance as a reasonable analogous approximation:
          </p>
          <pre>
            <code>varToGo(k, t) = Σ_s (segmentContribution(k,s) × segment_s.demandCv)² × remainingFraction_s(t)</code>
          </pre>

          <h2>5. EMSRb and the checkpoint re-optimization loop</h2>
          <h3>5.1 EMSRb</h3>
          <p>
            <code>packages/engine/src/emsr.ts::computeEmsrB</code>
          </p>
          <p>
            Given buckets sorted by fare descending and remaining capacity <code>C</code>, for each pair of adjacent
            aggregated classes <code>(1..j)</code> vs. <code>(j+1)</code>:
          </p>
          <pre>
            <code>{`M_j  = Σ_{i≤j} meanToGo(i)                       (aggregate demand-to-go)
σ_j  = sqrt(Σ_{i≤j} varToGo(i))
f̄_j  = Σ_{i≤j} meanToGo(i)·fare(i) / M_j          (weighted average fare)
CR   = fare(j+1) / f̄_j                            (critical ratio)
protection_j = M_j + Φ⁻¹(1 − CR) × σ_j`}</code>
          </pre>
          <p>
            This is the direct n-class generalization of <strong>Littlewood's rule</strong>: protect seats for the
            higher-value aggregate up to the point where the probability its demand exceeds the protection level
            equals the ratio of the lower fare to the higher aggregate's average fare. <code>Φ⁻¹</code> (inverse
            standard normal CDF) is implemented via Acklam's rational approximation with a Halley refinement step (
            <code>packages/engine/src/stats.ts</code>), verified against known quantiles in{" "}
            <code>test/stats.test.ts</code>.
          </p>
          <p>
            Nested booking limits follow: <code>bookingLimit(0) = C</code>,{" "}
            <code>bookingLimit(j) = clamp(C − protection_{"{"}j−1{"}"}, 0, C)</code>. The <strong>bid price</strong>{" "}
            is the fare of the lowest-fare bucket still open (<code>bookingLimit &gt; 0</code>) — the marginal value
            of the next seat sold.
          </p>
          <p>
            <code>test/emsr.test.ts</code> verifies this against the textbook two-class Littlewood example by hand,
            plus monotonicity (bid price never falls as capacity shrinks) and boundary behavior (zero capacity, single
            bucket).
          </p>

          <h3>5.2 Checkpoints and the forward march</h3>
          <p>
            <code>packages/engine/src/pricing-engine.ts::generatePriceCurve</code>,{" "}
            <code>booking-curve.ts::generateCheckpoints</code>
          </p>
          <p>
            Re-optimization checkpoints (data-collection points, "DCPs" in RM parlance) are generated with{" "}
            <strong>denser spacing near departure</strong> (<code>t_i = H × ((K−i)/K)^1.6</code>), matching how real
            RM systems schedule more frequent re-optimizations as departure nears and forecast uncertainty shrinks. At
            each checkpoint, in order from the booking-horizon start to departure:
          </p>
          <ol>
            <li>Compute demand-to-go per bucket (§4) using the <em>current</em> remaining fraction.</li>
            <li>Run EMSRb (§5.1) against current remaining capacity → raw bid price.</li>
            <li>
              Apply the <strong>competitive overlay</strong>:{" "}
              <code>price = bidPrice × (1 + competitiveSensitivity × (competitorIndex − 1))</code>.
            </li>
            <li>
              Clamp to the <strong>guardrails</strong>: a cost-based floor (
              <code>variableCost × minFareToCostRatio + fuelSurcharge</code>), a brand/regulatory ceiling (
              <code>baseFare × maxFareMultiplier</code>), and a maximum fractional step-change versus the previous
              checkpoint's price (anti-sticker-shock).
            </li>
            <li>
              Compute expected bookings for the interval until the next checkpoint — each segment's interval arrivals
              (§4) times its acceptance share at the quoted price (§2.3, normalized) — capped at remaining capacity
              (excess is recorded as spilled demand).
            </li>
            <li>Deduct accepted bookings from remaining capacity and move to the next checkpoint.</li>
          </ol>
          <p>
            The result is a full price curve, load-factor curve, and revenue estimate across the booking horizon —
            recomputed from scratch (not simulated stochastically) as the <em>expected</em> trajectory under the mean
            forecast. §5.3 discusses the emergent behavior this produces near departure.
          </p>

          <h3>5.3 A note on near-departure behavior</h3>
          <p>
            Because demand-to-go (§4) is thinned toward zero as <code>t → 0</code>, EMSRb correctly stops protecting
            inventory once expected future high-fare demand is negligible — and, with capacity still remaining, opens
            the lowest buckets rather than let seats depart empty. This is not a bug: it is the direct, unforced
            consequence of EMSRb's marginal-value logic (an empty seat earns $0; almost any positive fare beats
            that). It is also sensitive to the tail shape of the booking-curve density near <code>t=0</code>, and
            real carriers often override it with an explicit close-in inventory hold-back policy to guard against
            underforecasting last-minute high-fare demand. The <code>maxStepChangeFraction</code> guardrail (§5.2
            step 4) is the control surface for softening this in the current model; a reviewer calibrating this for a
            real route should sanity-check the near-departure price trajectory against that route's actual walk-up
            fare behavior.
          </p>

          <h2>6. Explicit simplifications</h2>
          <p>Stated plainly, for reviewer sign-off:</p>
          <ul>
            <li>
              <strong>Single-leg, not network.</strong> No origin-destination network effects, no
              connecting-passenger displacement value, no fleet-level optimization.
            </li>
            <li>
              <strong>Independent segments.</strong> No cross-elasticity or diversion between segments (e.g. a
              business traveler "buying down" into a leisure fare is not modeled as a separate behavior beyond the
              shared WTP curve).
            </li>
            <li>
              <strong>Time-invariant bucket decomposition.</strong> The fare-bucket-to-segment demand split (§3) is
              computed once from the full-horizon forecast and only <em>thinned</em> over time (§4); it does not
              itself shift shape as booking progresses.
            </li>
            <li>
              <strong>Deterministic price curve vs. stochastic simulation are two different code paths.</strong>{" "}
              <code>generatePriceCurve</code> produces the <em>expected</em> trajectory under mean forecasts;{" "}
              <code>runSimulation</code> (§7) separately stress-tests that fixed policy against randomized demand
              draws. The model does not re-forecast mid-simulation based on observed bookings (no Bayesian updating of
              the demand forecast itself).
            </li>
            <li>
              <strong>No overbooking cancellation/no-show dynamics beyond a static factor.</strong>{" "}
              <code>overbookingFactor</code> and <code>expectedNoShowRate</code> are reported and used to size
              sellable capacity, but no-show risk is not itself priced.
            </li>
          </ul>

          <h2>7. Validation</h2>
          <h3>7.1 Unit tests (<code>packages/engine/test/</code>, 28 tests, run via <code>pnpm test</code>)</h3>
          <ul>
            <li>
              <code>stats.test.ts</code> — normal CDF/inverse-CDF accuracy against known quantiles; PRNG determinism
              and distributional sanity of the normal sampler.
            </li>
            <li>
              <code>emsr.test.ts</code> — EMSRb against the textbook two-class Littlewood example; booking limits
              always in <code>[0, capacity]</code>; bid price monotonic in capacity; boundary cases (zero capacity,
              single bucket).
            </li>
            <li>
              <code>pricing-engine.test.ts</code> — price curve stays within guardrail bounds; checkpoints ordered
              and terminate at departure; cumulative bookings non-decreasing; higher demand (seasonality) raises
              revenue/seat; higher competitor index raises the opening quoted price; floor is respected even under
              near-zero demand; capacity is never oversold beyond the overbooking factor; and — a robustness test —
              the engine returns finite, sane output even when fed deliberately malformed parameters (negative fares,
              out-of-range shares).
            </li>
            <li>
              <code>simulate.test.ts</code> — simulation reproducibility given a fixed seed; finite and non-negative
              outputs; the dynamic policy is not systematically beaten by the flat-fare baseline on default
              parameters; trial-count clamping.
            </li>
            <li>
              <code>validate.test.ts</code> — <code>sanitizeParameters</code> clamps every out-of-range field,
              renormalizes segment shares, replaces non-finite values, and resolves internally-inconsistent
              guardrails, all without throwing.
            </li>
          </ul>

          <h3>7.2 Monte Carlo policy validation (<code>packages/engine/src/simulate.ts</code>)</h3>
          <p>
            For a given parameter set, <code>runSimulation</code> draws <code>trials</code> stochastic demand
            realizations per segment (<code>Normal(segmentMean, segmentMean × CV)</code>, clipped ≥ 0) and replays{" "}
            <strong>both</strong> (a) the dynamic price sequence from <code>generatePriceCurve</code> and (b) a single
            flat fare (the route's base fare) as a counterfactual, against each realization — capping bookings at
            capacity each interval and recording spillage. This is the standard way to answer "how robust is a policy
            derived from a mean forecast to forecast error?" — the question a revenue-management analyst asks before
            trusting the deterministic curve. Percentiles (P10/P50/P90) and means are reported for both arms.
          </p>

          <h3>7.3 Synthetic validation exhibit (<code>packages/engine/src/synthetic-data.ts</code>)</h3>
          <p>
            <code>pnpm generate:synthetic-data</code> (fixed seed <code>20240115</code>, fully reproducible) prices 24
            randomized flight-dates (month, day-of-week, ±10–15% competitive noise) across 10 route archetypes
            spanning short-haul leisure to long-haul international business, runs a 150-trial simulation (§7.2) on
            each, and writes <code>apps/web/public/data/validation-dataset.json</code>. The running application's
            "Validation" tab renders this exhibit live. Current results (see the{" "}
            <a href="#/docs/executive-overview">Executive Overview</a> §3 for the business framing):
          </p>
          <ul>
            <li>Mean revenue uplift vs. flat fare: <strong>+4.3%</strong>, median <strong>+3.4%</strong></li>
            <li>Mean load factor: <strong>90.0%</strong> dynamic vs. <strong>87.1%</strong> flat-fare baseline</li>
            <li>
              Per-route mean uplift ranges from <strong>+1.2%</strong> (a business-heavy transcon route, where flat
              pricing already captures most of the reference fare) to <strong>+9.1%</strong> (a price-sensitive
              short-haul leisure route, where segmentation has the most to add) — the range itself is informative:
              dynamic pricing's value is not uniform, and the model correctly shows more/less benefit depending on
              route demand structure, rather than a flat uplift everywhere.
            </li>
          </ul>
          <p>
            <strong>These are synthetic numbers for a synthetic dataset</strong> — they validate that the{" "}
            <em>implementation</em> behaves consistently with RM theory, not that a real carrier would realize this
            uplift. Real deployment requires calibrating <code>segments</code>, <code>seasonality</code>, and{" "}
            <code>bookingCurve</code> parameters against actual booking data per route, and backtesting against
            realized revenue.
          </p>

          <h2>8. Robustness</h2>
          <p>
            <code>packages/engine/src/validate.ts::sanitizeParameters</code> is the single choke point through which
            all externally-supplied parameters pass before reaching the pricing math (both the client UI and the
            server API call it). It:
          </p>
          <ul>
            <li>
              clamps every numeric field to a documented safe range (
              <code>packages/engine/src/defaults.ts::PARAMETER_BOUNDS</code>),
            </li>
            <li>replaces non-finite values,</li>
            <li>renormalizes segment demand shares to sum to 1,</li>
            <li>resets malformed seasonality arrays to neutral,</li>
            <li>
              widens an internally-inconsistent fare ceiling/floor rather than leaving an infeasible guardrail band,
            </li>
          </ul>
          <p>
            and returns a list of every adjustment made, surfaced to the caller (visible in the UI as "Input
            adjustments applied"). The engine is designed to never throw or return <code>NaN</code>/negative prices
            regardless of what a client sends — verified by the robustness test in §7.1.
          </p>

          <h2>9. Deployment characteristics</h2>
          <p>
            The system is a single backend service (<code>apps/worker</code>) serving both the built frontend (as
            static assets, no separate hosting) and the API (via Hono). No external database or queue is used — the
            engine is pure computation with no persisted state, so there is nothing to provision beyond the service
            itself.
          </p>
          <ul>
            <li>
              <strong>CPU budget.</strong> <code>generatePriceCurve</code> over the default configuration (26 buckets
              × ~66 checkpoints) runs in low single-digit milliseconds. <code>/api/simulate</code> caps server-side
              trial count at 300 to keep response times low. Larger Monte Carlo runs (up to 1,000 trials, adjustable
              in the UI) run <strong>client-side</strong>, in the visitor's browser, using the identical{" "}
              <code>@flight-pricing/engine</code> package — unmetered, and outside the server's compute budget
              entirely.
            </li>
            <li>
              <strong>No database, no bandwidth-metered storage.</strong> The synthetic validation dataset (~120KB
              JSON) ships as a static asset, not a database read.
            </li>
          </ul>

          <h2>10. References</h2>
          <ul>
            <li>
              Belobaba, P. P. (1989). "Application of a probabilistic decision model to airline seat inventory
              control." <em>Operations Research</em>, 37(2).
            </li>
            <li>
              Belobaba, P. P. (1992). "Optimal vs. heuristic methods for nested seat allocation." AGIFORS
              Reservations Study Group.
            </li>
            <li>
              Littlewood, K. (1972). "Forecasting and control of passenger bookings." AGIFORS Symposium Proceedings.
            </li>
            <li>
              Talluri, K. T., &amp; van Ryzin, G. J. (2004). <em>The Theory and Practice of Revenue Management</em>.
              Springer.
            </li>
            <li>
              Smith, B. C., Leimkuhler, J. F., &amp; Darrow, R. M. (1992). "Yield management at American Airlines."{" "}
              <em>Interfaces</em>, 22(1).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
