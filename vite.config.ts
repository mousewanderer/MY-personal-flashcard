/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the same build works on GitHub Pages (any repo path) and inside Capacitor.
export default defineConfig({
  base: './',
  plugins: [react()],
  // IndexedDB is per origin, so a server that drifts to another port would open an empty app.
  // Dev, preview and the desktop shortcut (scripts/desktop/launch.ps1) all share this one.
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
