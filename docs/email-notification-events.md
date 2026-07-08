# Email notification events — Vezunde

Acest document marcheaza evenimentele unde trebuie conectate notificari email mai tarziu. Pentru MVP-ul curent, fluxurile raman functionale fara email automat.

## Claim si acces furnizor

| Event key | Cand se declanseaza | Catre cine | Scop | Prioritate |
|---|---|---|---|---|
| `provider_claim_submitted` | Dupa trimiterea unei revendicari normale | solicitant | Confirmare ca cererea a fost primita | mare |
| `provider_new_location_submitted` | Dupa trimiterea unei locatii noi | solicitant | Confirmare ca locatia intra in verificare | mare |
| `provider_access_request_submitted` | Dupa solicitare acces la profil deja administrat | solicitant | Confirmare ca cererea de acces a fost primita | mare |
| `provider_access_request_owner_notice` | Dupa solicitare acces la profil deja administrat | owner / admin locatie existent | Atentionare ca cineva cere acces la profil | mare |
| `provider_claim_approved` | Admin aproba claim/acces | solicitant | Anunt ca accesul este activ | mare |
| `provider_claim_rejected` | Admin respinge claim/acces | solicitant | Anunt respingere + motiv | mare |
| `provider_claim_needs_more_info` | Admin cere completari | solicitant | Cere informatii suplimentare | mare |

## Workspace si continut profil

| Event key | Cand se declanseaza | Catre cine | Scop | Prioritate |
|---|---|---|---|---|
| `provider_workspace_draft_submitted` | Furnizor trimite modificari spre review | admin Vezunde | Notificare ca exista modificari de verificat | medie |
| `provider_workspace_draft_approved` | Admin aproba modificari profil | furnizor | Anunt ca modificarile au fost aprobate/publicate | medie |
| `provider_workspace_draft_rejected` | Admin respinge modificari profil | furnizor | Anunt respingere + motiv | medie |
| `provider_workspace_draft_needs_more_info` | Admin cere completari pe draft | furnizor | Cere informatii suplimentare | medie |

## Membri si invitatii

| Event key | Cand se declanseaza | Catre cine | Scop | Prioritate |
|---|---|---|---|---|
| `provider_member_invited` | Owner/manager invita membru | invitat | Invitatie sa accepte accesul la locatie | mare |
| `provider_member_access_granted` | Cerere acces aprobata / membru activat | solicitant | Confirmare ca are acces | mare |
| `provider_member_access_granted_owner_notice` | Cerere acces aprobata pentru profil deja administrat | owner existent | Informare ca un membru nou a fost adaugat | medie |

## Reguli de siguranta

- Emailurile nu trebuie sa contina informatii sensibile inutile.
- Pentru profil deja administrat, notificarea catre owner trebuie sa permita ignorare/raportare.
- Aprobarea accesului ramane manuala in MVP.
- Niciun email nu trebuie sa inlocuiasca audit trail-ul din `DirectoryAuditRecord`.
- Date minime necesare: `user_id`, `claim_id`, `location_id`, `request_type`, `status`, `review_notes`, `email`.
