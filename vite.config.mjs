import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
});
