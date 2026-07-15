export function DocsView() {
  return (
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
  );
}
