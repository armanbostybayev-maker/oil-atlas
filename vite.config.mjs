import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from 'node:child_process';

export default defineConfig({
  base: "./",

  plugins: [react(), { name:'validate-public-infrastructure',apply:'build',buildStart(){
    execFileSync(process.execPath,['scripts/check-infrastructure.mjs'],{cwd:process.cwd(),stdio:'inherit'});
  }}],

  optimizeDeps: {
    exclude: [
      "maplibre-gl",
      "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url",
    ],
  },

  worker: {
    format: "es",
  },

  server: {
    host: "127.0.0.1",
    port: 5180,
    proxy: {
      "/api/tankers": {
        target: "https://oil-atlas.vercel.app",
        changeOrigin: true,
      },
      "/tankers": {
        target: "https://oil-atlas.vercel.app",
        changeOrigin: true,
        rewrite: () => "/api/tankers",
      },
    },
  },

  preview: {
    host: "127.0.0.1",
    port: 5180,
  },

  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Keep large libraries cached when application code changes.
        manualChunks(id) {
          const modulePath = id.replaceAll("\\", "/");
          if (!modulePath.includes("/node_modules/")) return;
          if (modulePath.includes("/node_modules/maplibre-gl/")) return "maplibre";
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(modulePath)) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
