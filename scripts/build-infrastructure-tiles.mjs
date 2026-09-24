#!/usr/bin/env node
/**
 * Prepare local vector tiles from independently licensed GeoJSON.
 * Requires tippecanoe and tippecanoe-decode in PATH.
 * Outputs are intentionally outside public/ and are not committed.
 *
 * node scripts/build-infrastructure-tiles.mjs --type oil --input /path/oil-pipelines.geojson --output /tmp/oil.mbtiles
 */
import { spawnSync } from "node:child_process";
import { readFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { INFRASTRUCTURE_TYPES, validateInfrastructureCollection } from "../map/InfrastructureLayer.mjs";

export const tileLayerName = type => {
  if (!INFRASTRUCTURE_TYPES.some(item => item.id === type)) throw new Error("Unknown infrastructure type");
  return `infrastructure_${type}`;
};
export function tileCommand({ type, input, output }) {
  if (!["oil", "gas"].includes(type)) throw new Error("Only oil and gas line layers are supported");
  if (!input || !output) throw new Error("--input and --output are required");
  return ["-f", "-o", resolve(output), "-l", tileLayerName(type),
    "-Z", "0", "-z", "12", "--no-feature-limit", "--no-tile-size-limit",
    "--no-line-simplification", "--no-tiny-polygon-reduction",
    "--no-polygon-splitting", resolve(input)];
}
function args(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith("--") || !argv[i + 1]) throw new Error("Expected --key value pairs");
    options[argv[i].slice(2)] = argv[i + 1];
  }
  return options;
}
async function main() {
  const options = args(process.argv.slice(2));
  const input = resolve(options.input || "");
  const output = resolve(options.output || "");
  if (input === output) throw new Error("Input and output must differ");
  const data = validateInfrastructureCollection(JSON.parse(await readFile(input, "utf8")), options.type);
  if (!data.features.length) throw new Error("Refusing to tile an empty dataset");
  await mkdir(dirname(output), { recursive: true });
  const result = spawnSync("tippecanoe", tileCommand({ ...options, input, output }), { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`tippecanoe failed: ${result.status}`);
  console.log(`${options.type}: ${data.features.length} source features; ${(await stat(output)).size} MBTiles bytes`);
  console.log("Tiles remain local. Do not serve or publish without redistribution approval.");
}
if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
