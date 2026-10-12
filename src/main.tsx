import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installErrorHandlers } from './utils/rendererErrors';
import { browserStorage, readTheme } from './utils/theme';

installErrorHandlers(window);
try {
  document.documentElement.classList.toggle('dark', readTheme(browserStorage(), window.matchMedia('(prefers-color-scheme: dark)').matches));
} catch { document.documentElement.classList.add('dark'); }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
);
