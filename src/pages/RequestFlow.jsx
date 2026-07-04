import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { detectCategory, getCategory, rankLocations } from "@/lib/vezunde";
import StepNeed from "@/components/request/StepNeed";
import StepDetails from "@/components/request/StepDetails";
import StepLocation from "@/components/request/StepLocation";
import StepContact from "@/components/request/StepContact";
import StepConfirm from "@/components/request/StepConfirm";

const STEP_LABELS = ["Nevoia", "Detalii", "Locatia", "Contact"];

export default function RequestFlow() {
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get("q") || "";
  const initialCategory = urlParams.get("categorie") || detectCategory(q) || "";

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState([]);
  const [data, setData] = useState({
    description: q,
    category: initialCategory,
    services: getCategory(initialCategory)?.services || [],
    forWhom: "adult",
    urgency: "normala",
    city: "",
    name: "",
    email: "",
    phone: "",
    photos: [],
    providerId: urlParams.get("furnizor") || "",
  });

  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await base44.entities.Request.create({
        need_category: data.category,
        description: data.description,
        service_keys: data.services,
        city: data.city,
        for_whom: data.forWhom,
        urgency: data.urgency,
        contact_name: data.name,
        contact_email: data.email,
        contact_phone: data.phone,
        photo_urls: data.photos,
        provider_location_id: data.providerId,
        status: "noua",
      });
      const all = await base44.entities.Location.list();
      setMatches(rankLocations(all, data.services, data.city).slice(0, 4));
      setStep(4);
    } catch (e) {
      setError("Nu am putut trimite cererea. Incearca din nou.");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-5 pt-12 pb-8">
      {step < 4 && (
        <div className="mb-10 flex items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              <div className={`text-xs font-medium ${i <= step ? "text-primary" : "text-muted-foreground/50"}`}>{label}</div>
              {i < STEP_LABELS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-primary" : "bg-border"}`} />}
            </React.Fragment>
          ))}
        </div>
      )}
      {step === 0 && <StepNeed data={data} update={update} onNext={() => setStep(1)} />}
      {step === 1 && <StepDetails data={data} update={update} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
      {step === 2 && <StepLocation data={data} update={update} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <StepContact data={data} update={update} onSubmit={submit} onBack={() => setStep(2)} submitting={submitting} error={error} />}
      {step === 4 && <StepConfirm matches={matches} data={data} />}
    </div>
  );
}