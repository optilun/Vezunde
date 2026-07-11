# Contract minimal pentru căutări semantice fără rezultate

Nu există în prezent o entitate Base44 sigură și aprobată pentru a scrie analitice de căutare. Clientul și funcțiile nu persistă niciun eveniment în această etapă.

La introducerea unei entități dedicate, un eveniment fără rezultate trebuie să aibă exact acest payload:

```json
{
  "normalized_query": "ochi uscati",
  "resolved_service_keys": ["dry_eye_management", "dry_eye_screening"],
  "coverage_status": "no_results",
  "semantic_matches": [
    { "service_key": "dry_eye_management", "score": 1 }
  ],
  "timestamp": "2026-07-11T10:00:00.000Z"
}
```

Reguli:

- nu stoca textul original, date de contact, coordonate sau identificatorul utilizatorului;
- `normalized_query` folosește normalizarea deterministă din `serviceSemanticSearch`;
- scrierea va fi făcută numai după aprobare de produs, schema Base44 și RLS explicit;
- contractul este documentație, nu activează nicio scriere live.
