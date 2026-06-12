import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '')
    },
    resolve: {
      alias: {
        'react': fileURLToPath(new URL('./node_modules/react', import.meta.url)),
        'react-dom': fileURLToPath(new URL('./node_modules/react-dom', import.meta.url)),
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-router-dom',
        'motion/react',
        'lucide-react',
        'canvas-confetti',
        'react-leaflet',
        'leaflet',
        'react-hot-toast'
      ],
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('leaflet') || id.includes('react-leaflet')) {
                return 'vendor-maps';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              if (id.includes('firebase') || id.includes('@firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('supabase') || id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('jspdf') || id.includes('html5-qrcode') || id.includes('lottie') || id.includes('lottie-react')) {
                return 'vendor-utils';
              }
            }
          }
        }
      }
    },
    server: {
      host: true,
      port: 3000,
      strictPort: true,
      hmr: false,
    },
  };
});
