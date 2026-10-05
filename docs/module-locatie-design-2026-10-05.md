# Program, Specialiști și Foto — 5 octombrie 2026

Design apropiat de editorul Servicii: antet compact cu locația, trei zone de navigare, suprafețe neutre, accent albastru, acțiuni explicite și afișare la 320/390 px.

- Program: săptămână, excepții, verificare și salvare; etichete pe zi, validare locală folosind același validator ca backend-ul, copierea zilei de luni doar în marți–vineri. Salvarea necesită success=true, nu marchează un răspuns gol ca reușit, blochează clicurile duble și închiderea în timpul salvării. Modificările nesalvate blochează copierea între locații și cer confirmare la închiderea editorului. Salvarea programului rămâne explicită deoarece actualizează imediat datele operaționale.
- Specialiști: listă, invitații, cereri/acorduri; formularul apare primul pe telefon. Rezumat vizibil, încărcare și erori cu reîncercare, etichete accesibile, mesaje de acțiune deasupra conținutului, tratarea refuzului clipboardului și protecție la clicuri duble. Acordul pentru publicare și accesul administrativ rămân separate.
- Foto: fereastră mai largă, imagine și recomandări în două coloane, navigare alegere/previzualizare/verificare. Draftul și trimiterea sunt separate. Optimizarea până la 1600 px nu mărește artificial imaginile mici; limita de fișier rămâne 4 MB. Retry reutilizează URL-ul deja încărcat, etichetele descriu și încărcarea fără draft salvat. Trimiterea necesită confirmarea serverului. Închiderea selecției nesalvate cere confirmare, se blochează în procesare; focusul rămâne în dialog și revine la butonul de deschidere.

Validare:
- npm run test:provider-location-editors: comportamentul componentului real Program, copiere L–V, validare, eroare/retry, confirmare server, blocarea salvării concurente.
- npm run test:provider-hours, npm run test:provider-account-e2e; verificările invitațiilor resend/acceptance.
- ESLint pe fișierele modificate, git diff --check, build frontend cu VIASEE_SKIP_NATIONAL_MAP_SNAPSHOT=1.
- Componentele reale au fost verificate vizual cu date demonstrative și un client Base44 în memorie, la desktop, 390 și 320 px. Nu s-au creat invitații, drafturi foto sau modificări de program în datele reale.
- Selectarea fișierelor locale a fost blocată de extensie; testul foto a folosit o imagine publică a aplicației, construită în fixture ca File, și încărcare simulată. Optimizarea, eșecul înregistrării, retry cu o singură încărcare, draftul și trimiterea separată au fost verificate. Dialogul real a fost verificat pentru lățime, focus și revenire.
- Fișierele temporare de test public și builderul fixture sunt eliminate înainte de finalizare.

Modificările sunt frontend și necesită Publish App în Base44 pentru viasee.ro.
