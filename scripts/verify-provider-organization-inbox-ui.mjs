import assert from "node:assert/strict";
import { canShowOrganizationInbox, groupOrganizationLeads, locationPlanLabel, mergeFocusedLead, organizationLeadTarget } from "../src/lib/providerOrganizationInboxView.js";

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

const globalOwner = { isOrganizationOwner: true, organizationId: "org", locations: [{ id: "a" }, { id: "b" }] };
const selectiveOwner = { ...globalOwner, locations: [{ id: "a" }] };
assert.equal(canShowOrganizationInbox(globalOwner), true, "An owner with two authorized locations gets the aggregate view");
assert.equal(canShowOrganizationInbox(selectiveOwner), false, "A selective owner with one location remains on its inbox");
assert.equal(canShowOrganizationInbox({ ...globalOwner, isOrganizationOwner: false }), false, "Manager, staff and organization admin do not get the aggregate view");
assert.equal(locationPlanLabel({ a: { plan_code: "pro" }, b: { plan_code: "free" } }, "a"), "Pro");
assert.equal(locationPlanLabel({ a: { plan_code: "pro" }, b: { plan_code: "free" } }, "b"), "Free", "One location's Pro plan must not decorate another's lead");

const firstHundred = Array.from({ length: 100 }, (_, index) => ({ id: "recent-" + index }));
const oldTarget = { id: "older-than-100", location_id: "b" };
assert.equal(mergeFocusedLead(firstHundred, oldTarget)[0], oldTarget, "Deep links beyond the first 100 remain selectable");
assert.equal(mergeFocusedLead(firstHundred, firstHundred[0]).length, 100, "A focused lead already in the list must not duplicate");

console.log("Provider organization inbox presentation checks passed.");
