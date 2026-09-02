import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import {
  getPatientRequestStatus,
  managePatientContactShareApproval,
  updatePatientRequestLifecycle,
} from "@/lib/patientRequestPersistenceClient";
import { PATIENT_SAFETY_FLAG_PRESENTATION } from "@/lib/patientSafety";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import { summarizePublicServices } from "@/lib/servicePresentation";
import PatientNotificationCenter from "@/components/notifications/PatientNotificationCenter";
import PatientRequestChat from "./PatientRequestChat";
import PatientRequestLifecyclePanel from "./PatientRequestLifecyclePanel";
import RequestWorkspaceLocationCard from "./RequestWorkspaceLocationCard";
import RequestWorkspaceTimeline from "./RequestWorkspaceTimeline";

const RESPONSE_PRESENTATION = {
  can_help: { icon: CheckCircle2, title: "Locația poate ajuta", description: "Locația a confirmat că poate răspunde acestei cereri." },
  needs_details: { icon: HelpCircle, title: "Sunt necesare detalii", description: "Locația a solicitat informații suplimentare înainte de confirmare." },
  cannot_help: { icon: XCircle, title: "Locația nu poate ajuta", description: "Poți continua cu celelalte locații din cerere." },
};

const TRUST_LABELS = {
  directory: "Listata",
  claimed: "Revendicata",
  verified: "Verificata",
  suspended: "Suspendata",
};

function formatDate(value, includeTime = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function locationId(location) {
  return location?.id || location?.location_id || "";
}

function locationName(location) {
  return location?.public_display_name || location?.name || location?.location_name || "Locatie";
}

function mergeLocations(results, responses) {
  const merged = [];
  const seen = new Set();
  for (const item of Array.isArray(results) ? results : []) {
    const id = locationId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
  }
  for (const response of Array.isArray(responses) ? responses : []) {
    if (!response?.location_id || seen.has(response.location_id)) continue;
    seen.add(response.location_id);
    merged.push({
      id: response.location_id,
      name: response.location_name,
      city: response.city,
      provider_type: "",
      profile_control_status: "directory",
      result_bucket: "top3",
    });
  }
  return merged;
}

function RequestSummary({ request, requestDraft, detailedMessage, resultCount }) {
  const answers = Array.isArray(requestDraft?.answers) ? requestDraft.answers : [];
  const preferences = Array.isArray(requestDraft?.preferences) ? requestDraft.preferences : [];
  // 2026-09-01: inainte, aceasta linie era un lant de rezerve - textul scris in hero
  // (`original_message`) se folosea DOAR daca nu exista mesaj detaliat. Cum acela era
  // obligatoriu, primul lucru spus de pacient, cu cuvintele lui, nu ajungea practic
  // niciodata la furnizor. Sunt doua lucruri diferite: unul e cum si-a descris problema
  // spontan, celalalt e ce a ales sa adauge la final. Acum se pastreaza amandoua.
  const openingMessage = requestDraft?.original_message || "";
  const addedMessage = detailedMessage || requestDraft?.detailed_message || "";
  const message = openingMessage || addedMessage;
  const hasSeparateAddition = Boolean(openingMessage && addedMessage && addedMessage !== openingMessage);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cererea ta</p>
        <div className="mt-4 rounded-2xl bg-foreground px-4 py-3 text-background">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-background/65">Tu</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{message || "Mesajul cererii a fost salvat."}</p>
        </div>
        {hasSeparateAddition && (
          <div className="mt-2 rounded-2xl bg-foreground/90 px-4 py-3 text-background">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-background/65">Tu · ai adăugat</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{addedMessage}</p>
          </div>
        )}
        <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">VIASEE</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">Am pregatit cererea pe baza informatiilor oferite.</p>
        </div>
        <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">VIASEE</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {resultCount > 0 ? `Am găsit ${resultCount} locații potrivite pentru cererea ta.` : "Rezultatele cererii sunt disponibile în secțiunea Locații."}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-extrabold text-foreground">Rezumat</h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-secondary/45 p-3">
            <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Nevoie</dt>
            <dd className="mt-1 text-xs font-semibold text-foreground">{requestDraft?.intent || request?.intent || "Cerere pentru servicii de vedere"}</dd>
          </div>
          <div className="rounded-xl bg-secondary/45 p-3">
            <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Localitate</dt>
            <dd className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground"><MapPin className="h-3.5 w-3.5" /> {request?.city || requestDraft?.city || "Nespecificata"}</dd>
          </div>
          {requestDraft?.for_whom && (
            <div className="rounded-xl bg-secondary/45 p-3">
              <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Pentru cine</dt>
              <dd className="mt-1 text-xs font-semibold capitalize text-foreground">{requestDraft.for_whom}</dd>
            </div>
          )}
          {requestDraft?.timing_key && (
            <div className="rounded-xl bg-secondary/45 p-3">
              <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Perioada</dt>
              <dd className="mt-1 text-xs font-semibold text-foreground">{requestDraft.timing_key}</dd>
            </div>
          )}
        </dl>

        {preferences.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Preferinte</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {preferences.map((preference) => <span key={preference} className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-foreground">{preference}</span>)}
            </div>
          </div>
        )}

        {answers.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Raspunsuri relevante</p>
            <div className="mt-3 space-y-3">
              {answers.slice(0, 8).map((answer, index) => (
                <div key={`${answer.question_key || "answer"}-${index}`}>
                  <p className="text-[11px] font-semibold text-muted-foreground">{answer.question_label || answer.question_key}</p>
                  <p className="mt-0.5 text-xs font-semibold text-foreground">{answer.answer_label || answer.answer_value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 2026-09-01 (audit cautare/recomandare LLM, sectiunea 3.3): textul de aici era generic
// ("poate afisa instructiuni separate") si nu spunea nimic concret - nici ce s-a detectat,
// nici ce sa faca pacientul. Acum arata efectiv semnalele identificate.
// docs/patient-emergency-guidance-policy.md sectiunile 4 si 5: semnalul de aici e advisory
// (possible_safety_flags, derivat din interpretarea AI), deci NU poate afisa instructiuni
// de destinatie de urgenta, prim ajutor sau numarul 112. Acelea apar doar in
// UrgencyInterruption, pe stare blocking confirmata determinist.
function UrgencyInterruptionSlot({ requestDraft }) {
  const flags = requestDraft?.interpretation?.possible_safety_flags || [];
  if (!Array.isArray(flags) || flags.length === 0) return null;
  const labels = flags.map((flag) => PATIENT_SAFETY_FLAG_PRESENTATION[flag]).filter(Boolean);
  return (
    <div data-component="UrgencyInterruption" className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-amber-950">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-extrabold">Informații de siguranță</p>
          <p className="mt-1 text-xs leading-relaxed">
            Formularea cererii tale poate conține un semnal care merită evaluare rapidă. VIASEE nu pune diagnostic și nu stabilește dacă situația este sau nu urgentă.
          </p>
          {labels.length > 0 && (
            <ul className="mt-2 space-y-1 pl-4 text-xs">
              {labels.map((label) => (
                <li key={label} className="list-disc">{label}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs leading-relaxed">
            Dacă simptomele sunt severe, au apărut brusc sau se agravează, cere o evaluare medicală fără să aștepți un răspuns în platformă.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/cauta?q=oftalmolog"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3.5 text-xs font-bold text-amber-950 hover:bg-amber-100/60"
            >
              <Search className="h-3.5 w-3.5" /> Cabinete oftalmologice lângă tine
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectedLocationPanel({
  location,
  response,
  requestId,
  accessToken,
  status,
  updatingLocationId,
  onPhoneShare,
  onBack,
}) {
  const presentation = response ? (RESPONSE_PRESENTATION[response.response_type] || RESPONSE_PRESENTATION.needs_details) : null;
  const PresentationIcon = presentation?.icon || Store;
  const approved = response?.contact_share_status === "approved";
  const requestActive = status?.lifecycle?.state === "active";
  const canManagePhone = requestActive
    && response?.contact_share_allowed
    && status?.contact_phone_available === true;
  const services = location?.matched_public_services?.length
    ? location.matched_public_services
    : (location?.public_services || location?.matched_service_keys || []);
  const serviceLabels = summarizePublicServices(services).slice(0, 4);
  const explanations = (location?.recommendation_explanations || location?.match_reasons || [])
    .map((item) => typeof item === "string" ? item.split(":").slice(-1)[0] : item?.label)
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-secondary">
        <ArrowLeft className="h-3.5 w-3.5" /> Inapoi la cerere
      </button>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{PROVIDER_TYPES[location?.provider_type] || location?.provider_type || "Locatie"}</p>
            <h2 className="mt-1 font-heading text-xl font-extrabold text-foreground sm:text-2xl">{locationName(location)}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {(location?.locality_name || location?.city || response?.city) && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {location?.locality_name || location?.city || response?.city}</span>}
              <span className="rounded-full border border-border bg-background px-2.5 py-1 font-semibold text-foreground">{TRUST_LABELS[location?.profile_control_status] || "Listata"}</span>
            </div>
          </div>
          {(response?.profile_available !== false) && (
            <a href={`/furnizor/${locationId(location)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary">
              Vezi profilul <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {explanations.length > 0 && (
          <div className="mt-5 rounded-2xl bg-secondary/45 p-4">
            <p className="text-xs font-extrabold text-foreground">De ce apare in rezultate</p>
            <ul className="mt-2 space-y-1.5">
              {explanations.map((explanation) => <li key={explanation} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {explanation}</li>)}
            </ul>
          </div>
        )}

        {serviceLabels.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-extrabold text-foreground">Servicii relevante</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {serviceLabels.map((service) => <span key={service.key} className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-foreground">{service.label}</span>)}
            </div>
          </div>
        )}
      </section>

      <section id={`patient-response-${locationId(location)}`} className="scroll-mt-24 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary"><PresentationIcon className="h-4.5 w-4.5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Raspunsul locatiei</p>
            <h3 className="mt-1 text-base font-extrabold text-foreground">{presentation?.title || "Cerere trimisa"}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{presentation?.description || "Locația este inclusă în cerere. Nu a trimis încă un răspuns."}</p>
            {response?.submitted_at && <p className="mt-2 text-[10px] text-muted-foreground">Actualizat la {formatDate(response.submitted_at, true)}</p>}
          </div>
        </div>

        {canManagePhone && (
          <div className={`mt-4 rounded-xl border p-3 ${approved ? "border-primary/20 bg-primary/5" : "border-border bg-secondary/35"}`}>
            <div className="flex items-start gap-2">
              {approved ? <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <UserX className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground">{approved ? "Telefonul este aprobat" : "Telefonul este ascuns"}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{approved ? "Doar această locație poate vedea numărul. Acordul poate fi retras." : "Telefonul se aproba separat si nu este introdus automat in chat."}</p>
                <button type="button" onClick={() => void onPhoneShare(locationId(location), approved ? "revoke" : "approve")} disabled={updatingLocationId === locationId(location)} className={`mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-xs font-bold disabled:opacity-60 sm:w-auto ${approved ? "border border-border bg-background text-foreground hover:bg-secondary" : "bg-foreground text-background hover:opacity-90"}`}>
                  {updatingLocationId === locationId(location) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
                  {approved ? "Retrage accesul la telefon" : "Permite accesul la telefon"}
                </button>
              </div>
            </div>
          </div>
        )}

        {response && (
          <PatientRequestChat
            requestId={requestId}
            accessToken={accessToken || ""}
            locationId={locationId(location)}
            locationName={locationName(location)}
            responseType={response.response_type}
          />
        )}
      </section>
    </div>
  );
}

function LocationRail({ locations, responses, selectedLocationId, unreadByLocation, requestTerminal, onSelect }) {
  const responseByLocation = new Map((responses || []).map((response) => [response.location_id, response]));
  const top3 = locations.filter((location) => location.result_bucket === "top3");
  const additional = locations.filter((location) => location.result_bucket !== "top3" && location.result_bucket !== "excluded");

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-extrabold text-foreground">Locatii potrivite</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Selectate pe baza criteriilor cererii, nu a planului comercial.</p>
        </div>
        <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-secondary px-2.5 py-1 text-xs font-extrabold text-foreground">{locations.length}</span>
      </div>

      {top3.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Top 3</p>
          {top3.map((location) => (
            <RequestWorkspaceLocationCard
              key={locationId(location)}
              location={location}
              response={responseByLocation.get(locationId(location))}
              selected={selectedLocationId === locationId(location)}
              unread={unreadByLocation[locationId(location)] || 0}
              requestTerminal={requestTerminal}
              onSelect={() => onSelect(locationId(location))}
            />
          ))}
        </div>
      )}

      {additional.length > 0 && (
        <div className="mt-7 space-y-3 border-t border-border pt-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Rezultate suplimentare</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Profilurile listate pot avea informatii neconfirmate. Sunt afisate separat de Top 3.</p>
          </div>
          {additional.map((location) => (
            <RequestWorkspaceLocationCard
              key={locationId(location)}
              location={location}
              response={responseByLocation.get(locationId(location))}
              selected={selectedLocationId === locationId(location)}
              unread={unreadByLocation[locationId(location)] || 0}
              requestTerminal={requestTerminal}
              onSelect={() => onSelect(locationId(location))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MessagesList({ responses, locations, unreadByLocation, selectedLocationId, onSelect }) {
  if (!responses.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <MessageCircle className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-bold text-foreground">Nu exista mesaje sau raspunsuri</p>
        <p className="mt-1 text-xs text-muted-foreground">Locatiile apar in sectiunea Locatii imediat dupa trimiterea cererii.</p>
      </div>
    );
  }
  const byId = new Map(locations.map((location) => [locationId(location), location]));
  return (
    <div className="space-y-3">
      {responses.map((response) => {
        const location = byId.get(response.location_id) || { id: response.location_id, name: response.location_name, city: response.city };
        return (
          <RequestWorkspaceLocationCard
            key={response.location_id}
            location={location}
            response={response}
            selected={selectedLocationId === response.location_id}
            unread={unreadByLocation[response.location_id] || 0}
            onSelect={() => onSelect(response.location_id)}
          />
        );
      })}
    </div>
  );
}

export default function RequestWorkspace({
  requestId,
  accessToken,
  publicReference = "",
  results = [],
  meta = null,
  requestDraft = null,
  detailedMessage = "",
}) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingLocationId, setUpdatingLocationId] = useState("");
  const [updatingLifecycle, setUpdatingLifecycle] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [mobileTab, setMobileTab] = useState("request");
  const [notificationData, setNotificationData] = useState({ notifications: [], counters: { total: 0, unread: 0 } });

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError("");
    try {
      setStatus(await getPatientRequestStatus(requestId, accessToken || ""));
    } catch (loadError) {
      setError(loadError?.message || "Cererea nu a putut fi incarcata.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, requestId]);

  useEffect(() => { void load(); }, [load]);

  const updateLifecycle = async (action) => {
    setUpdatingLifecycle(true);
    setError("");
    try {
      setStatus(await updatePatientRequestLifecycle({ requestId, action, explicitAccessToken: accessToken || "" }));
    } catch (updateError) {
      setError(updateError?.message || "Starea cererii nu a putut fi actualizată.");
    } finally {
      setUpdatingLifecycle(false);
    }
  };

  const updatePhoneShare = async (nextLocationId, action) => {
    setUpdatingLocationId(nextLocationId);
    setError("");
    try {
      await managePatientContactShareApproval({ requestId, locationId: nextLocationId, action, explicitAccessToken: accessToken || "" });
      await load();
    } catch (updateError) {
      setError(updateError?.message || "Acordul pentru telefon nu a putut fi actualizat.");
    } finally {
      setUpdatingLocationId("");
    }
  };

  const responses = status?.responses || [];
  const locations = useMemo(() => mergeLocations(results, responses), [responses, results]);
  const responseByLocation = useMemo(() => new Map(responses.map((response) => [response.location_id, response])), [responses]);
  const selectedLocation = locations.find((location) => locationId(location) === selectedLocationId) || null;
  const selectedResponse = selectedLocationId ? responseByLocation.get(selectedLocationId) : null;
  const unreadByLocation = useMemo(() => {
    const counts = {};
    for (const notification of notificationData?.notifications || []) {
      if (notification?.status !== "unread" || !notification?.action_target_id) continue;
      counts[notification.action_target_id] = (counts[notification.action_target_id] || 0) + 1;
    }
    return counts;
  }, [notificationData]);

  const selectLocation = (nextLocationId, nextTab = mobileTab) => {
    setSelectedLocationId(nextLocationId);
    setMobileTab(nextTab);
  };

  const request = status?.request || {
    public_reference: publicReference,
    city: requestDraft?.city,
    county: requestDraft?.county,
    submitted_at: new Date().toISOString(),
  };
  const lifecycle = status?.lifecycle || null;
  const requestTerminal = lifecycle?.terminal === true;
  const reference = request?.public_reference || publicReference || "indisponibila";

  if (loading && !status) {
    return <div className="mt-6 flex min-h-52 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Se incarca spatiul cererii...</div>;
  }

  return (
    <section className="mt-7 rounded-[28px] border border-border bg-secondary/20 p-3 sm:p-5 lg:p-6" aria-label="Spatiul cererii">
      <header className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Spatiul cererii</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-extrabold text-foreground sm:text-2xl">Cererea {reference}</h1>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-bold text-primary">{lifecycle?.state_label || "Activa"}</span>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-bold text-foreground">{lifecycle?.stage_label || "Trimisa"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
              {formatDate(request?.submitted_at, true) && <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Trimisa la {formatDate(request.submitted_at, true)}</span>}
              {request?.expires_at && lifecycle?.state === "active" && <span>Expira la {formatDate(request.expires_at)}</span>}
              {meta?.coverage_status && <span>Acoperire: {meta.coverage_status}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PatientNotificationCenter
              requestId={requestId}
              accessToken={accessToken || ""}
              onDataChange={setNotificationData}
              onOpenTarget={(notification) => {
                if (!notification?.action_target_id) return;
                selectLocation(notification.action_target_id, "messages");
              }}
            />
            <button type="button" onClick={() => void load()} disabled={loading || updatingLifecycle || Boolean(updatingLocationId)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizeaza
            </button>
          </div>
        </div>
      </header>

      {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">{error}</p>}

      <div className="mt-4">
        <PatientRequestLifecyclePanel lifecycle={lifecycle} request={request} updating={updatingLifecycle} onAction={updateLifecycle} />
      </div>

      <div className="mt-4 lg:hidden">
        <nav className="grid grid-cols-3 rounded-2xl border border-border bg-card p-1" aria-label="Navigatia cererii">
          {[
            ["request", "Cererea", Store],
            ["locations", "Locatii", MapPin],
            ["messages", "Mesaje", MessageCircle],
          ].map(([key, label, Icon]) => (
            <button key={key} type="button" onClick={() => { setMobileTab(key); if (key === "request") setSelectedLocationId(""); }} className={`relative inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold ${mobileTab === key ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
              {key === "messages" && Number(notificationData?.counters?.unread || 0) > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
            </button>
          ))}
        </nav>

        <div className="mt-4">
          {mobileTab === "request" && (
            <div className="space-y-4">
              <UrgencyInterruptionSlot requestDraft={requestDraft} />
              <RequestSummary request={request} requestDraft={requestDraft} detailedMessage={detailedMessage} resultCount={locations.length} />
              <RequestWorkspaceTimeline request={request} lifecycle={lifecycle} responses={responses} resultCount={locations.length} />
            </div>
          )}
          {mobileTab === "locations" && (
            selectedLocation ? (
              <SelectedLocationPanel location={selectedLocation} response={selectedResponse} requestId={requestId} accessToken={accessToken} status={status} updatingLocationId={updatingLocationId} onPhoneShare={updatePhoneShare} onBack={() => setSelectedLocationId("")} />
            ) : (
              <LocationRail locations={locations} responses={responses} selectedLocationId={selectedLocationId} unreadByLocation={unreadByLocation} requestTerminal={requestTerminal} onSelect={(id) => selectLocation(id, "locations")} />
            )
          )}
          {mobileTab === "messages" && (
            selectedLocation ? (
              <SelectedLocationPanel location={selectedLocation} response={selectedResponse} requestId={requestId} accessToken={accessToken} status={status} updatingLocationId={updatingLocationId} onPhoneShare={updatePhoneShare} onBack={() => setSelectedLocationId("")} />
            ) : (
              <MessagesList responses={responses} locations={locations} unreadByLocation={unreadByLocation} selectedLocationId={selectedLocationId} onSelect={(id) => selectLocation(id, "messages")} />
            )
          )}
        </div>
      </div>

      <div className="mt-4 hidden gap-5 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <main className="min-w-0">
          {selectedLocation ? (
            <SelectedLocationPanel location={selectedLocation} response={selectedResponse} requestId={requestId} accessToken={accessToken} status={status} updatingLocationId={updatingLocationId} onPhoneShare={updatePhoneShare} onBack={() => setSelectedLocationId("")} />
          ) : (
            <div className="space-y-4">
              <UrgencyInterruptionSlot requestDraft={requestDraft} />
              <RequestSummary request={request} requestDraft={requestDraft} detailedMessage={detailedMessage} resultCount={locations.length} />
              <RequestWorkspaceTimeline request={request} lifecycle={lifecycle} responses={responses} resultCount={locations.length} />
            </div>
          )}
        </main>
        <aside className="min-w-0">
          <div className="sticky top-24 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <LocationRail locations={locations} responses={responses} selectedLocationId={selectedLocationId} unreadByLocation={unreadByLocation} requestTerminal={requestTerminal} onSelect={(id) => selectLocation(id, "locations")} />
          </div>
        </aside>
      </div>
    </section>
  );
}
