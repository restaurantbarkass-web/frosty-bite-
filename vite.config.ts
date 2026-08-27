import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  // Dynamic build and deployment version computation (supports Vercel CI, Git SHA, custom tags, or build timestamps)
  const gitSha = env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '';
  const deploymentId = env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_DEPLOYMENT_ID || '';
  const explicitVersion = env.VITE_APP_VERSION || env.APP_VERSION || process.env.VITE_APP_VERSION || process.env.APP_VERSION || '';
  
  let computedVersion = explicitVersion;
  if (!computedVersion) {
    if (gitSha) {
      computedVersion = `v-${gitSha.slice(0, 8)}`;
    } else if (deploymentId) {
      computedVersion = `v-${deploymentId.slice(0, 10)}`;
    } else if (mode === 'production') {
      computedVersion = `v-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4)}`;
    } else {
      computedVersion = 'dev-preview';
    }
  }

  const buildTime = new Date().toISOString();
  const appEnv = env.VERCEL_ENV || process.env.VERCEL_ENV || mode;

  return {
    plugins: [react(), tailwindcss()],
    define: {
      '__APP_VERSION__': JSON.stringify(computedVersion),
      '__APP_BUILD_TIME__': JSON.stringify(buildTime),
      '__APP_ENV__': JSON.stringify(appEnv),
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
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('leaflet') || id.includes('react-leaflet') || id.includes('maplibre') || id.includes('mapbox')) {
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
              if (id.includes('html5-qrcode')) {
                return 'vendor-qrcode';
              }
              if (id.includes('jspdf')) {
                return 'vendor-pdf';
              }
              if (id.includes('lottie') || id.includes('lottie-react') || id.includes('lottie-web') || id.includes('canvas-confetti')) {
                return 'vendor-lottie';
              }
              if (id.includes('turf') || id.includes('@turf')) {
                return 'vendor-turf';
              }
              if (id.includes('@google/genai')) {
                return 'vendor-genai';
              }
              if (id.includes('gsap') || id.includes('motion')) {
                return 'vendor-animation';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
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
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 3000,
        overlay: false,
      },
    },
  };
});
