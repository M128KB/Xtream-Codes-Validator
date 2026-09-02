import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { setupGlobalFetchInterceptor } from './utils/fingerprint';

// Initialize transparent header injection for unique per-user SQLite database isolation
setupGlobalFetchInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

