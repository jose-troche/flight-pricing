export * from "./types.js";
export { DEFAULT_PARAMETERS, getDefaultParameters, PARAMETER_BOUNDS } from "./defaults.js";
export { sanitizeParameters } from "./validate.js";
export type { ValidationIssue } from "./validate.js";
export { generatePriceCurve } from "./pricing-engine.js";
export { runSimulation } from "./simulate.js";
export type { SimulateOptions } from "./simulate.js";
export { computeEmsrB } from "./emsr.js";
export { segmentTotalDemandMean, segmentSurvival, seasonalityMultiplier, MARKET_DEMAND_TO_CAPACITY_RATIO } from "./demand.js";
export { generateCheckpoints, buildSegmentBookingCurve } from "./booking-curve.js";
export type { SegmentBookingCurve } from "./booking-curve.js";
export {
  generateValidationDataset,
  ROUTE_ARCHETYPES,
} from "./synthetic-data.js";
export type { RouteArchetype, SyntheticFlightRecord, ValidationDataset } from "./synthetic-data.js";
export { normalCdf, normalInvCdf, createRng, sampleNormal, clamp } from "./stats.js";
export { deepMerge } from "./merge.js";
export type { DeepPartial } from "./merge.js";
