import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workspace = await readFile(new URL('../src/components/intake2/RequestWorkspace.jsx', import.meta.url), 'utf8');
const locationCard = await readFile(new URL('../src/components/intake2/RequestWorkspaceLocationCard.jsx', import.meta.url), 'utf8');
const timeline = await readFile(new URL('../src/components/intake2/RequestWorkspaceTimeline.jsx', import.meta.url), 'utf8');
const submission = await readFile(new URL('../src/components/intake2/PatientRequestSubmission.jsx', import.meta.url), 'utf8');
const notificationCenter = await readFile(new URL('../src/components/notifications/NotificationCenter.jsx', import.meta.url), 'utf8');
const patientNotificationCenter = await readFile(new URL('../src/components/notifications/PatientNotificationCenter.jsx', import.meta.url), 'utf8');
const chat = await readFile(new URL('../src/components/intake2/PatientRequestChat.jsx', import.meta.url), 'utf8');
const lifecycle = await readFile(new URL('../src/components/intake2/PatientRequestLifecyclePanel.jsx', import.meta.url), 'utf8');
const matchResults = await readFile(new URL('../src/components/intake2/MatchResults.jsx', import.meta.url), 'utf8');

assert.match(submission, /import RequestWorkspace from "\.\/RequestWorkspace"/);
assert.match(submission, /<RequestWorkspace/);
// 2026-09-1x: garda de tip a migrat din prop-ul inline in starea de submisie -
// `submittedResults` e setat o singura data la trimitere cu
// `Array.isArray(results) ? results : []` si initializat implicit ca `[]`, deci
// RequestWorkspace primeste mereu un array, exact ca inainte.
assert.match(submission, /setSubmittedResults\(Array\.isArray\(results\) \? results : \[\]\)/);
assert.match(submission, /const \[submittedResults, setSubmittedResults\] = useState\(\[\]\)/);
assert.match(submission, /results=\{submittedResults\}/);
assert.match(submission, /requestDraft=\{submittedDraft\}/);
assert.doesNotMatch(submission, /<PatientRequestResponseStatus/);
assert.match(matchResults, /<PatientRequestSubmission results=\{list\} meta=\{activeMeta\} onRequestCreated=\{onRequestCreated\}/);

assert.match(workspace, /lg:grid-cols-\[minmax\(0,2fr\)_minmax\(320px,1fr\)\]/);
assert.match(workspace, /sticky top-24/);
assert.match(workspace, /Spațiul cererii/);
assert.match(workspace, /Locații pentru cererea ta/);
assert.match(workspace, /Top 3/);
assert.match(workspace, /Rezultate suplimentare/);
assert.match(workspace, /\["request", "Cererea", Store\]/);
assert.match(workspace, /\["locations", "Locații", MapPin\]/);
assert.match(workspace, /\["messages", "Mesaje", MessageCircle\]/);
assert.match(workspace, /<PatientRequestLifecyclePanel/);
assert.match(workspace, /<PatientRequestChat/);
assert.match(workspace, /<PatientNotificationCenter/);
assert.match(workspace, /managePatientContactShareApproval/);
assert.match(workspace, /updatePatientRequestLifecycle/);
assert.match(workspace, /Permite accesul la telefon/);
assert.match(workspace, /Retrage accesul la telefon/);
assert.match(workspace, /target="_blank"/);
assert.match(workspace, /data-component="UrgencyInterruption"/);
assert.match(workspace, /result_bucket === "top3"/);
assert.match(workspace, /result_bucket !== "top3"/);
assert.doesNotMatch(workspace, /base44\.entities\./);
assert.doesNotMatch(workspace, /contact_phone\s*:|access_token_hash|contact_email_hash|requester_user_id/);
assert.doesNotMatch(workspace.toLowerCase(), /cel mai bun|analizeaza cererea|typing/);

assert.match(locationCard, /Listată/);
assert.match(locationCard, /Revendicată/);
assert.match(locationCard, /Verificată/);
assert.match(locationCard, /Cerere trimisă/);
assert.match(locationCard, /Locația poate ajuta/);
assert.match(locationCard, /Vezi profilul/);
assert.match(locationCard, /unread > 0/);
assert.match(timeline, /Cronologia cererii/);
assert.match(timeline, /Cererea a fost trimisă/);
assert.match(timeline, /Locațiile potrivite sunt disponibile/);

assert.match(notificationCenter, /onDataChange/);
assert.match(notificationCenter, /onDataChange\?\.\(data\)/);
assert.match(patientNotificationCenter, /onOpenTarget/);
assert.match(patientNotificationCenter, /onDataChange/);
assert.match(patientNotificationCenter, /request_access_token: accessToken/);
assert.doesNotMatch(patientNotificationCenter, /base44\.entities\.InAppNotification/);

assert.match(chat, /Nu introduce telefon, email sau linkuri/);
assert.match(chat, /Deschide conversația/);
assert.match(lifecycle, /Cererea a fost rezolvată/);
assert.match(lifecycle, /Închide cererea/);

console.log('Request Workspace v1 checks passed.');
