export function trackAnalyticsEvent(eventName, parameters = {}) {
  if (
    typeof window === "undefined" ||
    window.__viaseeAnalyticsEnabled !== true ||
    typeof window.gtag !== "function" ||
    !eventName
  ) {
    return;
  }

  window.gtag("event", eventName, parameters);
}
