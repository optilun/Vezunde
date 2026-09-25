import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sanitizeProviderInAppNotification as sanitizeLocal } from '../shared/inAppNotificationPolicy.js';
import { sanitizeProviderInAppNotification as sanitizeRuntime } from '../base44/shared/inAppNotificationPolicy.js';
import {
  providerNotificationLocationIds,
  resolveProviderNotificationLocation,
  mergeProviderNotificationResults,
  settleProviderNotificationLocations,
} from '../src/lib/providerNotificationScope.js';

const row = {
  id: 'notification-a',
  event_key: 'provider_lead_available',
  title: 'Cerere noua',
  body: 'Rezumat anonim',
  status: 'unread',
  action_kind: 'lead',
  action_target_id: 'lead-a',
  location_id: 'foreign-location',
  request_id: 'request-secret',
  recipient_ref_id: 'user-secret',
  contact_email: 'secret@example.com',
};
const authorizedLocation = { id: 'location-a', public_display_name: 'Locatia A' };
const expected = sanitizeLocal(row, authorizedLocation);
assert.deepEqual(sanitizeRuntime(row, authorizedLocation), expected);
assert.equal(expected.location_id, 'location-a');
assert.equal(expected.location_name, 'Locatia A');
for (const forbidden of ['request_id', 'recipient_ref_id', 'contact_email']) {
  assert.equal(Object.hasOwn(expected, forbidden), false);
}

const ids = providerNotificationLocationIds('', [
  { id: 'location-a' }, { id: 'location-b' }, { id: 'location-a' }, { id: '' },
]);
assert.deepEqual(ids, ['location-a', 'location-b']);
assert.equal(resolveProviderNotificationLocation({ location_id: 'location-b' }, ids), 'location-b');
assert.equal(resolveProviderNotificationLocation({ location_id: 'foreign-location' }, ids), '');
assert.equal(resolveProviderNotificationLocation({}, ids), '');
assert.equal(resolveProviderNotificationLocation({}, ['location-a'], 'location-a'), 'location-a');

const merged = mergeProviderNotificationResults([
  {
    counters: { total: 2, unread: 1 },
    notifications: [
      { id: 'notification-a', location_id: 'location-a', created_date: '2026-09-25T10:00:00Z' },
      { id: 'notification-shared', location_id: 'location-a', created_date: '2026-09-25T09:00:00Z' },
    ],
  },
  {
    counters: { total: 1, unread: 1 },
    notifications: [
      { id: 'notification-b', location_id: 'location-b', created_date: '2026-09-25T11:00:00Z' },
      { id: 'notification-shared', location_id: 'location-a', created_date: '2026-09-25T09:00:00Z' },
    ],
  },
]);
assert.deepEqual(merged.notifications.map((item) => item.id), [
  'notification-b', 'notification-a', 'notification-shared',
]);
assert.deepEqual(merged.counters, { total: 3, unread: 2 });

let inFlight = 0;
let maxInFlight = 0;
const settled = await settleProviderNotificationLocations(
  Array.from({ length: 11 }, (_, index) => `location-${index}`),
  async (id) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 2));
    inFlight -= 1;
    if (id === 'location-7') throw new Error('No access');
    return id;
  },
);
assert.equal(settled.length, 11);
assert.equal(settled.filter((item) => item.status === 'rejected').length, 1);
assert.ok(maxInFlight <= 5, 'fanout must stay bounded');
assert.ok(maxInFlight > 1, 'independent authorized locations may load concurrently');

const providerCenter = await readFile(new URL('../src/components/notifications/ProviderNotificationCenter.jsx', import.meta.url), 'utf8');
const genericCenter = await readFile(new URL('../src/components/notifications/NotificationCenter.jsx', import.meta.url), 'utf8');
assert.match(providerCenter, /resolveProviderNotificationLocation\(notification, locationIds/);
assert.match(providerCenter, /location_id: targetLocationId/);
assert.match(providerCenter, /onOpenTarget\(\{ \.\.\.notification, location_id: targetLocationId \}\)/);
assert.match(genericCenter, /markNotificationRead\(notification\.id, notification\)/);
assert.match(genericCenter, /notification\.location_name/);

console.log('Provider notification scope checks passed.');
