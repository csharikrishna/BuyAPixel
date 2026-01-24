import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
   plugins: [
      react(),
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
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      // Target modern browsers for smaller builds
      target: 'es2020',
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 600,
      rollupOptions: {
         output: {
            manualChunks: {
               // React core - always needed
               'react-vendor': ['react', 'react-dom', 'react-router-dom'],
               // Supabase - needed for auth/data
               'supabase': ['@supabase/supabase-js'],
               // UI Components - frequently used
               'ui-core': [
                  '@radix-ui/react-dialog',
                  '@radix-ui/react-dropdown-menu',
                  '@radix-ui/react-toast',
                  '@radix-ui/react-tooltip',
               ],
               // Form handling - loaded when forms are used
               'forms': [
                  'react-hook-form',
                  'zod',
                  '@hookform/resolvers',
               ],
               // Charts - only needed in admin/leaderboard
               'charts': ['recharts'],
               // Image cropping - only needed during upload
               'image-tools': ['react-easy-crop'],
            },
         },
      },
   },

   optimizeDeps: {
      include: [
         'react',
         'react-dom',
         'react-router-dom',
         '@supabase/supabase-js',
         '@tanstack/react-query',
      ],
      // Exclude large optional deps from pre-bundling
      exclude: ['recharts'],
   },
}));
