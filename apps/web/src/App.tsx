import { useMemo, useState } from "react";
import {
  generatePriceCurve,
  getDefaultParameters,
  sanitizeParameters,
  type PricingParameters,
} from "@flight-pricing/engine";
import { ParameterPanel } from "./components/ParameterPanel";
import { PriceCurveChart } from "./components/PriceCurveChart";
import { BookingCurveChart } from "./components/BookingCurveChart";
import { FareBucketTable } from "./components/FareBucketTable";
import { SimulationPanel } from "./components/SimulationPanel";
import { ValidationView } from "./components/ValidationView";
import { DocsView } from "./components/DocsView";
import { StatRow, StatTile } from "./components/StatTile";
import { fetchPriceFromServer } from "./lib/api";

type Tab = "studio" | "simulation" | "validation" | "docs";

const TABS: { id: Tab; label: string }[] = [
  { id: "studio", label: "Pricing studio" },
  { id: "simulation", label: "Simulation" },
  { id: "validation", label: "Validation" },
  { id: "docs", label: "Documentation" },
];

export default function App() {
  const [parameters, setParameters] = useState<PricingParameters>(() => getDefaultParameters());
  const [tab, setTab] = useState<Tab>("studio");
  const [serverCheck, setServerCheck] = useState<{ revenuePerSeat: number } | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { result, issues } = useMemo(() => {
    const { parameters: sanitized, issues } = sanitizeParameters(parameters);
    return { result: generatePriceCurve(sanitized), issues };
  }, [parameters]);

  const runServerCheck = async () => {
    setServerLoading(true);
    setServerError(null);
    try {
      const res = await fetchPriceFromServer(parameters);
      setServerCheck({ revenuePerSeat: res.result.expectedRevenuePerSeat });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setServerLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="app-title">Flight Pricing Studio</h1>
          <p className="app-subtitle">
            EMSRb-based dynamic pricing engine · interactive parameters · Monte Carlo validation · single Cloudflare
            Worker
          </p>
        </div>
      </header>

      <nav className="tab-bar" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className="tab-button"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "studio" && (
        <div className="layout-grid">
          <ParameterPanel parameters={parameters} onChange={setParameters} />
          <div>
            <StatRow>
              <StatTile label="Expected revenue" value={`$${result.expectedRevenue.toFixed(0)}`} />
              <StatTile label="Revenue per seat" value={`$${result.expectedRevenuePerSeat.toFixed(0)}`} />
              <StatTile label="Expected final load factor" value={`${(result.expectedFinalLoadFactor * 100).toFixed(1)}%`} />
              <StatTile
                label="Price range"
                value={`$${result.bucketFloor.toFixed(0)}–$${result.bucketCeiling.toFixed(0)}`}
              />
            </StatRow>

            {issues.length > 0 && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-title">Input adjustments applied</div>
                <ul className="issue-list">
                  {issues.map((issue, i) => (
                    <li key={i}>
                      <strong>{issue.path}</strong>: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <PriceCurveChart result={result} />
            <BookingCurveChart result={result} capacity={parameters.flight.capacity} />
            <FareBucketTable result={result} />

            <div className="panel">
              <button className="button secondary" onClick={runServerCheck} disabled={serverLoading}>
                {serverLoading ? "Calling Worker API…" : "Cross-check via Cloudflare Worker API"}
              </button>
              {serverCheck ? (
                <div className="field-desc" style={{ marginTop: 8 }}>
                  Server-computed revenue/seat: <strong>${serverCheck.revenuePerSeat.toFixed(2)}</strong> — client
                  estimate ${result.expectedRevenuePerSeat.toFixed(2)}. Both use the identical{" "}
                  <code>@flight-pricing/engine</code> module deployed to the Worker.
                </div>
              ) : null}
              {serverError ? <div className="issue-list">{serverError}</div> : null}
            </div>
          </div>
        </div>
      )}

      {tab === "simulation" && <SimulationPanel parameters={parameters} />}
      {tab === "validation" && <ValidationView />}
      {tab === "docs" && <DocsView />}

      <p className="footer-note">
        Synthetic data and illustrative parameters only — not real airline fares or schedules. See{" "}
        <code>docs/</code> in the repository for full methodology.
      </p>
    </div>
  );
}
