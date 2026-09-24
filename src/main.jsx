import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { prefetchProfileForCurrentUrl } from '@/lib/publicProfilePrefetch'
import '@/index.css'
import '@/styles/public-mobile.css'
import '@/styles/provider-location-cards.css'
import '@/styles/provider-location-editor.css'
import '@/styles/provider-profile.css'
import '@/styles/provider-location-modules.css'
import '@/styles/provider-program-flat.css'
import '@/styles/provider-access-redesign.css'
import '@/styles/provider-overview-refinement.css'
import '@/styles/provider-overview-width-fix.css'

// Pe /furnizor/:id, datele profilului se cer in paralel cu codul paginii (vezi fisierul).
prefetchProfileForCurrentUrl()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)