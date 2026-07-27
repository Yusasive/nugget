import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted Inter (ui-ux.md §3: UI/body typeface for dashboard + POS).
// 400 body, 600 headings/labels: the only two weights the admin surfaces use.
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
// Cormorant Garamond is the display serif (§3). Loaded only for the login
// logo lockup (§7.1), the one staff screen using the guest-site brand palette.
import '@fontsource/cormorant-garamond/600.css';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
