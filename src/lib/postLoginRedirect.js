const RETURN_TO_STORAGE_KEY = "viasee.auth.return_to";
const AUTH_PATHS = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);

function safeDestination(raw) {
  if (!raw || typeof window === "undefined") return "";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "";
    if (AUTH_PATHS.has(url.pathname)) return "";
    return `${url.pathname}${url.search}${url.hash}`;
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
