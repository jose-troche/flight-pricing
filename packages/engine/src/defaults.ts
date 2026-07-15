import type { PricingParameters } from "./types.js";

/**
 * Sensible, industry-plausible defaults for a single-cabin, domestic
 * narrow-body route (e.g. a transcontinental A320/737 flight). Every value
 * here is user-adjustable from the UI; these defaults exist so the model
 * produces a credible price curve with zero configuration.
 *
 * Elasticity, booking-curve, and EMSR parameter ranges are informed by the
 * airline RM literature (Belobaba, Talluri & van Ryzin, Smith/Leimkuhler/
 * Darrow "American Airlines" EMSR case study) — see docs/technical-methodology.md.
 */
export const DEFAULT_PARAMETERS: PricingParameters = {
  flight: {
    capacity: 180,
    distanceMiles: 2200,
    baseFare: 320,
    departureMonth: 7,
    departureDayOfWeek: 4, // Friday
  },
  segments: [
    {
      name: "Leisure",
      demandShare: 0.65,
      priceElasticity: 3.2,
      referenceFareMultiplier: 0.85,
      demandCv: 0.35,
      bookingCurve: { peakDaysToDeparture: 55, spreadDays: 35 },
    },
    {
      name: "Business",
      demandShare: 0.35,
      priceElasticity: 0.7,
      referenceFareMultiplier: 1.7,
      demandCv: 0.45,
      bookingCurve: { peakDaysToDeparture: 6, spreadDays: 6 },
    },
  ],
  seasonality: {
    monthlyMultipliers: [0.88, 0.86, 0.95, 1.0, 1.05, 1.18, 1.25, 1.22, 1.02, 0.92, 0.9, 1.1],
    dayOfWeekMultipliers: [1.05, 0.92, 0.9, 0.95, 1.1, 1.15, 1.05],
  },
  competitive: {
    competitorPriceIndex: 1.0,
    competitiveSensitivity: 0.35,
  },
  cost: {
    variableCostPerSeat: 95,
    fixedCostPerSeat: 60,
    fuelSurchargePerSeat: 12,
  },
  guardrails: {
    minFareToCostRatio: 1.05,
    maxFareMultiplier: 3.5,
    maxStepChangeFraction: 0.15,
  },
  engine: {
    virtualBucketCount: 26,
    bookingHorizonDays: 330,
    reoptimizationCheckpoints: 66,
    overbookingFactor: 1.04,
    expectedNoShowRate: 0.03,
  },
};

/** Deep-clones the defaults so callers can mutate freely without shared-state bugs. */
export function getDefaultParameters(): PricingParameters {
  return structuredClone(DEFAULT_PARAMETERS);
}

export const PARAMETER_BOUNDS = {
  flight: {
    capacity: { min: 30, max: 500 },
    distanceMiles: { min: 100, max: 8000 },
    baseFare: { min: 30, max: 5000 },
  },
  segments: {
    demandShare: { min: 0, max: 1 },
    priceElasticity: { min: 0.05, max: 8 },
    referenceFareMultiplier: { min: 0.3, max: 4 },
    demandCv: { min: 0.05, max: 1.2 },
    peakDaysToDeparture: { min: 0, max: 330 },
    spreadDays: { min: 1, max: 150 },
  },
  competitive: {
    competitorPriceIndex: { min: 0.3, max: 3 },
    competitiveSensitivity: { min: 0, max: 1 },
  },
  cost: {
    variableCostPerSeat: { min: 1, max: 3000 },
    fixedCostPerSeat: { min: 0, max: 3000 },
    fuelSurchargePerSeat: { min: 0, max: 500 },
  },
  guardrails: {
    minFareToCostRatio: { min: 1.0, max: 3 },
    maxFareMultiplier: { min: 1.1, max: 10 },
    maxStepChangeFraction: { min: 0.01, max: 1 },
  },
  engine: {
    virtualBucketCount: { min: 6, max: 60 },
    bookingHorizonDays: { min: 14, max: 365 },
    reoptimizationCheckpoints: { min: 4, max: 200 },
    overbookingFactor: { min: 1.0, max: 1.25 },
    expectedNoShowRate: { min: 0, max: 0.3 },
  },
} as const;
