import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import './job-images.css'
import './home-fixes.css'
import './battle-layout.css'
import './battle-results.css'
import './battle-refinements.css'
import './mobile-overrides.css'
import './final-ui.css'
import './stability.css'
import App from './App'
import { installRuleViewer } from './rule-viewer'

installRuleViewer()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
