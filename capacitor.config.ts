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
    LocalNotifications: {
      // One-colour icon in android/app/src/main/res/drawable, so it never shows as a white square.
      smallIcon: 'ic_stat_notify',
      iconColor: '#1f5f99',
    },
  },
}

export default config
