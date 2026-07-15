import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, tooltipContentStyle, tooltipLabelStyle } from "./ChartCard";
import { StatRow, StatTile } from "./StatTile";

interface SyntheticFlightRecord {
  route: string;
  routeDescription: string;
  departureMonth: number;
  departureDayOfWeek: number;
  dynamicRevenue: number;
  staticRevenue: number;
  revenueUpliftPct: number;
  dynamicLoadFactor: number;
  staticLoadFactor: number;
  flatPrice: number;
}

interface ValidationDataset {
  generatedAt: string;
  flightsPerRoute: number;
  trialsPerFlight: number;
  records: SyntheticFlightRecord[];
  summary: {
    totalFlights: number;
    meanRevenueUpliftPct: number;
    medianRevenueUpliftPct: number;
    meanDynamicLoadFactor: number;
    meanStaticLoadFactor: number;
    upliftByRoute: { route: string; meanUpliftPct: number }[];
  };
}

export function ValidationView() {
  const [data, setData] = useState<ValidationDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/validation-dataset.json")
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "failed to load"));
  }, []);

  if (error) {
    return <div className="panel">Could not load the synthetic validation dataset ({error}).</div>;
  }
  if (!data) {
    return <div className="panel">Loading synthetic validation dataset…</div>;
  }

  const { summary } = data;

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Synthetic validation exhibit</div>
        <p className="prose" style={{ margin: 0 }}>
          {data.summary.totalFlights} synthetic flight-dates across {data.summary.upliftByRoute.length} representative
          route archetypes (short-haul leisure through long-haul international), each run through a{" "}
          {data.trialsPerFlight}-trial Monte Carlo comparison of the dynamic EMSRb policy against a single flat fare.
          This is the reproducible evidence exhibit for revenue-management review — regenerate it any time with{" "}
          <code>pnpm generate:synthetic-data</code> (fixed seed, deterministic).
        </p>
      </div>

      <StatRow>
        <StatTile
          label="Mean revenue uplift"
          value={`+${summary.meanRevenueUpliftPct.toFixed(1)}%`}
          delta={{ text: "vs. single flat fare", good: true }}
        />
        <StatTile label="Median revenue uplift" value={`+${summary.medianRevenueUpliftPct.toFixed(1)}%`} />
        <StatTile label="Mean dynamic load factor" value={`${(summary.meanDynamicLoadFactor * 100).toFixed(1)}%`} />
        <StatTile label="Mean static load factor" value={`${(summary.meanStaticLoadFactor * 100).toFixed(1)}%`} />
      </StatRow>

      <ChartCard
        title="Mean revenue uplift by route archetype"
        desc="Percent revenue gain of the dynamic policy over a revenue-equivalent single flat fare, averaged across each route's synthetic flight-dates."
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={summary.upliftByRoute} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--gridline)" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="route" stroke="var(--baseline)" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
            <YAxis
              stroke="var(--baseline)"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              width={44}
            />
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Mean uplift"]}
            />
            <Bar dataKey="meanUpliftPct" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Sample flight-date records"
        desc="First 20 of the synthetic dataset — full data at /data/validation-dataset.json."
      >
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Month</th>
                <th>Dynamic revenue</th>
                <th>Static revenue</th>
                <th>Uplift</th>
                <th>Dynamic LF</th>
                <th>Static LF</th>
              </tr>
            </thead>
            <tbody>
              {data.records.slice(0, 20).map((r, i) => (
                <tr key={i}>
                  <td>{r.route}</td>
                  <td>{r.departureMonth}</td>
                  <td>${r.dynamicRevenue.toFixed(0)}</td>
                  <td>${r.staticRevenue.toFixed(0)}</td>
                  <td>{r.revenueUpliftPct >= 0 ? "+" : ""}{r.revenueUpliftPct.toFixed(1)}%</td>
                  <td>{(r.dynamicLoadFactor * 100).toFixed(0)}%</td>
                  <td>{(r.staticLoadFactor * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
