import type { ReactNode } from "react";

export function SliderField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  desc?: string;
}) {
  const { label, value, min, max, step, onChange, format, desc } = props;
  const display = format ? format(value) : value.toString();
  return (
    <div className="field-group">
      <div className="field-label">
        <span>{label}</span>
        <span className="field-value">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? (max - min) / 100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {desc ? <div className="field-desc">{desc}</div> : null}
    </div>
  );
}

export function SelectField(props: {
  label: string;
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (v: string) => void;
  desc?: string;
}) {
  const { label, value, options, onChange, desc } = props;
  return (
    <div className="field-group">
      <div className="field-label">
        <span>{label}</span>
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {desc ? <div className="field-desc">{desc}</div> : null}
    </div>
  );
}

export function Section(props: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="panel" open={props.defaultOpen ?? true}>
      <summary className="panel-title" style={{ cursor: "pointer", listStyle: "none" }}>
        {props.title}
      </summary>
      <div style={{ marginTop: 10 }}>{props.children}</div>
    </details>
  );
}

export const money = (v: number) => `$${v.toFixed(0)}`;
export const money2 = (v: number) => `$${v.toFixed(2)}`;
export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
export const pct1 = (v: number) => `${v.toFixed(1)}%`;
export const num = (v: number) => v.toFixed(0);
export const num2 = (v: number) => v.toFixed(2);
