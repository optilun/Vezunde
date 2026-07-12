// Resume app flows after Base44 Auth login.
// redirectToLogin(nextUrl) lands on /login?from_url=<nextUrl>. Auth pages use
// these helpers to preserve that destination when moving between login/register.

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];
const REMEMBERED_DESTINATION_KEY = "viasee.auth.remembered_destination";

function sanitizeDestination(raw, fallback = "/dupa-login") {
  if (!raw) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    if (AUTH_PATHS.includes(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function getPostLoginRedirect() {
  const raw = new URLSearchParams(window.location.search).get("from_url");
  return sanitizeDestination(raw);
}

export function buildAuthRoute(pathname) {
  const destination = getPostLoginRedirect();
  return `${pathname}?from_url=${encodeURIComponent(destination)}`;
}

export function buildAuthRouteForCurrentPage(pathname) {
  const destination = sanitizeDestination(window.location.pathname + window.location.search + window.location.hash);
  return `${pathname}?from_url=${encodeURIComponent(destination)}`;
}

export function rememberPostAuthDestination(destination = getPostLoginRedirect()) {
  const safeDestination = sanitizeDestination(destination);
  try {
    window.localStorage.setItem(REMEMBERED_DESTINATION_KEY, safeDestination);
  } catch {
    // Password reset still works; only the return destination may be lost.
  }
  return safeDestination;
}

export function getRememberedPostAuthDestination() {
  try {
    return sanitizeDestination(window.localStorage.getItem(REMEMBERED_DESTINATION_KEY));
  } catch {
    return "/dupa-login";
  }
}

export function consumeRememberedPostAuthDestination() {
  const destination = getRememberedPostAuthDestination();
  try {
    window.localStorage.removeItem(REMEMBERED_DESTINATION_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
  return destination;
}

export function buildAuthRouteFromRemembered(pathname) {
  return `${pathname}?from_url=${encodeURIComponent(getRememberedPostAuthDestination())}`;
}
