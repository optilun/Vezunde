import React, { useEffect, useMemo, useState } from "react";
import { Camera, Check, Loader2, Save, Send, ShieldCheck, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  PROFESSIONAL_REVIEW_STATUS_LABELS,
  PROFESSIONAL_SPECIALIZATIONS,
  PROFESSIONAL_TYPE_LABELS,
} from "@/lib/professionalProfileCatalog";

const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/50 disabled:cursor-not-allowed disabled:opacity-60";
const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const PHOTO_MAX_DATA_URL_LENGTH = 800000;

function initialValues(professional) {
  const pending = professional?.pending_profile || {};
  return {
    public_display_name: pending.public_display_name ?? professional?.public_display_name ?? professional?.full_name ?? "",
    professional_bio: pending.professional_bio ?? professional?.professional_bio ?? "",
    specializations: Array.isArray(pending.specializations)
      ? pending.specializations
      : (Array.isArray(professional?.specializations) ? professional.specializations : []),
    profile_photo_url: pending.profile_photo_url ?? professional?.profile_photo_url ?? "",
    public_website_url: pending.public_website_url ?? professional?.public_website_url ?? "",
    linkedin_url: pending.linkedin_url ?? professional?.linkedin_url ?? "",
    facebook_url: pending.facebook_url ?? professional?.facebook_url ?? "",
    instagram_url: pending.instagram_url ?? professional?.instagram_url ?? "",
    public_phone: pending.public_phone ?? professional?.public_phone ?? "",
    public_email: pending.public_email ?? professional?.public_email ?? "",
    accepts_independent_requests: pending.accepts_independent_requests ?? professional?.accepts_independent_requests ?? false,
  };
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Imaginea nu poate fi citită."));
    };
    image.src = objectUrl;
  });
}

async function makeSafePhotoDataUrl(file) {
  const image = await readImage(file);
  const canvas = document.createElement("canvas");
  const maxSide = 512;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let dataUrl = canvas.toDataURL("image/webp", 0.82);
  if (dataUrl.length > PHOTO_MAX_DATA_URL_LENGTH) dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  if (dataUrl.length > PHOTO_MAX_DATA_URL_LENGTH) throw new Error("Fotografia este prea mare după optimizare.");
  return dataUrl;
}

function initials(name) {
  return String(name || "S")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "S";
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function ProfessionalProfileEditor({ workspace, onRefresh }) {
  const professional = workspace.professional;
  const [values, setValues] = useState(() => initialValues(professional));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reviewStatus = professional.profile_review_status || professional.public_visibility_status || "draft";
  const pendingReview = reviewStatus === "pending_review";
  const specializationOptions = useMemo(
    () => PROFESSIONAL_SPECIALIZATIONS[professional.professional_type] || [],
    [professional.professional_type]
  );

  useEffect(() => {
    setValues(initialValues(professional));
    setMessage("");
    setError("");
  }, [professional.id, professional.pending_profile, reviewStatus]);

  const setField = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  const toggleSpecialization = (key) => {
    if (pendingReview) return;
    setValues((current) => {
      const selected = new Set(current.specializations || []);
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      return { ...current, specializations: [...selected] };
    });
  };

  const choosePhoto = async (file) => {
    setError("");
    setMessage("");
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setError("Format acceptat: PNG, JPG sau WEBP.");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError("Fotografia trebuie să aibă maximum 4 MB înainte de optimizare.");
      return;
    }
    setUploading(true);
    try {
      setField("profile_photo_url", await makeSafePhotoDataUrl(file));
      setMessage("Fotografia a fost pregătită. Salvează draftul pentru a o păstra.");
    } catch (photoError) {
      setError(photoError.message || "Fotografia nu a putut fi pregătită.");
    } finally {
      setUploading(false);
    }
  };

  const saveDraft = async ({ silent = false } = {}) => {
    setSaving(true);
    setError("");
    if (!silent) setMessage("");
    const response = await base44.functions.invoke("manageMyProfessionalProfile", {
      action: "save_draft",
      profile: values,
    }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setSaving(false);
    if (response.data?.error) {
      setError(response.data.error);
      return false;
    }
    if (!silent) setMessage("Draftul profilului profesional a fost salvat.");
    await onRefresh?.();
    return true;
  };

  const submitReview = async () => {
    const saved = await saveDraft({ silent: true });
    if (!saved) return;
    setSaving(true);
    setError("");
    setMessage("");
    const response = await base44.functions.invoke("manageMyProfessionalProfile", {
      action: "submit_review",
    }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setSaving(false);
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setMessage("Profilul profesional a fost trimis spre verificare. Nu este publicat automat.");
    await onRefresh?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Profil profesional</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Identitatea profesională îți aparține. Clinicile și opticile pot gestiona doar asocierea cu locația.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">
          {PROFESSIONAL_REVIEW_STATUS_LABELS[reviewStatus] || reviewStatus}
        </span>
      </div>

      {professional.review_note && reviewStatus === "needs_more_info" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <strong>Completări solicitate:</strong> {professional.review_note}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px] xl:items-start">
        <div className="space-y-5">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-3xl border border-border bg-secondary">
                  {values.profile_photo_url ? (
                    <img src={values.profile_photo_url} alt="Fotografie profil" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-heading text-xl font-black">
                      {initials(values.public_display_name || professional.full_name)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold">Fotografie profesională</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Portret clar, fără date medicale sau documente în imagine.</p>
                  {!pendingReview && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                        {values.profile_photo_url ? "Schimbă" : "Adaugă"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          disabled={uploading}
                          onChange={(event) => {
                            choosePhoto(event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      {values.profile_photo_url && (
                        <button type="button" onClick={() => setField("profile_photo_url", "")} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-secondary">
                          <Trash2 className="h-3.5 w-3.5" /> Elimină
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/40 px-3 py-2 text-right">
                <div className="text-[10px] font-medium text-muted-foreground">Completitudine</div>
                <div className="mt-0.5 text-lg font-bold">{professional.profile_completeness || 0}%</div>
              </div>
            </div>
          </section>

          <section className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-sm font-bold">Identitate publică</h2>
              <p className="mt-1 text-xs text-muted-foreground">Tipul profesional este blocat și poate fi schimbat doar prin verificare VIASEE.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nume public" hint="Folosește numele profesional real, cu titulatura doar dacă este corectă.">
                <input className={inputCls} value={values.public_display_name} disabled={pendingReview} onChange={(event) => setField("public_display_name", event.target.value)} maxLength={120} />
              </Field>
              <Field label="Tip profesional">
                <div className="flex h-10 items-center rounded-xl border border-border bg-secondary/40 px-3.5 text-sm font-semibold">
                  {PROFESSIONAL_TYPE_LABELS[professional.professional_type] || professional.professional_type}
                </div>
              </Field>
            </div>
            <Field label="Descriere profesională" hint={`${values.professional_bio.length}/1200 caractere. Pentru trimitere sunt necesare minimum 80.`}>
              <textarea className={inputCls} rows={7} maxLength={1200} value={values.professional_bio} disabled={pendingReview} onChange={(event) => setField("professional_bio", event.target.value)} placeholder="Descrie experiența, domeniile de interes și modul în care lucrezi cu pacienții sau clienții." />
            </Field>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-sm font-bold">Domenii profesionale</h2>
              <p className="mt-1 text-xs text-muted-foreground">Selectează doar activitățile pe care le practici. Este necesară cel puțin una.</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {specializationOptions.map(([key, label]) => {
                const selected = values.specializations.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={pendingReview}
                    onClick={() => toggleSpecialization(key)}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/60"}`}
                  >
                    <span>{label}</span>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-sm font-bold">Contact public și prezență online</h2>
              <p className="mt-1 text-xs text-muted-foreground">Aceste date apar pe profil numai după aprobare.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telefon public"><input className={inputCls} value={values.public_phone} disabled={pendingReview} onChange={(event) => setField("public_phone", event.target.value)} placeholder="+40..." /></Field>
              <Field label="Email public"><input className={inputCls} value={values.public_email} disabled={pendingReview} onChange={(event) => setField("public_email", event.target.value)} placeholder="nume@exemplu.ro" /></Field>
              <Field label="Website profesional"><input className={inputCls} value={values.public_website_url} disabled={pendingReview} onChange={(event) => setField("public_website_url", event.target.value)} placeholder="site.ro" /></Field>
              <Field label="LinkedIn"><input className={inputCls} value={values.linkedin_url} disabled={pendingReview} onChange={(event) => setField("linkedin_url", event.target.value)} placeholder="linkedin.com/in/..." /></Field>
              <Field label="Facebook"><input className={inputCls} value={values.facebook_url} disabled={pendingReview} onChange={(event) => setField("facebook_url", event.target.value)} placeholder="facebook.com/..." /></Field>
              <Field label="Instagram"><input className={inputCls} value={values.instagram_url} disabled={pendingReview} onChange={(event) => setField("instagram_url", event.target.value)} placeholder="instagram.com/..." /></Field>
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/35 p-4">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={values.accepts_independent_requests} disabled={pendingReview} onChange={(event) => setField("accepts_independent_requests", event.target.checked)} />
              <span>
                <span className="block text-sm font-semibold">Accept cereri independente</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Necesită telefon sau email public. Activarea chatului va depinde ulterior de planul profesional.</span>
              </span>
            </label>
          </section>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}
          {message && <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">{message}</div>}

          <div className="flex flex-wrap justify-end gap-2 rounded-3xl border border-border bg-card p-4 shadow-sm">
            <button disabled={saving || pendingReview || uploading} onClick={() => saveDraft()} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
              <Save className="h-4 w-4" /> Salvează draft
            </button>
            <button disabled={saving || pendingReview || uploading} onClick={submitReview} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Trimite spre verificare
            </button>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="p-5" style={{ background: "linear-gradient(135deg, #fffaf2 0%, #ffffff 50%, #f4f1ea 100%)" }}>
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-3xl border border-white/80 bg-white shadow-sm">
                  {values.profile_photo_url ? <img src={values.profile_photo_url} alt="Previzualizare" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-foreground font-heading text-lg font-black text-background">{initials(values.public_display_name)}</div>}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">Previzualizare profil</div>
                  <h2 className="mt-1 font-heading text-xl font-extrabold tracking-tight">{values.public_display_name || professional.full_name}</h2>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold shadow-sm">
                    <ShieldCheck className="h-3.5 w-3.5" /> {PROFESSIONAL_TYPE_LABELS[professional.professional_type] || "Specialist"}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground line-clamp-6">{values.professional_bio || "Descrierea profesională va apărea aici după completare și aprobare."}</p>
              {values.specializations.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {values.specializations.slice(0, 5).map((key) => {
                    const label = specializationOptions.find(([id]) => id === key)?.[1] || key;
                    return <span key={key} className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold shadow-sm">{label}</span>;
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-bold">Reguli de publicare</h3>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p>• Profilul rămâne privat până la aprobarea VIASEE.</p>
              <p>• Locația nu poate schimba numele, fotografia sau descrierea ta.</p>
              <p>• Asocierea cu fiecare locație se aprobă separat pentru afișarea publică.</p>
              <p>• Tipul profesional nu se modifică din acest formular.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
