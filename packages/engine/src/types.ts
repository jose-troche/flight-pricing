/**
 * Core domain types for the flight pricing engine.
 *
 * Naming follows conventional airline Revenue Management (RM) vocabulary
 * (DTD, EMSR, protection level, bid price, load factor) so the model reads
 * naturally to a revenue management subject-matter expert.
 */

/** Days-to-departure, 0 = departure day, positive = days before departure. */
export type DaysToDeparture = number;

export interface DemandSegmentParams {
  /** Human-readable label, e.g. "Leisure" | "Business". */
  name: string;
  /** Share of total expected demand attributable to this segment, 0-1. Segment shares across all segments must sum to 1. */
  demandShare: number;
  /**
   * Price-response semi-elasticity: fractional change in demand per unit
   * fractional change in price above the reference fare (exponential demand
   * curve d(p) = d0 * exp(-elasticity * (p - refFare) / refFare)).
   * Higher = more price-sensitive. Leisure ~2.5-4.5, Business ~0.4-1.2.
   */
  priceElasticity: number;
  /**
   * Reference willingness-to-pay expressed as a multiple of the route's
   * base (unrestricted economy) fare, e.g. 1.0 = pays reference fare on
   * average. Business segments run higher (1.3-2.5x), leisure lower
   * (0.6-1.1x).
   */
  referenceFareMultiplier: number;
  /**
   * Coefficient of variation of demand volume for this segment (std/mean).
   * Captures forecast uncertainty; used by EMSRb.
   */
  demandCv: number;
  /**
   * Booking-curve shape: mean days-to-departure at which this segment
   * books (lognormal-ish peak), and spread. Business books late (small
   * mean), leisure books early (large mean).
   */
  bookingCurve: {
    peakDaysToDeparture: number;
    spreadDays: number;
  };
}

export interface SeasonalityParams {
  /** 12 multipliers (Jan..Dec) applied multiplicatively to base demand/price. Default all 1.0. */
  monthlyMultipliers: number[];
  /** 7 multipliers (Mon..Sun) applied to demand/price for day-of-week of departure. */
  dayOfWeekMultipliers: number[];
}

export interface CompetitiveParams {
  /**
   * Index of the market's average competitor fare relative to this
   * carrier's unrestricted base fare, 1.0 = parity. >1 competitors are
   * pricier (room to push up), <1 competitors are cheaper (pressure down).
   */
  competitorPriceIndex: number;
  /** How strongly the engine reacts to the competitive index, 0 = ignore, 1 = full pass-through. */
  competitiveSensitivity: number;
}

export interface CostParams {
  /** All-in variable cost per seat flown (fuel, crew, distribution, catering...), the hard price floor. */
  variableCostPerSeat: number;
  /** Fixed cost allocated per seat (ownership/lease, overhead) used only for reporting contribution margin, not as a floor. */
  fixedCostPerSeat: number;
  /** Fuel surcharge pass-through per seat, added on top of the floor. */
  fuelSurchargePerSeat: number;
}

export interface GuardrailParams {
  /** Minimum allowed fare as a multiple of variable cost. Must be >= 1 to guarantee non-negative contribution. */
  minFareToCostRatio: number;
  /** Maximum allowed fare as a multiple of the base (reference) fare — a brand/regulatory "fare fence". */
  maxFareMultiplier: number;
  /** Maximum allowed price change between two consecutive re-optimization checkpoints, as a fraction (price stability / anti-sticker-shock control). */
  maxStepChangeFraction: number;
}

export interface EngineSettings {
  /** Number of virtual fare buckets used to discretize the willingness-to-pay curve for EMSRb (continuous pricing approximation). More buckets = smoother curve, more compute. */
  virtualBucketCount: number;
  /** Booking horizon in days before departure at which selling opens. */
  bookingHorizonDays: number;
  /** Number of DTD checkpoints at which the engine re-optimizes protection levels (nested re-optimization cadence). */
  reoptimizationCheckpoints: number;
  /** Overbooking authorization as a fraction of physical capacity (e.g. 1.05 = sell up to 5% over capacity to offset no-shows). */
  overbookingFactor: number;
  /** Assumed no-show rate, used together with overbooking factor for capacity-risk reporting. */
  expectedNoShowRate: number;
}

export interface FlightContext {
  /** Physical seat capacity of the aircraft/cabin being priced. */
  capacity: number;
  /** Great-circle distance in miles, used only for informational cost-per-mile displays. */
  distanceMiles: number;
  /** Unrestricted reference (base) economy fare that all multipliers apply against. */
  baseFare: number;
  /** ISO month of departure, 1-12. */
  departureMonth: number;
  /** Day of week of departure, 0=Mon..6=Sun. */
  departureDayOfWeek: number;
}

export interface PricingParameters {
  flight: FlightContext;
  segments: DemandSegmentParams[];
  seasonality: SeasonalityParams;
  competitive: CompetitiveParams;
  cost: CostParams;
  guardrails: GuardrailParams;
  engine: EngineSettings;
}

/** A single virtual fare bucket used internally by EMSRb. */
export interface FareBucket {
  index: number;
  fare: number;
  demandMean: number;
  demandStd: number;
}

/** EMSRb output: nested protection levels and booking limits per bucket. */
export interface EmsrResult {
  buckets: FareBucket[];
  /** Protection level for buckets [0..j] against bucket j+1, indexed by j (length = buckets.length - 1). */
  protectionLevels: number[];
  /** Nested booking limit for each bucket (seats sellable at-or-above that bucket's fare). */
  bookingLimits: number[];
  /** Bid price: marginal value of the last seat, i.e. fare of the lowest open bucket. */
  bidPrice: number;
}

/** One point on the price-vs-time curve returned to the UI. */
export interface PriceCurvePoint {
  daysToDeparture: DaysToDeparture;
  price: number;
  bidPrice: number;
  expectedCumulativeBookings: number;
  remainingCapacity: number;
  loadFactor: number;
}

export interface PriceCurveResult {
  points: PriceCurvePoint[];
  fareBuckets: FareBucket[];
  bucketFloor: number;
  bucketCeiling: number;
  baseFare: number;
  expectedFinalLoadFactor: number;
  expectedRevenue: number;
  expectedRevenuePerSeat: number;
}

export interface SimulationTrialResult {
  revenue: number;
  bookings: number;
  loadFactor: number;
  spilledDemand: number;
  averageFare: number;
}

export interface SimulationSummary {
  trials: number;
  dynamic: {
    meanRevenue: number;
    p10Revenue: number;
    p50Revenue: number;
    p90Revenue: number;
    meanLoadFactor: number;
    stdRevenue: number;
  };
  staticBaseline: {
    meanRevenue: number;
    p10Revenue: number;
    p50Revenue: number;
    p90Revenue: number;
    meanLoadFactor: number;
    stdRevenue: number;
    /** Flat price used for the baseline (mean of the dynamic price curve). */
    flatPrice: number;
  };
  revenueUpliftPct: number;
  trialsSample: SimulationTrialResult[];
}
