import { describe, it, expect } from "vitest";
import { generatePriceCurve } from "../src/pricing-engine.js";
import { getDefaultParameters } from "../src/defaults.js";

describe("generatePriceCurve", () => {
  it("produces a point for every checkpoint, all within guardrail bounds", () => {
    const params = getDefaultParameters();
    const result = generatePriceCurve(params);
    expect(result.points.length).toBeGreaterThan(10);
    for (const point of result.points) {
      expect(point.price).toBeGreaterThanOrEqual(result.bucketFloor - 1e-6);
      expect(point.price).toBeLessThanOrEqual(result.bucketCeiling + 1e-6);
      expect(Number.isFinite(point.price)).toBe(true);
      expect(point.remainingCapacity).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it("is sorted by days-to-departure descending, ending at departure (0)", () => {
    const result = generatePriceCurve(getDefaultParameters());
    const dtds = result.points.map((p) => p.daysToDeparture);
    for (let i = 1; i < dtds.length; i++) {
      expect(dtds[i]!).toBeLessThanOrEqual(dtds[i - 1]!);
    }
    expect(dtds[dtds.length - 1]).toBe(0);
  });

  it("cumulative bookings are non-decreasing as departure approaches", () => {
    const result = generatePriceCurve(getDefaultParameters());
    for (let i = 1; i < result.points.length; i++) {
      expect(result.points[i]!.expectedCumulativeBookings).toBeGreaterThanOrEqual(
        result.points[i - 1]!.expectedCumulativeBookings - 1e-6,
      );
    }
  });

  it("higher market demand (via seasonality) raises the price curve", () => {
    const low = getDefaultParameters();
    low.seasonality.monthlyMultipliers = new Array(12).fill(0.7);
    const high = getDefaultParameters();
    high.seasonality.monthlyMultipliers = new Array(12).fill(1.4);

    const lowResult = generatePriceCurve(low);
    const highResult = generatePriceCurve(high);
    expect(highResult.expectedRevenuePerSeat).toBeGreaterThan(lowResult.expectedRevenuePerSeat);
  });

  it("raising the competitor price index raises the opening quoted price", () => {
    // The competitive overlay multiplies the EMSRb bid price directly, so the very first
    // checkpoint (unaffected by any prior booking feedback) must be strictly higher.
    // Aggregate revenue is deliberately NOT asserted monotonic here: pushing price above what
    // demand/elasticity supports can reduce bookings enough to lower total revenue, and a later
    // re-optimization checkpoint can then react by lowering price again as more capacity remains
    // unsold — both are intended, economically-sound emergent behaviors of the nested policy.
    const base = getDefaultParameters();
    const competitive = getDefaultParameters();
    competitive.competitive.competitorPriceIndex = 1.5;

    const baseResult = generatePriceCurve(base);
    const competitiveResult = generatePriceCurve(competitive);
    expect(competitiveResult.points[0]!.price).toBeGreaterThan(baseResult.points[0]!.price);
  });

  it("respects the cost-based price floor even with very low demand", () => {
    const params = getDefaultParameters();
    params.seasonality.monthlyMultipliers = new Array(12).fill(0.1);
    const result = generatePriceCurve(params);
    for (const point of result.points) {
      expect(point.price).toBeGreaterThanOrEqual(result.bucketFloor - 1e-6);
    }
  });

  it("does not sell more than capacity * overbookingFactor", () => {
    const params = getDefaultParameters();
    const result = generatePriceCurve(params);
    const finalBookings = result.points[result.points.length - 1]!.expectedCumulativeBookings;
    expect(finalBookings).toBeLessThanOrEqual(params.flight.capacity * params.engine.overbookingFactor + 1e-6);
  });

  it("is robust to pathological input (does not throw, returns finite numbers)", () => {
    const params = getDefaultParameters();
    // @ts-expect-error intentionally malformed for robustness testing
    params.flight.baseFare = -50;
    // @ts-expect-error
    params.segments[0].demandShare = 5;
    // @ts-expect-error
    params.segments[1].demandShare = -3;
    const result = generatePriceCurve(params);
    for (const point of result.points) {
      expect(Number.isFinite(point.price)).toBe(true);
      expect(Number.isFinite(point.remainingCapacity)).toBe(true);
    }
  });
});
