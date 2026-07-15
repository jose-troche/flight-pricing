import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { runSimulation, type PricingParameters, type SimulationSummary } from "@flight-pricing/engine";
import { ChartCard, tooltipContentStyle, tooltipLabelStyle } from "./ChartCard";
import { StatRow, StatTile } from "./StatTile";
import { SliderField } from "./fields";
import { fetchSimulateFromServer } from "../lib/api";

function fmtMoney(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;
}

export function SimulationPanel(props: { parameters: PricingParameters }) {
  const { parameters } = props;
  const [trials, setTrials] = useState(200);
  const [seed, setSeed] = useState(42);
  const [serverResult, setServerResult] = useState<SimulationSummary | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { summary, elapsedMs } = useMemo(() => {
    const t0 = performance.now();
    const result = runSimulation(parameters, { trials, seed });
    return { summary: result, elapsedMs: performance.now() - t0 };
  }, [parameters, trials, seed]);

  const barData = [
    { name: "P10", dynamic: summary.dynamic.p10Revenue, static: summary.staticBaseline.p10Revenue },
    { name: "P50 (median)", dynamic: summary.dynamic.p50Revenue, static: summary.staticBaseline.p50Revenue },
    { name: "P90", dynamic: summary.dynamic.p90Revenue, static: summary.staticBaseline.p90Revenue },
  ];

  const upliftGood = summary.revenueUpliftPct >= 0;

  const runOnServer = async () => {
    setServerLoading(true);
    setServerError(null);
    try {
      const res = await fetchSimulateFromServer(parameters, Math.min(trials, 300), seed);
      setServerResult(res.summary);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setServerLoading(false);
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Monte Carlo settings</div>
        <SliderField
          label="Trials"
          value={trials}
          min={20}
          max={1000}
          step={10}
          onChange={setTrials}
          desc="Runs entirely in your browser via the same engine package the Worker uses — no server round-trip, no CPU-time limit."
        />
        <SliderField label="Random seed" value={seed} min={1} max={9999} step={1} onChange={setSeed} />
        <div className="field-desc">Computed {trials} × 2 trials in {elapsedMs.toFixed(1)}ms (client-side).</div>
        <button className="button secondary" style={{ marginTop: 10 }} onClick={runOnServer} disabled={serverLoading}>
          {serverLoading ? "Calling Worker API…" : "Cross-check via Worker API"}
        </button>
        {serverResult ? (
          <div className="field-desc" style={{ marginTop: 8 }}>
            Server (capped at 300 trials) dynamic mean revenue: <strong>${serverResult.dynamic.meanRevenue.toFixed(0)}</strong>{" "}
            — client estimate ${summary.dynamic.meanRevenue.toFixed(0)}. Both call the identical{" "}
            <code>@flight-pricing/engine</code> module, so results converge as trials increase.
          </div>
        ) : null}
        {serverError ? <div className="issue-list">{serverError}</div> : null}
      </div>

      <StatRow>
        <StatTile
          label="Revenue uplift vs. flat fare"
          value={`${summary.revenueUpliftPct >= 0 ? "+" : ""}${summary.revenueUpliftPct.toFixed(1)}%`}
          delta={{ text: upliftGood ? "Dynamic pricing ahead" : "Flat fare ahead", good: upliftGood }}
        />
        <StatTile label="Dynamic mean revenue" value={fmtMoney(summary.dynamic.meanRevenue)} />
        <StatTile label="Static baseline mean revenue" value={fmtMoney(summary.staticBaseline.meanRevenue)} />
        <StatTile label="Dynamic mean load factor" value={`${(summary.dynamic.meanLoadFactor * 100).toFixed(1)}%`} />
      </StatRow>

      <ChartCard
        title="Revenue distribution: dynamic policy vs. flat-fare baseline"
        desc={`${trials} stochastic demand draws each, capacity-capped per trial. P10/P50/P90 = 10th/50th/90th percentile realized revenue.`}
        legend={
          <>
            <span>
              <span className="legend-swatch" style={{ background: "var(--series-1)" }} />
              Dynamic (EMSRb) policy
            </span>
            <span>
              <span className="legend-swatch" style={{ background: "var(--series-6)" }} />
              Static flat-fare baseline (${summary.staticBaseline.flatPrice.toFixed(0)})
            </span>
          </>
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={4}>
            <CartesianGrid stroke="var(--gridline)" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="name" stroke="var(--baseline)" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <YAxis
              stroke="var(--baseline)"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={(v) => fmtMoney(v)}
              width={56}
            />
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              formatter={(value: number) => `$${value.toFixed(0)}`}
            />
            <Legend wrapperStyle={{ display: "none" }} />
            <Bar dataKey="dynamic" name="Dynamic" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="static" name="Static" fill="var(--series-6)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
