import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// register the service worker so pRose installs as a PWA and works offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
  // when a new SW takes control (a fresh deploy), reload once to pick up new assets.
  // skip this on the very first install (no controller yet) to avoid a needless reload.
  const hadController = !!navigator.serviceWorker.controller;
  let refreshed = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshed || !hadController) return;
    refreshed = true;
    window.location.reload();
  });
}
