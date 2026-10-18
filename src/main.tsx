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
import { detectLang, setLang } from './i18n';

// Downloaded songs play from the device; the service worker makes the app itself work offline.
setUrlResolver(resolveAudioUrl);
registerServiceWorker();

// Load the interface language first so the first paint is already in it (English is built in).
const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
setLang(detectLang(), false).then(render, render);
