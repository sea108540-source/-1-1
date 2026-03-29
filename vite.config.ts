import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('react-dom') || id.match(/[\\/]react[\\/]/)) {
            return 'react-vendor';
          }

          if (id.includes('recharts')) {
            return 'charts';
          }

          if (id.includes('react-calendar') || id.includes('date-fns')) {
            return 'calendar';
          }

          if (id.includes('@supabase')) {
            return 'supabase';
          }

          if (id.includes('lucide-react')) {
            return 'icons';
          }
        },
      },
    },
  },
});
