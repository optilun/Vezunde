import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { LEGACY_CATEGORY_MAP, INTAKE_CATEGORIES } from "@/lib/intake";
import { analyzeIntakeText } from "@/lib/aiIntake";
import WizardShell from "@/components/intake/WizardShell";
import StepCategory from "@/components/intake/StepCategory";
import StepDetails from "@/components/intake/StepDetails";
import StepCity from "@/components/intake/StepCity";
import StepTiming from "@/components/intake/StepTiming";
import StepPreferences from "@/components/intake/StepPreferences";
import StepResults from "@/components/intake/StepResults";
import StepContact from "@/components/intake/StepContact";
import StepDone from "@/components/intake/StepDone";

const TITLES = {
  category: { title: "Cu ce te putem ajuta?", subtitle: "Alege situatia care ti se potriveste." },
  city: { title: "Unde cauti?", subtitle: "Alege orasul in care vrei sa mergi." },
  timing: { title: "Cand ai nevoie?" },
  preferences: { title: "Ce conteaza pentru tine?", subtitle: "Poti alege mai multe optiuni." },
  results: { title: "Unde poti merge", subtitle: "Locuri potrivite pentru nevoia ta." },
  contact: { title: "Trimite solicitarea", subtitle: "Furnizorul primeste nevoia ta, nu datele tale de contact." },
  done: { title: "" },
};

export default function RequestFlow() {
  const params = new URLSearchParams(window.location.search);
  const initialText = params.get("q") || "";
  const legacyCat = LEGACY_CATEGORY_MAP[params.get("categorie")] || "";

  const [data, setData] = useState({
    category: legacyCat,
    detailLabel: "",
    for_whom: "",
    services: [],
    problemText: "",
    photos: [],
    city: "",
    timing: "",
    urgency: "normala",
    preferences: [],
    provider: null,
  });
  const [stepKey, setStepKey] = useState("category");
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(!!initialText);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initialText) return;
    analyzeIntakeText(initialText)
      .then(setAiSuggestion)
      .catch(() => {})
      .finally(() => setAiLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasDetails = (cat) => cat && cat !== "nesigur";

  const flow = useMemo(() => {
    const steps = ["category"];
    if (hasDetails(data.category)) steps.push("details");
    steps.push("city", "timing", "preferences", "results", "contact", "done");
    return steps;
  }, [data.category]);

  const progressSteps = flow.filter((s) => !["results", "contact", "done"].includes(s));
  const progressIndex = progressSteps.indexOf(stepKey);

  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const goNext = (categoryOverride) => {
    const cat = categoryOverride || data.category;
    const steps = ["category"];
    if (hasDetails(cat)) steps.push("details");
    steps.push("city", "timing", "preferences", "results", "contact", "done");
    setStepKey(steps[steps.indexOf(stepKey) + 1]);
  };

  const goBack = () => {
    const i = flow.indexOf(stepKey);
    if (i > 0) setStepKey(flow[i - 1]);
  };

  const handleRequest = (location) => {
    update({ provider: location });
    setStepKey("contact");
  };

  const handleSubmit = async (contact) => {
    setSubmitting(true);
    setError("");
    try {
      const request = await base44.entities.PatientRequest.create({
        intent: data.category,
        original_message: initialText,
        service_keys: data.services,
        location_scope: "city",
        city: data.city,
        ...(data.for_whom ? { for_whom: data.for_whom } : {}),
        urgency: data.urgency,
        timing_key: data.timing,
        preferences: data.preferences,
        selected_location_id: data.provider?.id || "",
        status: "noua",
        ...contact,
      });
      const nowIso = new Date().toISOString();
      const answers = [
        ["categorie", data.category],
        ["detaliu", data.detailLabel],
        ["descriere", data.problemText],
        ["pentru_cine", data.for_whom],
        ["oras", data.city],
        ["moment", data.timing],
        ["preferinte", data.preferences.join(", ")],
      ]
        .filter(([, v]) => v)
        .map(([question_key, answer_value]) => ({
          request_id: request.id,
          question_key,
          answer_value,
          answered_at: nowIso,
        }));
      if (answers.length > 0) await base44.entities.IntakeAnswer.bulkCreate(answers);
      if (data.photos.length > 0) {
        await base44.entities.RequestAttachment.bulkCreate(
          data.photos.map((url) => ({ request_id: request.id, file_url: url, kind: "photo" }))
        );
      }
      await base44.functions.invoke("matchProviders", {
        service_keys: data.services,
        city: data.city,
        request_id: request.id,
        selected_location_id: data.provider?.id || undefined,
      });
      setStepKey("done");
    } catch (e) {
      setError("Solicitarea nu a putut fi trimisa. Incearca din nou.");
    }
    setSubmitting(false);
  };

  const detailsTitle =
    stepKey === "details"
      ? INTAKE_CATEGORIES.find((c) => c.key === data.category)?.label
      : "";

  const meta = stepKey === "details"
    ? { title: require_title(data.category), subtitle: detailsTitle }
    : TITLES[stepKey];

  return (
    <div className="min-h-[80vh]">
      <WizardShell
        step={progressIndex >= 0 ? progressIndex + 1 : undefined}
        total={progressIndex >= 0 ? progressSteps.length : undefined}
        title={meta.title}
        subtitle={meta.subtitle}
        onBack={stepKey !== "category" && stepKey !== "done" ? goBack : undefined}
      >
        {stepKey === "category" && (
          <StepCategory data={data} update={update} onNext={goNext} aiSuggestion={aiSuggestion} aiLoading={aiLoading} />
        )}
        {stepKey === "details" && <StepDetails data={data} update={update} onNext={goNext} />}
        {stepKey === "city" && <StepCity data={data} update={update} onNext={goNext} />}
        {stepKey === "timing" && <StepTiming data={data} update={update} onNext={goNext} />}
        {stepKey === "preferences" && <StepPreferences data={data} update={update} onNext={goNext} />}
        {stepKey === "results" && <StepResults data={data} onRequest={handleRequest} />}
        {stepKey === "contact" && <StepContact onSubmit={handleSubmit} submitting={submitting} error={error} />}
        {stepKey === "done" && <StepDone provider={data.provider} />}
      </WizardShell>
    </div>
  );
}

function require_title(category) {
  const titles = {
    control_vedere: "Este pentru tine sau pentru un copil?",
    ochelari_lentile: "Ce cauti?",
    reparatii: "Ce s-a intamplat?",
    problema_ochi: "Descrie ce te deranjeaza",
  };
  return titles[category] || "Detalii";
}