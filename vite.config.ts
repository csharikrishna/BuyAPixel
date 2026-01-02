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
         "~bootstrap": path.resolve(__dirname, "node_modules/bootstrap"),
      },
   },

   build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      rollupOptions: {
         output: {
            manualChunks: {
               'react-vendor': ['react', 'react-dom', 'react-router-dom'],
               'ui-vendor': [
                  '@radix-ui/react-dialog',
                  '@radix-ui/react-dropdown-menu',
                  '@radix-ui/react-toast',
                  '@radix-ui/react-avatar',
                  '@radix-ui/react-label',
               ],
               'supabase-vendor': ['@supabase/supabase-js'],
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
      ],
   },
}));
