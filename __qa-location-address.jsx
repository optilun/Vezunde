import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "./src/index.css";
import { base44 } from "./src/api/base44Client";
import ProviderLocationsWithPhoto from "./src/components/workspace/provider/ProviderLocationsWithPhoto";
let draft = null;
base44.functions.invoke = async (name, p) => {
  if (name === "searchGeographicLocalities") return { data: { results: [{ siruta_code: "54975", name: "Cluj-Napoca", county_name: "Cluj", county_code: "CJ", display_label: "Cluj-Napoca, Cluj" }] } };
  if (name === "submitProviderWorkspaceChange") {
    if (p.action === "list_mine") return { data: { submissions: draft ? [draft] : [] } };
    if (p.action === "create_draft" || p.action === "update_draft") { draft = { id: "qa-draft-only", section: "location_details", status: "draft", payload_json: JSON.stringify(p.payload) }; return { data: { submission: draft } }; }
    return { data: {} };
  }
  return { data: { candidates: [] } };
};
const loc = { id: "qa-location-only", organization_id: "qa-org-only", name: "Lunera Optic Store", public_display_name: "Lunera Optic Store", address: "Str. Cupidon, nr. 40", city: "Giroc", locality_name: "Giroc", county: "Timiș", county_name: "Timiș", locality_siruta_code: "qa-giroc", lat: 45.6941795, lng: 21.2358535, map_precision: "approximate", public_phone: "0721152307", public_email: "contact@optilun.com", status: "publicata", active_status: "inactiva", profile_control_status: "verified", claim_verification_status: "approved", public_visibility_status: "approved" };
const workspace = { locations: [loc], organizations: [{ id: "qa-org-only", name: "Lunera Optic Store" }], current_user_capabilities: ["organization.manage_locations", "location.manage_profile", "location.manage_content", "location.manage_specialists", "location.manage_operational_status"] };
createRoot(document.getElementById("root")).render(<MemoryRouter><div className="min-h-screen bg-background text-foreground"><div className="border-b border-border px-6 py-4 font-bold">VIASEE <span className="ml-3 text-xs font-normal text-muted-foreground">Preview de verificare · date de test</span></div><main className="mx-auto max-w-[1340px] p-5 sm:p-8"><ProviderLocationsWithPhoto workspace={workspace} selectedLocationId={loc.id} onSelect={()=>{}} onRefresh={()=>{}} onOpenModule={()=>{}} /></main></div></MemoryRouter>);
