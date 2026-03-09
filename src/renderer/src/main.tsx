import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { TooltipProvider } from './components/ui/tooltip'
import { ThemeProvider } from './context/ThemeContext'
import { SablierProvider } from './context/SablierContext'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <SablierProvider>
        <TooltipProvider delayDuration={400}>
          <App />
        </TooltipProvider>
      </SablierProvider>
    </ThemeProvider>
  </React.StrictMode>
)
