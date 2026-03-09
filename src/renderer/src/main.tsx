import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { TooltipProvider } from './components/ui/tooltip'
import { ThemeProvider } from './context/ThemeContext'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <TooltipProvider delayDuration={400}>
        <App />
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>
)
