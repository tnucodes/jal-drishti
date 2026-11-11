import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" lets the built app run from any folder (Netlify, GitHub Pages, or a USB stick).
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rollupOptions: {
      output: {
        // Big libraries in their own files, so the browser can cache them.
        manualChunks: {
          react: ["react", "react-dom"],
          map: ["leaflet", "react-leaflet"],
          charts: ["recharts"],
        },
      },
    },
  },
});
