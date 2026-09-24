import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
  ]
});
