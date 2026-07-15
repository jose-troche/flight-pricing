export function StatRow(props: { children: React.ReactNode }) {
  return <div className="stat-row">{props.children}</div>;
}

export function StatTile(props: {
  label: string;
  value: string;
  delta?: { text: string; good: boolean };
}) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{props.label}</div>
      <div className="stat-value">{props.value}</div>
      {props.delta ? (
        <div className={`stat-delta ${props.delta.good ? "good" : "bad"}`}>{props.delta.text}</div>
      ) : null}
    </div>
  );
}
