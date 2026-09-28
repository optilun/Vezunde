import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { NATIONAL_MAP_SNAPSHOT_PATH, nationalMapSnapshotFromResponse } from './shared/nationalMapSnapshot.js'

// Codul unei pagini incepe sa se descarce odata cu scriptul principal, nu abia dupa ce acesta a
// rulat si a ajuns la ruta. Scriptul injectat nu face nimic pe alte adrese (`skipIf` este o conditie
// JavaScript evaluata in browser), iar daca fisierul paginii nu e gasit la build, nu se injecteaza
// nimic.
function preloadRouteChunk(name, pageFile, skipIf) {
  let base = '/'
  return {
    name,
    apply: 'build',
    configResolved(config) {
      base = config.base || '/'
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx && ctx.bundle
        if (!bundle) return html
        const chunks = Object.values(bundle).filter((item) => item.type === 'chunk')
        const page = chunks.find((chunk) => chunk.facadeModuleId && pageFile.test(chunk.facadeModuleId))
        if (!page) return html
        const entries = new Set(chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName))
        const hrefs = [page.fileName, ...(page.imports || [])]
          .filter((file) => !entries.has(file))
          .map((file) => `${base}${file}`)
        const script = `(function(){if(${skipIf})return;${JSON.stringify(hrefs)}.forEach(function(h){var l=document.createElement(\"link\");l.rel=\"modulepreload\";l.crossOrigin=\"\";l.href=h;document.head.appendChild(l)})})();`
        return [{ tag: 'script', children: script, injectTo: 'head-prepend' }]
      },
    },
  }
}

// Pe prima pagina (/), codul home-ului.
function preloadHomeRoute() {
  return preloadRouteChunk('viasee-preload-home-route', /[\\/]src[\\/]pages[\\/]Home\.jsx$/, 'location.pathname!=="/"')
}

// 2026-09-24. Pe un profil (/furnizor/:id), codul paginii de profil. Pe telefon, titlul aparea la
// 3,6-3,9 s: cod principal -> cod profil -> date, pe rand. Datele pornesc si ele devreme, vezi
// src/lib/publicProfilePrefetch.js.
function preloadProfileRoute() {
  return preloadRouteChunk('viasee-preload-profile-route', /[\\/]src[\\/]pages[\\/]ProviderProfile\.jsx$/, '!/^\\/furnizor\\/[^\\/]+\\/?$/.test(location.pathname)')
}

// 2026-09-28 (audit /cauta, B6). La build (Publish), lista publica a hartii Romaniei se scrie intr-un
// fisier static (vezi shared/nationalMapSnapshot.js). Daca lista nu poate fi citita in 20 s, build-ul
// continua fara fisier, iar pagina cere lista ca pana acum. Nu schimba ce contine harta.
const VIASEE_APP_ID = '6a48cb9d04fa7f999d8a8054'
function nationalMapSnapshot() {
  return {
    name: 'viasee-national-map-snapshot',
    apply: 'build',
    async buildStart() {
      if (process.env.VIASEE_SKIP_NATIONAL_MAP_SNAPSHOT === '1') return
      const appId = process.env.VITE_BASE44_APP_ID || VIASEE_APP_ID
      const serverUrl = (process.env.BASE44_SERVER_URL || 'https://base44.app').replace(/\/+$/, '')
      try {
        const response = await fetch(`${serverUrl}/api/apps/${appId}/functions/browseDirectoryProviders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-App-Id': appId },
          body: JSON.stringify({ map_scope: 'national' }),
          signal: AbortSignal.timeout(20_000),
        })
        const body = response.ok ? await response.json() : null
        const snapshot = nationalMapSnapshotFromResponse(body)
        if (!snapshot) {
          this.warn(`Harta Romaniei: fisierul static nu s-a scris (HTTP ${response.status}).`)
          return
        }
        this.emitFile({ type: 'asset', fileName: NATIONAL_MAP_SNAPSHOT_PATH.slice(1), source: JSON.stringify(snapshot) })
        console.log(`Harta Romaniei: ${snapshot.results.length} puncte in ${NATIONAL_MAP_SNAPSHOT_PATH}.`)
      } catch (error) {
        this.warn(`Harta Romaniei: fisierul static nu s-a scris (${error?.message || error}).`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    preloadHomeRoute(),
    preloadProfileRoute(),
    nationalMapSnapshot(),
  ]
});
