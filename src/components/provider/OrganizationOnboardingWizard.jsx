import React, { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Building2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import WizardShell from "@/components/intake/WizardShell";
import ChoiceCard from "@/components/intake/ChoiceCard";
import ContinueButton from "@/components/intake/ContinueButton";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";
import IdentityDuplicatePanel from "@/components/provider/IdentityDuplicatePanel";
import OnboardingAuthGate from "@/components/provider/OnboardingAuthGate";
import {
  CLAIMANT_RELATIONSHIPS,
  MEMBERSHIP_ROLE_LABELS,
  requestedRoleForRelationship,
} from "@/components/provider/ContactIdentityFields";

export const ORGANIZATION_ONBOARDING_RESUME_KEY = "pending_new_location_wizard";

const PHASES = ["Organizatie", "Locatie", "Cont", "Acces", "Contact", "Revizuire"];
const INPUT = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors focus:border-foreground/50";

const ORG_TYPES = {
  optica_medicala: { label: "Optica medicala", providerType: "optica_medicala", profileType: "independent_optical_store" },
  cabinet_optometric: { label: "Cabinet optometric", providerType: "cabinet_optometric", profileType: "independent_optometrist" },
  cabinet_oftalmologic: { label: "Cabinet oftalmologic", providerType: "cabinet_oftalmologic", profileType: "ophthalmology_office" },
  clinica_oftalmologica: { label: "Clinica oftalmologica", providerType: "clinica_oftalmologica", profileType: "ophthalmology_clinic" },
};

const VERIFICATION_LABELS = {
  manual_review: "Verificare manuala VIASEE",
  official_email: "Email oficial al organizatiei",
  public_phone: "Telefonul public al locatiei",
  existing_owner_approval: "Aprobarea unui owner existent",
};

const INITIAL = {
  organization: { name: "", legal_name: "", organization_type: "", structure: "single" },
  location: {
    name: "",
    provider_type: "",
    provider_profile_type: "",
    city: "",
    county: "",
    locality_siruta_code: "",
    county_code: "",
    uat_code: "",
    uat_name: "",
    address: "",
    phone_public: "",
    public_email: "",
    website: "",
    place_id: "",
    lat: null,
    lng: null,
  },
  contact: {
    contact_name: "",
    claimant_relationship: "",
    email: "",
    phone: "",
    representation_confirmed: false,
    verification_method: "manual_review",
  },
  identityExtra: {},
};

function readResume() {
  try {
    const raw = sessionStorage.getItem(ORGANIZATION_ONBOARDING_RESUME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveResume(data, step) {
  try {
    sessionStorage.setItem(ORGANIZATION_ONBOARDING_RESUME_KEY, JSON.stringify({ data, step }));
  } catch {
    // The current flow remains usable even if session storage is unavailable.
  }
}

function clearResume() {
  sessionStorage.removeItem(ORGANIZATION_ONBOARDING_RESUME_KEY);
}

function buildInitialData(resume, prefill) {
  const base = {
    ...INITIAL,
    organization: { ...INITIAL.organization },
    location: { ...INITIAL.location },
    contact: { ...INITIAL.contact },
    identityExtra: {},
  };
  if (resume?.data) {
    return {
      ...base,
      ...resume.data,
      organization: { ...base.organization, ...(resume.data.organization || {}) },
      location: { ...base.location, ...(resume.data.location || {}) },
      contact: { ...base.contact, ...(resume.data.contact || {}) },
      identityExtra: { ...(resume.data.identityExtra || {}) },
    };
  }
  if (!prefill) return base;
  return {
    ...base,
    organization: { ...base.organization, name: prefill.organization_name || prefill.name || "" },
    location: {
      ...base.location,
      name: prefill.name || "",
      city: prefill.city || "",
      county: prefill.county || "",
      address: prefill.address || "",
      phone_public: prefill.phone || "",
      website: prefill.website || "",
      place_id: prefill.place_id || "",
      lat: typeof prefill.lat === "number" ? prefill.lat : null,
      lng: typeof prefill.lng === "number" ? prefill.lng : null,
    },
  };
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[62%] text-right font-medium">{value || "—"}</span>
    </div>
  );
}

export default function OrganizationOnboardingWizard({ prefill, onDone, onExit, onClaimExisting }) {
  const [resume] = useState(readResume);
  const [data, setData] = useState(() => buildInitialData(resume, prefill));
  const dataRef = useRef(data);
  const [step, setStepState] = useState(() => resume?.step || "organization");
  const [identityCheck, setIdentityCheck] = useState(null);
  const [duplicateSource, setDuplicateSource] = useState("precheck");
  const [checkingIdentity, setCheckingIdentity] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const setStep = (next) => {
    setStepState(next);
    saveResume(dataRef.current, next);
  };

  const replaceData = (next, stepForResume = step) => {
    dataRef.current = next;
    setData(next);
    saveResume(next, stepForResume);
  };

  const patchOrganization = (patch) => {
    const current = dataRef.current;
    replaceData({ ...current, organization: { ...current.organization, ...patch } });
  };
  const patchLocation = (patch) => {
    const current = dataRef.current;
    replaceData({ ...current, location: { ...current.location, ...patch } });
  };
  const patchContact = (patch) => {
    const current = dataRef.current;
    replaceData({ ...current, contact: { ...current.contact, ...patch } });
  };

  const requestedRole = useMemo(
    () => requestedRoleForRelationship(data.contact.claimant_relationship),
    [data.contact.claimant_relationship],
  );
  const selectedType = ORG_TYPES[data.organization.organization_type];
  const computedProfileType = data.organization.organization_type === "optica_medicala" && data.organization.structure === "multiple"
    ? "optical_chain"
    : selectedType?.profileType || "";

  const exitWizard = () => {
    clearResume();
    onExit?.();
  };

  const goFromOrganization = () => {
    const current = dataRef.current;
    const type = ORG_TYPES[current.organization.organization_type];
    if (!type || !current.organization.name.trim()) return;
    const profileType = current.organization.organization_type === "optica_medicala" && current.organization.structure === "multiple"
      ? "optical_chain"
      : type.profileType;
    const next = {
      ...current,
      location: {
        ...current.location,
        name: current.location.name || current.organization.name,
        provider_type: type.providerType,
        provider_profile_type: profileType,
      },
    };
    replaceData(next, "location");
    setStepState("location");
  };

  const locationValid = Boolean(
    data.location.name.trim() &&
    data.location.locality_siruta_code &&
    data.location.address.trim() &&
    (data.location.phone_public.trim() || data.location.public_email.trim())
  );

  const checkIdentity = async () => {
    if (!locationValid || checkingIdentity) return;
    const current = dataRef.current;
    setCheckingIdentity(true);
    setError("");
    const response = await base44.functions.invoke("findProviderIdentityCandidates", {
      context: "provider_public_precheck",
      candidate: {
        organization_name: current.organization.name,
        location_name: current.location.name,
        provider_profile_type: current.location.provider_profile_type,
        locality_siruta_code: current.location.locality_siruta_code,
        address: current.location.address,
        phone_public: current.location.phone_public,
        public_email: current.location.public_email,
        website: current.location.website,
      },
      limit: 8,
    }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setCheckingIdentity(false);
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    if (response.data?.blocking_level && response.data.blocking_level !== "none") {
      setDuplicateSource("precheck");
      setIdentityCheck(response.data);
      setStepState("duplicate");
      saveResume(current, "duplicate");
      return;
    }
    setStep("auth");
  };

  const handleAuthenticated = useCallback((user) => {
    const current = dataRef.current;
    const next = {
      ...current,
      contact: {
        ...current.contact,
        contact_name: current.contact.contact_name || user?.full_name || user?.name || "",
        email: current.contact.email || user?.email || "",
      },
    };
    replaceData(next, "access");
    setStepState("access");
  }, []);

  const goBack = () => {
    const previous = {
      location: "organization",
      duplicate: duplicateSource === "submit" ? "review" : "location",
      auth: "location",
      access: "auth",
      contact: "access",
      review: "contact",
    }[step];
    if (previous) setStep(previous);
    else exitWizard();
  };

  const submit = async (identityExtraOverride = null) => {
    if (submitting) return;
    const authenticated = await base44.auth.isAuthenticated();
    if (!authenticated) {
      setStep("auth");
      return;
    }
    const current = dataRef.current;
    const type = ORG_TYPES[current.organization.organization_type];
    const profileType = current.organization.organization_type === "optica_medicala" && current.organization.structure === "multiple"
      ? "optical_chain"
      : type?.profileType || current.location.provider_profile_type;
    setSubmitting(true);
    setError("");
    const response = await base44.functions.invoke("submitProviderClaim", {
      mode: "new_location",
      claim_subject_type: "organization",
      claimant_relationship: current.contact.claimant_relationship,
      requested_membership_role: requestedRoleForRelationship(current.contact.claimant_relationship),
      verification_method: current.contact.verification_method || "manual_review",
      organization: {
        name: current.organization.name.trim(),
        legal_name: current.organization.legal_name.trim(),
        organization_type: profileType,
        structure: current.organization.structure,
      },
      location: {
        ...current.location,
        name: current.location.name.trim(),
        provider_type: type?.providerType || current.location.provider_type,
        provider_profile_type: profileType,
      },
      contact: current.contact,
      representation_confirmed: current.contact.representation_confirmed,
      ...(identityExtraOverride || current.identityExtra),
    }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSubmitting(false);
    if (response.data?.identity_check) {
      setDuplicateSource("submit");
      setIdentityCheck(response.data.identity_check);
      setStepState("duplicate");
      saveResume(current, "duplicate");
      return;
    }
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    clearResume();
    onDone?.(response.data);
  };

  if (step === "duplicate" && identityCheck) {
    const strong = identityCheck.blocking_level === "strong_duplicate_review_required";
    return (
      <WizardShell phases={PHASES} phaseStep={duplicateSource === "submit" ? 6 : 2} title="Am gasit profiluri asemanatoare" subtitle="Verifica rezultatele inainte sa cream o locatie noua." onBack={goBack}>
        <IdentityDuplicatePanel
          check={identityCheck}
          submitting={submitting}
          onClaim={(candidate) => {
            clearResume();
            onClaimExisting?.({
              id: candidate.location_id,
              name: candidate.name,
              organization_name: candidate.organization_name,
              provider_type: candidate.provider_type,
              provider_profile_type: candidate.provider_profile_type,
              city: candidate.locality_name,
              county: candidate.county_name,
              address: candidate.address,
              claim_action: candidate.claim_action,
            });
          }}
          onContinueDistinct={(note) => {
            const extra = strong
              ? { escalate_duplicate_review: true, identity_difference_note: note }
              : { identity_difference_note: note };
            setIdentityCheck(null);
            if (duplicateSource === "submit") {
              submit(extra);
              return;
            }
            const current = dataRef.current;
            const next = { ...current, identityExtra: extra };
            replaceData(next, "auth");
            setStepState("auth");
          }}
          onCancel={goBack}
        />
      </WizardShell>
    );
  }

  if (step === "organization") {
    const valid = data.organization.name.trim() && data.organization.organization_type;
    return (
      <WizardShell phases={PHASES} phaseStep={1} title="Despre organizatie" subtitle="Incepem cu identitatea opticii, clinicii sau cabinetului." onBack={exitWizard}>
        <div className="space-y-4 text-left">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Numele public al organizatiei *</label>
            <input className={INPUT} value={data.organization.name} onChange={(e) => patchOrganization({ name: e.target.value })} placeholder="Exemplu: Optica Vista" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Denumirea juridica</label>
            <input className={INPUT} value={data.organization.legal_name} onChange={(e) => patchOrganization({ legal_name: e.target.value })} placeholder="Optional; nu apare public automat" />
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Tipul organizatiei *</div>
            <div className="space-y-2.5">
              {Object.entries(ORG_TYPES).map(([key, item]) => (
                <ChoiceCard key={key} label={item.label} selected={data.organization.organization_type === key} onClick={() => patchOrganization({ organization_type: key })} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Structura organizatiei *</div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <ChoiceCard label="O singura locatie" hint="Poti adauga alte locatii ulterior." selected={data.organization.structure === "single"} onClick={() => patchOrganization({ structure: "single" })} />
              <ChoiceCard label="Mai multe locatii" hint="Prima locatie se adauga acum." selected={data.organization.structure === "multiple"} onClick={() => patchOrganization({ structure: "multiple" })} />
            </div>
          </div>
          <ContinueButton onClick={goFromOrganization} disabled={!valid}>Continua cu prima locatie</ContinueButton>
        </div>
      </WizardShell>
    );
  }

  if (step === "location") {
    const selectLocality = (locality) => patchLocation({
      locality_siruta_code: locality?.siruta_code || "",
      city: locality?.name || "",
      county: locality?.county_name || "",
      county_code: locality?.county_code || "",
      uat_code: locality?.uat_code || "",
      uat_name: locality?.uat_name || "",
    });
    return (
      <WizardShell phases={PHASES} phaseStep={2} title="Prima locatie" subtitle="Datele de aici identifica locatia. Profilul complet se configureaza dupa aprobarea accesului." onBack={goBack}>
        <div className="space-y-4 text-left">
          {data.location.place_id && <div className="rounded-xl border border-border bg-secondary/35 px-4 py-3 text-xs text-muted-foreground">Date preluate din Google Maps. Verifica fiecare camp inainte de continuare.</div>}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Numele locatiei *</label>
            <input className={INPUT} value={data.location.name} onChange={(e) => patchLocation({ name: e.target.value })} placeholder="Poate fi identic cu numele organizatiei" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Localitatea *</label>
            <LocalityAutocomplete placeholder="Cauta in lista oficiala" value={data.location.locality_siruta_code ? { display_label: `${data.location.city}${data.location.county ? ", " + data.location.county : ""}` } : null} onSelect={selectLocality} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Adresa completa *</label>
            <input className={INPUT} value={data.location.address} onChange={(e) => patchLocation({ address: e.target.value })} placeholder="Strada, numar, detalii utile" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Telefon public</label>
              <input className={INPUT} value={data.location.phone_public} onChange={(e) => patchLocation({ phone_public: e.target.value })} placeholder="Va putea aparea pe profil" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Email public</label>
              <input className={INPUT} type="email" value={data.location.public_email} onChange={(e) => patchLocation({ public_email: e.target.value })} placeholder="Va putea aparea pe profil" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Este necesar cel putin un contact public: telefon sau email.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <ContinueButton onClick={checkIdentity} disabled={!locationValid} loading={checkingIdentity}>Verifica si continua</ContinueButton>
        </div>
      </WizardShell>
    );
  }

  if (step === "auth") {
    return (
      <WizardShell phases={PHASES} phaseStep={3} title="Contul care va administra solicitarea" subtitle="Autentificarea are loc inainte de colectarea datelor private de reprezentare." onBack={goBack}>
        <OnboardingAuthGate onAuthenticated={handleAuthenticated} title="Continua cu un cont VIASEE" />
      </WizardShell>
    );
  }

  if (step === "access") {
    const valid = data.contact.claimant_relationship && data.contact.representation_confirmed;
    return (
      <WizardShell phases={PHASES} phaseStep={4} title="Ce relatie ai cu organizatia?" subtitle="Relatia stabileste rolul pe care il soliciti. Rolul final este confirmat dupa verificare." onBack={goBack}>
        <div className="space-y-4 text-left">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Organizatie</div>
            <div className="font-semibold">{data.organization.name}</div>
            <div className="mt-1 flex items-start gap-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{data.location.name}, {data.location.city}</div>
          </div>
          <div className="space-y-2.5">
            {Object.entries(CLAIMANT_RELATIONSHIPS).map(([key, label]) => (
              <ChoiceCard key={key} label={label} selected={data.contact.claimant_relationship === key} onClick={() => patchContact({ claimant_relationship: key })} />
            ))}
          </div>
          {data.contact.claimant_relationship && (
            <div className="rounded-xl border border-border bg-secondary/35 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Acces solicitat:</span> <span className="font-semibold">{MEMBERSHIP_ROLE_LABELS[requestedRole]}</span>
            </div>
          )}
          <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={data.contact.representation_confirmed} onChange={(e) => patchContact({ representation_confirmed: e.target.checked })} />
            <span>Confirm ca reprezint organizatia si ca sunt autorizat sa solicit acest acces.</span>
          </label>
          <ContinueButton onClick={() => setStep("contact")} disabled={!valid}>Continua cu datele de verificare</ContinueButton>
        </div>
      </WizardShell>
    );
  }

  if (step === "contact") {
    const valid = data.contact.contact_name.trim() && data.contact.email.trim();
    return (
      <WizardShell phases={PHASES} phaseStep={5} title="Date private de verificare" subtitle="Aceste date nu apar pe profilul public al organizatiei sau locatiei." onBack={goBack}>
        <div className="space-y-4 text-left">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nume complet *</label>
            <input className={INPUT} value={data.contact.contact_name} onChange={(e) => patchContact({ contact_name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Email pentru comunicarea solicitarii *</label>
            <input className={INPUT} type="email" value={data.contact.email} onChange={(e) => patchContact({ email: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Telefon</label>
            <input className={INPUT} value={data.contact.phone} onChange={(e) => patchContact({ phone: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Cum putem confirma initial legatura ta?</label>
            <select className={INPUT} value={data.contact.verification_method} onChange={(e) => patchContact({ verification_method: e.target.value })}>
              {Object.entries(VERIFICATION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Echipa VIASEE poate solicita o alta metoda sau informatii suplimentare.</p>
          </div>
          <ContinueButton onClick={() => setStep("review")} disabled={!valid}>Continua spre revizuire</ContinueButton>
        </div>
      </WizardShell>
    );
  }

  const typeLabel = selectedType?.label || ORG_TYPES[data.organization.organization_type]?.label;
  return (
    <WizardShell phases={PHASES} phaseStep={6} title="Revizuieste solicitarea" subtitle="Cererea nu publica automat profilul si nu acorda acces pana la verificare." onBack={goBack}>
      <div className="space-y-3 text-left">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Building2 className="h-3.5 w-3.5" />Organizatie si locatie</div>
          <Row label="Organizatie" value={data.organization.name} />
          <Row label="Denumire juridica" value={data.organization.legal_name} />
          <Row label="Tip" value={typeLabel} />
          <Row label="Structura" value={data.organization.structure === "multiple" ? "Mai multe locatii" : "O singura locatie"} />
          <Row label="Prima locatie" value={data.location.name} />
          <Row label="Localitate" value={`${data.location.city}${data.location.county ? ", " + data.location.county : ""}`} />
          <Row label="Adresa" value={data.location.address} />
          <Row label="Telefon public" value={data.location.phone_public} />
          <Row label="Email public" value={data.location.public_email} />
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acces si verificare</div>
          <Row label="Relatie" value={CLAIMANT_RELATIONSHIPS[data.contact.claimant_relationship]} />
          <Row label="Rol solicitat" value={MEMBERSHIP_ROLE_LABELS[requestedRole]} />
          <Row label="Nume" value={data.contact.contact_name} />
          <Row label="Email privat" value={data.contact.email} />
          <Row label="Telefon privat" value={data.contact.phone} />
          <Row label="Metoda initiala" value={VERIFICATION_LABELS[data.contact.verification_method]} />
        </section>
        {data.identityExtra?.identity_difference_note && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>Locatia seamana cu un profil existent. Explicatia ta va fi analizata manual: „{data.identityExtra.identity_difference_note}”</div>
          </div>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Prin trimitere confirmi informatiile si accepti <Link to="/termeni" className="underline underline-offset-2">Termenii</Link> si <Link to="/confidentialitate" className="underline underline-offset-2">Politica de confidentialitate</Link>.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <ContinueButton onClick={() => submit()} loading={submitting}>Trimite spre verificare</ContinueButton>
      </div>
    </WizardShell>
  );
}
