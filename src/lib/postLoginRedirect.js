// Resume app flows after Base44 Auth login.
// redirectToLogin(nextUrl) lands on /login?from_url=<nextUrl>. Auth pages use
// these helpers to preserve that destination when moving between login/register.

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export function getPostLoginRedirect() {
  const raw = new URLSearchParams(window.location.search).get("from_url");
  if (!raw) return "/dupa-login";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/dupa-login";
    if (AUTH_PATHS.includes(url.pathname)) return "/dupa-login";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/dupa-login";
  }
}

export function buildAuthRoute(pathname) {
  const destination = getPostLoginRedirect();
  return `${pathname}?from_url=${encodeURIComponent(destination)}`;
}

export function buildAuthRouteForCurrentPage(pathname) {
  const destination = window.location.pathname + window.location.search + window.location.hash;
  return `${pathname}?from_url=${encodeURIComponent(destination)}`;
}
