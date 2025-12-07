import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  server: {
    host: "::",
    port: 5173,
    strictPort: false,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    outDir: "dist",
    sourcemap: false, // set true if you need prod debugging
  },
}));
