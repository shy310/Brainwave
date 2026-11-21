import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { I18nProvider } from './i18n';
import { ConfirmHost } from './ui/Confirm';
import { ThemeProvider } from './app/ThemeProvider';
import { AuthProvider } from './features/auth/AuthProvider';
import { ErrorBoundary } from './app/ErrorBoundary';
import './styles.css';
import { registerServiceWorker } from './features/schedule/webPush';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <ErrorBoundary>
          <AuthProvider>
            <RouterProvider router={router} />
            <ConfirmHost />
          </AuthProvider>
        </ErrorBoundary>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
