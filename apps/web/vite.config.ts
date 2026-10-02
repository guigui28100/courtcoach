import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En local, les appels « /api/... » sont envoyés au serveur Nest (port 3000).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { "/api": { target: "http://localhost:3000", changeOrigin: false } } },
  build: { sourcemap: false },
});
