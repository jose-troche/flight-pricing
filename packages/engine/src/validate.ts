import type { PricingParameters } from "./types.js";
import { PARAMETER_BOUNDS } from "./defaults.js";
import { clamp } from "./stats.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Clamps every user-suppliable numeric field into a safe operating range
 * and returns both the sanitized parameters and a list of what was
 * adjusted. The engine must never crash or produce nonsensical output
 * (negative prices, NaN, capacity overflow) regardless of what the UI
 * sends — this is the single choke point that guarantees that.
 */
export function sanitizeParameters(input: PricingParameters): {
  parameters: PricingParameters;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const p = structuredClone(input);
  const b = PARAMETER_BOUNDS;

  const fix = (path: string, current: number, min: number, max: number): number => {
    if (!Number.isFinite(current)) {
      issues.push({ path, message: `non-finite value replaced with midpoint` });
      return (min + max) / 2;
    }
    const clamped = clamp(current, min, max);
    if (clamped !== current) {
      issues.push({ path, message: `clamped ${current} to [${min}, ${max}]` });
    }
    return clamped;
  };

  p.flight.capacity = Math.round(fix("flight.capacity", p.flight.capacity, b.flight.capacity.min, b.flight.capacity.max));
  p.flight.distanceMiles = fix("flight.distanceMiles", p.flight.distanceMiles, b.flight.distanceMiles.min, b.flight.distanceMiles.max);
  p.flight.baseFare = fix("flight.baseFare", p.flight.baseFare, b.flight.baseFare.min, b.flight.baseFare.max);
  p.flight.departureMonth = Math.round(clamp(p.flight.departureMonth, 1, 12));
  p.flight.departureDayOfWeek = Math.round(clamp(p.flight.departureDayOfWeek, 0, 6));

  if (!p.segments || p.segments.length === 0) {
    issues.push({ path: "segments", message: "no segments supplied; this will produce zero demand" });
    p.segments = [];
  }

  p.segments.forEach((seg, i) => {
    seg.demandShare = fix(`segments[${i}].demandShare`, seg.demandShare, b.segments.demandShare.min, b.segments.demandShare.max);
    seg.priceElasticity = fix(`segments[${i}].priceElasticity`, seg.priceElasticity, b.segments.priceElasticity.min, b.segments.priceElasticity.max);
    seg.referenceFareMultiplier = fix(`segments[${i}].referenceFareMultiplier`, seg.referenceFareMultiplier, b.segments.referenceFareMultiplier.min, b.segments.referenceFareMultiplier.max);
    seg.demandCv = fix(`segments[${i}].demandCv`, seg.demandCv, b.segments.demandCv.min, b.segments.demandCv.max);
    seg.bookingCurve.peakDaysToDeparture = fix(
      `segments[${i}].bookingCurve.peakDaysToDeparture`,
      seg.bookingCurve.peakDaysToDeparture,
      b.segments.peakDaysToDeparture.min,
      b.segments.peakDaysToDeparture.max,
    );
    seg.bookingCurve.spreadDays = fix(
      `segments[${i}].bookingCurve.spreadDays`,
      seg.bookingCurve.spreadDays,
      b.segments.spreadDays.min,
      b.segments.spreadDays.max,
    );
  });

  const shareSum = p.segments.reduce((s, seg) => s + seg.demandShare, 0);
  if (shareSum > 0 && Math.abs(shareSum - 1) > 1e-6) {
    issues.push({ path: "segments[].demandShare", message: `shares summed to ${shareSum.toFixed(3)}; renormalized to 1.0` });
    p.segments.forEach((seg) => (seg.demandShare = seg.demandShare / shareSum));
  }

  if (!p.seasonality.monthlyMultipliers || p.seasonality.monthlyMultipliers.length !== 12) {
    issues.push({ path: "seasonality.monthlyMultipliers", message: "expected 12 values; reset to neutral" });
    p.seasonality.monthlyMultipliers = new Array(12).fill(1);
  }
  if (!p.seasonality.dayOfWeekMultipliers || p.seasonality.dayOfWeekMultipliers.length !== 7) {
    issues.push({ path: "seasonality.dayOfWeekMultipliers", message: "expected 7 values; reset to neutral" });
    p.seasonality.dayOfWeekMultipliers = new Array(7).fill(1);
  }
  p.seasonality.monthlyMultipliers = p.seasonality.monthlyMultipliers.map((v) => clamp(Number.isFinite(v) ? v : 1, 0.3, 3));
  p.seasonality.dayOfWeekMultipliers = p.seasonality.dayOfWeekMultipliers.map((v) => clamp(Number.isFinite(v) ? v : 1, 0.3, 3));

  p.competitive.competitorPriceIndex = fix("competitive.competitorPriceIndex", p.competitive.competitorPriceIndex, b.competitive.competitorPriceIndex.min, b.competitive.competitorPriceIndex.max);
  p.competitive.competitiveSensitivity = fix("competitive.competitiveSensitivity", p.competitive.competitiveSensitivity, b.competitive.competitiveSensitivity.min, b.competitive.competitiveSensitivity.max);

  p.cost.variableCostPerSeat = fix("cost.variableCostPerSeat", p.cost.variableCostPerSeat, b.cost.variableCostPerSeat.min, b.cost.variableCostPerSeat.max);
  p.cost.fixedCostPerSeat = fix("cost.fixedCostPerSeat", p.cost.fixedCostPerSeat, b.cost.fixedCostPerSeat.min, b.cost.fixedCostPerSeat.max);
  p.cost.fuelSurchargePerSeat = fix("cost.fuelSurchargePerSeat", p.cost.fuelSurchargePerSeat, b.cost.fuelSurchargePerSeat.min, b.cost.fuelSurchargePerSeat.max);

  p.guardrails.minFareToCostRatio = fix("guardrails.minFareToCostRatio", p.guardrails.minFareToCostRatio, b.guardrails.minFareToCostRatio.min, b.guardrails.minFareToCostRatio.max);
  p.guardrails.maxFareMultiplier = fix("guardrails.maxFareMultiplier", p.guardrails.maxFareMultiplier, b.guardrails.maxFareMultiplier.min, b.guardrails.maxFareMultiplier.max);
  p.guardrails.maxStepChangeFraction = fix("guardrails.maxStepChangeFraction", p.guardrails.maxStepChangeFraction, b.guardrails.maxStepChangeFraction.min, b.guardrails.maxStepChangeFraction.max);

  p.engine.virtualBucketCount = Math.round(fix("engine.virtualBucketCount", p.engine.virtualBucketCount, b.engine.virtualBucketCount.min, b.engine.virtualBucketCount.max));
  p.engine.bookingHorizonDays = Math.round(fix("engine.bookingHorizonDays", p.engine.bookingHorizonDays, b.engine.bookingHorizonDays.min, b.engine.bookingHorizonDays.max));
  p.engine.reoptimizationCheckpoints = Math.round(fix("engine.reoptimizationCheckpoints", p.engine.reoptimizationCheckpoints, b.engine.reoptimizationCheckpoints.min, b.engine.reoptimizationCheckpoints.max));
  p.engine.overbookingFactor = fix("engine.overbookingFactor", p.engine.overbookingFactor, b.engine.overbookingFactor.min, b.engine.overbookingFactor.max);
  p.engine.expectedNoShowRate = fix("engine.expectedNoShowRate", p.engine.expectedNoShowRate, b.engine.expectedNoShowRate.min, b.engine.expectedNoShowRate.max);

  if (p.guardrails.minFareToCostRatio * p.cost.variableCostPerSeat > p.flight.baseFare * p.guardrails.maxFareMultiplier) {
    issues.push({ path: "guardrails", message: "min fare floor exceeded max fare ceiling; widened ceiling" });
    p.guardrails.maxFareMultiplier = (p.guardrails.minFareToCostRatio * p.cost.variableCostPerSeat * 1.5) / p.flight.baseFare;
  }

  return { parameters: p, issues };
}
