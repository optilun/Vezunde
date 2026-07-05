import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";

// Module 3H.1B.3.UI: first screen of the new-location flow — subject type
// only. No provider-type list shown here.
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
        hint="Pentru optici, clinici, cabinete, laboratoare B2C sau organizatii cu una sau mai multe locatii."
        selected={data.claimSubjectType === "organization"}
        onClick={() => choose("organization")}
      />
      <ChoiceCard
        label="Sunt profesionist independent"
        hint="Pentru medici oftalmologi, optometristi sau opticieni care lucreaza independent."
        selected={data.claimSubjectType === "independent_professional"}
        onClick={() => choose("independent_professional")}
      />
    </div>
  );
}