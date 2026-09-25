import assert from "node:assert/strict";
import { groupOrganizationLeads, organizationLeadTarget } from "../src/lib/providerOrganizationInboxView.js";

const deliveredTwice = [
  { id: "lead-a", location_id: "loc-a", group_key: "opaque-1", preview_summary: "aceeasi descriere" },
  { id: "lead-b", location_id: "loc-b", group_key: "opaque-1", preview_summary: "aceeasi descriere" },
  { id: "lead-c", location_id: "loc-a", group_key: "opaque-2", preview_summary: "aceeasi descriere" },
];
const groups = groupOrganizationLeads(deliveredTwice);
assert.equal(groups.length, 2, "Only an authorized opaque group key may merge deliveries");
assert.deepEqual(groups[0].leads.map((lead) => lead.id), ["lead-a", "lead-b"]);
assert.deepEqual(groups[1].leads.map((lead) => lead.id), ["lead-c"]);
assert.deepEqual(organizationLeadTarget({ ...deliveredTwice[1], is_historical: true }), {
  leadId: "lead-b",
  locationId: "loc-b",
  history: true,
}, "Opening a grouped delivery must preserve its exact lead and location");
assert.equal(organizationLeadTarget({ id: "lead-without-location" }), null);
assert.equal(groupOrganizationLeads([{ id: "x" }, { id: "y" }]).length, 2, "Ungrouped rows stay separate");

console.log("Provider organization inbox presentation checks passed.");
