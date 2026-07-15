export function ExecutiveOverviewPage() {
  return (
    <div>
      <a className="doc-back-link" href="#/docs">
        ← Back to Documentation
      </a>
      <div className="panel">
        <div className="panel-title">Flight Pricing Studio — Executive Overview</div>
        <p className="doc-byline">
          Audience: commercial / revenue leadership, finance, product sponsors. Companion document:{" "}
          <a href="#/docs/technical-methodology">Technical Methodology</a> (for revenue management / data science
          review).
        </p>
        <div className="prose">
          <h2>1. What this is</h2>
          <p>
            Flight Pricing Studio is a working dynamic pricing engine for a single flight leg, plus an interactive
            tool for setting its parameters and seeing the resulting price and revenue outcomes before anything
            touches production data.
          </p>
          <p>
            It is built on <strong>the same class of mathematics that airline revenue management (RM) has run on
            since the 1990s</strong> — expected marginal seat revenue (EMSR) bid-price control, the technique
            American Airlines pioneered and that became an industry standard. The implementation here generalizes it
            into a <strong>near-continuous price curve</strong> rather than a handful of fixed fare buckets, which is
            the direction the industry itself has moved over the last several years (carriers have publicly discussed
            "continuous pricing" as a successor to legacy fare-class systems).
          </p>
          <p>
            This is a <strong>decision-support and demonstration system</strong>, not a production booking engine. It
            does not touch real fares, real inventory, or real customers. Its purpose is to let commercial and
            revenue-management stakeholders evaluate the pricing logic, its assumptions, and its behavior across
            realistic scenarios — and to serve as a credible, reviewable starting point for a production build.
          </p>

          <h2>2. Why dynamic pricing, and why this approach</h2>
          <p>
            An airline seat is a <strong>perishable asset</strong>: unsold at departure, it is worth nothing. Two
            customers rarely have the same willingness to pay for the same seat — a business traveler booking three
            days out and a leisure traveler booking three months out are different demand pools with different price
            sensitivity. Flat, one-size-fits-all pricing leaves money on the table with the first group and empty
            seats with the second.
          </p>
          <p>
            The engine addresses this with three ideas, all standard in RM theory and explained in depth for a
            technical audience in the companion document:
          </p>
          <ol>
            <li>
              <strong>Segment the demand.</strong> Model leisure and business demand separately — different price
              sensitivity, different willingness to pay, different booking timing.
            </li>
            <li>
              <strong>Protect inventory for higher-value demand that hasn't shown up yet.</strong> This is what EMSR
              bid-price control does: it decides, at each point in the booking horizon, how many seats to hold back
              for customers willing to pay more, versus how many to sell now.
            </li>
            <li>
              <strong>Re-optimize as bookings accrue.</strong> The engine re-runs this logic repeatedly between
              booking open and departure, using demand-to-go forecasts, so the price curve responds to how the flight
              is actually filling relative to how it was expected to fill.
            </li>
          </ol>

          <h2>3. What the evidence shows</h2>
          <p>
            The repository ships a <strong>synthetic validation exhibit</strong> — 240 illustrative flight-dates
            across 10 representative route types (short-haul leisure through long-haul international business), each
            stress-tested with a 150-trial Monte Carlo simulation comparing the dynamic policy against a single flat
            fare at the same capacity. Full detail and methodology are in the companion document and reproducible
            from the repository (<code>pnpm generate:synthetic-data</code>, fixed seed, deterministic — the
            "Validation" tab in the running app shows this exhibit live).
          </p>
          <p>Headline results from that exhibit:</p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Mean revenue uplift vs. flat fare</td>
                  <td>
                    <strong>+4.3%</strong>
                  </td>
                </tr>
                <tr>
                  <td>Median revenue uplift vs. flat fare</td>
                  <td>
                    <strong>+3.4%</strong>
                  </td>
                </tr>
                <tr>
                  <td>Mean load factor, dynamic policy</td>
                  <td>
                    <strong>90.0%</strong>
                  </td>
                </tr>
                <tr>
                  <td>Mean load factor, flat-fare baseline</td>
                  <td>
                    <strong>87.1%</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            These figures are <strong>deliberately modest and route-dependent</strong> — some synthetic flight-dates
            in the exhibit show a small loss relative to the flat fare, not just gains, because the underlying demand
            draws are randomized. This is intentional: a credible validation exhibit shows variance, not just a
            cherry-picked win. The magnitude (single-digit percent, occasionally double-digit on leisure-heavy
            short-haul routes) is consistent with the range commonly cited in the RM literature for the incremental
            value of dynamic pricing/inventory control over undifferentiated pricing.
          </p>
          <p>
            <strong>These are illustrative, synthetic numbers</strong>, not a forecast for any real airline, route,
            or fleet. They demonstrate that the model behaves the way RM theory predicts it should, not what a
            specific airline would realize in production — that requires calibrating the parameters below against
            real booking and fare data.
          </p>

          <h2>4. What an executive can control (without touching code)</h2>
          <p>
            Every commercially meaningful assumption is an adjustable parameter with a sensible, documented default —
            not a hard-coded constant. In the running application's "Pricing Studio" tab, that includes:
          </p>
          <ul>
            <li>
              <strong>Route economics</strong> — capacity, base fare, distance, variable/fixed cost per seat, fuel
              surcharge.
            </li>
            <li>
              <strong>Demand mix</strong> — the leisure/business split, how price-sensitive each group is, and when
              each group typically books.
            </li>
            <li>
              <strong>Seasonality</strong> — month-by-month and day-of-week demand multipliers.
            </li>
            <li>
              <strong>Competitive posture</strong> — how the engine's price reacts to a competitor price index, and
              how strongly.
            </li>
            <li>
              <strong>Guardrails</strong> — a cost-based price floor, a brand/regulatory price ceiling, and a cap on
              how much the price can move between re-optimizations (an anti-"sticker shock" control).
            </li>
          </ul>
          <p>
            Changing any of these updates the price curve, load-factor projection, and revenue estimate{" "}
            <strong>instantly</strong> in the browser — there is no batch job or waiting period to explore a
            scenario.
          </p>

          <h2>5. Risk and governance</h2>
          <ul>
            <li>
              <strong>The engine cannot quote a price outside the guardrails you set.</strong> The price floor and
              ceiling are enforced in code, not by convention.
            </li>
            <li>
              <strong>The engine does not crash on bad input.</strong> Out-of-range or malformed parameters are
              automatically clamped to a safe range, and every adjustment made is reported back, not silently
              swallowed.
            </li>
            <li>
              <strong>The model's assumptions are stated, not hidden.</strong> The companion document lists
              explicitly what is and is not modeled (see "What's simplified"), so a revenue-management reviewer can
              assess fit-for-purpose before any production use.
            </li>
            <li>
              <strong>Nothing here touches real customer or booking data.</strong> All demonstration data is
              synthetic and clearly labeled as such throughout the application.
            </li>
          </ul>

          <h2>6. Cost to operate</h2>
          <p>
            The entire system — the user interface, the API, and the pricing engine itself — runs as a single
            lightweight server process, with no database and no persistent infrastructure to manage:
          </p>
          <ul>
            <li>
              Interactive price-curve and simulation computation happens <strong>in the visitor's browser</strong>{" "}
              (the same engine code that runs on the server), so there is no server cost or latency for exploring
              scenarios.
            </li>
            <li>
              The server API exists for authoritative/integration use and responds in low single-digit milliseconds
              of compute per request.
            </li>
          </ul>
          <p>There is effectively no infrastructure cost to keep this running as a standing demonstration or internal evaluation tool.</p>

          <h2>7. Suggested next steps</h2>
          <ol>
            <li>
              Have a revenue-management analyst review the companion technical document and validate the parameter
              defaults against known route economics.
            </li>
            <li>
              Calibrate segment elasticity and booking-curve parameters against real historical booking data for one
              or two representative routes.
            </li>
            <li>
              Extend the validation exhibit with those calibrated parameters and compare against actual historical
              revenue for the same routes/dates as a backtest.
            </li>
            <li>
              Decide, with RM and engineering, what a production integration path would look like (this system is
              intentionally decoupled from any booking/inventory system so it can be evaluated independently first).
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
