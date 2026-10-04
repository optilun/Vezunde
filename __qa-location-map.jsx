import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import ProviderLocations from "./src/components/workspace/provider/ProviderLocations.jsx";
import "./src/index.css";
const location = { id: "visual-test-only", name: "Lunera Optic Store", public_display_name: "Lunera Optic Store", address: "Str. Cupidon nr. 40", locality_name: "Giroc", county_name: "Timiș", lat: 45.6941795, lng: 21.2358535, map_precision: "approximate", status: "inactive", profile_control_status: "verified", claim_verification_status: "approved" };
const workspace = { locations: [location], memberships: [], current_user_capabilities: ["location.manage_profile", "location.manage_content", "location.manage_specialists", "location.manage_operational_status"] };
createRoot(document.getElementById("root")).render(<MemoryRouter><div className="mx-auto max-w-6xl px-4 py-6 sm:px-8"><p className="mb-5 text-xs text-muted-foreground">VIASEE · Verificare vizuală temporară · Datele nu se salvează</p><ProviderLocations workspace={workspace} selectedLocationId={location.id} onSelect={()=>{}} onRefresh={()=>{}} onOpenModule={()=>{}} /></div></MemoryRouter>);
