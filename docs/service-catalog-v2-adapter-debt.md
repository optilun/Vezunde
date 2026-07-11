# Datorie tehnică — adaptoarele catalogului semantic V2

În acest PR, `canonicalServiceRegistryExtended.js` și `serviceOperationalTaxonomyExtended.js` rămân adaptoare temporare peste registrele istorice. Ele sunt folosite de toți consumatorii de servicii din frontend și backend prin importurile `*Extended`.

Nu s-a mutat încă extensia direct în registrele istorice deoarece acestea sunt importate de multe fluxuri legacy, iar o rescriere completă ar schimba simultan serializarea drafturilor, review-ul, profilul public și matching-ul.

## Stare după acest PR

- configuratorul, validatoarele, review-ul, profilul public, directorul, matching-ul și fallback-ul workspace importă V2;
- sursa locală V2 rămâne disponibilă dacă endpointurile noi Base44 nu sunt încă publicate;
- noile chei nu sunt eliminate din drafturi sau din `LocationService`;
- nu se execută migrare de date și nu se modifică schema.

## Consolidare ulterioară

1. Mută definițiile V2 în `shared/canonicalServiceRegistry.js` fără mutații la import.
2. Construiește `SERVICE_GROUPS`, indexurile de chei, layouturile și aliasurile din structuri imutabile.
3. Mută secțiunile operaționale V2 în `shared/serviceOperationalTaxonomy.js` și păstrează extended doar ca reexport temporar.
4. Rulează snapshot-uri pentru drafturi legacy, `LocationService`, `ProviderWorkspaceSubmission`, matching și profil public.
5. Elimină adaptoarele numai după ce datele remote au fost verificate read-only și după un dry-run de migrare aprobat.
