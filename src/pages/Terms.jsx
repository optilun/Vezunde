import React from "react";
import LegalPageLayout, { LegalList, LegalNote } from "@/components/legal/LegalPageLayout";
import { VIASEE_COMPANY } from "@/lib/legal";

export default function Terms() {
  const sections = [
    {
      id: "operator-contract",
      title: "Operatorul și acceptarea termenilor",
      content: (
        <>
          <p>VIASEE este administrat de <strong>{VIASEE_COMPANY.legalName}</strong>, CUI {VIASEE_COMPANY.taxId}, nr. ONRC {VIASEE_COMPANY.registrationNumber}, cu sediul în {VIASEE_COMPANY.registeredOffice}.</p>
          <p>Prin folosirea platformei sau crearea unui cont confirmi că ai citit și accepți acești termeni. Funcțiile cu reguli suplimentare îți vor prezenta condițiile relevante înainte de utilizare.</p>
        </>
      ),
    },
    {
      id: "rolul-platformei",
      title: "Ce este VIASEE",
      content: (
        <>
          <p>VIASEE este o platformă de descoperire și orientare pentru servicii de oftalmologie, optometrie, optică medicală, investigații, ochelari, lentile și reparații.</p>
          <LegalNote>VIASEE nu oferă consultații, diagnostic sau tratament medical și nu înlocuiește evaluarea unui profesionist calificat.</LegalNote>
          <p>Platforma poate facilita găsirea unei locații, trimiterea unei cereri și comunicarea. Contractul pentru serviciul medical, optic sau comercial ales se încheie direct între utilizator și furnizor.</p>
        </>
      ),
    },
    {
      id: "eligibilitate-cont",
      title: "Eligibilitate și cont",
      content: (
        <>
          <p>Pentru a crea un cont trebuie să ai capacitatea legală necesară. Cererile pentru copii sunt trimise de un părinte, tutore sau reprezentant legal.</p>
          <p>Trebuie să oferi informații corecte, să îți protejezi datele de acces și să ne anunți dacă suspectezi utilizarea neautorizată a contului.</p>
        </>
      ),
    },
    {
      id: "cautare-cereri",
      title: "Căutare, orientare și cereri",
      content: (
        <>
          <p>Rezultatele sunt construite pe baza informațiilor comunicate, a serviciilor declarate, a zonei și a datelor disponibile în platformă. Ele au rol orientativ.</p>
          <p>Disponibilitatea, prețul, eligibilitatea unui serviciu și timpul de răspuns trebuie confirmate direct cu specialistul sau locația. Trimiterea unei cereri nu reprezintă o programare și nu garantează acceptarea acesteia.</p>
        </>
      ),
    },
    {
      id: "profiluri-verificare",
      title: "Profiluri și informații publice",
      content: (
        <>
          <p>Unele profiluri pot fi create inițial din informații publice și afișate cu detalii limitate. Statutul de verificare este afișat separat atunci când există.</p>
          <p>Un specialist sau reprezentant autorizat poate revendica profilul, solicita corectarea datelor și adăuga informații. VIASEE poate cere documente pentru verificarea identității, calificării sau dreptului de reprezentare.</p>
        </>
      ),
    },
    {
      id: "responsabilitatea-specialistilor",
      title: "Responsabilitatea specialiștilor și locațiilor",
      content: (
        <>
          <LegalList>
            <li>Să publice informații corecte, actuale și care pot fi dovedite.</li>
            <li>Să ofere numai servicii pentru care dețin calificările și autorizările necesare.</li>
            <li>Să respecte confidențialitatea și să folosească datele primite doar pentru gestionarea solicitării.</li>
            <li>Să nu publice afirmații înșelătoare, garanții medicale sau conținut care poate pune utilizatorii în pericol.</li>
            <li>Să mențină actualizate locațiile, programul, echipa și serviciile.</li>
          </LegalList>
          <p>VIASEE poate solicita clarificări, limita afișarea sau suspenda un profil atunci când informațiile sunt neconforme ori există un risc pentru utilizatori.</p>
        </>
      ),
    },
    {
      id: "continut",
      title: "Conținut și fișiere încărcate",
      content: (
        <>
          <p>Păstrezi drepturile asupra conținutului propriu. Ne acorzi permisiunea limitată de a-l găzdui, afișa și procesa pentru furnizarea funcției solicitate.</p>
          <p>Nu încărca informații despre alte persoane fără un temei legal, imagini ilegale, conținut discriminatoriu, înșelător sau care încalcă drepturile altcuiva.</p>
        </>
      ),
    },
    {
      id: "date-comunicare",
      title: "Date de contact și comunicare",
      content: (
        <>
          <p>Datele complete de contact nu sunt distribuite automat tuturor profilurilor afișate. Transmiterea lor depinde de fluxul ales, de acordurile prezentate și de informațiile necesare pentru răspuns.</p>
          <p>Mesajele și solicitările pot fi moderate pentru siguranță, prevenirea abuzurilor și respectarea regulilor platformei.</p>
        </>
      ),
    },
    {
      id: "utilizare-interzisa",
      title: "Utilizări interzise",
      content: (
        <LegalList>
          <li>Accesarea neautorizată, testarea abuzivă sau perturbarea platformei.</li>
          <li>Colectarea automată a datelor, copierea bazelor de date sau folosirea lor pentru spam.</li>
          <li>Uzurparea identității, profile false sau documente falsificate.</li>
          <li>Transmiterea de malware, mesaje abuzive sau conținut ilegal.</li>
          <li>Folosirea VIASEE pentru urgențe medicale sau pentru obținerea unui diagnostic automat.</li>
        </LegalList>
      ),
    },
    {
      id: "moderare-suspendare",
      title: "Moderare și suspendare",
      content: (
        <p>Putem elimina conținut, limita funcții sau suspenda un cont pentru încălcări, risc de securitate, informații profesionale neconfirmate ori obligații legale. Când este posibil, explicăm motivul și oferim o cale de clarificare.</p>
      ),
    },
    {
      id: "disponibilitate-raspundere",
      title: "Disponibilitate și limite de răspundere",
      content: (
        <>
          <p>Urmărim funcționarea stabilă a platformei, dar pot exista mentenanță, erori sau întreruperi. Nu garantăm că fiecare profil va răspunde sau că un serviciu va fi disponibil într-un anumit moment.</p>
          <p>Specialistul sau organizația răspunde pentru actul profesional, recomandările, serviciile și relația cu utilizatorul. VIASEE răspunde pentru propriile obligații în limitele permise de lege.</p>
        </>
      ),
    },
    {
      id: "proprietate-intelectuala",
      title: "Proprietate intelectuală",
      content: (
        <p>Marca VIASEE, interfața, textele originale, elementele grafice, structura și software-ul sunt protejate. Folosirea platformei nu transferă drepturi asupra acestora.</p>
      ),
    },
    {
      id: "lege-contact",
      title: "Lege aplicabilă, reclamații și contact",
      content: (
        <>
          <p>Acești termeni sunt guvernați de legea română și de normele europene aplicabile. Drepturile obligatorii ale persoanelor nu sunt limitate prin acești termeni.</p>
          <p>Pentru o sesizare sau clarificare, scrie-ne la <a className="font-semibold text-[#171717] underline underline-offset-4" href={`mailto:${VIASEE_COMPANY.contactEmail}`}>{VIASEE_COMPANY.contactEmail}</a>. Încercăm mai întâi soluționarea directă și documentată.</p>
        </>
      ),
    },
    {
      id: "modificari",
      title: "Modificarea termenilor",
      content: (
        <p>Putem actualiza termenii când se schimbă funcțiile sau cerințele legale. Pentru schimbările importante care afectează un cont sau abonament vom folosi o notificare rezonabilă, prin platformă sau email.</p>
      ),
    },
  ];

  return (
    <LegalPageLayout
      eyebrow="REGULILE PLATFORMEI"
      title="Termeni și condiții"
      intro="Regulile esențiale pentru folosirea VIASEE de către persoanele care caută servicii, specialiști și organizații."
      sections={sections}
    />
  );
}

