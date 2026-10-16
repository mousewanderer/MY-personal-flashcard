import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/** The native hotspot link (`android/.../LanPlugin.java`). The host is connection 0 on a guest's phone. */
interface LanPlugin {
  host(): Promise<{ addresses: string[]; port: number }>
  join(options: { address: string }): Promise<void>
  send(options: { to: number; data: string }): Promise<void>
  broadcast(options: { data: string }): Promise<void>
  close(): Promise<void>
  addListener(event: 'peer', fn: (e: { id: number; joined: boolean }) => void): Promise<PluginListenerHandle>
  addListener(event: 'message', fn: (e: { from: number; data: string }) => void): Promise<PluginListenerHandle>
}

export const Lan = registerPlugin<LanPlugin>('Lan')

/** Hotspot play needs the Android app: a browser can't listen for connections. */
export const lanAvailable = Capacitor.getPlatform() === 'android'

/** Listens to the link's events; returns the cleanup for an effect. */
export function onLan(onPeer: (id: number, joined: boolean) => void, onMessage: (from: number, data: string) => void): () => void {
  if (!lanAvailable) return () => {}
  const handles = [Lan.addListener('peer', (e) => onPeer(e.id, e.joined)), Lan.addListener('message', (e) => onMessage(e.from, e.data))]
  return () => handles.forEach((h) => void h.then((x) => x.remove()))
}

/** Closes the server or the link to the host; nothing to do on the web. */
export const closeLan = () => void (lanAvailable ? Lan.close().catch(() => {}) : undefined)

export const sendTo = (to: number, msg: object) => void Lan.send({ to, data: JSON.stringify(msg) }).catch(() => {})
export const broadcast = (msg: object) => void Lan.broadcast({ data: JSON.stringify(msg) }).catch(() => {})

/** "192.168.43.1:8737" or " 192.168.43.1 " → "192.168.43.1". */
export const cleanAddress = (s: string) => s.trim().replace(/:\d+$/, '')
