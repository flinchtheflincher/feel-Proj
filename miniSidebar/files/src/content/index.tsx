import { createRoot } from 'react-dom/client'
import MiniContextApp from './MiniContextApp'
import { DEFAULT_AUTO_OPEN, STORAGE_KEYS } from '../shared/constants'
import tailwindStyles from '../compiled.css'

const HOST_ID = 'mini-context-extension-root'

const readAutoOpenSetting = async (): Promise<boolean> =>
  new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEYS.AUTO_OPEN], (result: Record<string, unknown>) => {
      const autoOpenValue = result[STORAGE_KEYS.AUTO_OPEN]
      resolve(typeof autoOpenValue === 'boolean' ? autoOpenValue : DEFAULT_AUTO_OPEN)
    })
  })

const mountMiniContext = async (): Promise<void> => {
  if (window.top !== window) return;
  
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    // If it exists but was somehow hidden, force it open
    return;
  }

  try {
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.position = 'static';
    host.style.display = 'block';
    
    // Inject at the very end of the document to be the last thing hydrated/processed
    document.documentElement.appendChild(host);

    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styleTag = document.createElement('style');
    styleTag.textContent = tailwindStyles;
    shadowRoot.appendChild(styleTag);
    
    const rootContainer = document.createElement('div');
    shadowRoot.appendChild(rootContainer);

    const initiallyOpen = await readAutoOpenSetting();
    console.log('[MiniSide] Mounting...', { initiallyOpen });
    createRoot(rootContainer).render(<MiniContextApp initiallyOpen={initiallyOpen} />);
  } catch (err) {
    console.error('[MiniSide] Mount failed:', err);
  }
}

// Aggressive persistence: Watch for deletion and re-mount
const setupPersistence = () => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const removed = Array.from(mutation.removedNodes).some(
          (node) => (node as HTMLElement).id === HOST_ID
        );
        if (removed) {
          console.warn('[MiniSide] Extension was removed from DOM! Re-injecting...');
          void mountMiniContext();
        }
      }
    }
  });

  observer.observe(document.documentElement, { childList: true });
};

// Initial mount
void mountMiniContext();
setupPersistence();

