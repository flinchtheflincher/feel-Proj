import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PopupApp from './PopupApp'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Popup root element was not found.')
}

createRoot(container).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
)

