import { getProviderServiceSections } from "../../shared/serviceOperationalTaxonomy.js";

export const PROVIDER_SERVICE_AREAS = [
  { key: "products", label: "Produse optice" },
  { key: "professional_services", label: "Servicii profesionale" },
  { key: "technical_services", label: "Servicii tehnice" },
  { key: "medical_services", label: "Consultații și investigații" },
  { key: "medical_specialties", label: "Specializări medicale" },
  { key: "medical_procedures", label: "Proceduri și chirurgie" },
  { key: "b2b", label: "Ofertă B2B" },
];

export const PROVIDER_SERVICE_SECTIONS = getProviderServiceSections();

export const PROVIDER_SERVICE_SECTION_BY_KEY = Object.fromEntries(
  PROVIDER_SERVICE_SECTIONS.map((section) => [section.key, section]),
);
