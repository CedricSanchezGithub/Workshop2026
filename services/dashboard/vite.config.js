import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Servi par le moteur de remédiation (services/remediation) ; en dev, /api est relayé vers lui.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8090" } },
});
