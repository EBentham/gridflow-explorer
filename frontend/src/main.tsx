import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './design/tokens.css'
import './design/base.css'
import './design/shell.css'
import './design/art.css'
import './design/frame.css'
import './design/charts.css'
import './design/catalogue.css'
import App from './App.tsx'
import { loadFonts } from './design/fonts'
import { LatestDaysProvider } from './hooks/LatestDaysProvider'
import { ThemeProvider } from './shell/ThemeProvider'
import { applyTheme, readInitialTheme } from './shell/theme'

loadFonts()
// Before the first render, so a stored or URL-forced theme never flashes the other one.
applyTheme(readInitialTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LatestDaysProvider>
          <App />
        </LatestDaysProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
