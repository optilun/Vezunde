export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_KEY = "viasee_cookie_consent_v1";
export const OPEN_COOKIE_SETTINGS_EVENT = "viasee:open-cookie-settings";
export const COOKIE_CONSENT_CHANGED_EVENT = "viasee:cookie-consent-changed";

export function readCookieConsent() {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (parsed?.version !== COOKIE_CONSENT_VERSION) return null;

    return {
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return null;
  }
}

export function saveCookieConsent({ analytics, marketing }) {
  const consent = {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    analytics: Boolean(analytics),
    marketing: Boolean(marketing),
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // The preference still applies for the current page when storage is unavailable.
  }

  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: consent }),
  );

  return consent;
}

export function openCookieSettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
  }
}

