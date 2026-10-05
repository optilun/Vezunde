# Editorul serviciilor — 5 octombrie 2026

Pagina serviciilor unei locații folosește trei pași: Spațiile locației, Serviciile oferite, Verifică și trimite.
Oferta configurată se deschide la rezumat, cu Editează oferta. O ofertă nouă începe la spații.
Categoriile sunt navigabile direct; căutarea este vizibilă în pasul serviciilor. Există o singură bară de acțiuni.
Spațiile fără servicii publice, inclusiv laboratorul, rămân accesibile pentru resurse opționale.

Drafturile se salvează automat după 1 secundă de pauză. Scrierile sunt serializate, iar schimbările din timpul unei scrieri se salvează în același draft.
O salvare este confirmată numai dacă serverul întoarce un submission cu id. La eroare, selecțiile rămân în formular și apare reîncercarea.
Continuarea, închiderea prin X și copierea ofertei așteaptă salvarea. Salvarea nu trimite automat cererea spre aprobare.
CAS, dependențele, resursele opționale, B2B, configurațiile vechi și cererile aflate în verificare păstrează regulile existente.
La trimitere, eliminările propuse se ascund public până la soluționare, ca înainte.

Validare:
- npm run test:services-editor: scenarii de salvare automată/manuală, răspuns neconfirmat, eroare, retry, reîncărcare, debounce, modificări în timpul salvării, undo și izolare între locații.
- Validarea payloadului și a rutării funcțiilor a trecut; lint pentru fișierele modificate a trecut.
- Componenta și hookul reale au fost testate în Chrome cu toate API-urile înlocuite la compilare cu mockuri în memorie. Oferta reală a organizației nu a fost modificată.
- Desktop 1280 px și mobil 390/320 px: o singură bară de acțiuni, fără depășirea lățimii paginii; căutare, resurse laborator, eroare/retry și submit explicit verificate.
- Fixturele temporare de test au fost șterse din aplicație.

Modificările frontend necesită Publish App pentru a apărea pe viasee.ro.
