import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Custom plugin to strip modulepreload links in dev (prevents console warnings)
function stripModulePreload(): import("vite").Plugin {
   return {
      name: 'strip-modulepreload',
      transformIndexHtml(html) {
         return html.replace(/<link[^>]*rel="modulepreload"[^>]*>/gi, '');
      },
   };
}

export default defineConfig(({ mode }) => ({
   plugins: [
      react(),
      stripModulePreload(),
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
      modulePreload: { polyfill: false },
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      // Target modern browsers for smaller builds
      target: 'es2020',
      // Reduce chunk size warning limit to catch bloat
      chunkSizeWarningLimit: 600,
      // CSS code splitting - critical for reducing main.css
      cssCodeSplit: true,
      // Asset inlining threshold (4KB) - aggressive inline small assets
      assetsInlineLimit: 4096,
      // Enable tree-shaking for unused code removal
      rollupOptions: {
         output: {
            // Dynamic imports should be code-split
            dynamicImportInCjs: false,
            manualChunks: {
               // React core - always needed
               'react-vendor': ['react', 'react-dom', 'react-router-dom'],
               // Supabase - lazy loaded after auth check
               'supabase': ['@supabase/supabase-js'],
               // UI Components - split into tiers for lazy loading
               'ui-core': [
                  '@radix-ui/react-dialog',
                  '@radix-ui/react-dropdown-menu',
                  '@radix-ui/react-tooltip',
               ],
               'ui-extra': [
                  '@radix-ui/react-toast',
                  '@radix-ui/react-accordion',
                  '@radix-ui/react-tabs',
                  '@radix-ui/react-select',
                  '@radix-ui/react-popover',
                  '@radix-ui/react-scroll-area',
               ],
               // Form handling - loaded when forms are used
               'forms': [
                  'react-hook-form',
                  'zod',
                  '@hookform/resolvers',
               ],
               // Image cropping - only needed during upload
               'image-tools': ['react-easy-crop'],
               // Query - used frequently but separable
               'query': ['@tanstack/react-query'],
               // Sonner (toast) - frequently used
               'sonner': ['sonner'],
               // Helmet (SEO) - used on every page but separable
               'helmet': ['react-helmet-async'],
               // Lucide icons - heavy but used everywhere, keep separate
               'lucide': ['lucide-react'],
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
      exclude: [],
   },
}));
