import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src--frontend"),
      // Dedupe: Magic UI components import "motion/react" — map to the
      // framer-motion copy already in the bundle instead of shipping two
      // animation libraries (halves animation-vendor, avoids dev re-optimize reloads).
      "motion/react": path.resolve(__dirname, "./node_modules/framer-motion"),
    },
  },
  // This defines a global 'process' variable to prevent the frontend from crashing
  define: {
    'process.env': {},
    'global': {},
  },
  server: {
    allowedHosts: ['klk5st-5173.csb.app'],
    // Pre-transform the app source at server start so first visits are instant
    warmup: {
      clientFiles: [
        './src--frontend/App.tsx',
        './src--frontend/main.tsx',
        './src--frontend/components/**/*.tsx',
        './src--frontend/context/**/*.tsx',
        './src--frontend/lib/**/*.ts',
        './src--frontend/dashboards/**/*.tsx',
      ],
    },
  },

  // ── Build Performance Optimizations ──────────────────────────
  build: {
    target: 'esnext',           // Modern browsers only — smaller output, native ESM
    minify: 'esbuild',          // Fastest minifier (default, but explicit)
    cssCodeSplit: true,          // Split CSS per async chunk
    sourcemap: false,            // No source maps in production
    chunkSizeWarningLimit: 600,  // Warn above 600KB

    rollupOptions: {
      output: {
        // Split vendor code into separate cached chunks
        manualChunks(id: string) {
          // React core — rarely changes, cache forever
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          // Supabase SDK — large, stable
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase-vendor';
          }
          // Radix UI primitives — many small packages, bundle together
          if (id.includes('node_modules/@radix-ui/')) {
            return 'ui-vendor';
          }
          // Charts — only needed on analytics pages
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-')) {
            return 'charts-vendor';
          }
          // Animation — only needed where framer-motion is used
          if (id.includes('node_modules/framer-motion')) {
            return 'animation-vendor';
          }
          // Face/AI libraries — only on face registration/attendance pages
          if (id.includes('node_modules/face-api') ||
              id.includes('node_modules/@mediapipe') ||
              id.includes('node_modules/@tensorflow')) {
            return 'face-ai-vendor';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor';
          }
        },
      },
    },
  },

  // ── Dev Server Optimizations ─────────────────────────────────
  optimizeDeps: {
    // Pre-bundle these dependencies to speed up page load during dev
    include: [
      'react',
      'react-dom/client',
      'react-router-dom',
      '@supabase/supabase-js',
      'lucide-react',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'sonner',
      'date-fns',
      'cmdk',
      'framer-motion',
      'recharts',
      // Lazy-route deps — bundling upfront prevents mid-navigation
      // "re-optimizing dependencies → reloading" cycles
      '@tanstack/react-query',
      'react-hook-form',
      'embla-carousel-react',
      'vaul',
      'react-day-picker',
      'input-otp',
      'qrcode.react',
      'socket.io-client',
    ],
    // Exclude large WASM/compute-heavy libraries from pre-bundling if they break or slow down initial boot
    exclude: ['@mediapipe/face_mesh']
  },
});