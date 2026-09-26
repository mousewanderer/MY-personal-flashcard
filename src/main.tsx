import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initBackButton } from './platform/backButton'
import './styles/global.css'

initBackButton()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
