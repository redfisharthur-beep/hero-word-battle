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
import './unified-mobile-layout.css'
import './comfort-ui.css'
import './hard-layout-fix.css'
import './result-polish.css'
import App from './App'
import { installRuleViewer } from './rule-viewer'
import { installComfortUi } from './comfort-ui'
import { installLineLoginFeedback } from './line-login-feedback'
import { installGameAudio } from './audio-manager'

installLineLoginFeedback()
installRuleViewer()
installComfortUi()
installGameAudio()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
