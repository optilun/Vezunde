import React, { useEffect, useState } from "react";
import { ExternalLink, Globe2, MapPin, Phone, Save, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { buildGoogleMapsEmbedUrl, buildGoogleMapsUrl, hasMapLocation } from "@/lib/maps";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/50";
const QUICK_FIELDS = [
  ["public_description", "Descriere publica", "textarea", "Spune pe scurt ce oferi, cui te adresezi si ce te diferentiaza."],
  ["public_phone", "Telefon public", "text", "Numar afisat pacientilor/clientilor pe profil."],
  ["public_email", "Email public", "text", "Email public pentru contact."],
  ["website_url", "Website", "text", "Exemplu: https://site.ro"],
  ["facebook_url", "Facebook", "text", "Link catre pagina oficiala."],
  ["instagram_url", "Instagram", "text", "Link catre profilul oficial."],
  ["linkedin_url", "LinkedIn", "text", "Optional, util mai ales pentru B2B."],
];

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PublicStatusItem({ label, value, empty = "Nepublicat" }) {
  const hasValue = Boolean(String(value || "").trim());
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${hasValue ? "text-foreground" : "text-muted-foreground"}`}>{hasValue ? value : empty}</span>
    </div>
  );
}

export default function ProviderProfilePublic({ locationId, overview, onRefresh }) {
  const pv = overview.public_preview || {};
  const loc = overview.location || {};
  const mapLocation = {
    name: pv.display_name || loc.name,
    address: pv.address,
    city: pv.city || loc.city,
    county: pv.county || loc.county,
    locality_name: pv.city || loc.locality_name,
    county_name: pv.county || loc.county_name,
  };
  const mapsUrl = buildGoogleMapsUrl(mapLocation);
  const embedUrl = buildGoogleMapsEmbedUrl(mapLocation);
  const [quick, setQuick] = useState({
    public_description: pv.description || "",
    public_phone: pv.phone || "",
    public_email: pv.email || "",
    website_url: pv.website || "",
    facebook_url: pv.facebook || "",
    instagram_url: pv.instagram || "",
    linkedin_url: pv.linkedin || "",
  });
  const [savingQuick, setSavingQuick] = useState(false);
  const [quickMsg, setQuickMsg] = useState("");

  const [reviewDraft, setReviewDraft] = useState(null);
  const [reviewValues, setReviewValues] = useState({
    public_display_name: loc.public_display_name || pv.display_name || loc.name || "",
    address: pv.address || "",
  });
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState("");

  useEffect(() => {
    setQuick({
      public_description: pv.description || "",
      public_phone: pv.phone || "",
      public_email: pv.email || "",
      website_url: pv.website || "",
      facebook_url: pv.facebook || "",
      instagram_url: pv.instagram || "",
      linkedin_url: pv.linkedin || "",
    });
    setReviewValues({
      public_display_name: loc.public_display_name || pv.display_name || loc.name || "",
      address: pv.address || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const loadOwnDraft = async () => {
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }).catch(() => ({ data: { submissions: [] } }));
    const own = (res.data?.submissions || []).find((s) => s.section === "location_details" && ["draft", "needs_more_info", "pending_review"].includes(s.status));
    setReviewDraft(own || null);
    if (own) {
      const payload = JSON.parse(own.payload_json || "{}");
      setReviewValues({
        public_display_name: payload.public_display_name ?? (loc.public_display_name || pv.display_name || loc.name || ""),
        address: payload.address ?? (pv.address || ""),
        public_phone: payload.public_phone ?? "",
        public_email: payload.public_email ?? "",
      });
    }
  };

  useEffect(() => { loadOwnDraft(); }, [locationId]);

  const saveQuick = async () => {
    setSavingQuick(true); setQuickMsg("");
    const res = await base44.functions.invoke("saveProviderRoutineProfile", { location_id: locationId, ...quick }).catch((e) => ({ data: { error: e.message } }));
    setSavingQuick(false);
    if (res.data?.error) { setQuickMsg(res.data.error); return; }
    setQuickMsg("Modificarile rapide au fost salvate.");
    onRefresh();
  };

  const saveReview = async () => {
    setSavingReview(true); setReviewMsg("");
    const action = reviewDraft && reviewDraft.status !== "pending_review" ? "update_draft" : "create_draft";
    const payload = {
      public_display_name: reviewValues.public_display_name || "",
      address: reviewValues.address || "",
    };
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action, submission_id: reviewDraft?.id, location_id: locationId, section: "location_details", payload,
    }).catch((e) => ({ data: { error: e.message } }));
    setSavingReview(false);
    if (res.data?.error) { setReviewMsg(res.data.error); return; }
    setReviewMsg("Draft salvat. Trimite-l spre review cand este pregatit.");
    loadOwnDraft();
  };

  const submitReview = async () => {
    if (!reviewDraft) return;
    setSavingReview(true); setReviewMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: reviewDraft.id, location_id: locationId, section: "location_details" }).catch((e) => ({ data: { error: e.message } }));
    setSavingReview(false);
    if (res.data?.error) { setReviewMsg(res.data.error); return; }
    setReviewMsg("Trimis spre review.");
    loadOwnDraft();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Profil public</h1>
        <p className="mt-1 text-xs text-muted-foreground">Controleaza informatiile care apar pe pagina publica a locatiei.</p>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Previzualizare profil</div>
              <h2 className="mt-1 font-heading text-xl font-bold">{pv.display_name || loc.public_display_name || loc.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{pv.address ? `${pv.address}, ${pv.city || ""}` : (pv.city || "Adresa nepublicata")}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-semibold shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" /> {loc.profile_control_status === "verified" ? "Verificat" : "Activ"}
            </span>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-2">
            <PublicStatusItem label="Telefon" value={pv.phone} empty="Lipseste" />
            <PublicStatusItem label="Email" value={pv.email} empty="Lipseste" />
            <PublicStatusItem label="Website" value={pv.website} empty="Nepublicat" />
            <PublicStatusItem label="Program" value={pv.opening_hours} empty="Nepublicat" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-sm">Locatie pe harta</div>
              <p className="mt-1 text-xs text-muted-foreground">Generata din adresa publicata.</p>
            </div>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4">
                Deschide <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          {hasMapLocation(mapLocation) && embedUrl ? (
            <div className="mt-3 h-44 overflow-hidden rounded-xl border border-border bg-secondary">
              <iframe title={`Harta ${pv.display_name || loc.name}`} src={embedUrl} className="w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-border bg-secondary/50 p-5 text-center">
              <MapPin className="w-5 h-5 mx-auto text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">Adauga adresa pentru afisarea hartii.</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <div className="font-semibold text-sm">Informatii publice rapide</div>
          <p className="text-xs text-muted-foreground mt-1">Aceste informatii administrative se actualizeaza imediat dupa salvare.</p>
        </div>
        {QUICK_FIELDS.map(([key, label, type, hint]) => (
          <Field key={key} label={label} hint={hint}>
            {type === "textarea" ? (
              <textarea className={inputCls} rows={4} value={quick[key]} onChange={(e) => setQuick({ ...quick, [key]: e.target.value })} />
            ) : (
              <input className={inputCls} value={quick[key]} onChange={(e) => setQuick({ ...quick, [key]: e.target.value })} />
            )}
          </Field>
        ))}
        <div className="flex items-center gap-3 pt-1">
          <button disabled={savingQuick} onClick={saveQuick} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>
            <Save className="w-4 h-4" /> Salveaza informatiile
          </button>
          {quickMsg && <p className="text-xs text-muted-foreground">{quickMsg}</p>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <div className="font-semibold text-sm">Identitate si adresa — necesita review</div>
          <p className="text-xs text-muted-foreground mt-1">Numele public si adresa pot afecta identificarea locatiei, harta si increderea profilului. De aceea sunt verificate inainte de publicare.</p>
          {reviewDraft && <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary">{SUBMISSION_STATUS_LABELS[reviewDraft.status] || reviewDraft.status}</span>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nume public afisat" hint="Exemplu: Lunera Optic Store - Sibiu">
            <input className={inputCls} value={reviewValues.public_display_name || ""} onChange={(e) => setReviewValues({ ...reviewValues, public_display_name: e.target.value })} disabled={reviewDraft?.status === "pending_review"} />
          </Field>
          <Field label="Adresa" hint="Adresa folosita si pentru harta.">
            <input className={inputCls} value={reviewValues.address || ""} onChange={(e) => setReviewValues({ ...reviewValues, address: e.target.value })} disabled={reviewDraft?.status === "pending_review"} />
          </Field>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Schimbarile de identitate nu se publica instant. Salveaza draftul, apoi trimite spre review.
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={savingReview || reviewDraft?.status === "pending_review"} onClick={saveReview} className="px-5 py-2.5 rounded-full text-sm font-semibold border border-border disabled:opacity-50">
            Salveaza draft
          </button>
          {reviewDraft && reviewDraft.status !== "pending_review" && (
            <button disabled={savingReview} onClick={submitReview} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>
              Trimite spre review
            </button>
          )}
        </div>
        {reviewMsg && <p className="text-xs text-muted-foreground">{reviewMsg}</p>}
      </div>
    </div>
  );
}