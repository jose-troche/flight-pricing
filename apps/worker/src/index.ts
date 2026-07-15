import { Hono } from "hono";
import {
  getDefaultParameters,
  sanitizeParameters,
  generatePriceCurve,
  runSimulation,
  ROUTE_ARCHETYPES,
  deepMerge,
  type PricingParameters,
} from "@flight-pricing/engine";

interface Bindings {
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Fills in any fields a client omits (or sends malformed) by layering them
 * over the server-side defaults before validation. Keeps the API robust to
 * partial payloads without ever touching `any`-typed data past this point.
 */
function resolveParameters(body: unknown): PricingParameters {
  const defaults = getDefaultParameters();
  if (typeof body !== "object" || body === null) return defaults;
  return deepMerge(defaults, body as Partial<PricingParameters>);
}

app.get("/api/health", (c) => c.json({ ok: true, service: "flight-pricing-worker" }));

app.get("/api/defaults", (c) => {
  return c.json({ parameters: getDefaultParameters() });
});

app.get("/api/scenarios", (c) => {
  const defaults = getDefaultParameters();
  return c.json({
    scenarios: ROUTE_ARCHETYPES.map((route) => ({
      code: route.code,
      description: route.description,
      parameters: deepMerge(defaults, route.overrides),
    })),
  });
});

app.post("/api/price", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parameters = resolveParameters(body);
  const { parameters: sanitized, issues } = sanitizeParameters(parameters);
  const result = generatePriceCurve(sanitized);
  return c.json({ result, issues, parameters: sanitized });
});

app.post("/api/simulate", async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { parameters?: unknown; trials?: number; seed?: number }
    | null;
  const parameters = resolveParameters(body?.parameters);
  const { parameters: sanitized, issues } = sanitizeParameters(parameters);

  // Free-tier CPU-time guardrail: server-side simulation is capped well
  // below the Workers Free plan's 10ms CPU-time-per-request limit; the UI
  // runs larger Monte Carlo runs client-side (in the browser, unmetered)
  // via the same @flight-pricing/engine package for instant what-if
  // exploration and only calls this endpoint for the authoritative,
  // shareable/link-able result.
  const trials = Math.min(Math.max(Math.round(body?.trials ?? 150), 10), 300);
  const seed = Number.isFinite(body?.seed) ? Number(body?.seed) : undefined;

  const summary = runSimulation(sanitized, { trials, seed });
  return c.json({ summary, issues, parameters: sanitized });
});

app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
