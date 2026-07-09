import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, MapPin, Save, Send, Stethoscope, UserPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AVAILABILITY_OPTIONS,
  REQUEST_INTAKE_STATUS_LABELS,
  SPECIALIST_INVITE_ROLES,
  WEEK_DAYS,
  getOrderedServiceGroups,
  isB2BProfile,
} from "@/lib/providerWorkspaceCatalog";

const LOCATION_TABS = [
  { key: "details", label: "Detalii locatie", icon: MapPin },
  { key: "services", label: "Servicii", icon: Stethoscope },
  { key: "schedule", label: "Program", icon: CalendarDays },
  { key: "team", label: "Specialisti", icon: UserPlus },
];

const ACTIVE_SUBMISSION_STATUSES = ["draft", "needs_more_info", "pending_review"];

function Panel({ children, className = "" }) {
  return <section className={"rounded-lg border border-border bg-card p-5 shadow-sm " + className}>{children}</section>;
}

function Field({ label, children, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function locationTitle(location) {
  return location?.public_display_name || location?.name || "Locatie";
}

function locationSubtitle(location) {
  const bits = [location?.locality_name || location?.city, location?.address].filter(Boolean);
  return bits.join(" - ");
}

function currentSelectedFromLocation(location) {
  const summary = location?.content_summary || {};
  const active = new Set([...(summary.approved_service_keys || []), ...(summary.approved_specialization_keys || [])]);
  const selected = {};
  for (const group of getOrderedServiceGroups(location)) {
    selected[group.key] = group.items.map(([id]) => id).filter((id) => active.has(id));
  }
  return selected;
}

function emptySchedule() {
  return {
    days: Object.fromEntries(WEEK_DAYS.map(([key]) => [key, { open: "09:00", close: "18:00", closed: key === "sun" }])),
    exceptions: [],
  };
}

function parseSchedule(location) {
  try {
    const raw = location?.opening_hours_json ? JSON.parse(location.opening_hours_json) : null;
    if (raw?.days) return { ...emptySchedule(), ...raw, days: { ...emptySchedule().days, ...raw.days }, exceptions: Array.isArray(raw.exceptions) ? raw.exceptions : [] };
  } catch (_e) {
    // Keep the editor usable if legacy JSON is malformed.
  }
  return emptySchedule();
}

function scheduleSummary(schedule) {
  const lines = [];
  for (const [key, label] of WEEK_DAYS) {
    const day = schedule.days[key] || {};
    if (day.closed) lines.push(label + ": inchis");
    else lines.push(label + ": " + (day.open || "") + "-" + (day.close || ""));
  }
  return lines.join("; ");
}

function saturdaySummary(schedule) {
  const sat = schedule.days.sat || {};
  if (sat.closed) return "Inchis sambata";
  return "Sambata: " + (sat.open || "") + "-" + (sat.close || "");
}

function mapUrl(details) {
  const lat = Number(details.lat);
  const lng = Number(details.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const delta = 0.01;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
  return "https://www.openstreetmap.org/export/embed.html?bbox=" + encodeURIComponent(bbox) + "&layer=mapnik&marker=" + encodeURIComponent(lat + "," + lng);
}

function tabButtonClass(active) {
  return "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors " + (active ? "bg-foreground text-background" : "bg-secondary text-foreground hover:bg-secondary/80");
}

function TabButton({ tab, active, onClick }) {
  const Icon = tab.icon;
  return (
    <button onClick={onClick} className={tabButtonClass(active)}>
      <Icon className="w-4 h-4" /> {tab.label}
    </button>
  );
}

function buildLocationDetailsPayload(form) {
  const lat = String(form.lat || "").trim();
  const lng = String(form.lng || "").trim();
  if ((lat && !lng) || (!lat && lng)) {
    return { error: "Completeaza atat latitudinea, cat si longitudinea, sau lasa ambele goale." };
  }
  const payload = {
    public_display_name: form.public_display_name,
    address: form.address,
    public_phone: form.public_phone,
    public_email: form.public_email,
    place_id: form.place_id,
  };
  if (lat && lng) {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!Number.isFinite(nLat) || nLat < -90 || nLat > 90 || !Number.isFinite(nLng) || nLng < -180 || nLng > 180) {
      return { error: "Coordonatele pinului sunt invalide." };
    }
    payload.lat = nLat;
    payload.lng = nLng;
  }
  return { payload };
}

function extractSubmission(response) {
  return response?.data?.submission || response?.submission || null;
}

function DetailsTab({ location, onSaved }) {
  const [form, setForm] = useState({});
  const [draft, setDraft] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadDraft = async () => {
    if (!location?.id) return;
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action: "list_mine",
      location_id: location.id,
    }).catch(() => ({ data: { submissions: [] } }));
    const submissions = res?.data?.submissions || res?.submissions || [];
    const activeDraft = submissions.find((s) => s.section === "location_details" && ACTIVE_SUBMISSION_STATUSES.includes(s.status)) || null;
    setDraft(activeDraft);
    if (activeDraft) {
      let payload = {};
      try { payload = JSON.parse(activeDraft.payload_json || "{}"); } catch (_e) { payload = {}; }
      setForm({
        public_display_name: payload.public_display_name ?? (location?.public_display_name || location?.name || ""),
        address: payload.address ?? (location?.address || ""),
        public_phone: payload.public_phone ?? (location?.public_phone || location?.phone_public || ""),
        public_email: payload.public_email ?? (location?.public_email || ""),
        lat: payload.lat ?? (location?.lat ?? ""),
        lng: payload.lng ?? (location?.lng ?? ""),
        place_id: payload.place_id ?? (location?.place_id || ""),
      });
    } else {
      setForm({
        public_display_name: location?.public_display_name || location?.name || "",
        address: location?.address || "",
        public_phone: location?.public_phone || location?.phone_public || "",
        public_email: location?.public_email || "",
        lat: location?.lat ?? "",
        lng: location?.lng ?? "",
        place_id: location?.place_id || "",
      });
    }
  };

  useEffect(() => {
    loadDraft();
    setMessage("");
    setError("");
    setShowAdvanced(false);
  }, [location?.id]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const url = mapUrl(form);
  const pendingReview = draft?.status === "pending_review";

  const saveDraft = async () => {
    setError("");
    setMessage("");
    const built = buildLocationDetailsPayload(form);
    if (built.error) { setError(built.error); return; }
    setSaving(true);
    try {
      const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
      const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
        action,
        submission_id: draft?.id,
        location_id: location.id,
        section: "location_details",
        payload: built.payload,
      });
      const submission = extractSubmission(res);
      if (submission) setDraft(submission);
      setMessage("Draft salvat. Trimite-l spre review cand este pregatit.");
      if (onSaved) await onSaved();
      await loadDraft();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Nu am putut salva draftul.");
    } finally {
      setSaving(false);
    }
  };

  const submitDraft = async () => {
    if (!draft?.id || pendingReview) return;
    setError("");
    setMessage("");
    const built = buildLocationDetailsPayload(form);
    if (built.error) { setError(built.error); return; }
    setSubmitting(true);
    try {
      await base44.functions.invoke("submitProviderWorkspaceChange", {
        action: "submit",
        location_id: location.id,
        section: "location_details",
        submission_id: draft.id,
      });
      setMessage("Detaliile locatiei au fost trimise spre review.");
      if (onSaved) await onSaved();
      await loadDraft();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Nu am putut trimite modificarile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Detalii publice locatie</h2>
            <p className="mt-1 text-sm text-muted-foreground">Numele public, adresa, pinul si contactele locatiei necesita review admin.</p>
          </div>
          {draft && <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{draft.status}</span>}
        </div>
        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          <Field label="Nume public locatie">
            <Input value={form.public_display_name || ""} disabled={pendingReview} onChange={(e) => update("public_display_name", e.target.value)} />
          </Field>
          <Field label="Telefon public locatie">
            <Input value={form.public_phone || ""} disabled={pendingReview} onChange={(e) => update("public_phone", e.target.value)} placeholder="+40..." />
          </Field>
          <Field label="Email public locatie">
            <Input value={form.public_email || ""} disabled={pendingReview} onChange={(e) => update("public_email", e.target.value)} placeholder="sibiu@..." />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Adresa publica">
              <Textarea value={form.address || ""} disabled={pendingReview} onChange={(e) => update("address", e.target.value)} rows={3} />
            </Field>
          </div>
          <Field label="Latitudine pin">
            <Input value={form.lat ?? ""} disabled={pendingReview} onChange={(e) => update("lat", e.target.value)} placeholder="45.79" />
          </Field>
          <Field label="Longitudine pin">
            <Input value={form.lng ?? ""} disabled={pendingReview} onChange={(e) => update("lng", e.target.value)} placeholder="24.15" />
          </Field>
        </div>

        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">
          Optiuni avansate <ChevronDown className={"h-4 w-4 transition-transform " + (showAdvanced ? "rotate-180" : "")} />
        </button>
        {showAdvanced && (
          <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3">
            <Field label="Google Place ID" hint="Optional. Pentru MVP sunt suficiente coordonatele latitudine/longitudine.">
              <Input value={form.place_id || ""} disabled={pendingReview} onChange={(e) => update("place_id", e.target.value)} placeholder="optional" />
            </Field>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={saveDraft} disabled={saving || submitting || pendingReview}><Save className="w-4 h-4" /> {saving ? "Se salveaza..." : "Salveaza draft"}</Button>
          {draft && !pendingReview && <Button onClick={submitDraft} disabled={saving || submitting}><Send className="w-4 h-4" /> {submitting ? "Se trimite..." : "Trimite spre review"}</Button>}
        </div>
      </Panel>
      <Panel>
        <h2 className="font-semibold">Pin harta</h2>
        {url ? (
          <iframe title="Previzualizare pin locatie" src={url} loading="lazy" referrerPolicy="no-referrer" className="mt-4 w-full aspect-[4/3] rounded-lg border border-border" />
        ) : (
          <div className="mt-4 aspect-[4/3] rounded-lg border border-dashed border-border bg-secondary flex items-center justify-center p-5 text-center text-sm text-muted-foreground">
            Adauga latitudine si longitudine pentru previzualizarea pinului.
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">Geografia canonica ramane SIRUTA. Pinul este doar informatie de locatie, nu sursa de matching.</p>
      </Panel>
    </div>
  );
}

function ServicesTab({ location, onSaved }) {
  const groups = getOrderedServiceGroups(location);
  const currentSelected = useMemo(() => currentSelectedFromLocation(location), [location?.id]);
  const [selected, setSelected] = useState(currentSelected);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showSecondary, setShowSecondary] = useState(false);

  useEffect(() => {
    setSelected(currentSelectedFromLocation(location));
    setMessage("");
    setError("");
  }, [location?.id]);

  if (isB2BProfile(location)) {
    return (
      <Panel>
        <h2 className="font-semibold">Servicii</h2>
        <p className="mt-2 text-sm text-muted-foreground">Acest tip de profil este B2B si nu poate publica servicii patient-facing.</p>
      </Panel>
    );
  }

  const setChecked = (groupKey, id, checked) => {
    setSelected((prev) => {
      const values = new Set(prev[groupKey] || []);
      if (checked) values.add(id); else values.delete(id);
      return { ...prev, [groupKey]: [...values] };
    });
  };

  const submit = async () => {
    setError("");
    setMessage("");
    const removal = {};
    for (const group of groups) {
      const next = new Set(selected[group.key] || []);
      removal[group.key] = (currentSelected[group.key] || []).filter((id) => !next.has(id));
    }
    setSaving(true);
    try {
      const create = await base44.functions.invoke("submitProviderWorkspaceChange", {
        action: "create_draft",
        location_id: location.id,
        section: "services",
        payload: { selected_ids: selected, removal_ids: removal, suggestions: [] },
      });
      const submission = extractSubmission(create);
      if (!submission?.id) throw new Error("Draftul nu a fost creat.");
      await base44.functions.invoke("submitProviderWorkspaceChange", {
        action: "submit",
        location_id: location.id,
        section: "services",
        submission_id: submission.id,
      });
      setMessage("Serviciile au fost trimise spre review.");
      if (onSaved) await onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Nu am putut trimite serviciile.");
    } finally {
      setSaving(false);
    }
  };

  const primary = groups.slice(0, 2);
  const secondary = groups.slice(2);

  return (
    <Panel>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold">Servicii per locatie</h2>
          <p className="mt-1 text-sm text-muted-foreground">Alege doar servicii reale ale acestei locatii. Serviciile avansate raman sub review admin.</p>
        </div>
        <Button onClick={submit} disabled={saving}><Save className="w-4 h-4" /> {saving ? "Se trimite..." : "Trimite spre review"}</Button>
      </div>

      <div className="mt-5 space-y-5">
        {primary.map((group) => (
          <ServiceGroup key={group.key} group={group} selected={selected[group.key] || []} onChange={setChecked} />
        ))}
        {secondary.length > 0 && (
          <div>
            <button onClick={() => setShowSecondary((v) => !v)} className="text-sm font-semibold underline underline-offset-4">
              {showSecondary ? "Ascunde" : "Arata"} alte servicii disponibile
            </button>
            {showSecondary && <div className="mt-4 space-y-5">{secondary.map((group) => <ServiceGroup key={group.key} group={group} selected={selected[group.key] || []} onChange={setChecked} />)}</div>}
          </div>
        )}
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
    </Panel>
  );
}

function ServiceGroup({ group, selected, onChange }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{group.label}</h3>
      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {group.items.map(([id, label]) => (
          <label key={id} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm hover:bg-secondary transition-colors">
            <input type="checkbox" className="w-4 h-4" checked={selected.includes(id)} onChange={(e) => onChange(group.key, id, e.target.checked)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ScheduleTab({ location, onSaved }) {
  const [schedule, setSchedule] = useState(parseSchedule(location));
  const [availability, setAvailability] = useState(location?.availability_status || "necunoscuta");
  const [requestIntake, setRequestIntake] = useState(location?.request_intake_status || "inactive");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSchedule(parseSchedule(location));
    setAvailability(location?.availability_status || "necunoscuta");
    setRequestIntake(location?.request_intake_status || "inactive");
    setMessage("");
    setError("");
  }, [location?.id]);

  const updateDay = (key, changes) => {
    setSchedule((prev) => ({ ...prev, days: { ...prev.days, [key]: { ...(prev.days[key] || {}), ...changes } } }));
  };
  const updateException = (index, changes) => {
    setSchedule((prev) => ({ ...prev, exceptions: prev.exceptions.map((item, i) => i === index ? { ...item, ...changes } : item) }));
  };
  const addException = () => setSchedule((prev) => ({ ...prev, exceptions: [...prev.exceptions, { label: "Program special", start_date: "", end_date: "", hours: "", closed: false }] }));
  const removeException = (index) => setSchedule((prev) => ({ ...prev, exceptions: prev.exceptions.filter((_, i) => i !== index) }));

  const submit = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await base44.functions.invoke("saveProviderRoutineProfile", {
        location_id: location.id,
        opening_hours_json: JSON.stringify(schedule),
        opening_hours: scheduleSummary(schedule),
        saturday_hours: saturdaySummary(schedule),
        availability_status: availability,
        request_intake_status: requestIntake,
      });
      setMessage("Programul a fost salvat si publicat imediat.");
      if (onSaved) await onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Nu am putut salva programul.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold">Program si acces pacienti</h2>
          <p className="mt-1 text-sm text-muted-foreground">Programul si modul de primire se actualizeaza imediat. Nu modifica adresa sau datele de contact.</p>
        </div>
        <Button onClick={submit} disabled={saving}><Save className="w-4 h-4" /> {saving ? "Se salveaza..." : "Salveaza program"}</Button>
      </div>

      <div className="mt-5 grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <div className="space-y-3">
          {WEEK_DAYS.map(([key, label]) => {
            const day = schedule.days[key] || {};
            return (
              <div key={key} className="grid grid-cols-[90px_1fr_1fr_auto] gap-2 items-center rounded-lg border border-border p-3">
                <span className="text-sm font-medium">{label}</span>
                <Input value={day.open || ""} onChange={(e) => updateDay(key, { open: e.target.value })} placeholder="09:00" disabled={day.closed} />
                <Input value={day.close || ""} onChange={(e) => updateDay(key, { close: e.target.value })} placeholder="18:00" disabled={day.closed} />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={!!day.closed} onChange={(e) => updateDay(key, { closed: e.target.checked })} /> Inchis
                </label>
              </div>
            );
          })}
        </div>
        <div className="space-y-4">
          <Field label="Mod de primire clienti si pacienti">
            <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
              {Object.entries(AVAILABILITY_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </Field>
          <Field label="Primire cereri pacienti">
            <select value={requestIntake} onChange={(e) => setRequestIntake(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
              {Object.entries(REQUEST_INTAKE_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Exceptii de program</h3>
            <p className="mt-1 text-xs text-muted-foreground">Ex: sarbatori, inventar, program redus temporar.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addException}>Adauga exceptie</Button>
        </div>
        <div className="mt-3 space-y-3">
          {schedule.exceptions.length === 0 && <p className="text-sm text-muted-foreground">Nu exista exceptii adaugate.</p>}
          {schedule.exceptions.map((item, index) => (
            <div key={index} className="grid sm:grid-cols-5 gap-2 rounded-lg border border-border p-3">
              <Input value={item.label || ""} onChange={(e) => updateException(index, { label: e.target.value })} placeholder="Denumire" />
              <Input value={item.start_date || ""} onChange={(e) => updateException(index, { start_date: e.target.value })} placeholder="2026-12-24" />
              <Input value={item.end_date || ""} onChange={(e) => updateException(index, { end_date: e.target.value })} placeholder="2026-12-26" />
              <Input value={item.hours || ""} onChange={(e) => updateException(index, { hours: e.target.value })} placeholder="10:00-14:00" disabled={item.closed} />
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={!!item.closed} onChange={(e) => updateException(index, { closed: e.target.checked })} /> Inchis</label>
                <button onClick={() => removeException(index)} className="text-xs text-destructive">Sterge</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
    </Panel>
  );
}

function TeamTab({ location, onSaved }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("optometrist");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const approvedCount = location?.content_summary?.approved_public_team_count || 0;
  const pendingCount = location?.content_summary?.pending_team_review_count || 0;

  const submit = async () => {
    setError("");
    setMessage("");
    if (!email.trim()) { setError("Emailul specialistului este obligatoriu."); return; }
    setSaving(true);
    try {
      const create = await base44.functions.invoke("submitProviderWorkspaceChange", {
        action: "create_draft",
        location_id: location.id,
        section: "team",
        payload: { invitations: [{ email, professional_role: role }] },
      });
      const submission = extractSubmission(create);
      if (!submission?.id) throw new Error("Draftul nu a fost creat.");
      await base44.functions.invoke("submitProviderWorkspaceChange", {
        action: "submit",
        location_id: location.id,
        section: "team",
        submission_id: submission.id,
      });
      setEmail("");
      setMessage("Invitatia a fost trimisa spre review. Specialistul apare public doar dupa confirmare.");
      if (onSaved) await onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Nu am putut trimite invitatia.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Specialisti publici</h2>
          <p className="mt-1 text-sm text-muted-foreground">Invita profesionistii care pot aparea pe profil. Managerii si operatorii merg in Acces si utilizatori.</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>{approvedCount} publici</p>
          <p>{pendingCount} in review</p>
        </div>
      </div>
      <div className="mt-5 grid sm:grid-cols-[minmax(0,1fr)_260px_auto] gap-4 sm:items-end">
        <Field label="Email specialist">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="specialist@..." />
        </Field>
        <Field label="Functie">
          <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
            {Object.entries(SPECIALIST_INVITE_ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Field>
        <Button onClick={submit} disabled={saving || !email.trim()}><UserPlus className="w-4 h-4" /> {saving ? "Se trimite..." : "Trimite invitatia"}</Button>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
    </Panel>
  );
}

export default function LocationsWorkspace({ workspace, onSaved }) {
  const locations = workspace?.locations || [];
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id || "");
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (!selectedLocationId && locations[0]?.id) setSelectedLocationId(locations[0].id);
    if (selectedLocationId && !locations.some((loc) => loc.id === selectedLocationId)) setSelectedLocationId(locations[0]?.id || "");
  }, [locations.length, selectedLocationId]);

  const selectedLocation = locations.find((loc) => loc.id === selectedLocationId) || locations[0] || null;

  if (locations.length === 0) {
    return (
      <Panel>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Locatii</h1>
        <p className="mt-2 text-sm text-muted-foreground">Locatiile apar aici dupa aprobarea unei revendicari sau adaugari.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Locatii</h1>
        <p className="mt-2 text-sm text-muted-foreground">Gestioneaza informatiile publice per locatie: detalii, servicii, program si specialisti.</p>
      </div>

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
        <Panel className="p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Locatii</p>
          <div className="space-y-2">
            {locations.map((location) => (
              <button key={location.id} onClick={() => setSelectedLocationId(location.id)} className={"w-full text-left rounded-lg border p-3 transition-colors " + (selectedLocation?.id === location.id ? "border-foreground bg-secondary" : "border-border hover:bg-secondary")}>
                <p className="text-sm font-semibold truncate">{locationTitle(location)}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{locationSubtitle(location) || "Fara adresa publica"}</p>
                {location.claim_verification_status === "approved" && <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Claim aprobat</p>}
              </button>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {LOCATION_TABS.map((tab) => <TabButton key={tab.key} tab={tab} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} />)}
          </div>
          {activeTab === "details" && <DetailsTab location={selectedLocation} onSaved={onSaved} />}
          {activeTab === "services" && <ServicesTab location={selectedLocation} onSaved={onSaved} />}
          {activeTab === "schedule" && <ScheduleTab location={selectedLocation} onSaved={onSaved} />}
          {activeTab === "team" && <TeamTab location={selectedLocation} onSaved={onSaved} />}
        </div>
      </div>
    </div>
  );
}
