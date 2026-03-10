import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { TooltipProvider } from './components/ui/tooltip';
import { ThemeProvider } from './context/ThemeContext';
import { LicenseProvider } from './context/SablierContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <LicenseProvider>
        <TooltipProvider delayDuration={400}>
          <App />
        </TooltipProvider>
      </LicenseProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
