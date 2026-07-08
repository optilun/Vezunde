import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";

// Module 3H.1B.3.UI: first screen of the onboarding flow — subject type only.
// Patient-facing organizations, independent professionals and B2B suppliers are
// separated from the first step so they can route to different workspaces later.
export default function WizSubjectType({ data, update, next }) {
  const choose = (subjectType) => {
    update({
      claimSubjectType: subjectType,
      // Independent professionals claim on their own behalf — default silently
      // to satisfy the existing required claimant_relationship field.
      contact: {
        ...data.contact,
        claimant_relationship: subjectType === "independent_professional" ? "owner" : data.contact.claimant_relationship,
      },
    });
    next();
  };
  return (
    <div className="space-y-3">
      <ChoiceCard
        label="Reprezint o organizatie"
        hint="Pentru optici, clinici, cabinete sau organizatii cu una sau mai multe locatii care pot aparea in directorul pacientilor."
        selected={data.claimSubjectType === "organization"}
        onClick={() => choose("organization")}
      />
      <ChoiceCard
        label="Sunt profesionist independent"
        hint="Pentru medici oftalmologi, optometristi sau opticieni. Profilul este profesional si poate fi afiliat unei locatii."
        selected={data.claimSubjectType === "independent_professional"}
        onClick={() => choose("independent_professional")}
      />
      <ChoiceCard
        label="Sunt furnizor / partener B2B"
        hint="Pentru firme care vand produse, servicii, aparatura, lentile, rame, training sau solutii pentru optici si clinici."
        selected={data.claimSubjectType === "b2b_supplier"}
        onClick={() => choose("b2b_supplier")}
      />
    </div>
  );
}