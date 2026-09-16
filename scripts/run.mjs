import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const dependencies = existsSync(path.join(root, "node_modules/vite"))
  ? path.join(root, "node_modules")
  : path.resolve(root, "../frontend/node_modules");
const command = process.argv[2] || "dev";
if (command !== "preview") {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "data/preprocess.mjs")],
    { cwd: root, stdio: "inherit" },
  );
  if (result.status) process.exit(result.status);
}
const args = command === "dev" ? [] : [command];
const result = spawnSync(
  process.execPath,
  [
    path.join(dependencies, "vite/bin/vite.js"),
    ...args,
    "--config",
    path.join(root, "vite.config.mjs"),
    ...process.argv.slice(3),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, OIL_STAT_MODULES: dependencies },
  },
);
process.exit(result.status ?? 1);
