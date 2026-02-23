import { createRoot } from 'react-dom/client'
import MiniContextApp from './MiniContextApp'
import { DEFAULT_AUTO_OPEN, STORAGE_KEYS } from '../shared/constants'

const HOST_ID = 'mini-context-extension-root'

const readAutoOpenSetting = async (): Promise<boolean> =>
  new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEYS.AUTO_OPEN], (result: Record<string, unknown>) => {
      const autoOpenValue = result[STORAGE_KEYS.AUTO_OPEN]
      resolve(typeof autoOpenValue === 'boolean' ? autoOpenValue : DEFAULT_AUTO_OPEN)
    })
  })

const mountMiniContext = async (): Promise<void> => {
  if (window.top !== window || document.getElementById(HOST_ID)) {
    return
  }

  const host = document.createElement('div')
  host.id = HOST_ID
  document.documentElement.appendChild(host)

  const shadowRoot = host.attachShadow({ mode: 'open' })
  const rootContainer = document.createElement('div')
  shadowRoot.appendChild(rootContainer)

  const initiallyOpen = await readAutoOpenSetting()
  createRoot(rootContainer).render(<MiniContextApp initiallyOpen={initiallyOpen} />)
}

void mountMiniContext()

