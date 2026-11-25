import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerServiceWorker } from './utils/registerSW';
import { applyTypographyPrefs, loadTypographyPrefs } from './utils/typography';

applyTypographyPrefs(loadTypographyPrefs());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerServiceWorker();
