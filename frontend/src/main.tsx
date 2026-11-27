import '@fontsource-variable/fredoka'
import '@fontsource-variable/nunito'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { isDevPreview } from './lib/devPreview.ts'
import { bootstrap } from './state/flow.ts'
import './styles/base.css'
import './styles/hud.css'
import './styles/panel.css'
import './styles/camera.css'
import './styles/interior.css'

async function start() {
  let Root = App
  if ((import.meta.env.DEV || import.meta.env.VITE_DEV_PREVIEW === 'true') && isDevPreview()) {
    const preview = await import('./dev/DevPreview.tsx')
    const { initializePreview } = await import('./dev/state.ts')
    initializePreview()
    Root = preview.default
  } else {
    // Vorschauen starten bewusst ohne das Laden echter Fortschritte oder Serverdaten.
    bootstrap()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
}

void start()
