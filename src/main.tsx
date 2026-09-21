import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silently suppress benign development/production WebSocket and HMR proxy connection alerts
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || '');
    if (
      reason.includes('WebSocket') || 
      reason.includes('ws://') || 
      reason.includes('wss://') || 
      reason.includes('vite') ||
      reason.includes('HMR')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('WebSocket') || 
      msg.includes('ws://') || 
      msg.includes('wss://') || 
      msg.includes('vite') ||
      msg.includes('HMR')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
