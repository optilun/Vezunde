import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveProviderLocationAccess } from "../src/lib/providerWorkspaceAccess.js";

const context = {
  capabilities: [
    "organization.view",
    "location.view",
    "location.manage_content",
    "location.manage_specialists",
  ],
  locations: [
    {
      id: "location-manager",
      current_user_role: "location_manager",
      capabilities: [
        "organization.view",
        "location.view",
        "location.manage_content",
        "location.manage_specialists",
      ],
    },
    {
      id: "location-staff",
      current_user_role: "location_staff",
      capabilities: [
        "organization.view",
        "location.view",
        "location.manage_requests",
        "location.manage_operational_status",
      ],
    },
  ],
  memberships: [
    {
      location_id: "location-manager",
      role: "location_manager",
      capabilities: ["location.manage_content"],
    },
    {
      location_id: "location-staff",
      role: "location_staff",
      capabilities: ["location.manage_requests"],
    },
  ],
};

const managerAccess = resolveProviderLocationAccess(context, "location-manager");
assert.equal(managerAccess.role, "location_manager");
assert.equal(managerAccess.capabilities.includes("location.manage_content"), true);

const staffAccess = resolveProviderLocationAccess(context, "location-staff");
assert.equal(staffAccess.role, "location_staff");
assert.equal(staffAccess.capabilities.includes("location.manage_content"), false, "Capabilities from another location must not leak into the selected location");
assert.equal(staffAccess.capabilities.includes("location.manage_requests"), true);

const missingAccess = resolveProviderLocationAccess(context, "missing-location");
assert.deepEqual(missingAccess, { role: "", capabilities: [] });

const modulePage = await readFile(new URL("../src/components/workspace/provider/ProviderLocationModulePage.jsx", import.meta.url), "utf8");
assert.match(modulePage, /resolveProviderLocationAccess\(workspace, locationId\)/);
assert.doesNotMatch(modulePage, /workspace\.current_user_capabilities/, "Location modules must not use organization-wide merged capabilities");

const workspaceRoot = await readFile(new URL("../src/components/workspace/provider/ProviderWorkspaceRoot.jsx", import.meta.url), "utf8");
assert.match(workspaceRoot, /resolveProviderLocationAccess\(selectedContext \|\| workspace, selectedLocationId\)/, "Workspace root must derive permissions for the selected location");
assert.match(workspaceRoot, /locationCapabilities\.has\(LOCATION_MODULE_CAPABILITIES\[requestedLocationModule\]\)/, "Route access must use selected-location capabilities");
assert.match(workspaceRoot, /const targetAccess = accessForLocation\(locationId\)/, "Opening or switching a location module must re-check the target location");
assert.match(workspaceRoot, /current_location_role: selectedLocationAccess\.role/, "Scoped workspace must expose the selected location role");
assert.doesNotMatch(workspaceRoot, /const capabilities = new Set\(selectedContext\?\.capabilities \|\| \[\]\)/, "Organization-wide capabilities must not drive location controls");

console.log("Provider location access scope checks passed.");
