import React from "react";
import ConversationalCard from "@/components/intake2/ConversationalCard";
import PatientRequestResume from "@/pages/PatientRequestResume";
import { INTENTS, LEGACY_CATEGORY_TO_INTENT } from "@/lib/intentRegistry";
import { readPatientRequestReformulation } from "@/lib/patientNoResponseReviewClient";

export default function RequestFlow() {
  const urlParams = new URLSearchParams(window.location.search);
  const publicReference = urlParams.get("ref") || "";
  const q = urlParams.get("q") || "";
  const cat = urlParams.get("categorie") || "";
  const reformulationId = urlParams.get("reformulation") || "";
  const reformulation = reformulationId ? readPatientRequestReformulation(reformulationId) : null;
  const intent = reformulation?.request_draft?.intent
    || (INTENTS[cat] ? cat : LEGACY_CATEGORY_TO_INTENT[cat] || null);
  const initialMessage = reformulation?.detailed_message || q;

  return (
    <div
      className="flex min-h-[calc(100svh-4rem)] items-start justify-center overflow-x-clip px-3 py-5 sm:px-5 sm:py-14 md:py-20"
      style={{ background: "linear-gradient(180deg, #E9ECF4 0%, #F5F3EE 50%, #F7F2E8 100%)" }}
    >
      <div className={`w-full safe-area-bottom ${publicReference ? "max-w-7xl" : "max-w-3xl"}`}>
        {publicReference ? (
          <PatientRequestResume publicReference={publicReference} />
        ) : (
          <ConversationalCard
            initialMessage={initialMessage}
            initialIntent={intent}
            reformulation={reformulation}
          />
        )}
      </div>
    </div>
  );
}
