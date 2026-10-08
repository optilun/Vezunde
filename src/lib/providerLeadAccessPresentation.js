// Presentation only. Access decisions and data redaction remain on the server.
export function providerLeadAccessPresentation(lead, entitlement) {
  const terminal = lead?.is_historical === true || ['closed', 'expired'].includes(lead?.status);
  const reason = lead?.full_details_status?.reason || '';
  const upgrade = !terminal && entitlement?.plan_code === 'free' && lead?.full_details_status?.upgrade_available === true;
  if (terminal) return { title: 'Cerere încheiată', description: 'Datele de contact sunt retrase. Consultă starea cererii în istoric.', upgrade: false };
  if (reason === 'lead_not_top3' || reason === 'lead_not_full_details_scoped') return { title: 'Previzualizare disponibilă', description: 'Locația a primit rezumatul acestei cereri. Detaliile și chatul sunt disponibile pentru locațiile selectate în Top 3.', upgrade: false };
  if (['contact_not_active', 'distribution_consent_missing', 'distribution_consent_version_not_supported', 'lead_not_available'].includes(reason)) return { title: 'Accesul la detalii nu este disponibil', description: 'Datele clientului sunt protejate. Accesul depinde de disponibilitatea cererii și de acordul activ al clientului.', upgrade: false };
  if (reason === 'lead_status_not_eligible') return { title: 'Detaliile nu sunt disponibile în această stare', description: 'Consultă răspunsul locației și starea cererii. Schimbarea planului nu modifică starea cererii.', upgrade: false };
  if (upgrade) return { title: 'Mai mult cu Pro', description: 'Vezi detaliile cererilor eligibile și răspunde din VIASEE. Clientul inițiază chatul, iar telefonul se aprobă separat.', upgrade: true };
  return { title: 'Detaliile sunt protejate', description: 'Accesul la detalii și chat se verifică pentru fiecare cerere: Pro, selecție în Top 3 și acord activ al clientului.', upgrade: false };
}

export function providerRequestLocationBlocker(location = {}) {
  if (location.profile_control_status === 'suspended') return 'Profilul locației este suspendat. Verifică starea locației.';
  if (location.status && location.status !== 'publicata') return 'Profilul locației nu este publicat. Verifică pașii pentru publicare înainte de a primi cereri noi.';
  if (location.is_active === false || ['inactive', 'inactiv', 'inactiva'].includes(location.active_status)) return 'Locația este inactivă. Verifică starea locației pentru a putea primi cereri noi.';
  if (location.profile_control_status && !['claimed', 'verified'].includes(location.profile_control_status)) return 'Revendică sau verifică profilul locației pentru a putea primi cereri.';
  if (location.request_intake_status && location.request_intake_status !== 'active') return 'Primirea cererilor este oprită pentru această locație. Verifică setările de acces.';
  if (location.accepts_patients_directly === false) return 'Locația nu primește momentan cereri directe de la clienți. Verifică setările locației.';
  return '';
}
