import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SERVICES } from "@/lib/vezunde";
import WizardShell from "@/components/intake/WizardShell";
import LocationSearch from "@/components/claim/LocationSearch";
import OnbType from "@/components/onboarding/OnbType";
import ClaimStepConfirm from "@/components/claim/ClaimStepConfirm";
import ClaimStepServices from "@/components/claim/ClaimStepServices";
import ClaimStepStrengths from "@/components/claim/ClaimStepStrengths";
import ClaimStepTeam from "@/components/claim/ClaimStepTeam";
import ClaimStepSchedule from "@/components/claim/ClaimStepSchedule";
import ClaimStepSubmit from "@/components/claim/ClaimStepSubmit";

const STEPS = ["confirm", "type", "services", "strengths", "team", "schedule", "submit"];

const TITLES = {
  confirm: { title: "Confirma datele locatiei", subtitle: "Verifica si completeaza informatiile publice." },
  type: { title: "Ce tip de locatie este?" },
  services: { title: "Pentru ce servicii doriti sa fiti gasiti?", subtitle: "Alege serviciile pe care le oferiti." },
  strengths: { title: "Care sunt punctele voastre forte?", subtitle: "Acestea va diferentiaza in rezultatele pacientilor." },
  team: { title: "Cine lucreaza aici?", subtitle: "Alege tipurile de specialisti din locatie." },
  schedule: { title: "Program si disponibilitate" },
  submit: { title: "Trimite pentru verificare", subtitle: "Datele tale sunt folosite doar pentru verificarea profilului." },
};

const EMPTY = {
  existing: null,
  name: "", city: "", address: "", phone: "", website: "",
  provider_type: "", services: [], strengths: [], team_types: [],
  opening_hours: "", saturday_hours: "", availability_status: "necunoscuta",
};

export default function AddOrClaim() {
  const [stage, setStage] = useState("search"); // search | wizard | done
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const startFromLocation = async (loc) => {
    const [services, specs] = await Promise.all([
      base44.entities.LocationService.filter({ location_id: loc.id }),
      base44.entities.LocationSpecialization.filter({ location_id: loc.id }),
    ]);
    setData({
      ...EMPTY,
      existing: loc,
      name: loc.name || "",
      city: loc.city || "",
      address: loc.address || "",
      phone: loc.phone_public || "",
      website: loc.website || "",
      provider_type: loc.provider_type || "",
      services: services.map((s) => s.service_key),
      strengths: specs.map((s) => s.specialization_key),
      opening_hours: loc.opening_hours || "",
      saturday_hours: loc.saturday_hours || "",
    });
    setStepIdx(0);
    setStage("wizard");
  };

  const startManual = () => {
    setData(EMPTY);
    setStepIdx(0);
    setStage("wizard");
  };

  const onNext = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const onBack = () => {
    if (stepIdx === 0) setStage("search");
    else setStepIdx((i) => i - 1);
  };

  const handleSubmit = async (contact) => {
    setSubmitting(true);
    setError("");
    try {
      const nowIso = new Date().toISOString();
      const locationData = {
        name: data.name, city: data.city, address: data.address, phone_public: data.phone,
        website: data.website, provider_type: data.provider_type,
        opening_hours: data.opening_hours, saturday_hours: data.saturday_hours,
        availability_status: data.availability_status || "necunoscuta",
        ...(data.availability_status && data.availability_status !== "necunoscuta"
          ? { availability_updated_at: nowIso }
          : {}),
        status: "in_verificare",
        data_source: data.existing ? "claim" : "manual",
        last_confirmed_at: nowIso,
      };
      let locationId = data.existing?.id;
      if (locationId) {
        await base44.entities.ProviderLocation.update(locationId, locationData);
        await base44.entities.LocationService.deleteMany({ location_id: locationId });
        await base44.entities.LocationSpecialization.deleteMany({ location_id: locationId });
      } else {
        const loc = await base44.entities.ProviderLocation.create({ ...locationData, is_verified: false });
        locationId = loc.id;
      }
      if (data.services.length > 0) {
        await base44.entities.LocationService.bulkCreate(
          data.services.map((key) => ({ location_id: locationId, service_key: key }))
        );
      }
      if (data.strengths.length > 0) {
        await base44.entities.LocationSpecialization.bulkCreate(
          data.strengths.map((key) => ({ location_id: locationId, specialization_key: key }))
        );
      }
      await base44.entities.ProviderClaimRequest.create({
        location_id: locationId,
        mode: data.existing ? "claim" : "new",
        business_name: data.name,
        contact_name: contact.contact_name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        submitted_payload: JSON.stringify({
          services: data.services.map((s) => SERVICES[s]),
          strengths: data.strengths.map((s) => SERVICES[s]),
          team_types: data.team_types,
        }),
        status: "in_asteptare",
      });
      setStage("done");
    } catch (e) {
      setError("Trimiterea nu a reusit. Incearca din nou.");
    }
    setSubmitting(false);
  };

  if (stage === "done") {
    return (
      <div className="max-w-xl mx-auto px-5 py-20 text-center min-h-[70vh]">
        <CheckCircle2 className="w-12 h-12 mx-auto text-foreground/70" strokeWidth={1.5} />
        <h1 className="mt-5 font-heading text-2xl font-extrabold tracking-tight">Solicitarea a fost trimisa</h1>
        <p className="mt-3 text-muted-foreground text-sm max-w-sm mx-auto">
          Vom verifica datele inainte de publicare.
        </p>
        <Link to="/" className="mt-8 inline-block px-6 py-3 rounded-full text-white text-sm font-medium" style={{ backgroundColor: "#171717" }}>
          Inapoi acasa
        </Link>
      </div>
    );
  }

  if (stage === "search") {
    return (
      <div className="min-h-[80vh]">
        <WizardShell
          title="Gaseste locatia ta"
          subtitle="Cauta dupa nume, oras, adresa sau telefonul public. Vom folosi rezultatul doar pentru a te ajuta sa completezi profilul."
        >
          <LocationSearch onSelect={startFromLocation} onManual={startManual} />
        </WizardShell>
      </div>
    );
  }

  const stepKey = STEPS[stepIdx];

  return (
    <div className="min-h-[80vh]">
      <WizardShell
        step={stepIdx + 1}
        total={STEPS.length}
        title={TITLES[stepKey].title}
        subtitle={TITLES[stepKey].subtitle}
        onBack={onBack}
      >
        {stepKey === "confirm" && <ClaimStepConfirm data={data} update={update} onNext={onNext} />}
        {stepKey === "type" && <OnbType data={data} update={update} onNext={onNext} />}
        {stepKey === "services" && <ClaimStepServices data={data} update={update} onNext={onNext} />}
        {stepKey === "strengths" && <ClaimStepStrengths data={data} update={update} onNext={onNext} />}
        {stepKey === "team" && <ClaimStepTeam data={data} update={update} onNext={onNext} />}
        {stepKey === "schedule" && <ClaimStepSchedule data={data} update={update} onNext={onNext} />}
        {stepKey === "submit" && <ClaimStepSubmit onSubmit={handleSubmit} submitting={submitting} error={error} />}
      </WizardShell>
    </div>
  );
}