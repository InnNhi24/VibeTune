import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'node:url';

// Vite config for VibeTune monorepo
export default defineConfig({
  // Root config for monorepo
  root: '.',
  
  // Build configuration
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(fileURLToPath(new URL('.', import.meta.url)), 'index.html'),
        frontend: resolve(fileURLToPath(new URL('.', import.meta.url)), 'frontend/index.html')
      }
    }
  },
  
  // Server configuration
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  
  // Preview configuration
  preview: {
    port: 4173,
    host: true
  },
  
  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@supabase/supabase-js',
      'zustand'
    ]
  }
});
