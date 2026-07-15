import { describe, it, expect } from "vitest";
import { runSimulation } from "../src/simulate.js";
import { getDefaultParameters } from "../src/defaults.js";

describe("runSimulation", () => {
  it("is reproducible given the same seed", () => {
    const params = getDefaultParameters();
    const a = runSimulation(params, { trials: 50, seed: 5 });
    const b = runSimulation(params, { trials: 50, seed: 5 });
    expect(a.dynamic.meanRevenue).toBeCloseTo(b.dynamic.meanRevenue, 6);
  });

  it("produces non-negative, finite revenue and load factor statistics", () => {
    const result = runSimulation(getDefaultParameters(), { trials: 80, seed: 1 });
    for (const summary of [result.dynamic, result.staticBaseline]) {
      expect(summary.meanRevenue).toBeGreaterThan(0);
      expect(Number.isFinite(summary.meanRevenue)).toBe(true);
      expect(summary.meanLoadFactor).toBeGreaterThan(0);
      expect(summary.p10Revenue).toBeLessThanOrEqual(summary.p50Revenue + 1e-6);
      expect(summary.p50Revenue).toBeLessThanOrEqual(summary.p90Revenue + 1e-6);
    }
  });

  it("dynamic pricing does not systematically underperform the flat-fare baseline on default params", () => {
    const result = runSimulation(getDefaultParameters(), { trials: 300, seed: 11 });
    // The EMSRb-derived policy should be at least roughly competitive with (and typically beat)
    // a single revenue-equivalent flat fare, since it can price-discriminate across demand segments.
    expect(result.revenueUpliftPct).toBeGreaterThan(-5);
  });

  it("clamps trial count into a sane range", () => {
    const result = runSimulation(getDefaultParameters(), { trials: 5, seed: 1 });
    expect(result.trials).toBeGreaterThanOrEqual(10);
    const result2 = runSimulation(getDefaultParameters(), { trials: 100000, seed: 1 });
    expect(result2.trials).toBeLessThanOrEqual(2000);
  });
});
