import { createRoot } from 'react-dom/client'
import MiniContextApp from './MiniContextApp'
import tailwindStyles from '../compiled.css?inline'

const HOST_ID = 'mini-context-extension-root'

const mountMiniContext = async (): Promise<void> => {
  if (window.top !== window) return;

  const existing = document.getElementById(HOST_ID);
  if (existing) return;

  try {
    console.log('[MiniSide] Starting mount process...');
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.position = 'fixed'; // Ensure it's visible
    host.style.bottom = '0';
    host.style.right = '0';
    host.style.zIndex = '2147483647';
    
    document.body.appendChild(host);

    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styleTag = document.createElement('style');
    styleTag.textContent = typeof tailwindStyles === 'string' ? tailwindStyles : (tailwindStyles as { default?: string }).default || '';
    shadowRoot.appendChild(styleTag);
    
    const rootContainer = document.createElement('div');
    shadowRoot.appendChild(rootContainer);

    console.log('[MiniSide] Rendering React app...');
    createRoot(rootContainer).render(<MiniContextApp />);
    console.log('[MiniSide] Mount complete.');
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

