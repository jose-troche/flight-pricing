import type { PriceCurveResult, PricingParameters, SimulationSummary, ValidationIssue } from "@flight-pricing/engine";

export interface PriceResponse {
  result: PriceCurveResult;
  issues: ValidationIssue[];
  parameters: PricingParameters;
}

export interface SimulateResponse {
  summary: SimulationSummary;
  issues: ValidationIssue[];
  parameters: PricingParameters;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} responded ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Calls the deployed Worker's authoritative /api/price endpoint (same engine, server-side). */
export function fetchPriceFromServer(parameters: PricingParameters): Promise<PriceResponse> {
  return postJson<PriceResponse>("/api/price", parameters);
}

/** Calls the deployed Worker's /api/simulate endpoint (trial count capped server-side for the Workers Free plan CPU budget). */
export function fetchSimulateFromServer(
  parameters: PricingParameters,
  trials: number,
  seed?: number,
): Promise<SimulateResponse> {
  return postJson<SimulateResponse>("/api/simulate", { parameters, trials, seed });
}
