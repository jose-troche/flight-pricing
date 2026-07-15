import { describe, it, expect } from "vitest";
import { normalCdf, normalInvCdf, createRng, sampleNormal, quantile, mean, stdDev } from "../src/stats.js";

describe("normalCdf / normalInvCdf", () => {
  it("matches known standard normal values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.959964)).toBeCloseTo(0.025, 3);
  });

  it("is the inverse of normalInvCdf", () => {
    for (const p of [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
      const z = normalInvCdf(p);
      expect(normalCdf(z)).toBeCloseTo(p, 3);
    }
  });
});

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(123);
    const b = createRng(123);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("sampleNormal", () => {
  it("has approximately correct mean and std over many samples", () => {
    const rng = createRng(99);
    const samples = Array.from({ length: 20000 }, () => sampleNormal(rng, 100, 15));
    expect(mean(samples)).toBeCloseTo(100, -1);
    expect(stdDev(samples)).toBeGreaterThan(13);
    expect(stdDev(samples)).toBeLessThan(17);
  });
});

describe("quantile", () => {
  it("computes basic quantiles correctly", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quantile(sorted, 0.5)).toBeCloseTo(5.5, 5);
    expect(quantile(sorted, 0)).toBe(1);
    expect(quantile(sorted, 1)).toBe(10);
  });
});
