import React from "react";
import ProfessionalCardFrame from "@/components/results/ProfessionalCardFrame";

// Cardul de specialist pentru rasfoirea directorului (/cauta).
//
// 2026-09-03. Perechea lui DirectoryResultCard si supus aceleiasi reguli: fara scor, fara insigna
// de recomandare, fara stilizare de Top 3. Rasfoirea nu este o recomandare - pacientul se uita
// peste cine exista intr-o localitate, nu primeste un raspuns la o nevoie. A imprumuta aici
// vizualul de rezultat potrivit ar transforma o listare alfabetica intr-un clasament implicit.
//
// 2026-09-30. Acelasi cadru vizual ca al locatiilor (ProfessionalCardFrame: celula de grila,
// coperta, numele mare, sageata spre profil). Regula ramane: nu trimitem nimic in `details`, deci
// nu apare nicio informatie de potrivire.

export default function ProfessionalDirectoryCard({ professional }) {
  const specializations = Array.isArray(professional.specialization_labels)
    ? professional.specialization_labels
    : [];
  return <ProfessionalCardFrame professional={professional} specializations={specializations} />;
}
