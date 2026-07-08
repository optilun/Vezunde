# Profile separation and professional affiliation — Vezunde

## Decizie de produs

Vezunde separa clar patru zone:

1. Director pacienti
2. Workspace furnizori
3. Marketplace B2B
4. Joburi si colaborari profesionale

Directorul pacientilor afiseaza locatii, nu specialisti independenti fara locatie verificata.

## Director pacienti

In cautarea pacientilor apar doar locatii unde pacientul poate merge fizic sau poate contacta direct o unitate verificabila.

Eligibile implicit:

- `independent_optical_store`
- `optical_chain`
- `ophthalmology_clinic`
- `ophthalmology_office`

Neeligibile implicit pentru cautarea pacientilor:

- `independent_ophthalmologist`
- `independent_optometrist`
- `independent_optician`
- `optical_laboratory_b2c`
- `optical_laboratory_b2b`
- `future_b2b_distributor`

Specialistii pot aparea public doar ca membri ai echipei unei locatii eligibile.

## Organizatii si locatii

Clinici si optici se modeleaza ca:

```text
ProviderOrganization -> una sau mai multe ProviderLocation
```

Pacientul vede locatia potrivita, nu doar brandul generic.

## Specialist independent

Un specialist independent cu cont Vezunde nu este recomandat direct pacientilor in MVP.

El poate avea:

- profil profesional;
- marketplace profesional;
- invitatii de afiliere;
- colaborari;
- joburi;
- aplicari la joburi.

Daca lucreaza intr-o optica sau clinica, apare prin acea locatie.

## Afiliere specialist la locatie

Afilierea se separa de profilul profesional:

```text
ProfessionalProfile = persoana/profilul profesional
ProfessionalLocationAssignment = relatia cu o locatie
```

Flux recomandat:

1. Locatia adauga specialistul in echipa cu nume, tip profesional si optional email.
2. Specialistul poate confirma afilierea prin contul lui.
3. Pana la confirmare, afisarea publica este permisa doar ca membru adaugat de locatie, fara badge de confirmare.
4. Dupa confirmare, specialistul poate controla datele lui profesionale.
5. Dupa verificare Vezunde, profilul poate primi un nivel mai puternic de incredere.

## Niveluri de afisare echipa

| Status | Apare public | Observatie |
|---|---|---|
| `location_added` | da | nume si rol adaugate de locatie |
| `professional_confirmed` | da | specialistul a confirmat prin cont |
| `vezunde_verified` | da | Vezunde a verificat profilul |

## Regula de siguranta

Locatia poate propune/adauga un specialist in echipa, dar nu poate crea singura un profil profesional complet verificat in numele specialistului.

## Email events de adaugat cand instalam mail

- `professional_affiliation_invited`
- `professional_affiliation_confirmed`
- `professional_affiliation_removed`
- `professional_profile_claimed`
- `professional_profile_verified`
