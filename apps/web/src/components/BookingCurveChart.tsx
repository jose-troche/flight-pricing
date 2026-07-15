import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PriceCurveResult } from "@flight-pricing/engine";
import { ChartCard, tooltipContentStyle, tooltipLabelStyle } from "./ChartCard";

export function BookingCurveChart(props: { result: PriceCurveResult; capacity: number }) {
  const { result, capacity } = props;
  const data = result.points.map((pt) => ({
    daysToDeparture: pt.daysToDeparture,
    loadFactor: Math.round(pt.loadFactor * 1000) / 10,
    bookings: Math.round(pt.expectedCumulativeBookings),
    remaining: Math.round(pt.remainingCapacity),
  }));

  return (
    <ChartCard
      title="Expected load factor vs. days to departure"
      desc={`Cumulative expected bookings as a share of the ${capacity}-seat cabin, assuming demand materializes as forecast. Values above 100% reflect the overbooking authorization.`}
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="loadFactorFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--gridline)" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="daysToDeparture"
            type="number"
            reversed
            domain={["dataMin", "dataMax"]}
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            label={{ value: "Days to departure", position: "insideBottom", offset: -2, fill: "var(--text-muted)", fontSize: 11 }}
          />
          <YAxis
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
            width={48}
          />
          <ReferenceLine y={100} stroke="var(--baseline)" strokeWidth={1} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value: number, name: string, item: any) => {
              if (name === "Load factor") return [`${value.toFixed(1)}%`, name];
              return [value, name];
            }}
            labelFormatter={(v) => `${v} days to departure`}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const d = payload[0]!.payload as (typeof data)[number];
              return (
                <div style={tooltipContentStyle}>
                  <div style={tooltipLabelStyle}>{label} days to departure</div>
                  <div>Load factor: {d.loadFactor.toFixed(1)}%</div>
                  <div>Bookings: {d.bookings}</div>
                  <div>Remaining capacity: {d.remaining}</div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="loadFactor"
            name="Load factor"
            stroke="var(--series-1)"
            strokeWidth={2}
            fill="url(#loadFactorFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
