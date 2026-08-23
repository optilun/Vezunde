// Faza 2: tokenii vizuali ai modulului Servicii, extrasi 1:1 din
// ProviderServicesWorkspaceOperational.jsx. Culorile sunt cele din
// src/components/home/CategoryShowcase.jsx (identitatea de pe homepage).
import {
  Briefcase,
  Building2,
  CheckCircle2,
  CircleDot,
  Eye,
  FileCheck,
  FlaskConical,
  Glasses,
  GraduationCap,
  Home,
  Hospital,
  Microscope,
  PackageOpen,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Store,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

export const inputClass = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/35 focus:ring-2 focus:ring-foreground/5";

export const UNIT_ICONS = {
  optical_store: Store,
  optical_cabinet: Glasses,
  optometry_cabinet: Eye,
  ophthalmology_office: Stethoscope,
  optical_workshop: Wrench,
  optical_laboratory: FlaskConical,
  ophthalmology_diagnostics: Microscope,
  ophthalmology_procedure_room: CircleDot,
  ophthalmology_surgery_unit: Hospital,
  b2b_distribution_center: PackageOpen,
};

export const CAPABILITY_ICONS = {
  contact_lens_sales: CircleDot,
  contact_lens_professional_services: Eye,
  pediatric_eye_care: Users,
  ophthalmology_specialties: ShieldCheck,
  emergency_ophthalmology: Hospital,
  low_vision_rehabilitation: Glasses,
  b2b_distribution: PackageOpen,
  b2b_logistics: Building2,
  b2b_technical_support: Settings2,
};

export const BUSINESS_ATTRIBUTE_ICONS = {
  home_visit_eye_care: Home,
  workplace_vision_screening: Briefcase,
  employer_glasses_reimbursement: FileCheck,
  mobile_optical_unit: Truck,
  school_vision_screening: GraduationCap,
};

export const CAPABILITY_FALLBACK_ICON = CheckCircle2;
export const UNIT_FALLBACK_ICON = Building2;

// Grupurile de servicii pentru care decontarea CAS are sens. Deliberat NU includem
// vanzarea de rame/ochelari sau reparatiile: acelea nu se deconteaza prin casa de
// asigurari, iar un marcaj acolo ar deruta furnizorul (2026-08-06).
export const CAS_ELIGIBLE_GROUPS = new Set([
  "ophthalmology_consults",
  "optometry",
  "investigations",
  "procedures_surgery",
  "specialties",
  "children_and_prevention",
]);

// Culorile exacte din CategoryShowcase.jsx (homepage), mapate pe grupurile canonice
// de servicii (2026-08-06). business_attributes ramane fara culoare - nu e o
// categorie de pe homepage, e un atribut de afacere.
export const GROUP_TONE = {
  optical_retail: { bg: "#efd5c5", border: "#e1bda8", text: "#8a4a28" },
  lenses_and_measurements: { bg: "#efd5c5", border: "#e1bda8", text: "#8a4a28" },
  optometry: { bg: "#dce5e9", border: "#c6d3da", text: "#3d5a68" },
  contact_lenses: { bg: "#dce5e9", border: "#c6d3da", text: "#3d5a68" },
  ophthalmology_consults: { bg: "#e8e0ea", border: "#d4c6d8", text: "#5c4566" },
  specialties: { bg: "#e8e0ea", border: "#d4c6d8", text: "#5c4566" },
  procedures_surgery: { bg: "#e8e0ea", border: "#d4c6d8", text: "#5c4566" },
  children_and_prevention: { bg: "#e8e0ea", border: "#d4c6d8", text: "#5c4566" },
  investigations: { bg: "#dfe3d2", border: "#ccd2ba", text: "#565f3c" },
  technical_activities: { bg: "#eadcba", border: "#dac69b", text: "#6b551f" },
};

// b2b_capabilities (al 11-lea grup canonic, gasit la audit 2026-08-19) ramane
// DELIBERAT fara culoare - acelasi motiv ca la zona B2B (UNIT_TONE mai jos): nu e
// una din cele 5 categorii de pe homepage, e ofertă catre alte optici, nu catre
// pacienti. Simbolul de categorie pur si simplu nu se afiseaza la acele 3 sectiuni -
// comportament corect, nu o scapare.

export const UNIT_TONE = {
  optical_store: GROUP_TONE.optical_retail,
  optical_cabinet: GROUP_TONE.optical_retail,
  optometry_cabinet: GROUP_TONE.optometry,
  ophthalmology_office: GROUP_TONE.ophthalmology_consults,
  optical_workshop: GROUP_TONE.technical_activities,
  optical_laboratory: GROUP_TONE.technical_activities,
  ophthalmology_diagnostics: GROUP_TONE.investigations,
  ophthalmology_procedure_room: GROUP_TONE.ophthalmology_consults,
  ophthalmology_surgery_unit: GROUP_TONE.ophthalmology_consults,
};