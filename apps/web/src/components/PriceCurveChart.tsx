import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PriceCurveResult } from "@flight-pricing/engine";
import { ChartCard, LegendItem, tooltipContentStyle, tooltipLabelStyle } from "./ChartCard";

export function PriceCurveChart(props: { result: PriceCurveResult }) {
  const { result } = props;
  const data = result.points.map((pt) => ({
    daysToDeparture: pt.daysToDeparture,
    price: Math.round(pt.price * 100) / 100,
    bidPrice: Math.round(pt.bidPrice * 100) / 100,
  }));

  return (
    <ChartCard
      title="Quoted price vs. days to departure"
      desc="The EMSRb-derived bid price (underlying revenue-management signal) and the final quoted price after the competitive overlay and guardrails, re-optimized at each checkpoint as bookings accrue."
      legend={
        <>
          <LegendItem color="var(--series-1)" label="Quoted price" />
          <LegendItem color="var(--series-7)" label="EMSRb bid price" />
        </>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
            tickFormatter={(v) => `$${v}`}
            width={56}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(value: number, name: string) => [`$${value.toFixed(0)}`, name]}
            labelFormatter={(v) => `${v} days to departure`}
          />
          <Line
            type="monotone"
            dataKey="price"
            name="Quoted price"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: "var(--surface-1)", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="bidPrice"
            name="EMSRb bid price"
            stroke="var(--series-7)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 5, stroke: "var(--surface-1)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
