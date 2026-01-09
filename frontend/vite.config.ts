import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ Minimal, safe Vite config for Vercel
export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});