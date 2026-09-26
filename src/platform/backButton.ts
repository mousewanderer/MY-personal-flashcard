import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { navigate } from '../router'

let screenHandler: (() => void) | null = null

/** Lets a screen take over the back button (the study session asks before leaving). */
export function setBackHandler(handler: (() => void) | null): void {
  screenHandler = handler
}

/**
 * Android hardware back button: close an open dialog, else let the current screen decide,
 * else go to the parent screen; exit the app from My Sets.
 */
export function initBackButton(): void {
  if (!Capacitor.isNativePlatform()) return
  void App.addListener('backButton', () => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
    if (dialog) {
      dialog.close()
      return
    }
    if (screenHandler) {
      screenHandler()
      return
    }
    const path = window.location.hash.replace(/^#/, '').split('?')[0]
    if (path === '' || path === '/') void App.exitApp()
    else navigate(path.startsWith('/doc/') ? '/docs' : '/', true)
  })
}
