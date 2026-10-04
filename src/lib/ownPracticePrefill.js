// 2026-10-04 (structura conturilor, pasul 5). Datele cu care pornește formularul de locație nouă
// când un specialist își adaugă cabinetul propriu. Sunt doar sugestii: persoana le vede și le poate
// schimba înainte de trimitere, iar VIASEE verifică solicitarea ca pe orice locație nouă.
//
// Tipul cabinetului urmează profesia, dintre tipurile pe care formularul le oferă deja.
export const OWN_PRACTICE_TYPE_BY_PROFESSION = Object.freeze({
  ophthalmologist: { provider_type: "cabinet_oftalmologic", provider_profile_type: "ophthalmology_office", label: "Cabinet oftalmologic" },
  optometrist: { provider_type: "cabinet_optometric", provider_profile_type: "independent_optometrist", label: "Cabinet optometric" },
  optician: { provider_type: "optica_medicala", provider_profile_type: "independent_optical_store", label: "Optică" },
});

function clean(value, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function ownPracticePrefill(professional) {
  const name = clean(professional?.public_display_name || professional?.full_name, 120);
  const type = OWN_PRACTICE_TYPE_BY_PROFESSION[professional?.professional_type] || null;
  const suggestedName = type && name ? `${type.label} ${name}` : name;
  return {
    organization_name: suggestedName,
    name: suggestedName,
    provider_type: type?.provider_type || "",
    provider_profile_type: type?.provider_profile_type || "",
    phone: clean(professional?.public_phone, 40),
    public_email: clean(professional?.public_email, 160),
  };
}
