import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatProviderSaturdayHours,
  formatProviderWeeklyHours,
  validateProviderOpeningHours,
} from '../shared/providerOpeningHours.js';

const weekly = {
  monday: { open: true, from: '09:00', to: '18:00' },
  tuesday: { open: true, from: '09:00', to: '18:00' },
  wednesday: { open: true, from: '09:00', to: '18:00' },
  thursday: { open: true, from: '09:00', to: '18:00' },
  friday: { open: true, from: '09:00', to: '18:00' },
  saturday: { open: true, from: '09:00', to: '14:00' },
  sunday: { open: false, from: '', to: '' },
};

const valid = validateProviderOpeningHours({
  weekly,
  exceptions: [
    { type: 'closed', start_date: '2026-12-24', end_date: '2026-12-26', public_note: 'Inchis de sarbatori' },
    { type: 'custom', start_date: '2026-12-31', end_date: '2026-12-31', from: '09:00', to: '13:00', public_note: 'Program scurt' },
  ],
});
assert.equal(valid.valid, true);
assert.equal(valid.value.weekly.sunday.open, false);
assert.equal(valid.value.exceptions[0].from, '');
assert.equal(formatProviderWeeklyHours(valid.value.weekly), 'Luni-Vineri: 09:00 - 18:00; Sambata: 09:00 - 14:00; Duminica: Inchis');
assert.equal(formatProviderSaturdayHours(valid.value.weekly), '09:00 - 14:00');

const reversedHours = validateProviderOpeningHours({
  weekly: { ...weekly, monday: { open: true, from: '18:00', to: '09:00' } },
  exceptions: [],
});
assert.equal(reversedHours.valid, false);
assert.match(reversedHours.error, /inchidere/i);

const missingTime = validateProviderOpeningHours({
  weekly: { ...weekly, tuesday: { open: true, from: '', to: '18:00' } },
  exceptions: [],
});
assert.equal(missingTime.valid, false);
assert.match(missingTime.error, /ore valide/i);

const invalidDate = validateProviderOpeningHours({
  weekly,
  exceptions: [{ type: 'closed', start_date: '2026-02-30', end_date: '2026-03-01' }],
});
assert.equal(invalidDate.valid, false);
assert.match(invalidDate.error, /date calendaristice valide/i);

const reversedDates = validateProviderOpeningHours({
  weekly,
  exceptions: [{ type: 'closed', start_date: '2026-07-10', end_date: '2026-07-01' }],
});
assert.equal(reversedDates.valid, false);
assert.match(reversedDates.error, /data de inceput/i);

const overlapping = validateProviderOpeningHours({
  weekly,
  exceptions: [
    { type: 'closed', start_date: '2026-07-01', end_date: '2026-07-03' },
    { type: 'custom', start_date: '2026-07-03', end_date: '2026-07-04', from: '10:00', to: '14:00' },
  ],
});
assert.equal(overlapping.valid, false);
assert.match(overlapping.error, /suprapun/i);

const unknownField = validateProviderOpeningHours({
  weekly: { ...weekly, monday: { open: true, from: '09:00', to: '18:00', timezone: 'Europe/Bucharest' } },
  exceptions: [],
});
assert.equal(unknownField.valid, false);
assert.match(unknownField.error, /campuri nepermise/i);

const copyBackend = readFileSync(new URL('../base44/functions/copyProviderOpeningHours/entry.ts', import.meta.url), 'utf8');
assert.match(copyBackend, /targetIds\.includes\(sourceId\)/, 'source location must be excluded from targets');
assert.match(copyBackend, /target\.organization_id !== source\.organization_id/, 'copy must remain inside one organization');
assert.match(copyBackend, /confirm_replace_existing/, 'existing schedules require explicit replacement confirmation');
assert.match(copyBackend, /provider_copy_opening_hours/, 'copy operation must be audited');
assert.match(copyBackend, /duplicate_skipped/, 'duplicate operations must be idempotent');
assert.doesNotMatch(copyBackend, /availability_status:\s*schedule/, 'copy must not change access mode');
assert.doesNotMatch(copyBackend, /services|specialists|public_visibility_status\s*:/, 'copy payload must not affect unrelated provider data');

const copyPanel = readFileSync(new URL('../src/components/workspace/provider/ProviderHoursCopyPanel.jsx', import.meta.url), 'utf8');
assert.match(copyPanel, /location\.manage_operational_status/, 'UI must filter locations by operational permission');
assert.match(copyPanel, /Vezi preview-ul/, 'UI must require preview before copy');
assert.match(copyPanel, /Confirm inlocuirea/, 'UI must show an explicit overwrite confirmation');
assert.match(copyPanel, /sm:w-auto/, 'primary action must remain usable on mobile');

const comparisonBackend = readFileSync(new URL('../base44/functions/getProviderLocationComparison/entry.ts', import.meta.url), 'utf8');
assert.match(comparisonBackend, /locationIds\.length < 2/, 'comparison must require at least two locations');
assert.match(comparisonBackend, /MAX_LOCATIONS = 6/, 'comparison must cap the number of locations');
assert.match(comparisonBackend, /ProviderMembership\.filter/, 'comparison must validate active membership access');
assert.match(comparisonBackend, /locations\.some\(\(location\) => clean\(location\.organization_id\) !== organizationId\)/, 'comparison must remain inside one organization');
assert.match(comparisonBackend, /read_only: true/, 'comparison response must be explicitly read-only');
assert.match(comparisonBackend, /canonicalServiceEntries/, 'comparison must normalize canonical service differences');
assert.doesNotMatch(comparisonBackend, /entities\.[A-Za-z]+\.(create|update|delete)\(/, 'comparison endpoint must not mutate entities');

const comparisonPanel = readFileSync(new URL('../src/components/workspace/provider/ProviderLocationComparisonPanel.jsx', import.meta.url), 'utf8');
assert.match(comparisonPanel, /getProviderLocationComparison/, 'comparison UI must use the protected comparison endpoint');
assert.match(comparisonPanel, /Doar diferențele/, 'comparison UI must support filtering to differences');
assert.match(comparisonPanel, /md:hidden/, 'comparison must have a dedicated mobile service view');
assert.match(comparisonPanel, /hidden overflow-x-auto md:block/, 'comparison must retain a desktop matrix');
assert.match(comparisonPanel, /Instrumentul nu modifică datele/, 'comparison UI must state its read-only boundary');

const workspaceRoot = readFileSync(new URL('../src/components/workspace/provider/ProviderWorkspaceRoot.jsx', import.meta.url), 'utf8');
assert.match(workspaceRoot, /ProviderLocationComparisonPanel/, 'comparison panel must be exposed in the locations workspace');
assert.match(workspaceRoot, /safeSection === "locations" && !activeLocationModule/, 'comparison must stay at organization location level');

console.log('Provider opening-hours and location comparison contracts: PASS');

await import('./verify-provider-service-copy.mjs');
