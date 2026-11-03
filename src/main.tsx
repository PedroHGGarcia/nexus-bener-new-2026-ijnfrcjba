/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'

// @skip-protected: Do not remove. Required for React rendering.
import { registerServiceWorker } from './lib/register-sw'

registerServiceWorker()

if ('serviceWorker' in navigator) {
  const refreshed = sessionStorage.getItem('sw-refreshed')
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshed) return
    sessionStorage.setItem('sw-refreshed', '1')
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(<App />)
