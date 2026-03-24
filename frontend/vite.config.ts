/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

function startupBanner(): Plugin {
  return {
    name: "startup-banner",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const apiTarget = process.env.API_PROXY_TARGET || "http://localhost:8000";
        const banner = `
    __  __      _ _______ _
   / / / /___  (_) ____(_) |
  / / / / __ \\/ / /_  / /| |
 / /_/ / / / / / __/ / / | |
 \\____/_/ /_/_/_/   /_/  |_|
  Homelab Ops  [frontend]

  API proxy: ${apiTarget}
`;
        for (const line of banner.split("\n")) {
          if (line.trim()) console.log(line);
        }
      });
    },
  };
}

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(process.env.BUILD_VERSION || "dev"),
    __BUILD_COMMIT__: JSON.stringify(process.env.BUILD_COMMIT || ""),
    __BUILD_DATE__: JSON.stringify(process.env.BUILD_DATE || ""),
  },
  plugins: [react(), tailwindcss(), startupBanner()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-router")) return "react-vendor";
          if (id.includes("node_modules/@xyflow/")) return "xyflow";
          if (id.includes("node_modules/mermaid/") || id.includes("node_modules/d3") || id.includes("node_modules/elkjs") || id.includes("node_modules/cytoscape")) return "mermaid-vendor";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": process.env.API_PROXY_TARGET || "http://localhost:8000",
    },
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/App.tsx", "./src/components/*.tsx"],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    passWithNoTests: true,
    exclude: ["e2e/**", "e2e-prod/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/vite-env.d.ts", "src/test-setup.ts", "src/api/types.ts", "src/hooks/useVersionCheck.ts", "src/router.tsx"],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
