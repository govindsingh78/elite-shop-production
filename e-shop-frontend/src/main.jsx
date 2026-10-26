import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/common/ErrorBoundary.jsx'
import { startMonitoring } from './components/common/monitor.js'
import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/css/style.scss';

// Crashes and page speed are reported to Admin › Server & health.
startMonitoring();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
