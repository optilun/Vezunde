import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, HelpCircle, Inbox, Loader2, LockKeyhole, MapPin, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const FILTERS = [
  { key: "all", label: "Toate" },
  { key: "new", label: "Noi" },
  { key: "viewed", label: "Văzute" },
  { key: "interested", label: "Putem ajuta" },
  { key: "needs_details", label: "Detalii necesare" },
];

const RESPONSE_OPTIONS = [
  { key: "can_help", label: "Putem ajuta", icon: CheckCircle2 },
  { key: "needs_details", label: "Avem nevoie de detalii", icon: HelpCircle },
  { key: "cannot_help", label: "Nu putem ajuta", icon: XCircle },
];

const FREE_ENTITLEMENT = Object.freeze({ plan_code: "free", status: "free", feature_keys: [] });

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw Object.assign(new Error(data.error), { status: response?.status || 0 });
  return data;
}

function formatDate(value) {
  if (!value) return "Dată indisponibilă";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Dată indisponibilă";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function serviceLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function LeadCard({ lead, response, canRespond, onMarkViewed, onRespond, marking, responding }) {
  const services = lead.matched_service_keys?.length ? lead.matched_service_keys : lead.service_keys;
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-[0_12px_36px_rgba(23,23,23,0.035)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-base font-extrabold tracking-tight text-foreground">
              {lead.intent_label || "Cerere client"}
            </h3>
            {lead.status === "new" && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">Nou</span>
            )}
            {response?.response_label && (
              <span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-bold text-background">{response.response_label}</span>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {lead.preview_summary || "Rezumatul cererii nu este disponibil."}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" /> {formatDate(lead.created_date)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(services || []).slice(0, 5).map((service) => (
          <span key={service} className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-semibold text-foreground">
            {serviceLabel(service)}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <span className="inline-flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {[lead.city, lead.county].filter(Boolean).join(", ") || "Localitate indisponibilă"}
        </span>
        <span>{lead.for_whom === "copil" ? "Pentru copil" : "Pentru adult"}</span>
      </div>

      {canRespond && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-bold text-foreground">Răspunsul locației</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {RESPONSE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = response?.response_type === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onRespond(lead.id, option.key)}
                  disabled={responding}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors disabled:opacity-60 ${selected ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-secondary"}`}
                >
                  {responding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Acesta este un răspuns structurat. Nu trimite date de contact și nu deschide conversația.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="h-3.5 w-3.5" /> Contactul și conversația sunt blocate
        </span>
        {lead.status === "new" && !response && (
          <button
            type="button"
            onClick={() => onMarkViewed(lead.id)}
            disabled={marking}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
          >
            {marking ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Marchează ca văzut
          </button>
        )}
      </div>
    </article>
  );
}

export default function ProviderLeadInbox({ locationId, location }) {
  const [data, setData] = useState(null);
  const [entitlement, setEntitlement] = useState(FREE_ENTITLEMENT);
  const [responsesByLead, setResponsesByLead] = useState({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState("");
  const [respondingId, setRespondingId] = useState("");

  const canRespond = entitlement?.plan_code === "pro"
    && entitlement?.feature_keys?.includes("provider_leads.respond");

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      const inboxResponse = await base44.functions.invoke("providerLeadInboxOps", {
        action: "list",
        location_id: locationId,
        status: filter === "all" ? "" : filter,
        limit: 100,
      });
      const inboxData = responseData(inboxResponse);
      setData(inboxData);

      let resolvedEntitlement = FREE_ENTITLEMENT;
      try {
        const entitlementResponse = await base44.functions.invoke("getProviderEntitlement", { location_id: locationId });
        resolvedEntitlement = responseData(entitlementResponse).entitlement || FREE_ENTITLEMENT;
      } catch (_entitlementError) {
        resolvedEntitlement = FREE_ENTITLEMENT;
      }
      setEntitlement(resolvedEntitlement);

      if (resolvedEntitlement.plan_code === "pro" && resolvedEntitlement.feature_keys?.includes("provider_leads.respond")) {
        const responsesResponse = await base44.functions.invoke("providerLeadResponseOps", {
          action: "list",
          location_id: locationId,
        });
        const responseRows = responseData(responsesResponse).responses || [];
        setResponsesByLead(Object.fromEntries(responseRows.map((row) => [row.lead_id, row])));
      } else {
        setResponsesByLead({});
      }
    } catch (loadError) {
      setError(loadError?.message || "Leadurile nu au putut fi încărcate.");
    } finally {
      setLoading(false);
    }
  }, [filter, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markViewed = async (leadId) => {
    setMarkingId(leadId);
    setError("");
    try {
      const response = await base44.functions.invoke("providerLeadInboxOps", {
        action: "mark_viewed",
        location_id: locationId,
        lead_id: leadId,
      });
      const updated = responseData(response).lead;
      setData((current) => {
        if (!current) return current;
        const leads = current.leads
          .map((lead) => (lead.id === updated.id ? updated : lead))
          .filter((lead) => filter === "all" || lead.status === filter);
        return {
          ...current,
          leads,
          counters: {
            ...current.counters,
            new: Math.max(0, Number(current.counters?.new || 0) - 1),
            viewed: Number(current.counters?.viewed || 0) + 1,
          },
        };
      });
    } catch (markError) {
      setError(markError?.message || "Leadul nu a putut fi actualizat.");
    } finally {
      setMarkingId("");
    }
  };

  const submitResponse = async (leadId, responseType) => {
    setRespondingId(leadId);
    setError("");
    try {
      const response = await base44.functions.invoke("providerLeadResponseOps", {
        action: "submit",
        location_id: locationId,
        lead_id: leadId,
        response_type: responseType,
      });
      const result = responseData(response);
      setResponsesByLead((current) => ({ ...current, [leadId]: result.response }));
      setData((current) => current ? {
        ...current,
        leads: current.leads
          .map((lead) => (lead.id === leadId ? { ...lead, status: result.lead_status } : lead))
          .filter((lead) => filter === "all" || lead.status === filter),
      } : current);
    } catch (responseError) {
      setError(responseError?.message || "Răspunsul nu a putut fi salvat.");
    } finally {
      setRespondingId("");
    }
  };

  const locationName = data?.location?.name || location?.public_display_name || location?.name || "Locația selectată";
  const leads = useMemo(() => data?.leads || [], [data?.leads]);

  return (
    <section className="space-y-6">
      <header className="rounded-[22px] border border-foreground/10 bg-card p-6 shadow-[0_14px_40px_rgba(23,23,23,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <Inbox className="h-4 w-4" /> Inbox furnizor
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">Leaduri</h1>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${entitlement?.plan_code === "pro" ? "bg-foreground text-background" : "bg-secondary text-foreground"}`}>
                Plan {entitlement?.plan_code === "pro" ? "Pro" : "Free"}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Cereri relevante pentru {locationName}. Datele de contact rămân ascunse până la acordul separat al clientului.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizează
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">Leaduri noi</p><p className="mt-1 text-2xl font-extrabold text-foreground">{data?.counters?.new || 0}</p></div>
        <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">Active</p><p className="mt-1 text-2xl font-extrabold text-foreground">{data?.counters?.active || 0}</p></div>
        <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">Total disponibile</p><p className="mt-1 text-2xl font-extrabold text-foreground">{data?.counters?.total || 0}</p></div>
      </div>

      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-foreground">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p><strong>Date protejate.</strong> Numele, emailul, telefonul, mesajul original și conversația nu sunt incluse în acest inbox.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${filter === item.key ? "bg-foreground text-background" : "border border-border bg-card text-foreground hover:bg-secondary"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă leadurile...
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 font-heading text-lg font-extrabold text-foreground">Nu există leaduri în această categorie</h2>
          <p className="mt-2 text-sm text-muted-foreground">Leadurile eligibile vor apărea aici după acordul clientului.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              response={responsesByLead[lead.id] || null}
              canRespond={canRespond}
              onMarkViewed={markViewed}
              onRespond={submitResponse}
              marking={markingId === lead.id}
              responding={respondingId === lead.id}
            />
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-secondary/35 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {canRespond ? "Răspunsurile structurate sunt active" : "Răspunsurile sunt disponibile în planul Pro"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Chatul, mesajele libere și accesul la datele de contact vor fi adăugate separat și vor necesita în continuare acordul clientului.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
