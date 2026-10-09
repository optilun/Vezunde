import React, { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";

// 2026-10-09 (audit Top 3, T1; Alex: „1 + 2 + 3 întâi”). Până acum nicio locație nu putea porni
// primirea cererilor, deci nicio cerere nu ajungea la cineva. Comutatorul pornește sau oprește
// primirea; lista de sub el arată ce mai lipsește ca cererile să ajungă efectiv aici.
function result(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export default function ProviderRequestIntakeSwitch({ locationId, onChange }) {
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setState(null); setLoadError(""); setMessage(""); setError("");
    base44.functions.invoke("providerRequestIntakeOps", { action: "get", location_id: locationId })
      .then(result)
      .then((data) => { if (active) setState(data); })
      .catch((requestError) => { if (active) setLoadError(requestError.message || "Starea primirii cererilor nu a putut fi încărcată."); });
    return () => { active = false; };
  }, [locationId]);

  const toggle = async (enabled) => {
    if (saving || !state?.can_manage) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const data = result(await base44.functions.invoke("providerRequestIntakeOps", { action: "set", location_id: locationId, enabled }));
      setState(data);
      setMessage(enabled ? "Primirea cererilor este pornită." : "Primirea cererilor este oprită. Cererile noi nu mai ajung la această locație.");
      onChange?.({ request_intake_status: data.request_intake_status, accepts_patients_directly: data.accepts_patients_directly });
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || "Schimbarea nu a putut fi salvată. Încearcă din nou.");
    } finally {
      setSaving(false);
    }
  };

  if (!state) {
    return (
      <section className="rounded-xl border border-border bg-white p-4 text-sm">
        <p className="font-semibold">Primesc cereri de la clienți</p>
        <p role="status" className="mt-1 text-muted-foreground">{loadError || "Se verifică starea…"}</p>
      </section>
    );
  }

  const items = state.readiness?.items || [];
  const missing = items.filter((item) => !item.ok && item.key !== "intake");
  return (
    <section aria-labelledby="request-intake-title" className="rounded-xl border border-border bg-white p-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id="request-intake-title" className="font-semibold">Primesc cereri de la clienți</h3>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Când e pornit, cererile clienților potrivite pentru această locație ajung în Cereri. Pe Free vezi un rezumat anonim; pe Pro, în Top 3, vezi și detaliile.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {saving && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            id="request-intake-switch"
            checked={state.enabled === true}
            onCheckedChange={toggle}
            disabled={saving || !state.can_manage}
            aria-label="Primesc cereri de la clienți"
          />
        </div>
      </div>

      {!state.can_manage && (
        <p className="mt-2 text-xs text-muted-foreground">Doar proprietarul sau managerul locației poate schimba această setare.</p>
      )}

      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.key} className={`flex items-start gap-2 text-xs ${item.ok ? "text-foreground" : "text-muted-foreground"}`}>
            {item.ok
              ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4d6b45]" />
              : <CircleDashed aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      {state.enabled && missing.length > 0 && (
        <p className="mt-3 rounded-lg bg-[#fbf3df] px-3 py-2 text-xs text-[#5c4a1f]">
          Primirea e pornită, dar cererile ajung aici doar când toate condițiile de mai sus sunt îndeplinite.
        </p>
      )}
      {message && <p role="status" className="mt-3 text-xs font-medium text-foreground">{message}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    </section>
  );
}
