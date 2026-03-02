import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src--frontend"),
    },
  },
  // This defines a global 'process' variable to prevent the frontend from crashing
  define: {
    'process.env': {},
    'global': {},
  },
  server: {
    allowedHosts: ['klk5st-5173.csb.app'],
  },
});