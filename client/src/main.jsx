import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/source-sans-3'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './index.css'
import './portal.css'
import './a11y.css'
import App from './App.jsx'
import ConnectionLostDialog from './components/ConnectionLostDialog.jsx'
import ScrollTopButton from './components/ScrollTopButton.jsx'
import SkipLink from './components/SkipLink.jsx'
import VisionBar from './vision/VisionBar.jsx'
import { initVision } from './vision/vision.js'

// режим для слабовидящих применяется до первого рендера, чтобы страница не мигала
initVision()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SkipLink />
    <VisionBar />
    <App />
    <ScrollTopButton />
    <ConnectionLostDialog />
  </StrictMode>,
)
