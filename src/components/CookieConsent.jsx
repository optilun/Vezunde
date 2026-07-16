import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  saveCookieConsent,
} from "@/lib/cookieConsent";

function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-7 w-12 flex-none items-center rounded-full border transition-colors ${
        checked ? "border-[#171717] bg-[#171717]" : "border-[#aaa49b] bg-[#e6dfd5]"
      } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      >
        {checked ? <Check className="h-3 w-3 text-[#171717]" aria-hidden="true" /> : null}
      </span>
    </button>
  );
}

function PreferenceRow({ title, description, checked, onChange, required = false }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-5 border-t border-[#d7d0c5] py-5 first:border-t-0">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-[#171717]">{title}</h3>
          {required ? (
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-[#6d6962]">
              Mereu active
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm leading-6 text-[#625e57]">{description}</p>
      </div>
      <Toggle
        checked={checked}
        onChange={onChange}
        disabled={required}
        label={`${title}: ${checked ? "activ" : "inactiv"}`}
      />
    </div>
  );
}

export default function CookieConsent() {
  const [storedConsent, setStoredConsent] = useState(undefined);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const dialogTitleRef = useRef(null);

  useEffect(() => {
    const stored = readCookieConsent();
    setStoredConsent(stored);
    setAnalytics(Boolean(stored?.analytics));
    setMarketing(Boolean(stored?.marketing));
  }, []);

  useEffect(() => {
    const openPreferences = () => {
      const current = readCookieConsent();
      setAnalytics(Boolean(current?.analytics));
      setMarketing(Boolean(current?.marketing));
      setPreferencesOpen(true);
    };

    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openPreferences);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openPreferences);
  }, []);

  useEffect(() => {
    if (!preferencesOpen) return undefined;

    dialogTitleRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") setPreferencesOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preferencesOpen]);

  const applyConsent = (nextAnalytics, nextMarketing) => {
    const saved = saveCookieConsent({
      analytics: nextAnalytics,
      marketing: nextMarketing,
    });
    setStoredConsent(saved);
    setAnalytics(saved.analytics);
    setMarketing(saved.marketing);
    setPreferencesOpen(false);
  };

  if (storedConsent === undefined) return null;

  return (
    <>
      {!storedConsent && !preferencesOpen ? (
        <section
          aria-label="Preferințe cookies"
          className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-[920px] border border-[#171717] bg-[#f8f4ec] shadow-[0_14px_50px_rgba(23,23,23,0.18)] sm:inset-x-5 sm:bottom-5"
        >
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-center">
            <div>
              <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#6d6962]">
                Confidențialitate
              </p>
              <h2 className="mt-2 font-heading text-lg font-bold tracking-[-0.025em] text-[#171717] sm:text-xl">
                Tu alegi ce date opționale folosim.
              </h2>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#625e57]">
                Folosim elementele necesare pentru funcționarea platformei. Analiza utilizării și marketingul rămân oprite până când le accepți.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                <Link to="/cookies" className="font-semibold text-[#171717] underline underline-offset-4">
                  Politica de cookies
                </Link>
                <Link to="/confidentialitate" className="font-semibold text-[#171717] underline underline-offset-4">
                  Confidențialitate
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:w-[19rem]">
              <button
                type="button"
                onClick={() => applyConsent(false, false)}
                className="min-h-11 rounded-full border border-[#171717] px-4 text-sm font-semibold text-[#171717] transition-colors hover:bg-[#ebe4d9]"
              >
                Doar necesare
              </button>
              <button
                type="button"
                onClick={() => applyConsent(true, true)}
                className="min-h-11 rounded-full bg-[#171717] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2b2b2b]"
              >
                Acceptă toate
              </button>
              <button
                type="button"
                onClick={() => setPreferencesOpen(true)}
                className="col-span-2 min-h-11 rounded-full border border-[#171717] px-5 text-sm font-semibold text-[#171717] transition-colors hover:bg-[#ebe4d9]"
              >
                Configurează preferințele
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {preferencesOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-5">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-preferences-title"
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto border-2 border-[#171717] bg-[#f8f4ec] shadow-2xl sm:max-h-[86dvh]"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b-2 border-[#171717] bg-[#f8f4ec] p-5 sm:p-6">
              <div>
                <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#6d6962]">
                  Setări cookies
                </p>
                <h2
                  id="cookie-preferences-title"
                  ref={dialogTitleRef}
                  tabIndex={-1}
                  className="mt-2 font-heading text-2xl font-bold tracking-[-0.03em] text-[#171717] outline-none"
                >
                  Preferințele tale
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreferencesOpen(false)}
                className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full border border-[#171717]"
                aria-label="Închide setările"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <p className="text-sm leading-6 text-[#625e57]">
                Poți schimba această alegere oricând din linkul „Setări cookies” din footer.
              </p>
              <div className="mt-5 border-y-2 border-[#171717]">
                <PreferenceRow
                  title="Necesare"
                  description="Autentificare, securitate, preferințe esențiale și funcționarea serviciilor solicitate."
                  checked
                  required
                />
                <PreferenceRow
                  title="Analiză"
                  description="Ne ajută să înțelegem agregat cum este utilizată platforma. Google Analytics nu este încă activ și nu va porni fără acord."
                  checked={analytics}
                  onChange={setAnalytics}
                />
                <PreferenceRow
                  title="Marketing"
                  description="Măsurarea campaniilor și afișarea mesajelor relevante. Meta Pixel nu este încă activ și nu va porni fără acord."
                  checked={marketing}
                  onChange={setMarketing}
                />
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => applyConsent(false, false)}
                  className="min-h-11 rounded-full border border-[#171717] px-5 text-sm font-semibold"
                >
                  Doar necesare
                </button>
                <button
                  type="button"
                  onClick={() => applyConsent(analytics, marketing)}
                  className="min-h-11 rounded-full bg-[#171717] px-6 text-sm font-semibold text-white"
                >
                  Salvează preferințele
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
