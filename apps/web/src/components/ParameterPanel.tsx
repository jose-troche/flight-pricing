import { PARAMETER_BOUNDS, ROUTE_ARCHETYPES, deepMerge, getDefaultParameters, type PricingParameters } from "@flight-pricing/engine";
import { SliderField, SelectField, money, pct } from "./fields";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ParameterPanel(props: {
  parameters: PricingParameters;
  onChange: (p: PricingParameters) => void;
}) {
  const { parameters: p, onChange } = props;
  const b = PARAMETER_BOUNDS;

  const set = (mutator: (draft: PricingParameters) => void) => {
    const draft = structuredClone(p);
    mutator(draft);
    onChange(draft);
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Scenario preset</div>
        <SelectField
          label="Route archetype"
          value="custom"
          options={[
            { value: "custom", label: "Custom (current settings)" },
            ...ROUTE_ARCHETYPES.map((r) => ({ value: r.code, label: `${r.code} — ${r.description}` })),
          ]}
          onChange={(code) => {
            const archetype = ROUTE_ARCHETYPES.find((r) => r.code === code);
            if (!archetype) return;
            onChange(deepMerge(getDefaultParameters(), archetype.overrides));
          }}
          desc="Loads a representative synthetic route's parameters. Every field below stays editable afterward."
        />
        <button className="button secondary" style={{ marginTop: 4 }} onClick={() => onChange(getDefaultParameters())}>
          Reset to defaults
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">Flight &amp; route</div>
        <SliderField
          label="Capacity (seats)"
          value={p.flight.capacity}
          min={b.flight.capacity.min}
          max={b.flight.capacity.max}
          step={1}
          onChange={(v) => set((d) => (d.flight.capacity = v))}
        />
        <SliderField
          label="Base (reference) fare"
          value={p.flight.baseFare}
          min={b.flight.baseFare.min}
          max={1200}
          step={5}
          format={money}
          onChange={(v) => set((d) => (d.flight.baseFare = v))}
          desc="Unrestricted economy fare that all segment/guardrail multipliers apply against."
        />
        <SliderField
          label="Distance (miles)"
          value={p.flight.distanceMiles}
          min={b.flight.distanceMiles.min}
          max={b.flight.distanceMiles.max}
          step={10}
          onChange={(v) => set((d) => (d.flight.distanceMiles = v))}
          desc="Informational only — used for cost-per-mile display."
        />
        <SelectField
          label="Departure month"
          value={p.flight.departureMonth}
          options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
          onChange={(v) => set((d) => (d.flight.departureMonth = Number(v)))}
        />
        <SelectField
          label="Departure day of week"
          value={p.flight.departureDayOfWeek}
          options={DOW.map((m, i) => ({ value: i, label: m }))}
          onChange={(v) => set((d) => (d.flight.departureDayOfWeek = Number(v)))}
        />
      </div>

      {p.segments.map((seg, i) => (
        <div className="panel" key={seg.name}>
          <div className="panel-title">Demand segment — {seg.name}</div>
          <SliderField
            label="Demand share"
            value={seg.demandShare}
            min={0}
            max={1}
            step={0.01}
            format={pct}
            onChange={(v) =>
              set((d) => {
                const other = 1 - v;
                d.segments[i]!.demandShare = v;
                const otherIdx = i === 0 ? 1 : 0;
                if (d.segments[otherIdx]) d.segments[otherIdx]!.demandShare = other;
              })
            }
            desc="Shares across all segments are renormalized to sum to 1."
          />
          <SliderField
            label="Price elasticity"
            value={seg.priceElasticity}
            min={b.segments.priceElasticity.min}
            max={6}
            step={0.05}
            onChange={(v) => set((d) => (d.segments[i]!.priceElasticity = v))}
            desc="Higher = more price-sensitive (demand falls off faster above reference fare)."
          />
          <SliderField
            label="Reference fare multiplier"
            value={seg.referenceFareMultiplier}
            min={b.segments.referenceFareMultiplier.min}
            max={3}
            step={0.05}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => set((d) => (d.segments[i]!.referenceFareMultiplier = v))}
            desc="This segment's typical willingness-to-pay, as a multiple of the base fare."
          />
          <SliderField
            label="Demand volatility (CV)"
            value={seg.demandCv}
            min={b.segments.demandCv.min}
            max={b.segments.demandCv.max}
            step={0.01}
            format={pct}
            onChange={(v) => set((d) => (d.segments[i]!.demandCv = v))}
            desc="Coefficient of variation of demand volume — forecast uncertainty feeding EMSRb."
          />
          <SliderField
            label="Booking curve peak (days to departure)"
            value={seg.bookingCurve.peakDaysToDeparture}
            min={0}
            max={120}
            step={1}
            onChange={(v) => set((d) => (d.segments[i]!.bookingCurve.peakDaysToDeparture = v))}
            desc="When this segment typically books. Business books late, leisure books early."
          />
          <SliderField
            label="Booking curve spread"
            value={seg.bookingCurve.spreadDays}
            min={b.segments.spreadDays.min}
            max={90}
            step={1}
            onChange={(v) => set((d) => (d.segments[i]!.bookingCurve.spreadDays = v))}
          />
        </div>
      ))}

      <div className="panel">
        <div className="panel-title">Competitive &amp; cost</div>
        <SliderField
          label="Competitor price index"
          value={p.competitive.competitorPriceIndex}
          min={b.competitive.competitorPriceIndex.min}
          max={2}
          step={0.01}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => set((d) => (d.competitive.competitorPriceIndex = v))}
          desc="1.0 = market parity. Above 1 = competitors pricier (room to push up)."
        />
        <SliderField
          label="Competitive sensitivity"
          value={p.competitive.competitiveSensitivity}
          min={0}
          max={1}
          step={0.01}
          format={pct}
          onChange={(v) => set((d) => (d.competitive.competitiveSensitivity = v))}
          desc="How strongly the quoted price reacts to the competitive index."
        />
        <SliderField
          label="Variable cost / seat"
          value={p.cost.variableCostPerSeat}
          min={b.cost.variableCostPerSeat.min}
          max={400}
          step={1}
          format={money}
          onChange={(v) => set((d) => (d.cost.variableCostPerSeat = v))}
          desc="Fuel, crew, distribution, catering. The hard price floor is derived from this."
        />
        <SliderField
          label="Fuel surcharge / seat"
          value={p.cost.fuelSurchargePerSeat}
          min={b.cost.fuelSurchargePerSeat.min}
          max={150}
          step={1}
          format={money}
          onChange={(v) => set((d) => (d.cost.fuelSurchargePerSeat = v))}
        />
      </div>

      <div className="panel">
        <div className="panel-title">Guardrails</div>
        <SliderField
          label="Min fare / cost ratio"
          value={p.guardrails.minFareToCostRatio}
          min={b.guardrails.minFareToCostRatio.min}
          max={2}
          step={0.01}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => set((d) => (d.guardrails.minFareToCostRatio = v))}
          desc="Fare floor guarantees non-negative contribution margin per seat."
        />
        <SliderField
          label="Max fare multiplier"
          value={p.guardrails.maxFareMultiplier}
          min={1.2}
          max={b.guardrails.maxFareMultiplier.max}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onChange={(v) => set((d) => (d.guardrails.maxFareMultiplier = v))}
          desc="Brand/regulatory 'fare fence' — highest allowed multiple of base fare."
        />
        <SliderField
          label="Max step change per checkpoint"
          value={p.guardrails.maxStepChangeFraction}
          min={b.guardrails.maxStepChangeFraction.min}
          max={0.6}
          step={0.01}
          format={pct}
          onChange={(v) => set((d) => (d.guardrails.maxStepChangeFraction = v))}
          desc="Anti-sticker-shock control: caps how much price can move between re-optimizations."
        />
      </div>

      <details className="panel">
        <summary className="panel-title" style={{ cursor: "pointer", listStyle: "none" }}>
          Engine settings (advanced)
        </summary>
        <div style={{ marginTop: 10 }}>
          <SliderField
            label="Virtual fare buckets"
            value={p.engine.virtualBucketCount}
            min={b.engine.virtualBucketCount.min}
            max={b.engine.virtualBucketCount.max}
            step={1}
            onChange={(v) => set((d) => (d.engine.virtualBucketCount = Math.round(v)))}
            desc="More buckets = smoother continuous-pricing approximation of EMSRb."
          />
          <SliderField
            label="Booking horizon (days)"
            value={p.engine.bookingHorizonDays}
            min={b.engine.bookingHorizonDays.min}
            max={b.engine.bookingHorizonDays.max}
            step={1}
            onChange={(v) => set((d) => (d.engine.bookingHorizonDays = Math.round(v)))}
          />
          <SliderField
            label="Re-optimization checkpoints"
            value={p.engine.reoptimizationCheckpoints}
            min={b.engine.reoptimizationCheckpoints.min}
            max={120}
            step={1}
            onChange={(v) => set((d) => (d.engine.reoptimizationCheckpoints = Math.round(v)))}
            desc="How often (data-collection points) the engine re-runs EMSRb as bookings accrue."
          />
          <SliderField
            label="Overbooking factor"
            value={p.engine.overbookingFactor}
            min={b.engine.overbookingFactor.min}
            max={b.engine.overbookingFactor.max}
            step={0.01}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => set((d) => (d.engine.overbookingFactor = v))}
          />
          <SliderField
            label="Expected no-show rate"
            value={p.engine.expectedNoShowRate}
            min={b.engine.expectedNoShowRate.min}
            max={b.engine.expectedNoShowRate.max}
            step={0.01}
            format={pct}
            onChange={(v) => set((d) => (d.engine.expectedNoShowRate = v))}
          />
        </div>
      </details>

      <details className="panel">
        <summary className="panel-title" style={{ cursor: "pointer", listStyle: "none" }}>
          Seasonality (advanced)
        </summary>
        <div style={{ marginTop: 10 }}>
          <div className="field-desc" style={{ marginBottom: 8 }}>
            Monthly demand multipliers (1.0 = neutral)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {MONTHS.map((m, i) => (
              <label key={m} style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {m}
                <input
                  type="number"
                  step={0.05}
                  value={p.seasonality.monthlyMultipliers[i]}
                  onChange={(e) =>
                    set((d) => {
                      d.seasonality.monthlyMultipliers[i] = Number(e.target.value);
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="field-desc" style={{ margin: "12px 0 8px" }}>
            Day-of-week demand multipliers
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {DOW.map((m, i) => (
              <label key={m} style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {m}
                <input
                  type="number"
                  step={0.05}
                  value={p.seasonality.dayOfWeekMultipliers[i]}
                  onChange={(e) =>
                    set((d) => {
                      d.seasonality.dayOfWeekMultipliers[i] = Number(e.target.value);
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
