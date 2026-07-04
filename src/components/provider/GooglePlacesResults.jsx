import React, { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";

const QUOTA_MSG = "Momentan nu putem cauta pe Google Maps. Poti adauga locatia manual.";

export default function GooglePlacesResults({ query, onExisting, onSimilar, onDraft }) {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(null);
  const [error, setError] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const tokenRef = useRef(crypto.randomUUID());
  const cacheRef = useRef(new Map());
  const reqRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setPredictions([]);
      tokenRef.current = crypto.randomUUID(); // new session after cleared search
      return;
    }
    const cached = cacheRef.current.get(q.toLowerCase());
    if (cached) { setPredictions(cached); return; }
    const reqId = ++reqRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await base44.functions
        .invoke("placesAutocomplete", { input: q, session_token: tokenRef.current, context: "specialist_onboarding" })
        .catch((e) => ({ authRequired: e.response?.status === 401, data: { error: e.response?.data?.error || QUOTA_MSG } }));
      if (reqId !== reqRef.current) return; // stale response — ignore
      setLoading(false);
      if (res.authRequired) { setNeedsAuth(true); setPredictions([]); return; }
      if (res.data?.error) { setError(res.data.error); setPredictions([]); return; }
      setError("");
      const preds = res.data?.predictions || [];
      cacheRef.current.set(q.toLowerCase(), preds);
      setPredictions(preds);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const select = async (pred) => {
    setSelecting(pred.place_id);
    setError("");
    const res = await base44.functions
      .invoke("placesDetails", { place_id: pred.place_id, session_token: tokenRef.current, context: "specialist_onboarding" })
      .catch((e) => ({ authRequired: e.response?.status === 401, data: { error: e.response?.data?.error || QUOTA_MSG } }));
    tokenRef.current = crypto.randomUUID(); // new session after a selection
    setSelecting(null);
    if (res.authRequired) { setNeedsAuth(true); return; }
    if (res.data?.error) { setError(res.data.error); return; }
    if (res.data?.existing_location) onExisting(res.data.existing_location);
    else if (res.data?.similar_location) onSimilar({ location: res.data.similar_location, draft: res.data.draft });
    else if (res.data?.draft) onDraft(res.data.draft);
  };

  return (
    <div className="mt-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        Gasit pe Google Maps
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      </div>
      <div className="mt-2 space-y-2">
        {predictions.map((pred) => (
          <button
            key={pred.place_id}
            type="button"
            onClick={() => select(pred)}
            disabled={!!selecting}
            className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/40 transition-colors disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  {pred.main_text}
                </div>
                {pred.secondary_text && (
                  <div className="text-xs text-muted-foreground mt-0.5">{pred.secondary_text}</div>
                )}
              </div>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-secondary px-2 py-1 text-muted-foreground">
                Google Maps
              </span>
            </div>
            {selecting === pred.place_id && (
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Se preiau datele...
              </div>
            )}
          </button>
        ))}
        {!loading && predictions.length === 0 && !error && !needsAuth && (
          <p className="text-sm text-muted-foreground">Nicio locatie gasita pe Google Maps.</p>
        )}
        {needsAuth && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="text-muted-foreground">Cautarea pe Google Maps este disponibila doar dupa autentificare, in fluxul de inscriere. Poti continua si manual, fara Google.</p>
            <button
              type="button"
              onClick={() => base44.auth.redirectToLogin(window.location.href)}
              className="mt-3 px-4 py-2 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: "#171717" }}
            >
              Autentifica-te
            </button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}