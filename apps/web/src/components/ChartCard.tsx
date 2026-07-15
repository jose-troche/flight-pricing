import type { ReactNode } from "react";

export function ChartCard(props: { title: string; desc?: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-title">{props.title}</h3>
      </div>
      {props.desc ? <p className="chart-desc">{props.desc}</p> : null}
      {props.legend ? <div className="legend-row">{props.legend}</div> : null}
      {props.children}
    </div>
  );
}

export function LegendItem(props: { color: string; label: string }) {
  return (
    <span>
      <span className="legend-swatch" style={{ background: props.color }} />
      {props.label}
    </span>
  );
}

export const tooltipContentStyle: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12.5,
  color: "var(--text-primary)",
  padding: "8px 10px",
};

export const tooltipLabelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontWeight: 600,
  marginBottom: 4,
};
