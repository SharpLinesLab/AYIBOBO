import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/fonts.css';
import './styles/app.css';
import './styles/music.css';
import './styles/premium.css';
import './styles/signature.css';
import './styles/features.css';
import { registerServiceWorker, resolveAudioUrl } from './offline';
import { setUrlResolver } from './player/engine';

// Downloaded songs play from the device; the service worker makes the app itself work offline.
setUrlResolver(resolveAudioUrl);
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
