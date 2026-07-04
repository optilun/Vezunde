import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SERVICES } from "@/lib/vezunde";
import WizardShell from "@/components/intake/WizardShell";
import OnbMode from "@/components/onboarding/OnbMode";
import OnbType from "@/components/onboarding/OnbType";
import OnbServices from "@/components/onboarding/OnbServices";
import OnbStrengths from "@/components/onboarding/OnbStrengths";
import OnbTeam from "@/components/onboarding/OnbTeam";
import OnbPublicInfo from "@/components/onboarding/OnbPublicInfo";
import OnbSubmit from "@/components/onboarding/OnbSubmit";

const STEPS = ["mode", "type", "services", "strengths", "team", "public", "submit"];

const TITLES = {
  mode: { title: "Revendica sau adauga o locatie", subtitle: "Incepe procesul de listare pe Vezunde." },
  type: { title: "Ce tip de locatie este?" },
  services: { title: "Ce servicii oferiti?", subtitle: "Alege toate serviciile disponibile in locatie." },
  strengths: { title: "Care sunt punctele voastre forte?", subtitle: "Acestea ajuta pacientii sa va gaseasca pentru ce stiti sa faceti cel mai bine." },
  team: { title: "Cine lucreaza aici?", subtitle: "Adauga specialistii din locatie." },
  public: { title: "Date publice si program" },
  submit: { title: "Trimite pentru verificare", subtitle: "Verifica rezumatul si lasa-ne datele tale de contact." },
};

export default function ProviderOnboarding() {
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState({
    mode: "", claimLocation: null, provider_type: "", services: [], strengths: [],
    team: [], name: "", city: "", address: "", phone: "", opening_hours: "", description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const stepKey = STEPS[stepIdx];
  const update = (patch) => setData((d) => ({ ...d, ...patch }));
  const onNext = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const onBack = () => setStepIdx((i) => Math.max(i - 1, 0));

  const handleSubmit = async (contact) => {
    setSubmitting(true);
    setError("");
    try {
      const nowIso = new Date().toISOString();
      let locationId = data.claimLocation?.id;
      const locationData = {
        name: data.name, provider_type: data.provider_type, city: data.city,
        address: data.address, phone_public: data.phone, opening_hours: data.opening_hours,
        description: data.description, status: "in_verificare",
        data_source: locationId ? "claim" : "manual", last_confirmed_at: nowIso,
      };
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
      for (const member of data.team) {
        const profile = await base44.entities.ProfessionalProfile.create({
          full_name: member.full_name,
          specializations: member.specializations || [],
          bio: member.bio || "",
        });
        await base44.entities.ProfessionalLocationAssignment.create({
          professional_id: profile.id,
          location_id: locationId,
          professional_type: member.professional_type,
          active_status: "activ",
          public_status: "public",
        });
      }
      await base44.entities.ProviderClaimRequest.create({
        location_id: locationId,
        mode: data.mode === "claim" ? "claim" : "new",
        business_name: data.name,
        contact_name: contact.contact_name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        submitted_payload: JSON.stringify({
          services: data.services.map((s) => SERVICES[s]),
          strengths: data.strengths.map((s) => SERVICES[s]),
          team: data.team.map((m) => `${m.full_name} (${m.professional_type})`),
        }),
        status: "in_asteptare",
      });
      setDone(true);
    } catch (e) {
      setError("Trimiterea nu a reusit. Incearca din nou.");
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto px-5 py-20 text-center min-h-[70vh]">
        <CheckCircle2 className="w-12 h-12 mx-auto text-foreground/70" strokeWidth={1.5} />
        <h1 className="mt-5 font-heading text-2xl font-extrabold tracking-tight">Trimis pentru verificare</h1>
        <p className="mt-3 text-muted-foreground text-sm max-w-sm mx-auto">
          Echipa Vezunde va verifica datele si te va contacta pe email. Profilul devine vizibil ca verificat dupa validare.
        </p>
        <Link to="/" className="mt-8 inline-block px-6 py-3 rounded-full text-white text-sm font-medium" style={{ backgroundColor: "#171717" }}>
          Inapoi acasa
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh]">
      <WizardShell
        step={stepIdx + 1}
        total={STEPS.length}
        title={TITLES[stepKey].title}
        subtitle={TITLES[stepKey].subtitle}
        onBack={stepIdx > 0 ? onBack : undefined}
      >
        {stepKey === "mode" && <OnbMode data={data} update={update} onNext={onNext} />}
        {stepKey === "type" && <OnbType data={data} update={update} onNext={onNext} />}
        {stepKey === "services" && <OnbServices data={data} update={update} onNext={onNext} />}
        {stepKey === "strengths" && <OnbStrengths data={data} update={update} onNext={onNext} />}
        {stepKey === "team" && <OnbTeam data={data} update={update} onNext={onNext} />}
        {stepKey === "public" && <OnbPublicInfo data={data} update={update} onNext={onNext} />}
        {stepKey === "submit" && <OnbSubmit data={data} onSubmit={handleSubmit} submitting={submitting} error={error} />}
      </WizardShell>
    </div>
  );
}