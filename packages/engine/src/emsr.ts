import type { EmsrResult, FareBucket } from "./types.js";
import { normalInvCdf, clamp } from "./stats.js";

/**
 * EMSRb (Expected Marginal Seat Revenue-b) nested protection-level
 * heuristic, per Belobaba (1989, 1992) and Belobaba/Weatherford's later
 * generalization used industry-wide for single-leg fare-class inventory
 * control. `buckets` must be sorted by fare descending (bucket 0 = highest
 * fare / most restrictive-free product).
 *
 * For each pair of adjacent aggregated classes (1..j) vs (j+1), the
 * protection level is the number of seats to reserve for the higher-fare
 * aggregate so that the probability the aggregate demand exceeds the
 * protection level equals the critical ratio f_{j+1} / f̄_j (the classic
 * newsvendor / Littlewood's rule generalized to n classes).
 */
export function computeEmsrB(buckets: FareBucket[], capacityToGo: number): EmsrResult {
  const n = buckets.length;
  const cap = Math.max(0, capacityToGo);

  if (n === 0) {
    return { buckets, protectionLevels: [], bookingLimits: [], bidPrice: 0 };
  }

  const protectionLevels: number[] = [];
  let cumMean = 0;
  let cumVar = 0;
  let cumFareWeighted = 0;

  for (let j = 0; j < n - 1; j++) {
    const bucket = buckets[j]!;
    cumMean += bucket.demandMean;
    cumVar += bucket.demandStd * bucket.demandStd;
    cumFareWeighted += bucket.demandMean * bucket.fare;

    const weightedAvgFare = cumMean > 0 ? cumFareWeighted / cumMean : bucket.fare;
    const nextFare = buckets[j + 1]!.fare;
    const criticalRatio = clamp(nextFare / Math.max(weightedAvgFare, 1e-6), 0.0001, 0.9999);
    const z = normalInvCdf(1 - criticalRatio);
    const std = Math.sqrt(cumVar);
    const protection = cumMean + z * std;
    protectionLevels.push(clamp(protection, 0, cap));
  }

  const bookingLimits: number[] = new Array(n);
  bookingLimits[0] = cap;
  for (let j = 1; j < n; j++) {
    const priorProtection = protectionLevels[j - 1]!;
    bookingLimits[j] = clamp(cap - priorProtection, 0, cap);
  }

  let bidPrice = buckets[0]!.fare;
  if (cap <= 0.001) {
    bidPrice = buckets[0]!.fare;
  } else {
    for (let j = n - 1; j >= 0; j--) {
      if (bookingLimits[j]! > 0.5) {
        bidPrice = buckets[j]!.fare;
        break;
      }
    }
  }

  return { buckets, protectionLevels, bookingLimits, bidPrice };
}
