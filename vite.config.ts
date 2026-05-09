import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ""),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      host: true,
      port: 3000,
      strictPort: true,
      hmr: false,
    },
  };
});
