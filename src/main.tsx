import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './jobPortraits.css'
import './battle-results.css'
import './battle-roster.css'
import './mobile-overrides.css'
import { installJobPortraits } from './jobPortraits'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

installJobPortraits()
