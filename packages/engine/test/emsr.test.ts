import { describe, it, expect } from "vitest";
import { computeEmsrB } from "../src/emsr.js";
import type { FareBucket } from "../src/types.js";

function bucket(index: number, fare: number, demandMean: number, demandStd: number): FareBucket {
  return { index, fare, demandMean, demandStd };
}

describe("computeEmsrB", () => {
  it("matches the textbook two-class Littlewood's rule example", () => {
    // Classic example: high fare $200 (mean 20, std 10), low fare $100 (mean 40, std 15), capacity 50.
    // Littlewood: protect if P(demand_high > protection) >= f_low/f_high => z = invCdf(1 - 100/200) = invCdf(0.5) = 0
    // protection = mean_high + 0*std = 20
    const buckets = [bucket(0, 200, 20, 10), bucket(1, 100, 40, 15)];
    const result = computeEmsrB(buckets, 50);
    expect(result.protectionLevels[0]).toBeCloseTo(20, 5);
    expect(result.bookingLimits[0]).toBe(50);
    expect(result.bookingLimits[1]).toBeCloseTo(30, 5);
  });

  it("never allocates negative or over-capacity booking limits", () => {
    const buckets = [bucket(0, 500, 5, 3), bucket(1, 300, 20, 8), bucket(2, 150, 60, 20), bucket(3, 90, 100, 30)];
    for (const cap of [0, 1, 10, 50, 200, 1000]) {
      const result = computeEmsrB(buckets, cap);
      for (const bl of result.bookingLimits) {
        expect(bl).toBeGreaterThanOrEqual(0);
        expect(bl).toBeLessThanOrEqual(Math.max(cap, 0));
      }
    }
  });

  it("bid price rises toward the ceiling fare as capacity shrinks", () => {
    const buckets = [bucket(0, 500, 10, 5), bucket(1, 300, 20, 8), bucket(2, 150, 50, 15), bucket(3, 90, 80, 20)];
    const bidPrices = [5, 20, 60, 150, 500].map((cap) => computeEmsrB(buckets, cap).bidPrice);
    for (let i = 1; i < bidPrices.length; i++) {
      expect(bidPrices[i]!).toBeLessThanOrEqual(bidPrices[i - 1]! + 1e-9);
    }
    expect(bidPrices[0]).toBe(500);
  });

  it("handles a single bucket without error", () => {
    const result = computeEmsrB([bucket(0, 250, 40, 10)], 60);
    expect(result.bookingLimits).toEqual([60]);
    expect(result.bidPrice).toBe(250);
  });

  it("handles zero capacity gracefully", () => {
    const buckets = [bucket(0, 300, 10, 5), bucket(1, 150, 30, 10)];
    const result = computeEmsrB(buckets, 0);
    expect(result.bookingLimits.every((bl) => bl === 0)).toBe(true);
    expect(result.bidPrice).toBe(300);
  });
});
