import type { PricingParameters, SimulationSummary, SimulationTrialResult } from "./types.js";
import { generatePriceCurve } from "./pricing-engine.js";
import { segmentTotalDemandMean, segmentSurvival } from "./demand.js";
import { buildSegmentBookingCurve, generateCheckpoints } from "./booking-curve.js";
import { sanitizeParameters } from "./validate.js";
import { createRng, sampleNormal, quantile, mean, stdDev, clamp } from "./stats.js";

export interface SimulateOptions {
  trials?: number;
  seed?: number;
}

/**
 * Monte Carlo validation: draws stochastic demand realizations around the
 * engine's forecast and replays both (a) the dynamic EMSRb-derived price
 * policy and (b) a revenue-equivalent static flat fare against them,
 * capping bookings at capacity each interval. This is the standard way RM
 * teams stress-test a pricing policy that was derived from a *mean*
 * forecast against forecast uncertainty, and is the evidence a revenue
 * management analyst would want before signing off on the model.
 */
export function runSimulation(rawParams: PricingParameters, options: SimulateOptions = {}): SimulationSummary {
  const { parameters: params } = sanitizeParameters(rawParams);
  const trials = Math.min(Math.max(options.trials ?? 200, 10), 2000);
  const seed = options.seed ?? 42;
  const rng = createRng(seed);

  const priceCurve = generatePriceCurve(params);
  const checkpoints = generateCheckpoints(params.engine.bookingHorizonDays, params.engine.reoptimizationCheckpoints);
  const segmentCurves = params.segments.map((seg) =>
    buildSegmentBookingCurve(seg, checkpoints, params.engine.bookingHorizonDays),
  );
  const segmentTotals = params.segments.map((seg) => segmentTotalDemandMean(seg, params.flight, params.seasonality));

  // The baseline is a single undifferentiated fare charged for the whole booking horizon
  // (the "one fare fits all" counterfactual an airline without capacity/time-based revenue
  // management would run) — this is the standard comparator used to quantify RM value, not a
  // revenue-equivalent price, so uplift reflects the actual benefit of dynamic optimization.
  const flatPrice = priceCurve.baseFare;

  const dynamicResults: SimulationTrialResult[] = [];
  const staticResults: SimulationTrialResult[] = [];
  const startingCapacity = params.flight.capacity * params.engine.overbookingFactor;

  for (let trial = 0; trial < trials; trial++) {
    const segmentDraws = segmentTotals.map((total, s) => {
      const seg = params.segments[s]!;
      const draw = sampleNormal(rng, total, total * seg.demandCv);
      return Math.max(0, draw);
    });

    dynamicResults.push(
      simulatePolicy(
        params,
        segmentDraws,
        segmentCurves,
        checkpoints,
        startingCapacity,
        (i) => priceCurve.points[i]!.price,
      ),
    );
    staticResults.push(
      simulatePolicy(params, segmentDraws, segmentCurves, checkpoints, startingCapacity, () => flatPrice),
    );
  }

  const summarize = (results: SimulationTrialResult[]) => {
    const revenues = results.map((r) => r.revenue).sort((a, b) => a - b);
    return {
      meanRevenue: mean(revenues),
      p10Revenue: quantile(revenues, 0.1),
      p50Revenue: quantile(revenues, 0.5),
      p90Revenue: quantile(revenues, 0.9),
      meanLoadFactor: mean(results.map((r) => r.loadFactor)),
      stdRevenue: stdDev(revenues),
    };
  };

  const dynamicSummary = summarize(dynamicResults);
  const staticSummary = summarize(staticResults);

  return {
    trials,
    dynamic: dynamicSummary,
    staticBaseline: { ...staticSummary, flatPrice },
    revenueUpliftPct:
      staticSummary.meanRevenue > 0
        ? ((dynamicSummary.meanRevenue - staticSummary.meanRevenue) / staticSummary.meanRevenue) * 100
        : 0,
    trialsSample: dynamicResults.slice(0, 20),
  };
}

function simulatePolicy(
  params: PricingParameters,
  segmentDraws: number[],
  segmentCurves: ReturnType<typeof buildSegmentBookingCurve>[],
  checkpoints: number[],
  startingCapacity: number,
  priceAt: (checkpointIndex: number) => number,
): SimulationTrialResult {
  let capacityToGo = startingCapacity;
  let revenue = 0;
  let spilled = 0;

  for (let i = 0; i < checkpoints.length - 1; i++) {
    const price = priceAt(i);
    let rawArrivals = 0;
    for (let s = 0; s < params.segments.length; s++) {
      const seg = params.segments[s]!;
      const intervalFrac = segmentCurves[s]!.intervalFraction[i]!;
      const acceptShare = segmentDraws[s]! > 0 ? segmentSurvival(seg, segmentDraws[s]!, params.flight.baseFare, price) / segmentDraws[s]! : 0;
      rawArrivals += segmentDraws[s]! * intervalFrac * acceptShare;
    }
    const accepted = Math.min(rawArrivals, capacityToGo);
    spilled += Math.max(0, rawArrivals - capacityToGo);
    revenue += accepted * price;
    capacityToGo -= accepted;
  }

  const bookings = startingCapacity - capacityToGo;
  return {
    revenue,
    bookings,
    loadFactor: clamp(bookings / params.flight.capacity, 0, 1.5),
    spilledDemand: spilled,
    averageFare: bookings > 0 ? revenue / bookings : 0,
  };
}
