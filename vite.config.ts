// vite.config.ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "src/app"),
      "@components": path.resolve(__dirname, "src/app/components"),
      "@features": path.resolve(__dirname, "src/app/features"),
      "@lib": path.resolve(__dirname, "src/app/lib"),
      "@types": path.resolve(__dirname, "src/types")
    }
  },
  server: {
    port: 5173
  },
  build: {
    sourcemap: true
  },
  test: {
    globals: true,
    environment: "jsdom"
  }
});