import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, Loader2, MapPin, Plus, Search, Send, ShieldCheck } from "lucide-react";
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

const EMPTY_SEARCH = { name: "", city: "", address: "", phone: "" };

function StepBadge({ number, label, active, complete }) {
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${active ? "border-foreground bg-foreground text-background" : complete ? "border-green-200 bg-green-50 text-green-800" : "border-border bg-card text-muted-foreground"}`}>
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${active ? "bg-background/15" : complete ? "bg-green-100" : "bg-secondary"}`}>
        {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : number}
      </span>
      {label}
    </div>
  );
}

function CandidateCard({ item, loading, onOpenExisting, onRequestExisting, onContinueNew }) {
  const sameOrganization = item.relation === "same_organization";
  const otherOrganization = item.relation === "other_organization" || (item.organization_id && !sameOrganization);
  const reasons = Array.isArray(item.reasons) ? item.reasons : [];
  const exactPhone = reasons.includes("telefon identic");
  const exactAddress = reasons.includes("aceeasi adresa") || reasons.includes("aceeași adresă");
  const strong = item.confidence === "high" || exactPhone || exactAddress || Number(item.score || 0) >= 72;
  const recommendationLabel = sameOrganization
    ? "Deja in organizatia ta"
    : otherOrganization
      ? "Profil asociat altei organizatii"
      : exactPhone
        ? "Telefon confirmat"
        : strong
          ? "Recomandare principala"
          : "Posibil profil existent";

  return (
    <div className={`rounded-2xl border bg-card p-4 ${strong ? "border-foreground/30 shadow-sm" : "border-border"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{item.name}</h3>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${sameOrganization ? "bg-green-50 text-green-800 ring-1 ring-green-200" : strong || otherOrganization ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200" : "bg-secondary text-foreground"}`}>
              {recommendationLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{item.address || "Adresa necompletata"}{item.city ? ` · ${item.city}` : ""}</p>
          {item.phone && <p className="mt-1 text-xs text-muted-foreground">{item.phone}</p>}
          {reasons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {reasons.map((reason) => <span key={reason} className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{reason}</span>)}
            </div>
          )}
          {otherOrganization && (
            <p className="mt-3 text-xs leading-relaxed text-amber-900">
              Poti solicita asocierea. Administratorul va verifica organizatia actuala si va decide daca profilul poate fi transferat.
            </p>
          )}
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">{item.score}% potrivire</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {sameOrganization ? (
          <button type="button" onClick={() => onOpenExisting(item.id)} className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background">Deschide locatia</button>
        ) : (
          <>
            <button type="button" disabled={loading} onClick={() => onRequestExisting(item)} className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-40">
              {loading ? "Se pregateste..." : "Aceasta este locatia mea"}
            </button>
            <button type="button" disabled={loading} onClick={onContinueNew} className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-40">Nu este aceasta</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProviderAddLocationFlow({ anchorLocationId, organizationName, onClose, onSelectLocation, onRefresh }) {
  const [step, setStep] = useState("search");
  const [searchData, setSearchData] = useState(EMPTY_SEARCH);
  const [searched, setSearched] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const pending = submission?.status === "pending_review";
  const needsMoreInfo = submission?.status === "needs_more_info";
  const isExistingRequest = submission?.item_key === "existing_location" || submission?.payload?.kind === "associate_existing_location";
  const selectedCandidate = submission?.payload?.candidate || null;
  const canSearch = searchData.name.trim().length >= 2 || searchData.address.trim().length >= 4 || searchData.phone.replace(/\D/g, "").length >= 7;
  const requiredComplete = useMemo(() => form.public_display_name && form.address && form.city && form.county, [form]);
  const dataStepActive = step === "form" || step === "existing";
  const reviewStepActive = pending;

  useEffect(() => {
    let mounted = true;
    if (!anchorLocationId) return undefined;
    Promise.all([
      base44.functions.invoke("providerLocationExpansionOps", { action: "get", anchor_location_id: anchorLocationId }).catch(() => ({ data: {} })),
      base44.functions.invoke("providerLocationIdentityResolutionOps", { action: "get", anchor_location_id: anchorLocationId }).catch(() => ({ data: {} })),
    ]).then(([newLocationResponse, existingResponse]) => {
      if (!mounted) return;
      const existingSubmission = existingResponse.data?.submission;
      const newSubmission = newLocationResponse.data?.submission;
      const activeSubmission = existingSubmission || newSubmission;
      if (!activeSubmission) return;
      setSubmission(activeSubmission);
      if (activeSubmission.item_key === "existing_location" || activeSubmission.payload?.kind === "associate_existing_location") {
        setStep("existing");
        return;
      }
      const location = activeSubmission.payload?.location;
      if (location) setForm({ ...EMPTY, ...location, lat: location.lat ?? "", lng: location.lng ?? "" });
      setStep("form");
    });
    return () => { mounted = false; };
  }, [anchorLocationId]);

  const search = async () => {
    if (!canSearch) return;
    setLoading(true);
    setMessage("");
    setSearched(false);
    const response = await base44.functions.invoke("providerLocationExpansionOps", {
      action: "search",
      anchor_location_id: anchorLocationId,
      search: searchData,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLoading(false);
    setSearched(true);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setCandidates(response.data?.candidates || []);
  };

  const openExisting = (id) => {
    onSelectLocation?.(id);
    onClose?.();
  };

  const requestExisting = async (candidate) => {
    setLoading(true);
    setMessage("");
    const response = await base44.functions.invoke("providerLocationIdentityResolutionOps", {
      action: "request_existing",
      anchor_location_id: anchorLocationId,
      target_location_id: candidate.id,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLoading(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    if (response.data?.open_existing && response.data?.location_id) {
      openExisting(response.data.location_id);
      return;
    }
    setSubmission(response.data?.submission || null);
    setStep("existing");
    setMessage("Solicitarea a fost pregatita. Verifica profilul si trimite-l spre aprobare.");
  };

  const beginNew = () => {
    setSubmission(null);
    setForm((current) => ({
      ...current,
      public_display_name: current.public_display_name || searchData.name.trim(),
      address: current.address || searchData.address.trim(),
      city: current.city || searchData.city.trim(),
      public_phone: current.public_phone || searchData.phone.trim(),
    }));
    setStep("form");
  };

  const saveDraft = async () => {
    if (!requiredComplete) { setMessage("Completeaza numele, adresa, localitatea si judetul."); return; }
    setLoading(true);
    setMessage("");
    const response = await base44.functions.invoke("providerLocationExpansionOps", {
      action: "save_draft",
      anchor_location_id: anchorLocationId,
      location: {
        ...form,
        lat: form.lat === "" ? null : Number(String(form.lat).replace(",", ".")),
        lng: form.lng === "" ? null : Number(String(form.lng).replace(",", ".")),
      },
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLoading(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setSubmission(response.data.submission);
    setMessage("Draft salvat. Verifica datele si trimite cererea spre aprobare.");
  };

  const submitReview = async () => {
    if (!submission?.id) return;
    setLoading(true);
    setMessage("");
    const functionName = isExistingRequest ? "providerLocationIdentityResolutionOps" : "providerLocationExpansionOps";
    const action = isExistingRequest ? "submit_existing" : "submit_review";
    const response = await base44.functions.invoke(functionName, {
      action,
      anchor_location_id: anchorLocationId,
      submission_id: submission.id,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLoading(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setSubmission({ ...submission, status: "pending_review" });
    setMessage(isExistingRequest
      ? "Asocierea profilului existent a fost trimisa spre verificare."
      : "Locatia a fost trimisa spre verificare. Nu va aparea public pana la aprobare.");
    onRefresh?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <StepBadge number="1" label="Verifica locatia" active={step === "search"} complete={dataStepActive || reviewStepActive} />
        <StepBadge number="2" label={isExistingRequest ? "Confirma profilul" : "Completeaza datele"} active={dataStepActive && !reviewStepActive} complete={reviewStepActive} />
        <StepBadge number="3" label="Trimite spre verificare" active={reviewStepActive} complete={false} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <div className="rounded-2xl border border-border bg-secondary/35 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card"><Building2 className="h-4 w-4" /></div>
            <div>
              <div className="text-sm font-bold">Organizatie: {organizationName || "Organizatia ta"}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">O locatie noua sau un profil existent aprobat va fi asociat acestei organizatii.</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><ShieldCheck className="h-4 w-4" /></div>
            <div>
              <div className="text-sm font-bold">Control anti-duplicate</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Profilurile existente sunt asociate sau transferate numai dupa verificarea administratorului.</p>
            </div>
          </div>
        </div>
      </div>

      {step === "search" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-lg font-bold">1. Cauta locatia in director</h2>
            <p className="mt-1 text-xs text-muted-foreground">Completeaza datele pe care le cunosti. Un semnal puternic, precum telefonul identic, poate identifica profilul existent.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div><label className="text-xs font-semibold text-muted-foreground">Numele locatiei</label><input value={searchData.name} onChange={(event) => setSearchData({ ...searchData, name: event.target.value })} className={`${input} mt-1.5`} placeholder="Ex: Lunera Optic Giroc" /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Localitate</label><input value={searchData.city} onChange={(event) => setSearchData({ ...searchData, city: event.target.value })} className={`${input} mt-1.5`} placeholder="Ex: Giroc" /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Adresa</label><input value={searchData.address} onChange={(event) => setSearchData({ ...searchData, address: event.target.value })} className={`${input} mt-1.5`} placeholder="Strada si numar" /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Telefon</label><input value={searchData.phone} onChange={(event) => setSearchData({ ...searchData, phone: event.target.value })} className={`${input} mt-1.5`} placeholder="Telefonul locatiei" /></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={!canSearch || loading} onClick={search} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-40">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Verifica in director</button>
              <button type="button" disabled={loading} onClick={beginNew} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-40"><Plus className="h-4 w-4" /> Adauga locatie noua</button>
            </div>
            {message && <p className="mt-4 text-xs text-destructive">{message}</p>}
          </section>

          <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-bold">2. Recomandari VIASEE</h2>
                <p className="mt-1 text-xs text-muted-foreground">Afisam maximum trei potriviri, ordonate dupa relevanta.</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{candidates.length} rezultate</span>
            </div>
            {candidates.length > 0 ? (
              <div className="mt-4 space-y-3">{candidates.map((item) => <CandidateCard key={item.id} item={item} loading={loading} onOpenExisting={openExisting} onRequestExisting={requestExisting} onContinueNew={beginNew} />)}</div>
            ) : searched && !loading ? (
              <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/25 p-5 text-center">
                <MapPin className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-semibold">Nu am gasit o potrivire relevanta</p>
                <p className="mt-1 text-xs text-muted-foreground">Poti continua cu o locatie noua. Verificarea finala va fi facuta si de administrator.</p>
                <button type="button" onClick={beginNew} className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background"><Plus className="h-4 w-4" /> Continua cu locatia noua</button>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/25 p-5 text-center">
                <Search className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-semibold">Completeaza datele din stanga</p>
                <p className="mt-1 text-xs text-muted-foreground">Rezultatele posibile vor aparea aici.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {step === "existing" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-bold">Profil existent selectat</h2>
                <p className="mt-1 text-xs text-muted-foreground">Nu cream o locatie duplicata. Administratorul verifica asocierea si organizatia actuala.</p>
              </div>
              {!pending && <button type="button" onClick={() => { setSubmission(null); setStep("search"); }} className="inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-4"><ArrowLeft className="h-3.5 w-3.5" /> Inapoi</button>}
            </div>
            <div className="mt-5 rounded-2xl border border-border bg-secondary/25 p-4">
              <div className="text-base font-bold">{selectedCandidate?.name || "Locatie existenta"}</div>
              <div className="mt-1 text-sm text-muted-foreground">{selectedCandidate?.address || "Adresa indisponibila"}{selectedCandidate?.city ? ` · ${selectedCandidate.city}` : ""}</div>
              {selectedCandidate?.phone && <div className="mt-1 text-sm text-muted-foreground">{selectedCandidate.phone}</div>}
              {selectedCandidate?.organization_name && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Organizatie actuala: <b>{selectedCandidate.organization_name}</b>. Un eventual transfer este decis numai de administrator.</div>}
            </div>
          </section>
          <div className="space-y-4">
            <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Send className="h-4 w-4" /></div>
                <div>
                  <h2 className="text-sm font-bold">Trimite asocierea spre verificare</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Administratorul poate asocia profilul, il poate transfera dupa verificare sau poate cere informatii suplimentare.</p>
                </div>
              </div>
              {submission?.admin_note && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><b>Mesaj administrator:</b> {submission.admin_note}</div>}
              {pending && <div className="mt-4 flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Cererea este in verificare.</div>}
              {needsMoreInfo && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Completeaza sau retrimite solicitarea dupa clarificarea mesajului administratorului.</div>}
              {message && <p className="mt-4 text-xs text-muted-foreground">{message}</p>}
            </section>
            <section className="sticky bottom-0 rounded-[24px] border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
              {!pending && <button type="button" disabled={loading || !submission?.id} onClick={submitReview} className="w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-40">{loading ? "Se trimite..." : needsMoreInfo ? "Retrimite spre verificare" : "Trimite spre verificare"}</button>}
            </section>
          </div>
        </div>
      )}

      {step === "form" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="font-heading text-lg font-bold">2. Datele locatiei noi</h2><p className="mt-1 text-xs text-muted-foreground">Completeaza doar datele punctului de lucru. Brandul, logo-ul si descrierea raman la nivelul organizatiei.</p></div>
              {!submission && <button type="button" onClick={() => setStep("search")} className="inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-4"><ArrowLeft className="h-3.5 w-3.5" /> Inapoi</button>}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div><label className="text-xs font-semibold text-muted-foreground">Nume public locatie *</label><input disabled={pending} className={`${input} mt-1.5`} value={form.public_display_name} onChange={(event) => setForm({ ...form, public_display_name: event.target.value })} /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Telefon public</label><input disabled={pending} className={`${input} mt-1.5`} value={form.public_phone} onChange={(event) => setForm({ ...form, public_phone: event.target.value })} /></div>
              <div className="md:col-span-2"><label className="text-xs font-semibold text-muted-foreground">Adresa completa *</label><input disabled={pending} className={`${input} mt-1.5`} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Localitate *</label><input disabled={pending} className={`${input} mt-1.5`} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Judet *</label><input disabled={pending} className={`${input} mt-1.5`} value={form.county} onChange={(event) => setForm({ ...form, county: event.target.value })} /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Email public</label><input disabled={pending} className={`${input} mt-1.5`} value={form.public_email} onChange={(event) => setForm({ ...form, public_email: event.target.value })} /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Cod SIRUTA, optional</label><input disabled={pending} className={`${input} mt-1.5`} value={form.locality_siruta_code} onChange={(event) => setForm({ ...form, locality_siruta_code: event.target.value })} /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Latitudine, optional</label><input disabled={pending} className={`${input} mt-1.5`} value={form.lat} onChange={(event) => setForm({ ...form, lat: event.target.value })} /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Longitudine, optional</label><input disabled={pending} className={`${input} mt-1.5`} value={form.lng} onChange={(event) => setForm({ ...form, lng: event.target.value })} /></div>
              <div className="md:col-span-2"><label className="text-xs font-semibold text-muted-foreground">Google Place ID, optional</label><input disabled={pending} className={`${input} mt-1.5`} value={form.place_id} onChange={(event) => setForm({ ...form, place_id: event.target.value })} /></div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Send className="h-4 w-4" /></div>
                <div>
                  <h2 className="text-sm font-bold">3. Trimitere spre verificare</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Locatia nu devine publica imediat. Mai intai este verificata de echipa VIASEE.</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Se verifica posibilele duplicate.</div>
                <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Locatia ramane legata de organizatia actuala.</div>
                <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Tipul organizatiei nu se schimba automat.</div>
              </div>
              {submission?.admin_note && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><b>Mesaj administrator:</b> {submission.admin_note}</div>}
              {pending && <div className="mt-4 flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Cererea este in verificare. Locatia nu este inca publica.</div>}
              {message && <p className="mt-4 text-xs text-muted-foreground">{message}</p>}
            </section>

            <section className="sticky bottom-0 rounded-[24px] border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending || loading || !requiredComplete} onClick={saveDraft} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-40">{loading ? "Se salveaza..." : "Salveaza draft"}</button>
                {submission && submission.status !== "pending_review" && <button type="button" disabled={loading} onClick={submitReview} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-40">Trimite spre verificare</button>}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
