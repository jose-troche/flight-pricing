import type { DemandSegmentParams } from "./types.js";
import { bookingArrivalDensity } from "./stats.js";

/**
 * Discretized representation of a segment's booking curve: for a fixed set
 * of re-optimization checkpoints (days-to-departure, descending), how much
 * of the segment's total demand arrives in each interval, and what
 * fraction of the segment's demand is still "to go" as of each checkpoint.
 *
 * Built once per pricing run from a fine daily grid via Poisson-process
 * thinning logic: integrating the arrival-intensity density over [0, horizon]
 * gives a proper probability distribution over arrival day, so interval
 * masses sum to 1 and "remaining fraction" is a proper survival function.
 */
export interface SegmentBookingCurve {
  /** Fraction of this segment's total demand arriving within each interval between consecutive checkpoints (same length as checkpoints.length - 1, aligned to checkpoints[i] -> checkpoints[i+1]). */
  intervalFraction: number[];
  /** Fraction of this segment's total demand still arriving at-or-before checkpoint i (i.e. from checkpoints[i] down to 0). Length = checkpoints.length. */
  remainingFraction: number[];
}

const DAILY_GRID_STEP = 1;

/** Evenly-in-log-time-spaced checkpoints, denser near departure, matching how airline RM systems schedule more frequent data-collection points (DCPs) as departure nears. */
export function generateCheckpoints(horizonDays: number, count: number): number[] {
  const k = Math.max(2, Math.round(count));
  const gamma = 1.6;
  const points = new Set<number>();
  for (let i = 0; i <= k; i++) {
    const frac = (k - i) / k;
    const t = Math.round(horizonDays * Math.pow(frac, gamma));
    points.add(t);
  }
  points.add(0);
  points.add(horizonDays);
  return Array.from(points).sort((a, b) => b - a);
}

export function buildSegmentBookingCurve(
  segment: DemandSegmentParams,
  checkpoints: number[],
  horizonDays: number,
): SegmentBookingCurve {
  const { peakDaysToDeparture, spreadDays } = segment.bookingCurve;

  // Fine daily grid density values over [0, horizonDays].
  const gridSize = Math.max(1, Math.floor(horizonDays / DAILY_GRID_STEP)) + 1;
  const density: number[] = new Array(gridSize);
  let total = 0;
  for (let g = 0; g < gridSize; g++) {
    const t = g * DAILY_GRID_STEP;
    const d = bookingArrivalDensity(t, peakDaysToDeparture, spreadDays);
    density[g] = d;
    total += d;
  }
  if (total <= 0) total = 1;

  const dayToGridIndex = (t: number) => Math.min(gridSize - 1, Math.max(0, Math.round(t / DAILY_GRID_STEP)));

  // Cumulative mass from day 0 up to and including a given day index.
  const cumFromZero: number[] = new Array(gridSize);
  let running = 0;
  for (let g = 0; g < gridSize; g++) {
    running += density[g]!;
    cumFromZero[g] = running;
  }

  const remainingFraction: number[] = checkpoints.map((t) => {
    const idx = dayToGridIndex(t);
    return cumFromZero[idx]! / total;
  });

  const intervalFraction: number[] = [];
  for (let i = 0; i < checkpoints.length - 1; i++) {
    // checkpoints are descending; interval covers (checkpoints[i+1], checkpoints[i]]
    const upper = remainingFraction[i]!;
    const lower = remainingFraction[i + 1]!;
    intervalFraction.push(Math.max(0, upper - lower));
  }

  return { intervalFraction, remainingFraction };
}
