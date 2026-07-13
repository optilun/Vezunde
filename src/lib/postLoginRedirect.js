// Module 3H.1B.2 — resume provider flows after Base44 Auth login.
// redirectToLogin(nextUrl) lands on /login?from_url=<nextUrl>. Auth pages use
// this helper to return to the originating flow instead of always /dupa-login.
// Only same-origin destinations are accepted (fail closed to /dupa-login,
// which keeps admin -> admin workspace and normal users -> account workspace).
export function getPostLoginRedirect() {
  const raw = new URLSearchParams(window.location.search).get("from_url");
  if (!raw) return "/dupa-login";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/dupa-login";
    // Never bounce back into the auth pages themselves.
    if (["/login", "/register", "/forgot-password", "/reset-password"].includes(url.pathname)) return "/dupa-login";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/dupa-login";
  }
}