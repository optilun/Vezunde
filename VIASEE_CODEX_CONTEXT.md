# VIASEE CODEX CONTEXT

Version: 1.0
Status: Canonical Implementation Reference
Date: 2026-08-04
Owner: VIASEE

---

# 0. SCOPUL DOCUMENTULUI

Acest document este sursa unica de adevar pentru proiectul VIASEE.
El compara documentele strategice cu implementarea reala si prezinta arhitectura completa, toate entitatile, toate fluxurile, toate problemele si toate recomandarile.

Acest document poate fi citit de orice LLM (Claude, Codex, etc.) ca baza de lucru.

---

# 1. VIZIUNEA PRODUSULUI

VIASEE este o platforma nationala pentru descoperirea serviciilor de sanatate vizuala din Romania.

Misiunea: descoperirea si increderea.
Nu este marketplace, ERP, CRM sau magazin.
Este "Google Maps al opticii medicale".

Ordinea de dezvoltare:
1. Directory national
2. Claim
3. Provider Dashboard
4. Membership
5. Reviews
6. Appointments
7. Analytics
8. Expansion Europe

Principii non-negociabile:
- Nu exista profile verified automat
- Nu exista servicii presupuse
- Nu exista specialisti inventati
- Nu exista adrese inventate
- Nu exista publicare a profilelor conflictuale
- Nu exista modificare automata a profilelor revendicate
- Calitatea datelor > viteza
- 95% date corecte > 100% date rapide

---

# 2. ORIGINE SI REBRANDING

Proiectul a pornit ca "Vezunde" si a fost rebranduit in "VIASEE".
Repository-ul GitHub este `optilun/Vezunde`.
Toate deciziile noi folosesc denumirea VIASEE.

Deploy revision curenta: `viasee-runtime-resync-2026-07-28-directory-runtime-info-compat-4`

---

# 3. ARHITECTURA COMPLETA

## 3.1 Frontend (React + Tailwind CSS + Vite)

Stack: React 18, Tailwind CSS, shadcn/ui, lucide-react, react-router-dom v6, @tanstack/react-query, framer-motion, react-leaflet, recharts, react-quill-new, @hello-pangea/dnd, three.js, date-fns, lodash, react-markdown.

Structura:
```
src/
  App.jsx                    — Router principal cu lazy loading, AuthProvider, QueryClientProvider
  index.css                  — Design tokens (HSL), fonturi (Manrope, Fraunces), workspace-neutral overrides
  pages/                     — Paginile aplicatiei (Home, Search, ProviderProfile, RequestFlow, AdminDirectoryOps, etc.)
  components/
    admin/                   — Dashboard admin (directory ops, review queues, research, dashboard)
    intake2/                 — Patient request flow (conversational card, match results, chat, recovery)
    workspace/               — Provider workspace (services, hours, media, leads, team, settings)
    provider/                — Provider onboarding (claim, new location wizard, search)
    home/                    — Homepage sections (hero, showcase, categories)
    results/                 — Search result cards
    ui/                      — shadcn/ui primitives (button, dialog, select, etc.)
    seo/                     — RouteSeo component
    guards/                  — RequireAuth, RequireAdmin
    notifications/           — Notification centers (patient + provider)
    specialists/             — Specialist landing page sections
    geo/                     — LocalityAutocomplete
  lib/                       — Logica partajata frontend (AuthContext, base44Client, intake, maps, analytics, etc.)
  api/                       — base44Client.js, base44LatestFunctionClient.js, base44FunctionRouting.js
  hooks/                     — use-mobile
  styles/                    — CSS module files pentru provider si admin
```

Rute (src/App.jsx):
- Publice: `/`, `/cauta`, `/parteneri`, `/despre-viasee`, `/furnizor/:id`, `/specialist/:id`, `/cerere`, `/ghid`, `/ghid/:slug`, `/adauga-sau-revendica`, legal pages
- Auth: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/accept-professional-invitation`, `/accept-provider-invitation`
- Protected: `/contul-meu`, `/ajutor-si-suport`, `/dupa-login`, `/profil-profesional/nou`
- Admin: `/admin/operatiuni`

Design tokens (src/index.css):
- Background: `45 22% 96%` (warm cream)
- Foreground: `0 0% 7%` (near black)
- Primary: `0 0% 9%`
- Font heading/body: Manrope
- Font display: Fraunces (serif)
- Radius: 0.5rem
- Dark mode definit dar neactivat implicit

## 3.2 Backend (Base44 Backend Functions — Deno runtime)

48 functii backend deployate:
```
acceptProviderMemberInvitation, authorizePatientRequestDistribution, browseDirectoryProviders,
controlledChatOps, createPatientRequest, createProviderMemberInvitation, deactivateProviderMember,
directoryOps, findProviderIdentityCandidates, getClaimableProviderLocations, getMyProfessionalWorkspace,
getMyProviderWorkspace, getPatientRequestStatus, getProviderClaimScopeOptions, getPublicLocationsForSearch,
getPublicOrganizationBrand, getPublicProfessionalProfile, getPublicProviderContent, getPublicProviderProfile,
getPublicProviderShowcase, getServiceSearchCatalog, listProviderMemberInvitations, manageMyProfessionalProfile,
managePatientContactShareApproval, manageProfessionalAssignment, matchProviders, matchProvidersSemantic,
patientRequestEmailVerificationOps, placesAutocomplete, placesDetails, professionalInvitationOps,
providerLeadContactAccessOps, providerLeadInboxOps, providerLeadResponseOps, providerLocationExpansionOps,
providerLocationIdentityResolutionOps, providerLocationLifecycleOps, providerServiceConfigurationOps,
reactivateProviderMember, revokeProviderMemberInvitation, searchGeographicLocalities, setProviderMemberAccess,
submitDirectoryCorrection, submitProviderClaim, submitProviderScopedClaim, syncProviderOrganizationOwnerAccess,
updateProviderLocation, updateProviderMemberRole
```

Pattern arhitectural:
- `directoryOps` este functia umbrela cu router intern (`router.ts`)
- Router-ul mapeaza `__function` la handlere specifice (directoryImportOps, adminProviderClaimReview, etc.)
- Fiecare handler primeste `Request` si returneaza `Response.json()`
- SDK: `createClientFromRequest(req)` -> `base44.auth.me()`, `base44.asServiceRole`
- Import: `npm:@base44/sdk@0.8.31`
- Crypto: `crypto.randomUUID()`, `crypto.subtle.digest()`
- Extern: `npm:fflate@0.8.2` pentru dezarhivare ZIP

## 3.3 Shared Libraries

PROBLEMA CRITICA: Exista doua directoare paralele cu aceeasi logica:
- `shared/` — 60+ fisiere
- `base44/shared/` — 60+ fisiere (aceeasi logica, copii)

Acest duplicat a fost identificat ca dead-end in istoricul dezvoltarii. Migrarea completa a esuat din cauza problemelor de path resolution. Backend functions folosesc `base44/shared/`, dar unele importa din `../../shared/`.

Fisiere shared critice (in `base44/shared/`):
- `directoryImportPipeline.js` — Normalizare, canonicalizare, validare, hash-uri, token-uri
- `directoryOrganizationTypeMapping.js` — Taxonomie organizatii, legacy -> canonical mapping
- `directoryOrganizationReconciliation.js` — Planificare reconciliere organizatii
- `directoryLocationReconciliation.js` — Planificare reconciliere locatii, state, link, evidence
- `directoryIdentityMatchPolicy.js` — Politici de potrivire identitate (external key, nume, adresa)
- `directoryBatchOrganizationPlanning.js` — Descriere organizatie per batch, validare compatibilitate
- `directoryImportReadPolicy.js` — Error handling, retry logic, transient failure detection
- `directoryFunctionRouting.js` — Rute pentru functii directory
- `canonicalServiceRegistry.js` — Registru servicii canonice
- `controlledChatLock.js` / `controlledChatPolicy.js` — Lock-uri si politici chat controlat
- `patientConversationAgent.js` — Agent conversatie pacient
- `patientGuidancePlanner.js` — Planificare ghidare pacient
- `providerLeadEligibility.js` — Eligibilitate lead-uri provider

## 3.4 Workflows (Automatizari)

Workflow curent:
- `Directory Auto Import Scheduler` — Cron la 5 minute (`*/5 * * * *`), timezone Europe/Bucharest
  - Trigger: scheduled
  - Activity: `invoke_backend_function` -> `directoryOps` cu `__function: directoryImportOps`, action `advance_auto_import_runs`
  - Scop: avanseaza automat rularile de import aprobate/in curs, fara dependenta de browser

## 3.5 Secrets

- `google_oauth_client_secret` — Autentificare Google OAuth
- `GOOGLE_PLACES_API_KEY` — Google Places API pentru autocomplete si detalii locatii

## 3.6 Integrations

- `Core.InvokeLLM` — Apeluri LLM (gpt_5_mini, gemini_3_flash, claude_sonnet_4_6, etc.)
- `Core.UploadFile` — Incarcare fisiere publice
- `Core.UploadPrivateFile` — Incarcare fisiere private
- `Core.CreateFileSignedUrl` — URL-uri semnate pentru fisiere private
- `Core.GenerateImage` — Generare imagini AI
- `Core.GenerateVideo` — Generare video AI (Veo 3.x)
- `Core.GenerateSpeech` — Text-to-speech
- `Core.SendEmail` — Email catre utilizatori inregistrati
- `Core.TranscribeAudio` — Transcriere audio (Whisper)
- `Core.ExtractDataFromUploadedFile` — Extragere date din CSV/Excel/JSON/PDF

## 3.7 Payment Provider

- Stripe disponibil in regiunea RO
- `@stripe/react-stripe-js` si `@stripe/stripe-js` instalate
- Base44 Payments / Wix Payments NU este disponibil in RO

---

# 4. SCHEMA BAZEI DE DATE

## 4.1 Entitati principale

### ProviderOrganization
Compania juridica. Contine: name, legal_name, website, organization_type (legacy), organization_type_code (canonical), directory_external_key, control_status, publication_status, data_quality_status, profile_completeness, public_visibility_status, status (activa/inactiva).
Relatii: 1 -> N ProviderLocation

### ProviderLocation
Punctul fizic. Contine: organization_id, name, provider_type, provider_profile_type, city, county, locality_siruta_code, address, lat, lng, phone_public, public_email, website, description, photo_url, opening_hours, request_intake_status, public_visibility_status, status (draft/in_verificare/publicata/suspendata), profile_control_status (directory/claimed/verified/suspended), verification_state, data_source, availability_status, research_status.
Relatii: N -> 1 ProviderOrganization, 1 -> N LocationService, 1 -> N ProfessionalLocationAssignment, 1 -> N ProviderLocationDirectoryState, 1 -> N DirectoryOrganizationLocationLink

### Location
Entitate legacy (posibil noutilizata sau depasita). Contine campuri similare cu ProviderLocation dar mai simpla.

### ProviderLocationDirectoryState
Starea de director a unei locatii. Contine: location_id, directory_external_key, address_fingerprint, location_type_code, care_setting_code, ownership_type_code, operational_status, data_quality_status, publication_status, control_status, directory_detail_level, directory_basic_details_approved, state_status (active/superseded).

### DirectoryOrganizationLocationLink
Legatura organizatie -> locatie. Contine: organization_id, location_id, source_row_key, source_version, link_status, confidence, evidence_summary, link_record_status (active/superseded).

### Professional
Persoana fizica. Specialist independent.

### ProfessionalProfile
Profil profesional legat de locatie.

### ProfessionalLocationAssignment
Asignarea profesionistilor la locatii.

### LocationService
Serviciile oferite intr-o locatie. Separat de ProviderLocation pentru cautare si filtrare.

### LocationSpecialization
Specializarile unei locatii.

### LocationFacility
Facilitatile unei locatii.

### LocationEquipment
Echipamentele unei locatii.

### ProductBrandOffering
Brandurile de produse oferite intr-o locatie (rame, lentile, lentile de contact, etc.).

### ProviderMembership
Membership atasat organizatiei (nu locatie).

### ProviderSubscription
Abonament Stripe.

### ProviderArticle
Articole publicate de provideri.

### ProviderMediaAsset
Asset-uri media (foto, video) pentru provideri.

## 4.2 Entitati de import director

### DirectoryAutoImportRun
Rularea completa a unei campanii de import. Contine: run_key, contract_version, campaign_mode (strict_import/national_directory), publication_mode, status (awaiting_approval/approved/running/paused/completed/blocked/failed/cancelled), manifest_url, package_sha256, total_batches, completed_batches, blocked_batches, failed_batches, total_rows, applied_rows, skipped_rows, failed_rows, current_sequence, current_step, safety_policy_json, result_json, approval_token_hash, approved_by_user_id, started_at, finished_at, last_heartbeat_at, execution_lock_token, execution_lock_expires_at, failure_message.

### DirectoryAutoImportItem
Un lot (batch) dintr-o rulare. Contine: run_id, sequence, item_key, status (pending/fetching/snapshot_created/rows_appended/validated/planned/approved/running/completed/blocked/failed/skipped), step, source_url, source_sha256, selected_sha256, expected_sha256, expected_rows, source_rows, selected_rows, excluded_rows, selection_result_json, source_payload_json, organization_count, snapshot_id, batch_id, execution_lock_token, applied_rows, skipped_rows, failed_rows, safety_result_json, result_json, failure_message, started_at, finished_at, last_heartbeat_at.

### DirectoryAutoImportPayloadChunk
Fragmente private ale payload-ului de import (pentru a ocoli limitele de camp). Contine: run_id, item_key, chunk_index, chunk_count, payload_chunk, payload_sha256, created_for_selected_rows.

### DirectorySourceSnapshot
Snapshot imutabil al sursei. Contine: snapshot_key, contract_version, source_name, source_version, source_sha256, source_format, original_filename, column_map_json, status (draft/uploading/validating/ready/blocked/imported/archived), total_rows, uploaded_rows, valid_rows, blocked_rows, duplicate_rows, warning_rows, summary_json, created_by_user_id, created_by_email, created_at_source, finalized_at, immutable_at.

### DirectoryImportBatch
Lotul de executie. Contine: batch_key, snapshot_id, contract_version, source_version, source_sha256, idempotency_key, mode (dry_run/import), status (draft/planning/ready/approved/running/completed/completed_with_errors/failed/rolling_back/rolled_back/rollback_failed), execution_cursor, rollback_cursor, execution_lock_token, approval_token_hash, approved_by_user_id, total_rows, valid_rows, blocked_rows, ready_rows, applied_rows, failed_rows, skipped_rows, created_organizations, created_locations, updated_locations, created_links, summary_json, started_at, finished_at, failure_message.

### DirectoryImportRow
Randul individual de import. Contine: snapshot_id, batch_id, row_number, source_row_key, row_hash, idempotency_key, organization_external_key, location_external_key, address_fingerprint, raw_payload_json, normalized_payload_json, planned_action (create_organization_and_location/create_location_use_existing_organization/create_location_without_organization/update_existing_location/link_existing_location/skip_unchanged/skip_duplicate/block_conflict/reject_invalid), planned_actions_json, status (raw/valid/blocked/ready/applied/skipped/failed/rolled_back), validation_codes, validation_errors_json, validation_warnings_json, match_strategy, match_confidence, candidate_matches_json, target_organization_id, target_location_id, admin_override_json, before_snapshot_json, result_json, error_message, applied_at, rollback_status.

### DirectoryImportMutation
Mutatie individuala pentru rollback. Contine: batch_id, row_id, sequence, mutation_key, entity_type (ProviderOrganization/ProviderLocation/ProviderLocationDirectoryState/DirectoryOrganizationLocationLink/ProviderEvidence), entity_id, operation (create/update), before_json, after_json, rollback_status (pending/not_required/completed/failed), rollback_error, applied_at, rolled_back_at.

### DirectoryAuditRecord
Audit log. Contine: entity_type, entity_id, action_type, changed_fields, previous_values, new_values, admin_user_id, admin_email, note, performed_at.

### DirectoryLocationIdentityLink
Legatura identitate locatie.

### DirectoryCorrectionRequest
Cerere corectare director.

## 4.3 Entitati de cerere pacient

### PatientRequest
Cererea initiala a pacientului.

### PatientRequestAnswer
Raspunsurile pacientului la intrebarile intake.

### Request
Cererea (poate fi entitate legacy sau paralela).

### RequestMatch
Potriviri intre cerere si provideri.

### ProviderLead
Lead-ul livrat unui provider. Contine: request_id, organization_id, location_id, intent, service_keys, city, county, access_tier (free_preview/pro_full), contact_access_state, conversation_access_state, delivery_state, status (new/viewed/interested/needs_details/declined/closed/expired), eligibility_reasons, expires_at.

### ProviderLeadResponse
Raspunsul providerului la un lead.

### PatientRequestConversation
Conversatia dintre pacient si provider.

### PatientRequestMessage
Mesajele din conversatie.

### PatientRequestContact
Contactul aprobat pentru partajare.

### ContactShareApproval
Aprobare partajare contact.

### PatientRequestRecoveryCase
Caz de recuperare pentru cereri fara raspuns.

### InAppNotification
Notificare in-app pentru provider sau pacient.

### CommunicationDelivery
Livrare comunicare (email, notificare).

## 4.4 Entitati de claim si verificare

### ClaimRequest / ProviderClaimRequest
Cerere revendicare profil.

### ProviderClaimScopeSelection
Selectia scope-ului de claim (location/selected_locations/organization).

### ProviderClaimLocationSelection
Selectia locatiilor pentru claim.

### VerificationRecord
Inregistrare verificare (manual/email/phone/document).

## 4.5 Entitati geografice

### GeographicLocality
Localitate canonica cu SIRUTA. Contine: siruta_code, county_name, county_code, uat_code, uat_name, is_active.

### GeographicImportRun
Rularea importului geografic.

## 4.6 Entitati de cercetare

### ResearchSource
Sursa de cercetare (URL sau text manual).

### AIResearchRun / AIResearchDraft
Rulari si draft-uri de cercetare AI.

## 4.7 Alte entitati

### User
Built-in. Read-only: id, created_date, full_name, email. Editable: role (admin/user).

### Organization
Entitate legacy (posibil inlocuita de ProviderOrganization).

### SafetyFlag
Flag de siguranta.

### SupportTicket
Ticket suport.

### UserFeedback
Feedback utilizator.

### AuditLog
Log audit general.

### GooglePlacesConfig / GooglePlacesUsage / PlacesApiUsage
Configurare si usage Google Places API.

---

# 5. MODULUL DIRECTORY — ANALIZA COMPLETA

## 5.1 Pipeline-ul de import (18 etape)

### Etapa 1: Source Registry
Datele provin din registrul national. Accepta:
- URL-uri JSON individuale
- Arhiva ZIP cu fisiere JSON (cu sau fara manifest)
- Registrul master JSON direct
- ZIP cu batch-uri agregate

Functie: `descriptorsFromZipBase64()`, `descriptorsFromManifest()`, `nationalRowsFromPrivateSourceBase64()`

### Etapa 2: Normalize
Normalizare campuri prin `FIELD_ALIASES` (mapare alias -> camp canonica).
- `normalizeIdentityText()` — diacritice, whitespace, lowercase
- `normalizeAddressForFingerprint()` — sterge prefixe strada/bulevard/numar
- `mapOperationalStatus()` — mapeaza statusuri operationale
- `dataQualityFor()` — clasificare calitate (high/medium/low/conflict)
- `pseudoRowReason()` — detecteaza randuri aggregate/false

Functie: `normalizeDirectoryImportRow()` in `base44/shared/directoryImportPipeline.js`

### Etapa 3: Canonicalize
Generare chei canonice stabile:
- `organization_external_key` — `org:${hash(nume)}`
- `location_external_key` — `loc:${hash(localitate|adresa|nume)}`
- `address_fingerprint` — `addr:${hash(siruta|adresa)}`

Aceste chei NU se schimba intre versiuni.

### Etapa 4: Geography Validation
Validare SIRUTA prin `GeographicLocality` entity.
Ordine incredere: SIRUTA > UAT > Judet > Oras > Coordonate.
`enrichRowsWithCanonicalGeography()` adauga county_name, county_code, uat_code, uat_name si seteaza `geography_validation_error`.

### Etapa 5: Identity Generation
Generare identitati prin `nationalIdentityKey()`:
- Prioritate 1: `external:${location_external_key}`
- Prioritate 2: `identity:${locality}|${address}|${name}`
- Prioritate 3: `source:${source_row_key}`

### Etapa 6: Deduplication
`selectRowsForNationalDirectory()` — selecteaza cele mai bune randuri per identitate.
`selectRowsForAutomaticImport()` — filtreaza dupa `import_readiness`, `research_status`, `operational_status`, `review_flags`.
`excludeControlledOrAmbiguousLiveMatches()` — exclude randuri care se potrivesc cu profile controlled (claimed/verified/suspended).
`reconcileNationalOrganizationKeys()` — reconciliaza organizatii existente dupa external key, nume, domain.

### Etapa 7: Snapshot
`createSnapshot()` — creeaza snapshot imutabil. Status: uploading.
`appendRows()` — adauga randuri. Verifica idempotency_key pentru deduplicare.
`finalizeSnapshot()` — valideaza toate randurile, marcheaza ca `ready` + `immutable_at`.

### Etapa 8: Dry Run (plan_batch)
`planBatch()` — simuleaza importul. Pentru fiecare rand:
- Aplica admin override daca exista
- Valideaza (`validateNormalizedDirectoryRow`)
- Rezolva tip organizatie (`resolveProviderOrganizationType`)
- Potrivire organizatie (`resolveDirectoryOrganizationMatch`) — external key, apoi nume exact
- Potrivire locatie (`resolveDirectoryLocationMatch`) — external key, apoi identitate exacta, apoi adresa
- Planificare reconciliere organizatie (`planDirectoryOrganizationReconciliation`)
- Planificare reconciliere locatie (`planDirectoryLocationReconciliation`)
- Determina `planned_action` final
- Actualizeaza randul cu status ready/blocked

Produce: organizatii noi, locatii noi, update-uri, duplicate, conflicte, blocaje, statistici.

### Etapa 9: Safety Inspection
`inspectSafety()` — verifica toate regulile de siguranta:
- Snapshot ready, fara blocari, fara duplicate
- Batch ready, fara blocaje, toate randurile ready
- Fara flag-uri unsafe (publishes_profiles, verifies_profiles, creates_services, grants_access, updates_controlled_profiles, updates_controlled_organizations)
- Fara admin overrides
- Fara conflicte organizatie
- Verifica fiecare rand: import_readiness, research_status, operational_status, canonical_type_source, organization_type_source, planned_action in allowed set
- Pentru locatii existente: verifica profile_control_status === 'directory'
- Pentru organizatii existente: verifica external key match

### Etapa 10: Approval
`approveBatch()` — necesita confirmation token format din `IMPORT ${batch_key} ${sha256.slice(0,12)} ${ready_rows}`.
Pentru rulari automate: `approveRun()` — necesita `AUTOIMPORT ${run_key} ${sha256.slice(0,12)} ${total_batches}`.

### Etapa 11: Batch Execution
`executeBatch()` — executa in chunk-uri de 5 randuri:
- Acorda lock (5 minute TTL)
- Sorteaza randuri: `create_organization_and_location` primele, apoi restul
- Pentru fiecare rand: `executeRow()`
  - Creeaza/actualizeaza organizatie (`ensureOrganization`)
  - Creeaza/actualizeaza locatie
  - Creeaza/actualizeaza director state (`ensureDirectoryState`)
  - Creeaza/actualizeaza legatura organizatie-locatie (`ensureOrganizationLink`)
  - Creeaza/supersedes evidenta (`ensureEvidence`)
  - Inregistreaza mutatie (`createMutation`)
  - Scrie audit (`writeAudit`)
- Release lock sau persistenta intrerupere
- Finalizeaza batch daca nu mai sunt randuri

### Etapa 12: Publication
`publishCompletedBatchAsBasicDirectory()` — publica profilele curate:
- `public_visibility_status: 'approved'`
- `status: 'publicata'`
- `profile_control_status: 'directory'`
- `verification_state: 'unclaimed'`
- `is_verified: false`
- `request_intake_status: 'inactive'`
- Quality classification: high/medium/low -> directory_detail_level: basic/summary
- Sari peste profile controlled (claimed/verified/suspended)

### Etapa 13: Audit
`DirectoryAuditRecord` — pentru fiecare operatie: cine, cand, ce, valoare veche, valoare noua, motiv.
`DirectoryImportMutation` — pentru fiecare mutatie: batch_id, row_id, entity_type, entity_id, operation, before_json, after_json, rollback_status.

### Etapa 14: Rollback
`rollbackBatch()` — necesita confirmation `ROLLBACK ${batch_key} ${applied_rows}`.
- Inverseaza mutatii in ordine inversa
- Pentru create: sterge entitatea (daca nu are dependente)
- Pentru update: restaureaza valori before_json
- Verifica ca entitatea nu a fost modificata dupa import
- Nu sterge locatii cu servicii sau memberships active
- Nu sterge organizatii cu locatii

### Etapa 15: Retry / Recovery
`resumeBatchAfterTransientFailure()` — recupereaza dupa erori tranzitorii:
- Identifica randuri failed cu erori tranzitorii (rate limit, timeout, service unavailable)
- `repairTransientRowArtifacts()` — recupereaza artefacte partiale create in timpul intreruperii
- Reseteaza randurile la status ready
- Actualizeaza progresul batch-ului

### Etapa 16: Heartbeat
`last_heartbeat_at` pe `DirectoryAutoImportRun`, `DirectoryAutoImportItem`, `DirectoryImportBatch`.
Actualizat la fiecare pas din `advanceRun()`.

### Etapa 17: Scheduler / Watchdog
Workflow `Directory Auto Import Scheduler`:
- Cron: `*/5 * * * *` (la 5 minute)
- Timezone: Europe/Bucharest
- Apel: `directoryOps` cu `__function: directoryImportOps`, action `advance_auto_import_runs`, `__automation_trigger: true`
- `advanceRuns()` — proceseaza maxim 2 rulari per ciclu (una approved + una running)
- Pentru fiecare rulare: pana la 18 pasi per ciclu
- Verifica completitudine prin `refreshProgress()`
- `reopenItemsMissingPublication()` — recupereaza item-uri finalizate fara publicare

### Etapa 18: National Campaign
Modul `national_directory` in `DirectoryAutoImportRun`:
- Filtrare stricta: `research_status` in ['official_confirmed', 'official_partial'], `operational_status` = 'active_confirmed'
- Excludere randuri cu `review_flags`
- Excludere randuri cu `geography_validation_error`
- Excludere randuri cu conflicte organizatie (`batch_organization_type_conflict`)
- Excludere randuri controlled (claimed/verified/suspended)
- Excludere randuri deja publicate
- Max 50 loturi, max 40 randuri per lot
- Publicare automata ca profil basic/summary
- `packNationalRows()` — grupeaza dupa organizatie, sorteaza alfabetic

---

# 6. FLUXURILE UTILIZATORILOR

## 6.1 Vizitator
1. Acceseaza `/` (Home)
2. Vede hero, categorii, showcase provideri
3. Cauta: `/cauta` -> filtrare dupa tip, localitate, servicii
4. Vede rezultate (ResultCard, DirectoryResultCard)
5. Acceseaza profil provider: `/furnizor/:id`
6. Porneste cerere: `/cerere` -> flow conversational (intake2)
7. Primeste rezultate match (MatchResults, MatchResultCard)
8. Poate incepe conversatie cu provider (PatientRequestChat)

## 6.2 Provider
1. Primeste invitatie (ProfessionalInvitation / ProviderMemberInvitation)
2. Accepta invitatie: `/accept-professional-invitation` sau `/accept-provider-invitation`
3. Onboarding: `/profil-profesional/nou`
4. Dashboard: `/contul-meu` -> ProviderWorkspaceRoot
5. Moduri: overview, services, hours, media, leads, team, settings, access, articles
6. Claim profil: `/adauga-sau-revendica` -> ClaimForm / NewLocationWizard
7. Inbox lead-uri: ProviderLeadInbox
8. Chat controlat cu pacientii: ProviderLeadChat
9. Contact access: ProviderLeadContactAccess

## 6.3 Administrator
1. Acceseaza `/admin/operatiuni` -> AdminDirectoryOps
2. Dashboard: KPIs, action queue, geo coverage, research pipeline, profiles trust
3. Directory ops:
   - Import pipeline (DirOpsImportPipeline)
   - Profiles (DirOpsProfiles)
   - Claims (DirOpsClaims)
   - Services (DirOpsServices)
   - Mapping (DirOpsMapping)
   - Corrections (DirOpsCorrections)
   - Identity candidates (DirOpsIdentityCandidates)
   - Migration queue (DirOpsMigrationQueue)
   - Audit (DirOpsAudit)
4. Review queues:
   - Location lifecycle (AdminLocationLifecycleReview)
   - New location (AdminNewLocationReview)
   - Organization profile (AdminOrganizationProfileReview)
   - Professional profile (AdminProfessionalProfileReview)
   - Service configuration (AdminServiceConfigurationReview)
   - Provider scoped claim (AdminProviderScopedClaimReview)
   - Workspace submissions (AdminWorkspaceSubmissionsReview)
   - Directory corrections (AdminDirectoryCorrectionReview)
5. Research:
   - Research queue (ResearchQueue)
   - AI copilot (AICopilot)
   - Geo import (GeoImport)
6. System:
   - Data integrity (AdminDataIntegrity)
   - Data repairs (AdminDataRepairs)
7. Support:
   - Support tickets (AdminSupportTickets)
   - Support center (AdminSupportCenter)
   - User feedback (AdminUserFeedback)

## 6.4 Directory Import Flow
1. Admin incarca registrul (ZIP/JSON/URL) prin `create_auto_import_run`
2. Sistemul parseaza, normalizeaza, selecteaza randuri eligibile
3. Sistemul creeaza `DirectoryAutoImportRun` (awaiting_approval) + `DirectoryAutoImportItem` per lot + `DirectoryAutoImportPayloadChunk`
4. Admin approveaza cu confirmation token
5. Scheduler-ul (cron 5 min) avanseaza automat:
   - fetch_source -> loadItemSourceRows
   - create_snapshot -> createSnapshot
   - append_rows -> appendRows
   - validate_snapshot -> finalizeSnapshot
   - plan_batch -> planBatch
   - inspect_batch -> inspectSafety + approveBatch
   - execute_batch -> executeBatch (chunk-uri de 5)
   - verify_batch -> verificare finala
   - publish_batch -> publishCompletedBatchAsBasicDirectory
6. La finalizare: run status = completed
7. Audit complet in DirectoryAuditRecord + DirectoryImportMutation

## 6.5 Claim Flow
1. Provider acceseaza `/adauga-sau-revendica`
2. Cauta locatie existenta sau adauga locatie noua
3. Daca exista: completeaza ClaimForm (identitate, contact, relatie)
4. Sistemul creeaza ClaimRequest / ProviderClaimRequest
5. Admin revizuieste in DirOpsClaims / AdminProviderScopedClaimReview
6. Aprobare: ProviderClaimScopeSelection + ProviderClaimLocationSelection
7. Locatia primeste `profile_control_status: 'claimed'`
8. Provider primesc acces prin ProviderMembership
9. Verified este separat — doar prin VerificationRecord manuala

## 6.6 Search Flow
1. Utilizator acceseaza `/cauta`
2. Selecteaza tip specialist, localitate, servicii
3. Frontend apeleaza `getPublicLocationsForSearch` sau `browseDirectoryProviders`
4. Backend filtreaza dupa: public_visibility_status=approved, status=publicata
5. Rezultate ordonate dupa: relevanta, proximitate, calitate, verificare
6. Fara pay-to-win (abonamentele NU influenteaza ranking)
7. Rezultate afisate prin ResultCard / DirectoryResultCard

## 6.7 SEO Flow
1. RouteSeo component pe fiecare ruta
2. Fiecare locatie publica are pagina proprie `/furnizor/:id`
3. Sitemap.xml generat
4. Robots.txt configurat
5. Schema.org, OpenGraph, canonical, breadcrumbs
6. IndexNow submission pentru indexare rapida
7. Doar profilele publicate sunt indexabile

---

# 7. ANALIZA DOCUMENTELOR STRATEGICE

## 7.1 VIASEE_MASTER_CONTEXT.md

| Afirmatie | Status | Observatie |
|-----------|--------|-----------|
| Pipeline complet de import | CONFIRMAT | 12 etape, idempotent, rollback, audit |
| Snapshot, dry-run, rollback | CONFIRMAT | Toate implementate |
| Import incremental | CONFIRMAT | Idempotency keys, reuse snapshots |
| Campanie nationala | CONFIRMAT | national_directory mode complet |
| Deduplicare | CONFIRMAT | external key + address fingerprint + name |
| Profile unclaimed | CONFIRMAT | Toate profilele importate pornesc unclaimed |
| Publicare automata pentru profile curate | CONFIRMAT | publishCompletedBatchAsBasicDirectory |
| OpenStreetMap, nu Google Maps pentru MVP | CONTRAZIS | Google Places API configurat, react-leaflet instalat dar Google Places folosit activ |
| SIRUTA este sursa canonica | CONFIRMAT | GeographicLocality cu siruta_code |
| Design minimal, premium, editorial | CONFIRMAT | Design tokens warm cream, Fraunces serif, Manrope sans |
| i18n pentru toate textele vizibile | NEIMPLEMENTAT | Textele sunt in romana, fara sistem i18n |
| Trust model: Imported -> Claimed -> Verified -> Trusted | PARTIAL | Implemented: directory -> claimed -> verified -> suspended. "Trusted" NU exista ca status |

## 7.2 VIASEE_ARCHITECTURE.md

| Afirmatie | Status | Observatie |
|-----------|--------|-----------|
| React frontend | CONFIRMAT | React 18 + Tailwind + shadcn/ui |
| Base44 Backend Functions | CONFIRMAT | 48 functii, Deno runtime |
| Base44 Entities | CONFIRMAT | 50+ entitati |
| Base44 Automations | CONFIRMAT | Directory Auto Import Scheduler workflow |
| GitHub ca sursa | CONFIRMAT | repo optilun/Vezunde |
| Componente mici, reutilizabile | PARTIAL | Unele fisiere sunt foarte mari (directoryImportOps.ts: ~900 linii, directoryAutoImportOps.ts: ~2100 linii) |
| Logica mutata in hook-uri sau shared | PARTIAL | Exista lib/ cu logica, dar si logica in componente |
| Fara dependente circulare | CONFIRMAT | Nu s-au identificat dependente circulare |
| Audit complet | CONFIRMAT | DirectoryAuditRecord + AuditLog |
| Organization -> Location -> Professional -> Services | CONFIRMAT | Model ierarhic respectat |
| Directory este entitatea centrala | CONFIRMAT | ProviderLocation + ProviderLocationDirectoryState |
| Automatizarile trebuie sa suporte retry, reluare, heartbeat, logging | CONFIRMAT | Toate implementate |
| Nu trebuie sa proceseze doua campanii simultan | CONFIRMAT | Lock-uri pe run si batch |
| Internationalizare | NEIMPLEMENTAT | Nu exista i18n |

## 7.3 VIASEE_DIRECTORY_RULEBOOK.md

| Afirmatie | Status | Observatie |
|-----------|--------|-----------|
| Importul poate fi reluat de 100 de ori fara efecte secundare | CONFIRMAT | Idempotency keys pe randuri, snapshots, batches |
| Pipeline complet cu toate etapele | CONFIRMAT | Toate etapele implementate |
| Niciun pas nu trebuie sarit | CONFIRMAT | Safety inspection verifica toate etapele |
| Deduplication: location_external_key -> address_fingerprint -> organization_external_key -> manual review | CONFIRMAT | resolveDirectoryLocationMatch respecta ordinea |
| Nu se compara doar numele | CONFIRMAT |
| Heartbeat | CONFIRMAT | last_heartbeat_at pe run/item/batch |
| Watchdog | CONFIRMAT | advanceRuns verifica progres, heartbeat, blocaje |
| Retry sigur, fara duplicate, fara reaplicare mutatii | CONFIRMAT | resumeBatchAfterTransientFailure + repairTransientRowArtifacts |
| Importul idempotent | CONFIRMAT |
| Organizatia se creeaza doar daca nu exista | CONFIRMAT | ensureOrganization verifica existing |
| Locatia se creeaza doar daca nu exista | CONFIRMAT | executeRow verifica target_location_id |
| Importul poate actualiza doar campuri sigure | CONFIRMAT | resolveDirectoryLocationUpdatePayload |
| Nu modifica profile revendicate/verificate | CONFIRMAT | CONTROLLED_PROFILES set, inspectSafety |
| Doar profilele fara conflicte, cu date suficiente, profil Directory | CONFIRMAT | publishCompletedBatchAsBasicDirectory |
| Status initial: directory, published, unclaimed, unverified, basic | CONFIRMAT |
| Claim NU schimba verification | CONFIRMAT |
| Verified doar manual | CONFIRMAT |
| Serviciile nu sunt presupuse | CONFIRMAT | creates_services: false in safety policy |
| Specialistii nu sunt creati automat | CONFIRMAT | Nu exista creare automata de profesionisti |
| Conflictele nu sunt importate automat | CONFIRMAT | block_conflict planned action |
| Rollback nu lasa orfane | CONFIRMAT | canDeleteCreatedLocation/canDeleteCreatedOrganization |
| Doar profile publicate indexabile | CONFIRMAT |
| Directory trebuie sa suporte Romania -> Moldova -> Europa | PARTIAL | Arhitectura suporta, dar nu exista implementare multi-tara |

## 7.4 VIASEE_HANDOVER.md

| Afirmatie | Status | Observatie |
|-----------|--------|-----------|
| Directory implementat | CONFIRMAT |
| Search implementat | CONFIRMAT |
| Provider Organizations/Locations | CONFIRMAT |
| Directory Import, Snapshot, Dry Run, Approval, Rollback, Batch Execution | CONFIRMAT |
| Canonical Mapping | CONFIRMAT |
| Deduplication | CONFIRMAT |
| Import Audit | CONFIRMAT |
| Automatic Publication | CONFIRMAT |
| Claim (MVP) | CONFIRMAT | Este MVP |
| Membership (MVP) | CONFIRMAT | Este MVP |
| SEO Pages (partial) | CONFIRMAT | RouteSeo + sitemap, dar partial |
| Admin Dashboard | CONFIRMAT |
| Import Dashboard | CONFIRMAT | DirOpsImportPipeline |
| Public Profiles | CONFIRMAT |

## 7.5 VIASEE_PRODUCT_DECISIONS.md

| Afirmatie | Status | Observatie |
|-----------|--------|-----------|
| VIASEE nu este construit pentru venit rapid | CONFIRMAT | Nu exista paywall sau monetizare agresiva |
| Directory first, apoi Claim, Dashboard, Membership, Reviews, Appointments | CONFIRMAT | Ordinea respectata |
| Administratorii nu introduc manual mii de locatii | CONFIRMAT | Pipeline automat de import |
| Automation first | CONFIRMAT |
| Preferam 95% date corecte | CONFIRMAT | Filtrare stricta in selectRowsForNationalDirectory |
| Search before sales | CONFIRMAT |
| Every location matters | CONFIRMAT | Fara favoritisme in ranking |
| No pay to win | CONFIRMAT | Abonamentele NU influenteaza ranking |
| Trust model: Imported -> Claimed -> Verified -> Trusted | PARTIAL | "Trusted" nu este implementat |
| SEO pentru fiecare locatie | PARTIAL | RouteSeo exista dar nu pentru toate locatiile individual |
| Interfata premium, curata, editoriala | CONFIRMAT |
| Nu copiem Google Maps, Yelp, Booking, eMAG | CONFIRMAT | Model propriu |

---

# 8. PROBLEME IDENTIFICATE

## 8.1 CRITICAL

### P-CRIT-1: Duplicare directoare shared/
- Descriere: Exista `shared/` si `base44/shared/` cu aceeasi logica
- Impact: Cod duplicat, risca divergenta, mentenanta dubla
- Solutie: Consolidare intr-un singur director (`base44/shared/`) cu redirect-uri sau alias-uri
- Prioritate: CRITICAL — trebuie rezolvat inainte de orice refactoring major

### P-CRIT-2: DIRECTORY_FUNCTION_IMPORT_ENDPOINT gresit
- Descriere: In `directoryFunctionRouting.js`, `DIRECTORY_IMPORT_FUNCTION_ENDPOINT = 'listProviderMemberInvitations'` — este mapat la o functie care nu are legatura cu importul
- Impact: Apelurile frontend catre `invokeDirectoryFunction(client, 'directoryImportOps', payload)` vor fi directionate gresit
- Solutie: Schimba la `'directoryOps'` — toate functiile directory folosesc acelasi endpoint
- Prioritate: CRITICAL

### P-CRIT-3: base44/config.jsonc stale
- Descriere: `base44/config.jsonc` are `name: "New App"` in loc de "VIASEE"
- Impact: Configuratie aplicatie incorecta
- Solutie: Actualizeaza name la "VIASEE"
- Prioritate: HIGH

## 8.2 HIGH

### P-HIGH-1: Fisiere prea mari
- Descriere: `directoryAutoImportOps.ts` (~2100 linii), `directoryImportOps.ts` (~900 linii)
- Impact: Dificil de mentinut, risc de bug-uri
- Solutie: Extrage functii in module separate (selection logic, safety inspection, execution logic, recovery logic)
- Prioritate: HIGH

### P-HIGH-2: Fara i18n
- Descriere: Toate textele vizibile sunt in romana, fara sistem de internationalizare
- Impact: Blocheaza extinderea europeana (Roadmap Etapa 8)
- Solutie: Implementeaza react-i18next sau solutie similara
- Prioritate: HIGH (pentru roadmap)

### P-HIGH-3: Google Maps folosit in loc de OpenStreetMap
- Descriere: Documentul strategic spune "OpenStreetMap, nu Google Maps pentru MVP", dar `GOOGLE_PLACES_API_KEY` este configurat si `placesAutocomplete`/`placesDetails` backend functions folosesc Google
- Impact: Contrazice decizia de produs, dependenta de Google API
- Solutie: Discuta decizia — Google Places ofera date mai bune, dar contrazice documentul strategic
- Prioritate: HIGH (necesita decizie)

### P-HIGH-4: Trust model incomplet
- Descriere: Documentul strategic defineste 4 niveluri (Imported -> Claimed -> Verified -> Trusted), dar implementarea are doar 3 (directory -> claimed -> verified) + suspended
- Impact: "Trusted" nu este implementat ca status distinct
- Solutie: Adauga `trusted` in enum-ul `profile_control_status` sau clarifica ca "verified" = "trusted"
- Prioritate: MEDIUM

## 8.3 MEDIUM

### P-MED-1: Fara teste unitare
- Descriere: Exista 200+ scripturi de verificare (`scripts/verify-*.mjs`) dar nu exista un framework de testare unitara (Jest, Vitest)
- Impact: Nu exista teste automate care sa ruleze la CI
- Solutie: Adauga Vitest cu teste pentru logica critica (normalizare, deduplicare, safety inspection)
- Prioritate: MEDIUM

### P-MED-2: Entitate Location redundanta
- Descriere: Exista atat `Location` cat si `ProviderLocation` cu campuri similare
- Impact: Confuzie, potential inconsistenta
- Solutie: Verifica daca `Location` este inca folosita; daca nu, arhiveaza
- Prioritate: MEDIUM

### P-MED-3: Entitate Organization redundanta
- Descriere: Exista atat `Organization` cat si `ProviderOrganization`
- Impact: Confuzie
- Solutie: Verifica utilizare; consolideaza sau arhiveaza
- Prioritate: MEDIUM

### P-MED-4: Lock contention in scheduler
- Descriere: `advanceRuns()` poate primii "locked" outcomes cand lock-ul de la pasul anterior nu a expirat inca
- Impact: Pasi sariti, necesita cicluri scheduler suplimentare
- Solutie: Adauga delay mic intre pasi sau reuse acelasi lock token
- Prioritate: MEDIUM

### P-MED-5: Payload chunk persistence
- Descriere: `DirectoryAutoImportPayloadChunk` stocheaza payload-uri in chunk-uri de text — vulnerabil la coruptie
- Impact: Daca un chunk se corupe, tot lotul este blocat
- Solutie: Implementeaza verificare CRC32 per chunk pe langa SHA-256 global
- Prioritate: MEDIUM

## 8.4 LOW

### P-LOW-1: Nume functii inconsistente
- Descriere: Amestec de camelCase si snake_case in denumiri functii backend
- Impact: Stil inconsistent
- Solutie: Standardizeaza la camelCase pentru functii JS/TS
- Prioritate: LOW

### P-LOW-2: Comentarii in romana/amestecat
- Descriere: Comentarii si mesaje de eroare in romana, cod in engleza
- Impact: Consistenta redusa
- Solutie: Standardizeaza mesajele de eroare (romana pentru user-facing, engleza pentru logs)
- Prioritate: LOW

### P-LOW-3: Fisiere _temp_never_use si _noop_invalid
- Descriere: Entitati `_temp_never_use` si `_noop_invalid` exista in schema
- Impact: Entitati nefolosite care ocupa spatiu
- Solutie: Verifica daca pot fi sterse
- Prioritate: LOW

---

# 9. TODO / FIXME / COD MORT

## 9.1 Cod mort potential
- `Location` entity — posibil inlocuit de `ProviderLocation`
- `Organization` entity — posibil inlocuit de `ProviderOrganization`
- `shared/` director — duplicat al `base44/shared/`
- `ProviderLeadInboxLegacy.jsx` — sugereaza versiune legacy
- `ProviderServicesThreeColumn.css` / `ProviderServicesSidebars.css` — fisiere CSS separate

## 9.2 Scripturi de verificare (200+)
Exista un numar foarte mare de scripturi `scripts/verify-*.mjs` care functioneaza ca teste de integrare. Acestea verifica:
- Patient conversation (30+ scripturi)
- Provider account/ workspace (15+ scripturi)
- Directory import/ mapping (10+ scripturi)
- Service registry (5+ scripturi)
- SEO (5+ scripturi)

Acestea NU sunt teste unitare — sunt scripturi Node.js care verifica structura fisierelor si logica prin regex si analiza statica.

## 9.3 Fara TODO/FIXME vizibile
Codul nu contine marcatori TODO sau FIXME explicizi. Logica neterminata este reprezentata prin:
- Statusuri "partial" in documente (SEO Pages partial)
- Moduri MVP (Claim, Membership)
- Entitati `_temp` si `_noop`

---

# 10. ISTORICUL DEZVOLTARII

## 10.1 Module terminate
- Directory Import Pipeline (18 etape, idempotent, rollback complet)
- National Campaign mode
- Snapshot/Dry-Run/Approval/Execution/Publication
- Audit complet (DirectoryAuditRecord + DirectoryImportMutation)
- Deduplication (external key + address fingerprint + name)
- Safety Inspection (inspectSafety)
- Scheduler (cron 5 min, advanceRuns)
- Heartbeat + Lock-uri
- Retry/Recovery (resumeBatchAfterTransientFailure, repairTransientRowArtifacts)
- Provider Organization/Location model
- Directory State (ProviderLocationDirectoryState)
- Organization Location Links
- Evidence tracking (ProviderEvidence)
- Admin Dashboard (AdminDirectoryOps)
- Search (getPublicLocationsForSearch, browseDirectoryProviders)
- Public Provider Profile
- SEO basics (RouteSeo, sitemap, robots.txt, IndexNow)

## 10.2 Module MVP
- Claim (basic flow, scope selection, admin review)
- Membership (atasat organizatiei, beneficii propagate)
- Provider Dashboard (workspace cu services, hours, media, leads, team)

## 10.3 Module partiale
- SEO (RouteSeo exista, dar nu pentru toate locatiile individual; schema.org partial)
- Provider Lead Inbox (functional dar cu versiuni legacy)
- Research AI Copilot (exists dar partial)

## 10.4 Module neimplementate
- Reviews
- Appointments
- Analytics
- i18n / multi-tara
- "Trusted" trust level
- OpenStreetMap (folosit Google Places in schimb)

## 10.5 Module care necesita refactorizare
- `directoryAutoImportOps.ts` — prea mare (~2100 linii)
- `directoryImportOps.ts` — prea mare (~900 linii)
- Consolidare `shared/` -> `base44/shared/`

---

# 11. ARHITECTURA RECOMANDATA (2 ani)

## Principii
- Nu rescrie cod functional
- Pastreaza compatibilitate
- Extinde, nu inlocui
- Consolidare progresiva

## Prioritati arhitecturale

### Anul 1
1. **Consolidare shared/** — migreaza tot codul din `shared/` in `base44/shared/`, creeaza alias-uri de compatibilitate
2. **Refactoring functii mari** — sparge `directoryAutoImportOps.ts` in 4-5 module: selection, safety, execution, recovery, publication
3. **i18n** — implementeaza react-i18next pentru extindere europeana
4. **Trust model complet** — adauga "trusted" ca status distinct
5. **Teste unitare** — adauga Vitest pentru logica critica (normalizare, deduplicare, safety, reconciliation)
6. **SEO complet** — pagina individuala pentru fiecare locatie publica, schema.org completa, OpenGraph
7. **Reviews** — modul reviews cu moderare
8. **Analytics** — dashboard cu statistici

### Anul 2
1. **Appointments** — programari online
2. **Multi-tara** — suport Romania + Moldova
3. **OpenStreetMap** — migrare de la Google Places (daca decizia se schimba)
4. **Performance** — optimizare pentru sute de mii de locatii (indexare, caching, CDN)
5. **API public** — API pentru integrari terte

## Ce NU trebuie schimbat
- Modelul de date ierarhic (Organization -> Location -> Professional -> Services)
- Pipeline-ul de import (18 etape)
- Idempotency keys si snapshot-uri
- Safety inspection
- Audit complet
- Lock-uri si heartbeat
- Trust model (directory -> claimed -> verified)
- "No pay to win" in ranking
- Design tokens (warm cream, Manrope, Fraunces)

## Ce trebuie eliminat
- Entitatea `Location` (daca nu mai este folosita)
- Entitatea `Organization` (daca nu mai este folosita)
- Entitatile `_temp_never_use` si `_noop_invalid`
- Directorul `shared/` (dupa consolidare)
- `ProviderLeadInboxLegacy.jsx`

---

# 12. AI RECOMMENDATIONS

## Ce as schimba
1. **Consolidare shared/ urgent** — este sursa de bug-uri si confuzie
2. **Refactoring directoryAutoImportOps.ts** — imparte in module: `nationalSelection.ts`, `safetyInspection.ts`, `batchExecution.ts`, `batchRecovery.ts`, `batchPublication.ts`
3. **DIRECTORY_FUNCTION_IMPORT_ENDPOINT** — schimba la `'directoryOps'` (este un bug)
4. **base44/config.jsonc** — actualizeaza numele la "VIASEE"
5. **i18n** — implementeaza pentru extindere europeana
6. **Teste unitare** — adauga Vitest pentru logica critica

## Ce NU as schimba
1. Modelul de date ierarhic — este corect si scalabil
2. Pipeline-ul de import — este complet si robust
3. Safety inspection — protejeaza integritatea datelor
4. Idempotency — functioneaza corect
5. Audit complet — esential pentru incredere
6. Lock-uri si heartbeat — previn rulare paralela
7. "No pay to win" — principiu corect
8. Design tokens — sunt premium si editoriale
9. Trust model (directory -> claimed -> verified) — cu exceptia adaugarii "trusted"
10. Filtrarea stricta in campania nationala — calitate > viteza

## Ce trebuie refactorizat
1. `directoryAutoImportOps.ts` — ~2100 linii, prea monolitic
2. `directoryImportOps.ts` — ~900 linii, poate fi impartit
3. `shared/` vs `base44/shared/` — consolidare obligatorie
4. Scripturile de verificare — transforma in teste Vitest reale

## Ce trebuie pastrat
1. Pipeline-ul de import cu 18 etape
2. Modelul de date ierarhic
3. Safety inspection
4. Audit complet
5. Idempotency keys
6. Lock-uri si heartbeat
7. Scheduler-ul (cron 5 min)
8. National campaign mode
9. Design tokens
10. "No pay to win"

## Ce trebuie eliminat
1. Directorul `shared/` (dupa consolidare)
2. Entitatea `Location` (daca nu mai este folosita)
3. Entitatea `Organization` (daca nu mai este folosita)
4. `_temp_never_use` si `_noop_invalid`
5. `ProviderLeadInboxLegacy.jsx`

## Ce trebuie amanat
1. OpenStreetMap migration — Google Places functioneaza bine pentru MVP
2. Multi-tara — incepe cu i18n mai intai
3. API public — dupa stabilizare
4. Appointments — dupa Reviews

## Ordine recomandat pentru dezvoltare
1. **Bug fix: DIRECTORY_FUNCTION_IMPORT_ENDPOINT** — 1 zi
2. **Bug fix: base44/config.jsonc** — 1 zi
3. **Consolidare shared/ -> base44/shared/** — 2-3 saptamani
4. **Refactoring directoryAutoImportOps.ts** — 1-2 saptamani
5. **Teste unitare (Vitest)** — 2-3 saptamani
6. **SEO complet** — 2-3 saptamani
7. **i18n** — 2-3 saptamani
8. **Reviews** — 3-4 saptamani
9. **Analytics** — 2-3 saptamani
10. **Appointments** — 4-6 saptamani
11. **Multi-tara** — 4-6 saptamani
12. **API public** — 3-4 saptamani

---

# 13. DEPENDENTE CRITICE

## 13.1 Dependente backend
- `npm:@base44/sdk@0.8.31` — SDK Base44
- `npm:fflate@0.8.2` — Dezarhivare ZIP

## 13.2 Dependente frontend
- `@base44/sdk@^0.8.41` — SDK Base44
- `@base44/vite-plugin@^1.0.30` — Vite plugin Base44
- React 18, react-router-dom v6, @tanstack/react-query
- shadcn/ui (toate componentele Radix)
- lucide-react, recharts, react-leaflet, framer-motion, three.js
- @stripe/react-stripe-js, @stripe/stripe-js

## 13.3 Dependente externe
- Google Places API (autocomplete, details)
- Google OAuth (autentificare)
- Stripe (plati)
- GitHub (repo optilun/Vezunde)

---

# 14. STAREA CURENTA A IMPORTULUI NATIONAL

La data generarii acestui document (2026-08-04):
- Rularea nationala `AUTODIR-5de9fd0f4baa` este in desfasurare
- 2 loturi finalizate cu succes (78 locatii aplicate, 38 publicate)
- Loturile 3-20 sunt pendinte (procesare automata prin scheduler-ul de 5 minute)
- Total: 671 randuri in 20 loturi, 438 randuri excluse de filtrul strict
- Bug-uri rezolvate recent: ordonarea randurilor create inainte de reuse, permiterea actualizarilor de organizatie pentru `reuse_planned_organization`

---

# 15. REGULI DE BAZA PENTRU ORICE AI

1. Citeste acest document inainte de orice implementare
2. Nu modifica matchingul, rankingul, Top 3, provider recommendation sau distribuirea cererilor fara cerere explicita
3. Orice schimbare necesita aprobare explicita
4. Respecta idempotenta, audit, rollback, compatibilitate
5. Nu rescrie cod functional
6. Nu introduce duplicate
7. Nu schimba arhitectura fara justificare
8. Raspunde in romana fara diacritice
9. GitHub main este sursa versiunii sincronizate
10. Nu pretinde ca vezi un branch sau PR neintegrat daca nu este sincronizat

---

# 16. CONCLUZIE

VIASEE este un proiect matur cu o arhitectura solida pentru modulul Directory. Pipeline-ul de import este complet si robust, cu idempotency, audit, rollback si safety inspection. Principalele probleme sunt:
1. Duplicare shared/ vs base44/shared/
2. Bug-uri minore in routing
3. Lipsa i18n pentru extindere europeana
4. Lipsa teste unitare
5. Fisiere prea mari care necesita refactoring

Proiectul respecta majoritatea principiilor din documentele strategice, cu exceptia folosirii Google Maps in loc de OpenStreetMap si a lipsei nivelului "Trusted" din trust model.

Arhitectura permite scalarea la sute de mii de locatii fara schimbari majore, conform obiectivului final.

---

*Document generat pe 2026-08-04. Status: Canonical Implementation Reference.*
*Sursa: Analiza completa a codului sursa, entitatilor, functiilor backend, workflow-urilor si documentelor strategice.*