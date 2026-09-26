import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.melyap.flashcards',
  appName: 'Flashcards',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      // Injects --safe-area-inset-* CSS variables; global.css falls back to env() on the web.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
}

export default config
