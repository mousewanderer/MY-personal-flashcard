import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { useEffect } from 'react'
import { Icon } from './components/Icon'
import { MiniPlayer } from './components/MiniPlayer'
import { APP_NAME } from './config'
import { useSettings } from './db/hooks'
import { ensureFirstRun } from './db/repo'
import { initMusic } from './music/player'
import DocPage from './pages/DocPage'
import DocsPage from './pages/DocsPage'
import MySets from './pages/MySets'
import ProfilePage from './pages/ProfilePage'
import SetPage from './pages/SetPage'
import SettingsPage from './pages/SettingsPage'
import StudyPage from './pages/StudyPage'
import { useRoute } from './router'
import type { Direction } from './types'

const DIRECTIONS: Direction[] = ['front-back', 'back-front', 'mixed']

export default function App() {
  const { theme } = useSettings()
  const { parts, query } = useRoute()

  useEffect(() => {
    void ensureFirstRun()
    void initMusic()
    document.title = APP_NAME
  }, [])

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.dataset.theme = theme
    if (Capacitor.isNativePlatform()) {
      // Status bar icons: light on the dark theme, dark on the light theme.
      const style = theme === 'dark' ? SystemBarsStyle.Dark : theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Default
      void SystemBars.setStyle({ style })
    }
  }, [theme])

  const [section, a, b] = parts
  if (section === 'study' && a && b) {
    const dir = query.get('dir') as Direction
    const starredOnly = query.get('starred') === '1'
    return (
      <StudyPage
        key={`${a}/${b}/${query.toString()}`}
        setId={a}
        modeId={b}
        direction={DIRECTIONS.includes(dir) ? dir : 'front-back'}
        shuffle={query.get('shuffle') !== '0'}
        starredOnly={starredOnly}
      />
    )
  }

  let page
  if (section === 'set' && a) page = <SetPage key={a} id={a} />
  else if (section === 'settings') page = <SettingsPage />
  else if (section === 'profile') page = <ProfilePage />
  else if (section === 'docs') page = <DocsPage />
  else if (section === 'doc' && a) page = <DocPage key={a} id={a} />
  else page = <MySets />

  const tab = section === 'doc' ? 'docs' : ['docs', 'profile', 'settings'].includes(section) ? section : 'sets'
  return (
    <div className="app">
      <nav className="nav" aria-label="Main">
        <span className="brand">{APP_NAME}</span>
        <a className={tab === 'sets' ? 'nav-link is-active' : 'nav-link'} href="#/">
          <Icon name="sets" />
          <span>Sets</span>
        </a>
        <a className={tab === 'docs' ? 'nav-link is-active' : 'nav-link'} href="#/docs">
          <Icon name="doc" />
          <span>Docs</span>
        </a>
        <a className={tab === 'profile' ? 'nav-link is-active' : 'nav-link'} href="#/profile">
          <Icon name="profile" />
          <span>Profile</span>
        </a>
        <a className={tab === 'settings' ? 'nav-link is-active' : 'nav-link'} href="#/settings">
          <Icon name="settings" />
          <span>Settings</span>
        </a>
        <MiniPlayer />
      </nav>
      <main className="main">{page}</main>
    </div>
  )
}
