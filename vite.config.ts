// vite.config.ts
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: ".",              // project root (default)
  publicDir: "public",    // static assets (default)
  resolve: {
    alias: {
      "@ui":   path.resolve(__dirname, "src/ui"),
      "@core": path.resolve(__dirname, "src/core"),
      "@queue": path.resolve(__dirname, "src/queue"),
      "@util": path.resolve(__dirname, "src/util"),
    },
  },
  server: {
    port: 5173,
    host: false,
    strictPort: true,
  },
});
