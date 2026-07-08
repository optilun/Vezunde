# Account and billing rules — Vezunde

## Decizie de produs

Un email trebuie sa reprezinte un singur cont Vezunde, indiferent daca utilizatorul intra cu Google sau cu email si parola.

Daca acelasi email este folosit prin mai multe metode de autentificare, intentia produsului este ca utilizatorul sa ajunga in acelasi profil, nu in doua conturi separate.

## UX minim

- La login esuat cu email si parola, afisam mesaj care recomanda folosirea Google daca acel cont a fost creat initial cu Google.
- La creare cont, trebuie evitat un cont duplicat pentru acelasi email.
- Inainte de billing live, trebuie verificat exact cum Base44 Auth trateaza acelasi email folosit prin Google si prin email/parola.

## Regula pentru plati

Abonamentul trebuie legat de business, nu de metoda de autentificare.

Pentru Vezunde, business-ul inseamna in principal organizatie, locatie sau tenant.

Utilizatorul autentificat este doar persoana care administreaza sau plateste, nu identitatea comerciala finala.

## Model recomandat

- User: persoana autentificata.
- ProviderMembership: accesul persoanei la locatie.
- ProviderOrganization sau ProviderLocation: entitatea care detine profilul.
- Subscription: abonamentul atasat business-ului.
- Billing owner: utilizatorul care gestioneaza plata.

## De verificat inainte de plata live

- Daca acelasi email prin Google si email/parola ajunge in acelasi User.
- Daca exista risc de User duplicat pe acelasi email.
- Daca abonamentul ramane vizibil cand utilizatorul schimba metoda de login.
- Daca schimbarea administratorului nu rupe abonamentul locatiei.
