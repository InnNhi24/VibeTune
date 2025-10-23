import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./', import.meta.url)),
      "@/components": fileURLToPath(new URL('./components', import.meta.url)),
      "@/services": fileURLToPath(new URL('./services', import.meta.url)),
      "@/utils": fileURLToPath(new URL('./utils', import.meta.url)),
      "@/hooks": fileURLToPath(new URL('./hooks', import.meta.url)),
      "@/contexts": fileURLToPath(new URL('./contexts', import.meta.url)),
      "@/store": fileURLToPath(new URL('./store', import.meta.url)),
      "@/styles": fileURLToPath(new URL('./styles', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-button'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    open: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});