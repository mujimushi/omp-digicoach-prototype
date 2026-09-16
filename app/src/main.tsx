import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { captureInstallPrompt } from './install/install-prompt.ts';
import { routes } from './router.tsx';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('index.html has no #root element');

captureInstallPrompt();
const router = createBrowserRouter(routes);

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
