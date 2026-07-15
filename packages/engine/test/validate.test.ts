import { describe, it, expect } from "vitest";
import { sanitizeParameters } from "../src/validate.js";
import { getDefaultParameters } from "../src/defaults.js";

describe("sanitizeParameters", () => {
  it("leaves already-valid default parameters unchanged (no issues)", () => {
    const { issues } = sanitizeParameters(getDefaultParameters());
    expect(issues).toEqual([]);
  });

  it("clamps out-of-range numeric fields instead of throwing", () => {
    const params = getDefaultParameters();
    params.flight.capacity = 999999;
    params.flight.baseFare = -100;
    params.cost.variableCostPerSeat = -50;
    const { parameters, issues } = sanitizeParameters(params);
    expect(parameters.flight.capacity).toBeLessThanOrEqual(500);
    expect(parameters.flight.baseFare).toBeGreaterThan(0);
    expect(parameters.cost.variableCostPerSeat).toBeGreaterThan(0);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("renormalizes segment demand shares that do not sum to 1", () => {
    const params = getDefaultParameters();
    params.segments[0]!.demandShare = 0.9;
    params.segments[1]!.demandShare = 0.9;
    const { parameters } = sanitizeParameters(params);
    const sum = parameters.segments.reduce((a, s) => a + s.demandShare, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("replaces non-finite values", () => {
    const params = getDefaultParameters();
    params.flight.baseFare = NaN;
    const { parameters } = sanitizeParameters(params);
    expect(Number.isFinite(parameters.flight.baseFare)).toBe(true);
  });

  it("widens the fare ceiling if the guardrails are internally inconsistent", () => {
    const params = getDefaultParameters();
    params.guardrails.minFareToCostRatio = 3;
    params.cost.variableCostPerSeat = 3000;
    params.guardrails.maxFareMultiplier = 1.1;
    params.flight.baseFare = 100;
    const { parameters } = sanitizeParameters(params);
    const floor = parameters.cost.variableCostPerSeat * parameters.guardrails.minFareToCostRatio;
    const ceiling = parameters.flight.baseFare * parameters.guardrails.maxFareMultiplier;
    expect(ceiling).toBeGreaterThan(floor);
  });
});
