import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In development the API is proxied through Vite so the SPA and Laravel share
// an origin and Sanctum's session cookie just works. In production the SPA
// calls VITE_API_URL (the api. subdomain) directly.
const API = process.env.VITE_DEV_API ?? "http://127.0.0.1:8010";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: {
      "/api": { target: API, changeOrigin: false },
      "/sanctum": { target: API, changeOrigin: false },
      "/r/": { target: API, changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
