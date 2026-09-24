import { defineConfig, loadEnv } from "vite";
import { readFileSync } from "node:fs";
import { tilePublicationIssues } from "./scripts/infrastructure-publication-gate.mjs";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  if (env.VITE_OIL_PIPELINE_TILES || env.VITE_GAS_PIPELINE_TILES) {
    const manifest = JSON.parse(readFileSync(new URL("./public/data/infrastructure/import-manifest.json", import.meta.url), "utf8"));
    const issues = tilePublicationIssues(manifest, env);
    if (issues.length) throw new Error(`Infrastructure tile publication blocked: ${issues.join("; ")}`);
  }
  return {
  base: "./",
  plugins: [react()],
  optimizeDeps: {
    exclude: [
      "maplibre-gl",
      "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url",
    ],
  },
  worker: { format: "es" },

  server: {
    host: "127.0.0.1",
    port: 5180,
    proxy: {
      "/api/tankers": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        rewrite: () => "/tankers",
      },
    },
  },

  preview: {
    host: "127.0.0.1",
    port: 5180,
  },

  build: {
    chunkSizeWarningLimit: 1600,
  },
};
});
