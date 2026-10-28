import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Manage Service Worker safely
if ('serviceWorker' in navigator) {
  const isInIframe = window.self !== window.top;

  if (isInIframe) {
    // Inside AI Studio preview iframe: unregister service workers to prevent cache/reload loops
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    }).catch(() => {});
  } else {
    // Normal mobile browser or standalone PWA
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('PWA Service Worker registered:', reg.scope);
        })
        .catch((err) => console.warn('PWA Service Worker registration skipped/failed:', err));
    });
    // NOTE: NEVER add controllerchange -> window.location.reload() here!
  }
}

// Global hard reload utility for mobile devices (manual trigger only)
(window as unknown as { forceUpdateApp: () => Promise<void> }).forceUpdateApp = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }
  } catch (e) {
    console.error('Failed to clear cache:', e);
  }
  const cleanUrl = window.location.origin + window.location.pathname + '?t=' + Date.now();
  window.location.replace(cleanUrl);
};

createRoot(document.getElementById('root')!).render(<App />);
