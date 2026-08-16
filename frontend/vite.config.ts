import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Allow proxied preview/staging hostnames to reach the dev server.
      allowedHosts: true,
      // In local development the SPA and Laravel run on different ports; the
      // browser always calls a relative /api path and Vite forwards it.
      proxy: process.env.VITE_DEV_API_PROXY
        ? { '/api': { target: process.env.VITE_DEV_API_PROXY, changeOrigin: true } }
        : undefined,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@tanstack')) return 'query-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
            if (id.includes('axios')) return 'http-vendor';
            return undefined;
          },
        },
      },
    },
  };
});
