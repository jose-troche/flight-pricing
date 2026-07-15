import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateValidationDataset } from "../src/synthetic-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dataset = generateValidationDataset({ flightsPerRoute: 24, trialsPerFlight: 150, seed: 20240115 });

const outputPath = resolve(__dirname, "../../../apps/web/public/data/validation-dataset.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(dataset, null, 2));

console.log(`Wrote ${dataset.records.length} synthetic flight records to ${outputPath}`);
console.log(`Mean revenue uplift vs static baseline: ${dataset.summary.meanRevenueUpliftPct.toFixed(2)}%`);
console.log(`Median revenue uplift: ${dataset.summary.medianRevenueUpliftPct.toFixed(2)}%`);
console.log(`Mean dynamic load factor: ${(dataset.summary.meanDynamicLoadFactor * 100).toFixed(1)}%`);
console.log(`Mean static load factor: ${(dataset.summary.meanStaticLoadFactor * 100).toFixed(1)}%`);
