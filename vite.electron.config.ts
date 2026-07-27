// Standalone Vite config for the Electron desktop build.
// Pure client-side React + TanStack Router (no SSR, no TanStack Start).
// Output: dist-electron/
import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  base: "./",
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.electron.gen.ts",
      routeFileIgnorePattern: "sitemap",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
  },
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "electron.html"),
    },
  },
  server: {
    port: 5180,
    strictPort: false,
  },
});
