import type { DemandSegmentParams, FlightContext, SeasonalityParams } from "./types.js";
import { clamp } from "./stats.js";

/** Market demand relative to capacity assumed at the reference fare, before segment mix or price effects. 1.15 means the underlying market could fill ~115% of the plane at reference fare — the classic RM setup where some demand must be spilled or up-sold, which is what makes dynamic pricing valuable. */
export const MARKET_DEMAND_TO_CAPACITY_RATIO = 1.15;

/** Seasonality multiplier for a given flight (month x day-of-week). */
export function seasonalityMultiplier(flight: FlightContext, seasonality: SeasonalityParams): number {
  const monthMult = seasonality.monthlyMultipliers[clamp(flight.departureMonth - 1, 0, 11)] ?? 1;
  const dowMult = seasonality.dayOfWeekMultipliers[clamp(flight.departureDayOfWeek, 0, 6)] ?? 1;
  return monthMult * dowMult;
}

/** Total expected seat demand for a segment across the whole booking horizon, before any price response — i.e. how many customers in this segment would show up if the fare were free-of-elasticity-effects at the reference fare. */
export function segmentTotalDemandMean(
  segment: DemandSegmentParams,
  flight: FlightContext,
  seasonality: SeasonalityParams,
): number {
  const marketDemand = flight.capacity * MARKET_DEMAND_TO_CAPACITY_RATIO;
  return marketDemand * seasonalityMultiplier(flight, seasonality) * segment.demandShare;
}

/**
 * Survival function: expected number of customers in this segment willing
 * to pay `price` or more, out of the segment's total demand mean.
 *
 * Exponential (constant semi-elasticity) price-response curve, the
 * standard functional form used in RM demand modeling (Talluri & van Ryzin,
 * ch. 7): S(p) = mean * exp(-elasticity * (p - refFare) / refFare).
 * Clamped to [0, saturationCap * mean] so demand neither explodes as
 * price -> 0 nor goes negative at very high price.
 */
export function segmentSurvival(
  segment: DemandSegmentParams,
  segmentTotalMean: number,
  baseFare: number,
  price: number,
): number {
  const refFare = baseFare * segment.referenceFareMultiplier;
  if (refFare <= 0) return 0;
  const relDelta = (price - refFare) / refFare;
  const raw = segmentTotalMean * Math.exp(-segment.priceElasticity * relDelta);
  const saturationCap = segmentTotalMean * 2.5;
  return clamp(raw, 0, saturationCap);
}
