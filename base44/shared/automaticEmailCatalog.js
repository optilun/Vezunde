// Catalogul este sursa pentru editorul admin. Fluxurile de trimitere folosesc
// acelasi template_key; daca nu exista un override valid, pastreaza mesajul existent.
const item = (key, title, group, trigger, recipient, subject, body, variables = [], required = []) => ({
  key, title, group, trigger, recipient, subject, body, variables, required, owner: 'viasee',
});

export const AUTOMATIC_EMAIL_CATALOG = Object.freeze([
  item('patient_email_verification', 'Cod de verificare email', 'Cont si acces',
    'Pacientul cere verificarea adresei asociate unei cereri', 'Pacient',
    'Cod de verificare VIASEE - {{public_reference}}',
    ['Buna ziua,', '', 'Foloseste codul de mai jos pentru a confirma adresa de email asociata cererii tale VIASEE:', '', '{{code}}', '', 'Codul este valabil 15 minute.', '{{resume_block}}', '', '{{security_notice}}', '', 'Echipa VIASEE'].join('\n'),
    ['public_reference', 'code', 'resume_block', 'security_notice'], ['code', 'security_notice']),
  item('provider_lead_available', 'Cerere noua pentru furnizor', 'Cereri si raspunsuri',
    'O cerere relevanta devine disponibila unei locatii', 'Owner sau manager locatie',
    'Cerere noua relevanta pentru {{location_name}}',
    ['Buna ziua,', '', 'O cerere noua relevanta este disponibila pentru {{location_name}}.', 'Categorie: {{intent_label}}', 'Localitate: {{city}}', '', 'Datele de contact ale clientului nu sunt incluse. Deschide VIASEE si acceseaza Inbox furnizor pentru detalii si actiunile permise planului locatiei.', '', 'Acest email nu confirma o programare si nu contine recomandari medicale.', '', 'Echipa VIASEE'].join('\n'),
    ['location_name', 'intent_label', 'city']),
  item('patient_request_received', 'Cerere salvata', 'Cereri si raspunsuri',
    'Pacientul salveaza o cerere si are email verificat', 'Pacient',
    'Cererea VIASEE a fost salvata - {{public_reference}}',
    ['Buna ziua,', 'Cererea ta a fost salvata in siguranta.', 'Zona selectata: {{city}}.', 'Cererea nu este trimisa locatiilor pana cand confirmi separat distribuirea.', 'Referinta cererii: {{public_reference}}', 'Revino in pagina securizata a cererii pentru status, raspunsuri si actiunile disponibile.', 'VIASEE nu distribuie automat numarul tau de telefon si nu confirma programari prin aceste mesaje.', 'Echipa VIASEE'].join('\n'),
    ['public_reference', 'city']),
  item('patient_request_distributed', 'Cerere distribuita', 'Cereri si raspunsuri',
    'Pacientul autorizeaza distribuirea cererii', 'Pacient',
    'Cererea VIASEE a fost distribuita - {{public_reference}}',
    ['Buna ziua,', 'Rezumatul cererii a fost pus la dispozitia a {{lead_count}} locatii eligibile.', 'Datele complete si telefonul raman protejate conform acordurilor tale.', 'Referinta cererii: {{public_reference}}', 'Revino in pagina securizata a cererii pentru status, raspunsuri si actiunile disponibile.', 'VIASEE nu distribuie automat numarul tau de telefon si nu confirma programari prin aceste mesaje.', 'Echipa VIASEE'].join('\n'),
    ['public_reference', 'lead_count']),
  item('patient_provider_response_received', 'Raspuns nou de la furnizor', 'Cereri si raspunsuri',
    'Un furnizor raspunde la o cerere', 'Pacient',
    'Raspuns nou la cererea VIASEE {{public_reference}}',
    ['Buna ziua,', '{{location_name}} {{response_label}}.', 'Referinta cererii: {{public_reference}}', 'Revino in pagina cererii din acelasi browser si foloseste butonul de actualizare pentru a vedea raspunsul structurat.', 'Datele tale de contact nu sunt distribuite prin acest email. Distribuirea lor necesita acord separat pentru fiecare locatie.', 'Acest mesaj nu reprezinta un diagnostic, o recomandare medicala sau confirmarea unei programari.', 'Echipa VIASEE'].join('\n'),
    ['public_reference', 'location_name', 'response_label']),
  item('patient_request_resolved', 'Cerere rezolvata', 'Cereri si raspunsuri',
    'Pacientul marcheaza cererea ca rezolvata', 'Pacient',
    'Cererea VIASEE a fost marcata ca rezolvata - {{public_reference}}',
    ['Buna ziua,', 'Ai marcat cererea ca rezolvata. Raspunsurile si istoricul raman disponibile.', 'Aceasta actiune nu reprezinta confirmarea unei programari sau a unui rezultat medical.', 'Referinta cererii: {{public_reference}}', 'Revino in pagina securizata a cererii pentru status, raspunsuri si actiunile disponibile.', 'VIASEE nu distribuie automat numarul tau de telefon si nu confirma programari prin aceste mesaje.', 'Echipa VIASEE'].join('\n'),
    ['public_reference']),
  item('patient_request_closed', 'Cerere inchisa', 'Cereri si raspunsuri',
    'Pacientul inchide cererea', 'Pacient',
    'Cererea VIASEE a fost inchisa - {{public_reference}}',
    ['Buna ziua,', 'Ai inchis cererea. Locatiile nu mai pot trimite raspunsuri sau mesaje noi.', 'Aceasta actiune nu reprezinta confirmarea unei programari sau a unui rezultat medical.', 'Referinta cererii: {{public_reference}}', 'Revino in pagina securizata a cererii pentru status, raspunsuri si actiunile disponibile.', 'VIASEE nu distribuie automat numarul tau de telefon si nu confirma programari prin aceste mesaje.', 'Echipa VIASEE'].join('\n'),
    ['public_reference']),
  item('provider_member_invitation_existing', 'Invitatie membru furnizor', 'Invitatii si revendicari',
    'Un owner invita un utilizator VIASEE existent in organizatie', 'Membru invitat',
    'Invitatie VIASEE pentru {{organization_name}}',
    ['Buna ziua,', '', 'Ai fost invitat sa colaborezi in contul VIASEE al organizatiei {{organization_name}}.', 'Rol propus: {{role_label}}.', '', 'Acces:', '{{locations_text}}', '', 'Accepta invitatia folosind linkul de mai jos:', '{{invitation_link}}', '', 'Invitatia este valabila pana la {{expiry_date}}.', 'Daca nu te asteptai la acest mesaj, il poti ignora.', '', 'Echipa VIASEE'].join('\n'),
    ['organization_name', 'role_label', 'locations_text', 'invitation_link', 'expiry_date'], ['invitation_link']),
  item('professional_invitation', 'Invitatie specialist', 'Invitatii si revendicari',
    'Ownerul sau managerul invita un specialist', 'Specialist invitat',
    'Invitatie profesionala VIASEE - {{location_name}}',
    ['Buna ziua,', '', 'Ai fost invitat ca {{professional_label}} sa confirmi asocierea profesionala cu locatia {{location_name}}.', '', 'Accepta invitatia folosind linkul de mai jos:', '{{invitation_link}}', '', 'Invitatia este valabila pana la {{expiry_date}}.', 'Acceptarea nu acorda acces administrativ si nu publica automat profilul.', 'Trebuie sa folosesti un cont cu aceeasi adresa de email.', '', 'Echipa VIASEE'].join('\n'),
    ['location_name', 'professional_label', 'invitation_link', 'expiry_date'], ['invitation_link']),
  item('provider_claim_more_info', 'Revendicare: completari', 'Invitatii si revendicari',
    'Administratorul cere detalii pentru o revendicare', 'Solicitant',
    'VIASEE - informatii suplimentare necesare',
    ['Buna ziua,', '', 'Pentru a continua verificarea solicitarii avem nevoie de informatii suplimentare.', '', '{{note}}', '', 'Poti urmari starea solicitarii din contul tau VIASEE.', '', 'Solicitare: {{business_name}}', '', 'Echipa VIASEE'].join('\n'),
    ['note', 'business_name'], ['note']),
  item('provider_claim_rejected', 'Revendicare: respinsa', 'Invitatii si revendicari',
    'Administratorul respinge o revendicare', 'Solicitant',
    'VIASEE - solicitare respinsa',
    ['Buna ziua,', '', 'Solicitarea ta nu a putut fi aprobata.', '', '{{note}}', '', 'Poti trimite o solicitare noua dupa corectarea informatiilor.', '', 'Solicitare: {{business_name}}', '', 'Echipa VIASEE'].join('\n'),
    ['note', 'business_name'], ['note']),
  item('provider_claim_approved', 'Revendicare: aprobata', 'Invitatii si revendicari',
    'Administratorul aproba o revendicare', 'Solicitant',
    'VIASEE - solicitare aprobata',
    ['Buna ziua,', '', 'Solicitarea ta a fost aprobata pentru {{approved_location_count}} locatii.', 'Rol acordat: {{approved_role}}.', '', 'Poti administra locatiile aprobate din contul tau VIASEE.', '', 'Solicitare: {{business_name}}', '', 'Echipa VIASEE'].join('\n'),
    ['approved_location_count', 'approved_role', 'business_name']),
  item('directory_correction_received', 'Sesizare director: primita', 'Corectii de director',
    'Un utilizator trimite o sesizare de date', 'Solicitant',
    'Am inregistrat sesizarea {{reference}}',
    ['Buna ziua,', '', 'Am inregistrat sesizarea privind profilul {{location_name}}.', 'Referinta: {{reference}}', '', 'Echipa VIASEE va verifica informatia si sursele transmise. Trimiterea cererii nu modifica automat profilul public.', 'Pentru protejarea datelor, raspundeti la acest email si mentionati referinta daca sunt necesare completari.', '', 'Echipa VIASEE'].join('\n'),
    ['reference', 'location_name']),
  item('directory_correction_more_info', 'Sesizare director: completari', 'Corectii de director',
    'Administratorul cere informatii suplimentare', 'Solicitant',
    'Sunt necesare completari pentru {{reference}}',
    ['Buna ziua,', '', '{{note}}', '', 'Referinta: {{reference}}', '', 'Echipa VIASEE'].join('\n'),
    ['note', 'reference'], ['note']),
  item('directory_correction_rejected', 'Sesizare director: respinsa', 'Corectii de director',
    'Administratorul respinge sesizarea', 'Solicitant',
    'Sesizarea {{reference}} a fost analizata',
    ['Buna ziua,', '', '{{note}}', '', 'Referinta: {{reference}}', '', 'Echipa VIASEE'].join('\n'),
    ['note', 'reference'], ['note']),
  item('directory_correction_resolved', 'Sesizare director: rezolvata', 'Corectii de director',
    'Administratorul aplica rezolvarea sesizarii', 'Solicitant',
    'Sesizarea {{reference}} a fost rezolvata',
    ['Buna ziua,', '', '{{note}}', '', 'Referinta: {{reference}}', '', 'Echipa VIASEE'].join('\n'),
    ['note', 'reference'], ['note']),
  // 2026-10-10 (Alex: tot ce intra trebuie sa ajunga la admin). Trimis de base44/shared/adminNotifications.js
  // catre utilizatorii cu rol admin. Fara date de contact ale pacientilor si fara text liber al utilizatorilor.
  item('admin_new_activity', 'Anunt pentru administrator', 'Administrare',
    'Cineva trimite ceva ce asteapta decizia adminului: revendicare, locatie noua, modificare de profil, specialist, sesizare, tichet, feedback, cerere de pacient', 'Administratorii VIASEE',
    'VIASEE admin: {{event_title}}',
    ['Buna ziua,', '', '{{event_title}}', '{{details}}', '', 'Deschide panoul de administrare:', '{{admin_link}}', '', 'Mesaj automat trimis administratorilor VIASEE. Nu contine datele de contact ale pacientilor.', '', 'Echipa VIASEE'].join('\n'),
    ['event_title', 'details', 'admin_link'], ['admin_link']),
]);

export const EXTERNAL_EMAIL_CATALOG = Object.freeze([
  { key: 'base44_login', title: 'Autentificare si resetare parola', group: 'Cont si acces', owner: 'base44', recipient: 'Utilizator', trigger: 'Autentificare, verificarea contului sau resetarea parolei', note: 'Trimise de sistemul de autentificare Base44. VIASEE nu controleaza continutul din acest cod; configurarea se verifica in Base44.' },
  { key: 'base44_new_user_invitation', title: 'Invitatie utilizator nou', group: 'Invitatii si revendicari', owner: 'base44', recipient: 'Membru invitat', trigger: 'Invitarea unei adrese fara cont VIASEE', note: 'Base44 auth.inviteUser trimite acest email; textul exact nu este disponibil editorului VIASEE.' },
  { key: 'stripe_receipts_invoices', title: 'Chitante si facturi', group: 'Plati si abonamente', owner: 'stripe', recipient: 'Client platitor', trigger: 'Plata sau emiterea facturii, daca este activata in Stripe', note: 'Stripe genereaza aceste mesaje. Continutul si activarea se gestioneaza in Dashboardul Stripe, nu in VIASEE.' },
  { key: 'stripe_payment_failed', title: 'Plata esuata si reamintiri', group: 'Plati si abonamente', owner: 'stripe', recipient: 'Client platitor', trigger: 'Esecul incasarii recurente, daca notificarile sunt active in Stripe', note: 'Stripe controleaza retry-urile si emailurile de plata. VIASEE sincronizeaza starea abonamentului prin webhook.' },
  { key: 'stripe_subscription_cancelled', title: 'Anularea abonamentului', group: 'Plati si abonamente', owner: 'stripe', recipient: 'Client platitor', trigger: 'Anulare sau terminarea abonamentului, in functie de setarile Stripe', note: 'VIASEE nu trimite acum un email propriu pentru anulare; verifica mesajele Stripe in Dashboard.' },
]);

export const AUTOMATIC_EMAIL_BY_KEY = Object.freeze(Object.fromEntries(AUTOMATIC_EMAIL_CATALOG.map((entry) => [entry.key, entry])));

export function emailTemplateTokens(value) {
  return [...String(value || '').matchAll(/{{\s*([a-z_]+)\s*}}/g)].map((match) => match[1]);
}

export function validateAutomaticEmailTemplate(definition, subject, body) {
  if (!definition || definition.owner !== 'viasee') return 'Sablon necunoscut.';
  if (!String(subject || '').trim() || String(subject).length > 180 || /[\r\n]/.test(subject)) return 'Subiectul trebuie sa aiba 1-180 caractere si o singura linie.';
  if (!String(body || '').trim() || String(body).length > 6000) return 'Continutul trebuie sa aiba 1-6000 caractere.';
  const allowed = new Set(definition.variables);
  const tokens = [...emailTemplateTokens(subject), ...emailTemplateTokens(body)];
  const unknown = tokens.find((token) => !allowed.has(token));
  if (unknown) return 'Variabila necunoscuta: ' + unknown;
  const missing = definition.required.find((token) => !emailTemplateTokens(body).includes(token));
  if (missing) return 'Continutul trebuie sa includa {{' + missing + '}}.';
  return '';
}

export function renderAutomaticEmailText(value, variables = {}) {
  return String(value || '').replace(/{{\s*([a-z_]+)\s*}}/g, (_match, key) => String(variables[key] ?? ''));
}

export function sampleAutomaticEmailVariables() {
  return {
    public_reference: 'VS-2026-00124', code: '123456',
    resume_block: '\nPoti reveni la cerere de pe orice dispozitiv folosind linkul securizat:\nhttps://viasee.ro/cerere?ref=EXEMPLU#access=exemplu\n\nLinkul contine cheia privata de acces. Nu il publica si nu il transmite unei persoane necunoscute.',
    security_notice: 'Nu transmite codul unei alte persoane. VIASEE nu iti va cere codul prin telefon sau chat.',
    location_name: 'Optica Exemplu', intent_label: 'Consult optometric', city: 'Bucuresti',
    lead_count: '2', response_label: 'poate ajuta',
    organization_name: 'Organizatia Exemplu', role_label: 'Manager locatie',
    locations_text: '- Optica Exemplu, Bucuresti', invitation_link: 'https://viasee.ro/accept-provider-invitation?token=EXEMPLU',
    expiry_date: '15.10.2026', professional_label: 'optometrist',
    note: 'Te rugam sa completezi documentele necesare.', business_name: 'Organizatia Exemplu',
    approved_location_count: '2', approved_role: 'organization_owner', reference: 'DIR-2026-0124',
    event_title: 'Revendicare nouă', details: 'Optica Exemplu · Cluj-Napoca',
    admin_link: 'https://viasee.ro/admin/operatiuni?s=revendicari',
  };
}
