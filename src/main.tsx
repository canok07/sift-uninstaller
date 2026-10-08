import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installErrorHandlers } from './utils/rendererErrors';

installErrorHandlers(window);
try {
  document.documentElement.classList.toggle('dark', localStorage.getItem('sift_theme') !== 'light');
} catch { document.documentElement.classList.add('dark'); }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
);
