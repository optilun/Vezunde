import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  readCookieConsent,
} from "@/lib/cookieConsent";

const MEASUREMENT_ID = "G-YWTE0T07CH";
const SCRIPT_ID = "viasee-google-analytics";
const GA_DISABLE_KEY = `ga-disable-${MEASUREMENT_ID}`;

let scriptPromise = null;
let gtagConfigured = false;

function ensureGtag() {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };
}

function getGoogleConsentState(consent) {
  return {
    analytics_storage: consent?.analytics ? "granted" : "denied",
    ad_storage: consent?.marketing ? "granted" : "denied",
    ad_user_data: consent?.marketing ? "granted" : "denied",
    ad_personalization: consent?.marketing ? "granted" : "denied",
  };
}

function updateGoogleConsent(consent) {
  ensureGtag();
  window.gtag("consent", "update", getGoogleConsentState(consent));
}

function clearAnalyticsCookies() {
  const cookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));

  const hostname = window.location.hostname;
  const registrableDomain = hostname.split(".").slice(-2).join(".");

  cookieNames.forEach((name) => {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${hostname}; SameSite=Lax`;

    if (registrableDomain.includes(".")) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${registrableDomain}; SameSite=Lax`;
    }
  });
}

function configureGtag() {
  if (gtagConfigured) return;

  ensureGtag();
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    send_page_view: false,
  });
  gtagConfigured = true;
}

function loadGoogleAnalytics() {
  if (scriptPromise) return scriptPromise;

  configureGtag();

  const existingScript = document.getElementById(SCRIPT_ID);
  if (existingScript) return Promise.resolve(true);

  scriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      MEASUREMENT_ID,
    )}`;
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener(
      "error",
      () => {
        scriptPromise = null;
        resolve(false);
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export default function GoogleAnalytics() {
  const { pathname, search } = useLocation();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    ensureGtag();
    window[GA_DISABLE_KEY] = true;
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      wait_for_update: 500,
    });

    const applyConsent = async (consent) => {
      const analyticsGranted = Boolean(consent?.analytics);
      window[GA_DISABLE_KEY] = !analyticsGranted;
      updateGoogleConsent(consent);

      if (analyticsGranted) {
        const loaded = await loadGoogleAnalytics();
        window.__viaseeAnalyticsEnabled = loaded;
        setAnalyticsEnabled(loaded);
      } else {
        window.__viaseeAnalyticsEnabled = false;
        setAnalyticsEnabled(false);
        clearAnalyticsCookies();
      }
    };

    void applyConsent(readCookieConsent());

    const onConsentChanged = (event) => {
      void applyConsent(event.detail);
    };

    window.addEventListener(
      COOKIE_CONSENT_CHANGED_EVENT,
      onConsentChanged,
    );

    return () => {
      window.removeEventListener(
        COOKIE_CONSENT_CHANGED_EVENT,
        onConsentChanged,
      );
    };
  }, []);

  useEffect(() => {
    if (!analyticsEnabled || typeof window.gtag !== "function") return undefined;

    const timer = window.setTimeout(() => {
      window.gtag("event", "page_view", {
        page_title: document.title,
        page_location: window.location.href,
        page_path: `${pathname}${search}`,
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [analyticsEnabled, pathname, search]);

  return null;
}
