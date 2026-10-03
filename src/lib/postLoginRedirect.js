const RETURN_TO_STORAGE_KEY = "viasee.auth.return_to";
const AUTH_PATHS = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);

// Parametrii de pornire ai aplicatiei (vezi src/lib/app-params.js si src/lib/authReturnTo.js): nu
// au ce cauta intr-o destinatie dupa login, altfel un link construit ar putea suprascrie sesiunea.
const BOOTSTRAP_PARAMS = ["access_token", "clear_access_token", "app_id", "app_base_url", "functions_version", "from_url"];

// 2026-10-03. Verificarea de origine nu era suficienta: `/.//evil.com/x` are aceeasi origine, dar
// devine `//evil.com/x`, adica o adresa pe alt site cand e pusa in window.location.href (redirect
// deschis). Acum calea trebuie sa inceapa cu un singur "/" si sa nu contina backslash - aceeasi
// regula ca safeReturnTo din authReturnTo.js.
export function safeDestination(raw, origin = typeof window === "undefined" ? "" : window.location.origin) {
  if (!raw || !origin) return "";
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return "";
    if (AUTH_PATHS.has(url.pathname)) return "";
    for (const param of BOOTSTRAP_PARAMS) url.searchParams.delete(param);
    const destination = `${url.pathname}${url.search}${url.hash}`;
    if (!destination.startsWith("/") || destination.startsWith("//") || destination.includes("\\")) return "";
    return destination;
  } catch (_error) {
    return "";
  }
}

function readStoredDestination() {
  if (typeof window === "undefined") return "";
  try {
    return safeDestination(window.sessionStorage.getItem(RETURN_TO_STORAGE_KEY));
  } catch (_error) {
    return "";
  }
}

function storeDestination(destination) {
  if (!destination || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RETURN_TO_STORAGE_KEY, destination);
  } catch (_error) {
    // Authentication still works even when session storage is unavailable.
  }
}

export function getPostLoginRedirect() {
  if (typeof window === "undefined") return "/dupa-login";
  const fromQuery = safeDestination(new URLSearchParams(window.location.search).get("from_url"));
  if (fromQuery) {
    storeDestination(fromQuery);
    return fromQuery;
  }
  return readStoredDestination() || "/dupa-login";
}

export function getAuthRoute(path) {
  const destination = getPostLoginRedirect();
  if (!destination || destination === "/dupa-login") return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}from_url=${encodeURIComponent(destination)}`;
}

export function clearPostLoginRedirect() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
  } catch (_error) {
    // No action required.
  }
}
