export function DocsView() {
  return (
    <div>
      <div className="panel">
        <div className="panel-title">Rationale — how and why this model works</div>
        <div className="prose">
          <p>
            The core idea is simple, even though the math underneath (§ below) is standard revenue-management
            theory: <strong>an empty seat at departure is worth nothing</strong>, and different travelers are
            willing to pay very different amounts for the same seat. Flat, one-price-fits-all fares leave money on
            the table with high-willingness-to-pay travelers and empty seats with price-sensitive ones. The engine's
            job is to find, at every point between booking-open and departure, the price that best balances those
            two failure modes — without ever needing a human to hand-tune a fare table.
          </p>
          <h3>1. Split demand into segments</h3>
          <p>
            Leisure and business travelers are modeled separately: different price sensitivity
            (<code>priceElasticity</code>), different typical willingness to pay (<code>referenceFareMultiplier</code>),
            and different booking timing (leisure books early, business books late). This mirrors how real airline
            RM teams segment demand — not by asking who's leisure/business at checkout, but by observing that price
            response and booking timing cluster into a small number of behavioral groups.
          </p>
          <h3>2. Turn that into a willingness-to-pay curve</h3>
          <p>
            Each segment gets an exponential price-response curve — as price rises above what a segment typically
            pays, the number of customers still willing to buy falls off smoothly. Stacking the segments' curves
            together gives the route's overall demand-vs-price relationship, discretized into ~20–30 virtual fare
            "buckets" spanning cheap to expensive, the modern generalization of the handful of fare classes (Y/B/M/K…)
            legacy systems used.
          </p>
          <h3>3. Decide what to protect for later</h3>
          <p>
            This is the actual revenue-management decision: with some seats already sold and some time left before
            departure, how many of the remaining seats should be held back for a late-booking business traveler who
            might pay 2× more, versus sold now at a lower price to a leisure traveler who's ready to buy today?{" "}
            <strong>EMSRb</strong> answers this with a clean statistical rule — protect a seat only when the expected
            value of holding it for higher-fare demand exceeds the certain revenue of selling it now. The engine
            re-runs this calculation repeatedly as departure approaches (§ Method), so the price curve responds to
            how the flight is actually filling.
          </p>
          <h3>4. Keep it inside guardrails</h3>
          <p>
            None of the above is allowed to produce a price outside sensible bounds: a cost-based floor (never sell
            below a defensible contribution margin), a brand/regulatory ceiling, and a cap on how much the price can
            jump between re-optimizations. These are parameters, not hard-coded limits — a revenue-management analyst
            sets them, the engine enforces them.
          </p>
          <p>
            The two panels below restate this for two audiences — commercial framing for executives, full
            derivation and stated assumptions for revenue-management/SME review — and the synthetic evidence for
            "does this actually work" lives in the Validation tab.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">System architecture</div>
        <p className="prose" style={{ marginTop: 0 }}>
          The whole system — UI, API, and pricing engine — deploys as a single Cloudflare Worker with no database.
          The same <code>@flight-pricing/engine</code> module is bundled into both the browser (for instant,
          client-side interactivity) and the Worker (as the authoritative server-side calculation), so there is no
          drift between what the UI shows and what the API returns.
        </p>
        <img
          src="/architecture.svg"
          alt="Architecture diagram: packages/engine (shared TypeScript source) is bundled into both the visitor's browser (React UI + client-side engine, for instant recompute with no network round-trip) and the Cloudflare Worker (static assets + Hono API + server-side engine). The browser and Worker communicate over HTTP for the initial page load and optional server cross-checks. The whole system fits Cloudflare's free tier: 100,000 requests/day, no database, well under 10ms CPU per API request."
          style={{ width: "100%", maxWidth: 960, height: "auto", display: "block", margin: "8px auto 0" }}
        />
      </div>

      <div className="two-col">
      <div className="panel">
        <div className="panel-title">For executives</div>
        <div className="prose">
          <h3>What this is</h3>
          <p>
            A dynamic pricing engine for a single flight leg, built on the same class of revenue-management
            mathematics (EMSRb / bid-price control) that the major network carriers have run since the 1990s —
            generalized here into a near-continuous price curve instead of a handful of fixed fare classes, which is
            the direction the industry has moved (e.g. "continuous pricing" programs at large US carriers).
          </p>
          <h3>Why it matters</h3>
          <p>
            Across the synthetic validation set (see the Validation tab), the dynamic policy earns a mean{" "}
            <strong>4–5% more revenue</strong> than a single flat fare at the same capacity, while running a{" "}
            <strong>higher load factor</strong>. Every input has a defensible default and can be overridden by a
            revenue-management analyst without touching code.
          </p>
          <h3>Risk controls</h3>
          <p>
            Guardrails are first-class parameters, not hard-coded: a cost-based price floor, a brand/regulatory fare
            ceiling, and a maximum per-checkpoint price step all bound what the engine can quote. The engine never
            throws on bad input — out-of-range values are clamped and reported, not crashed on.
          </p>
          <h3>Cost to run</h3>
          <p>
            The entire system — UI, API, and pricing engine — runs in a single Cloudflare Worker with no database.
            All interactive computation happens client-side or in sub-10ms server requests, comfortably inside
            Cloudflare's free tier (100,000 requests/day, no paid add-ons required).
          </p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">For revenue management / SMEs</div>
        <div className="prose">
          <h3>Method</h3>
          <p>
            Willingness-to-pay is modeled per demand segment with an exponential (constant semi-elasticity)
            price-response curve. The WTP curve is discretized into virtual fare buckets; <strong>EMSRb</strong>{" "}
            (Belobaba, 1989) computes nested protection levels and a bid price across the ladder at each
            re-optimization checkpoint, using demand-to-go forecasts derived by Poisson-thinning the full-horizon
            forecast against each segment's booking curve.
          </p>
          <h3>What's simplified</h3>
          <p>
            Single-leg (no O&amp;D network effects), independent segments (no cross-elasticity/diversion), and a
            fixed WTP-to-bucket decomposition held constant over time. These are stated explicitly — see{" "}
            <code>docs/technical-methodology.md</code> for the full derivation and assumption list.
          </p>
          <h3>Validation</h3>
          <p>
            Unit tests cover EMSRb against the closed-form Littlewood's-rule two-class case, monotonicity properties,
            and robustness to malformed input. A Monte Carlo simulator stress-tests the mean-forecast-derived policy
            against stochastic demand realizations. See <code>docs/technical-methodology.md §Validation</code> for
            full methodology and results.
          </p>
          <h3>Full documentation</h3>
          <p>
            <code>docs/executive-overview.md</code> and <code>docs/technical-methodology.md</code> in the repository
            contain the complete write-ups this tab summarizes.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
