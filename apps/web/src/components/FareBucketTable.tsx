import type { PriceCurveResult } from "@flight-pricing/engine";
import { ChartCard } from "./ChartCard";

export function FareBucketTable(props: { result: PriceCurveResult }) {
  const { result } = props;
  const buckets = [...result.fareBuckets].sort((a, b) => b.fare - a.fare);
  const totalMean = buckets.reduce((s, b) => s + b.demandMean, 0);

  return (
    <ChartCard
      title="Virtual fare bucket ladder"
      desc="Continuous pricing is approximated as many virtual fare buckets spanning the willingness-to-pay curve; EMSRb runs across this ladder at every re-optimization checkpoint. Demand mean/std are full-horizon forecasts (before booking-curve thinning)."
    >
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bucket</th>
              <th>Fare</th>
              <th>Demand mean</th>
              <th>Demand std</th>
              <th>Share of demand</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.index}>
                <td>#{bucket.index + 1}</td>
                <td>${bucket.fare.toFixed(0)}</td>
                <td>{bucket.demandMean.toFixed(1)}</td>
                <td>{bucket.demandStd.toFixed(1)}</td>
                <td>{totalMean > 0 ? `${((bucket.demandMean / totalMean) * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
