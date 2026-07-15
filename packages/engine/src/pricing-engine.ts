import type { FareBucket, PriceCurvePoint, PriceCurveResult, PricingParameters } from "./types.js";
import { segmentTotalDemandMean, segmentSurvival } from "./demand.js";
import { buildSegmentBookingCurve, generateCheckpoints } from "./booking-curve.js";
import { computeEmsrB } from "./emsr.js";
import { clamp } from "./stats.js";
import { sanitizeParameters } from "./validate.js";

interface BucketSegmentDecomposition {
  bucket: FareBucket;
  /** Per-segment contribution to this bucket's full-horizon demand mean/std, keyed by segment index. */
  segmentMean: number[];
  segmentStd: number[];
}

function priceFloor(params: PricingParameters): number {
  return params.cost.variableCostPerSeat * params.guardrails.minFareToCostRatio + params.cost.fuelSurchargePerSeat;
}

function priceCeiling(params: PricingParameters): number {
  return params.flight.baseFare * params.guardrails.maxFareMultiplier;
}

/** Builds the virtual fare-bucket ladder (log-spaced, descending fare) and decomposes each bucket's demand into per-segment contributions via the exponential willingness-to-pay survival function. */
function buildBuckets(params: PricingParameters): BucketSegmentDecomposition[] {
  const floor = priceFloor(params);
  const ceiling = priceCeiling(params);
  const n = params.engine.virtualBucketCount;

  const fares: number[] = [];
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1 || 1);
    // log-spaced from ceiling (k=0) down to floor (k=n-1), matching real fare ladders (geometric, not linear, spacing).
    const logFare = Math.log(ceiling) + t * (Math.log(floor) - Math.log(ceiling));
    fares.push(Math.exp(logFare));
  }

  const segmentTotals = params.segments.map((seg) => segmentTotalDemandMean(seg, params.flight, params.seasonality));

  const survivalAt = (fare: number) =>
    params.segments.map((seg, i) => segmentSurvival(seg, segmentTotals[i]!, params.flight.baseFare, fare));

  const decompositions: BucketSegmentDecomposition[] = [];
  let prevSurvival = new Array(params.segments.length).fill(0);

  for (let k = 0; k < n; k++) {
    const fare = fares[k]!;
    const survival = survivalAt(fare);
    const segmentMean = survival.map((s, i) => Math.max(0, s - prevSurvival[i]!));
    const segmentStd = segmentMean.map((m, i) => m * params.segments[i]!.demandCv);
    const demandMean = segmentMean.reduce((a, b) => a + b, 0);
    const demandStd = Math.sqrt(segmentStd.reduce((a, b) => a + b * b, 0));

    decompositions.push({
      bucket: { index: k, fare, demandMean, demandStd },
      segmentMean,
      segmentStd,
    });
    prevSurvival = survival;
  }

  return decompositions;
}

/**
 * Generates the full dynamic price curve across the booking horizon.
 *
 * At each re-optimization checkpoint (days-to-departure), demand-to-go is
 * forecast per fare bucket (Poisson-thinned from the full-horizon forecast
 * using each segment's booking-curve remaining fraction), EMSRb computes
 * the bid price against remaining capacity, a competitive overlay and
 * guardrails are applied, and expected bookings for the interval until the
 * next checkpoint are accepted against that price and deducted from
 * remaining capacity before moving to the next checkpoint.
 */
export function generatePriceCurve(rawParams: PricingParameters): PriceCurveResult {
  const { parameters: params } = sanitizeParameters(rawParams);
  const decompositions = buildBuckets(params);
  const buckets = decompositions.map((d) => d.bucket);

  const checkpoints = generateCheckpoints(params.engine.bookingHorizonDays, params.engine.reoptimizationCheckpoints);
  const segmentCurves = params.segments.map((seg) =>
    buildSegmentBookingCurve(seg, checkpoints, params.engine.bookingHorizonDays),
  );
  const segmentTotals = params.segments.map((seg) => segmentTotalDemandMean(seg, params.flight, params.seasonality));

  const floor = priceFloor(params);
  const ceiling = priceCeiling(params);
  const startingCapacity = params.flight.capacity * params.engine.overbookingFactor;

  let capacityToGo = startingCapacity;
  let prevPrice: number | undefined;
  let totalRevenue = 0;

  const points: PriceCurvePoint[] = [];

  for (let i = 0; i < checkpoints.length; i++) {
    const t = checkpoints[i]!;
    const remainingFractionAtI = segmentCurves.map((c) => c.remainingFraction[i]!);

    const bucketsToGo: FareBucket[] = decompositions.map((d) => {
      let mean = 0;
      let varSum = 0;
      for (let s = 0; s < params.segments.length; s++) {
        const frac = remainingFractionAtI[s]!;
        mean += d.segmentMean[s]! * frac;
        varSum += (d.segmentStd[s]! * d.segmentStd[s]!) * frac;
      }
      return { index: d.bucket.index, fare: d.bucket.fare, demandMean: mean, demandStd: Math.sqrt(varSum) };
    });

    const emsr = computeEmsrB(bucketsToGo, capacityToGo);
    const rawBidPrice = emsr.bidPrice;

    let adjPrice = rawBidPrice * (1 + params.competitive.competitiveSensitivity * (params.competitive.competitorPriceIndex - 1));
    adjPrice = clamp(adjPrice, floor, ceiling);
    if (prevPrice !== undefined) {
      const maxStep = params.guardrails.maxStepChangeFraction;
      adjPrice = clamp(adjPrice, prevPrice * (1 - maxStep), prevPrice * (1 + maxStep));
      adjPrice = clamp(adjPrice, floor, ceiling);
    }

    let acceptedThisInterval = 0;
    if (i < checkpoints.length - 1) {
      let rawAccepted = 0;
      for (let s = 0; s < params.segments.length; s++) {
        const seg = params.segments[s]!;
        const intervalFrac = segmentCurves[s]!.intervalFraction[i]!;
        const acceptShare = segmentTotals[s]! > 0 ? segmentSurvival(seg, segmentTotals[s]!, params.flight.baseFare, adjPrice) / segmentTotals[s]! : 0;
        rawAccepted += segmentTotals[s]! * intervalFrac * acceptShare;
      }
      acceptedThisInterval = Math.min(rawAccepted, capacityToGo);
      totalRevenue += acceptedThisInterval * adjPrice;
      capacityToGo -= acceptedThisInterval;
    }

    const cumulativeBookings = startingCapacity - capacityToGo;
    points.push({
      daysToDeparture: t,
      price: adjPrice,
      bidPrice: rawBidPrice,
      expectedCumulativeBookings: cumulativeBookings,
      remainingCapacity: capacityToGo,
      loadFactor: cumulativeBookings / params.flight.capacity,
    });

    prevPrice = adjPrice;
  }

  const expectedFinalLoadFactor = points[points.length - 1]?.loadFactor ?? 0;

  return {
    points,
    fareBuckets: buckets,
    bucketFloor: floor,
    bucketCeiling: ceiling,
    baseFare: params.flight.baseFare,
    expectedFinalLoadFactor,
    expectedRevenue: totalRevenue,
    expectedRevenuePerSeat: totalRevenue / params.flight.capacity,
  };
}
