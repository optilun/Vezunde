import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, Loader2, MapPin, Plus, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";

const input = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-foreground/50";

const EMPTY = {
  public_display_name: "",
  address: "",
  city: "",
  county: "",
  locality_siruta_code: "",
  public_phone: "",
  public_email: "",
  lat: "",
  lng: "",
  place_id: "",
};

function CandidateCard({ item, onOpenExisting, onContinueNew }) {
  const sameOrganization = item.relation === "same_organization";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{item.name}</h3>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${sameOrganization ? "bg-green-50 text-green-800 ring-1 ring-green-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"}`}>
              {sameOrganization ? "Deja în organizația ta" : "Posibil profil existent"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{item.address || "Adresă necompletată"}{item.city ? ` · ${item.city}` : ""}</p>
          {item.phone && <p className="mt-1 text-xs text-muted-foreground">{item.phone}</p>}
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">{item.score}% potrivire</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {sameOrganization ? (
          <button type="button" onClick={() => onOpenExisting(item.id)} className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background">Deschide locația</button>
        ) : (
          <>
            <button type="button" disabled className="rounded-full border border-border px-4 py-2 text-xs font-semibold opacity-50">Solicită asocierea</button>
            <button type="button" onClick={onContinueNew} className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary">Nu este aceasta</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProviderAddLocationFlow({ anchorLocationId, organizationName, onClose, onSelectLocation, onRefresh }) {
  const [step, setStep] = useState("search");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const pending = submission?.status === "pending_review";
  const canSearch = query.trim().length >= 3;
  const requiredComplete = useMemo(() => form.public_display_name && form.address && form.city && form.county, [form]);

  useEffect(() => {
    if (!anchorLocationId) return;
    base44.functions.invoke("providerLocationExpansionOps", { action: "get", anchor_location_id: anchorLocationId })
      .then((res) => {
        if (res.data?.submission) {
          setSubmission(res.data.submission);
          const location = res.data.submission.payload?.location;
          if (location) setForm({ ...EMPTY, ...location, lat: location.lat ?? "", lng: location.lng ?? "" });
          setStep("form");
        }
      })
      .catch(() => {});
  }, [anchorLocationId]);

  const search = async () => {
    if (!canSearch) return;
    setLoading(true);
    setMessage("");
    const res = await base44.functions.invoke("providerLocationExpansionOps", { action: "search", anchor_location_id: anchorLocationId, query })
      .catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLoading(false);
    if (res.data?.error) { setMessage(res.data.error); return; }
    setCandidates(res.data?.candidates || []);
  };

  const openExisting = (id) => {
    onSelectLocation && onSelectLocation(id);
    onClose && onClose();
  };

  const beginNew = () => {
    setForm((current) => ({ ...current, public_display_name: current.public_display_name || query.trim() }));
    setStep("form");
  };

  const saveDraft = async () => {
    if (!requiredComplete) { setMessage("Completează numele, adresa, localitatea și județul."); return; }
    setLoading(true);
    setMessage("");
    const res = await base44.functions.invoke("providerLocationExpansionOps", {
      action: "save_draft",
      anchor_location_id: anchorLocationId,
      location: {
        ...form,
        lat: form.lat === "" ? null : Number(String(form.lat).replace(",", ".")),
        lng: form.lng === "" ? null : Number(String(form.lng).replace(",", ".")),
      },
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLoading(false);
    if (res.data?.error) { setMessage(res.data.error); return; }
    setSubmission(res.data.submission);
    setMessage("Draft salvat. Verifică datele și trimite cererea spre aprobare.");
  };

  const submitReview = async () => {
    if (!submission?.id) return;
    setLoading(true);
    setMessage("");
    const res = await base44.functions.invoke("providerLocationExpansionOps", {
      action: "submit_review",
      anchor_location_id: anchorLocationId,
      submission_id: submission.id,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLoading(false);
    if (res.data?.error) { setMessage(res.data.error); return; }
    setSubmission({ ...submission, status: "pending_review" });
    setMessage("Locația a fost trimisă spre verificare. Nu va apărea public până la aprobare.");
    onRefresh && onRefresh();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-secondary/35 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card"><Building2 className="h-4 w-4" /></div>
          <div>
            <div className="text-sm font-bold">Organizație: {organizationName || "Organizația ta"}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Locația nouă va fi asociată automat acestei organizații. Tipul organizației nu se schimbă automat.</p>
          </div>
        </div>
      </div>

      {step === "search" && (
        <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
          <h2 className="font-heading text-lg font-bold">Verifică dacă locația există deja</h2>
          <p className="mt-1 text-xs text-muted-foreground">Caută după nume, adresă, localitate sau telefon. Evităm astfel profilele duplicate.</p>
          <div className="mt-4 flex gap-2">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} className={`${input} pl-10`} placeholder="Ex: Lunera Optic Giroc, Str. Cupidon 40 sau telefon" /></div>
            <button type="button" disabled={!canSearch || loading} onClick={search} className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-40">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Caută"}</button>
          </div>

          {candidates.length > 0 && <div className="mt-5 space-y-3">{candidates.map((item) => <CandidateCard key={item.id} item={item} onOpenExisting={openExisting} onContinueNew={beginNew} />)}</div>}
          {candidates.length === 0 && query && !loading && <div className="mt-5 rounded-2xl border border-dashed border-border bg-secondary/25 p-5 text-center"><MapPin className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-sm font-semibold">Nu am găsit o locație existentă</p><p className="mt-1 text-xs text-muted-foreground">Poți continua cu adăugarea unei locații noi în organizația ta.</p></div>}
          <div className="mt-5 flex justify-end"><button type="button" onClick={beginNew} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"><Plus className="h-4 w-4" /> Adaugă locație nouă</button></div>
        </section>
      )}

      {step === "form" && (
        <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-heading text-lg font-bold">Datele locației noi</h2><p className="mt-1 text-xs text-muted-foreground">Completează doar datele punctului de lucru. Brandul, logo-ul și descrierea rămân la nivelul organizației.</p></div>{!submission && <button type="button" onClick={() => setStep("search")} className="inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-4"><ArrowLeft className="h-3.5 w-3.5" /> Înapoi la verificare</button>}</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div><label className="text-xs font-semibold text-muted-foreground">Nume public locație *</label><input disabled={pending} className={`${input} mt-1.5`} value={form.public_display_name} onChange={(e) => setForm({ ...form, public_display_name: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Telefon public</label><input disabled={pending} className={`${input} mt-1.5`} value={form.public_phone} onChange={(e) => setForm({ ...form, public_phone: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="text-xs font-semibold text-muted-foreground">Adresă completă *</label><input disabled={pending} className={`${input} mt-1.5`} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Localitate *</label><input disabled={pending} className={`${input} mt-1.5`} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Județ *</label><input disabled={pending} className={`${input} mt-1.5`} value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Email public</label><input disabled={pending} className={`${input} mt-1.5`} value={form.public_email} onChange={(e) => setForm({ ...form, public_email: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Cod SIRUTA, opțional</label><input disabled={pending} className={`${input} mt-1.5`} value={form.locality_siruta_code} onChange={(e) => setForm({ ...form, locality_siruta_code: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Latitudine, opțional</label><input disabled={pending} className={`${input} mt-1.5`} value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Longitudine, opțional</label><input disabled={pending} className={`${input} mt-1.5`} value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="text-xs font-semibold text-muted-foreground">Google Place ID, opțional</label><input disabled={pending} className={`${input} mt-1.5`} value={form.place_id} onChange={(e) => setForm({ ...form, place_id: e.target.value })} /></div>
          </div>

          {submission?.admin_note && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><b>Mesaj administrator:</b> {submission.admin_note}</div>}
          {pending && <div className="mt-4 flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Cererea este în verificare. Locația nu este încă publică.</div>}
          {message && <p className="mt-4 text-xs text-muted-foreground">{message}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" disabled={pending || loading || !requiredComplete} onClick={saveDraft} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-40">{loading ? "Se salvează..." : "Salvează draft"}</button>
            {submission && submission.status !== "pending_review" && <button type="button" disabled={loading} onClick={submitReview} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-40">Trimite spre verificare</button>}
          </div>
        </section>
      )}
    </div>
  );
}
