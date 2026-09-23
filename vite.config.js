import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Pe prima pagina (/), codul home-ului incepe sa se descarce odata cu scriptul principal, nu abia
// dupa ce acesta a rulat si a ajuns la ruta. Scriptul injectat nu face nimic pe alte pagini, iar
// daca fisierul home-ului nu e gasit la build, nu se injecteaza nimic.
function preloadHomeRoute() {
  let base = '/'
  return {
    name: 'viasee-preload-home-route',
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
        const home = chunks.find((chunk) => chunk.facadeModuleId && /[\\/]src[\\/]pages[\\/]Home\.jsx$/.test(chunk.facadeModuleId))
        if (!home) return html
        const entries = new Set(chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName))
        const hrefs = [home.fileName, ...(home.imports || [])]
          .filter((file) => !entries.has(file))
          .map((file) => `${base}${file}`)
        const script = `(function(){if(location.pathname!=="/")return;${JSON.stringify(hrefs)}.forEach(function(h){var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=h;document.head.appendChild(l)})})();`
        return [{ tag: 'script', children: script, injectTo: 'head-prepend' }]
      },
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
  ]
});
