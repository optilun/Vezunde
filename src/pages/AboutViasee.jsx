import React from "react";
import { Link } from "react-router-dom";
import LegalPageLayout, {
  LegalList,
  LegalNote,
} from "@/components/legal/LegalPageLayout";
import { VIASEE_COMPANY } from "@/lib/legal";

export default function AboutViasee() {
  const sections = [
    {
      id: "ce-este",
      title: "Ce este VIASEE",
      content: (
        <>
          <p>
            VIASEE este o platformă românească de descoperire, orientare și
            promovare pentru servicii de vedere. Ajută oamenii să înțeleagă ce
            tip de profesionist sau locație poate fi relevantă și unde pot căuta
            opțiuni potrivite nevoii lor.
          </p>
          <LegalNote>
            VIASEE oferă informații și orientare. Nu pune diagnostice, nu
            înlocuiește consultația medicală și nu prezintă recomandările ca
            verdict medical.
          </LegalNote>
        </>
      ),
    },
    {
      id: "ce-poti-gasi",
      title: "Ce poți găsi",
      content: (
        <>
          <p>
            Platforma este construită pentru ecosistemul serviciilor de vedere
            din România.
          </p>
          <LegalList>
            <li>
              optici medicale, cabinete optometrice, cabinete și clinici
              oftalmologice și laboratoare optice;
            </li>
            <li>
              opticieni medicali, optometriști și medici oftalmologi;
            </li>
            <li>
              consultații, investigații, servicii pentru ochelari și lentile de
              contact, ajustări și reparații;
            </li>
            <li>
              ghiduri editoriale despre rolurile specialiștilor și despre
              serviciile pentru vedere.
            </li>
          </LegalList>
        </>
      ),
    },
    {
      id: "cum-functioneaza",
      title: "Cum funcționează",
      content: (
        <>
          <p>
            Utilizatorul pornește de la nevoia sa, iar VIASEE organizează
            informațiile despre servicii, locații și profesioniști pentru a face
            opțiunile mai ușor de comparat și înțeles.
          </p>
          <LegalList>
            <li>rezultatele sunt legate de nevoie, serviciu și zonă;</li>
            <li>statutul și sursa informațiilor sunt tratate separat;</li>
            <li>poziția în rezultate nu se cumpără;</li>
            <li>
              disponibilitatea sau eligibilitatea unui serviciu nu este
              presupusă atunci când nu este confirmată.
            </li>
          </LegalList>
        </>
      ),
    },
    {
      id: "verificare",
      title: "Cum verificăm informațiile",
      content: (
        <>
          <p>
            Datele pot proveni din surse publice oficiale, informații transmise
            de organizații și profesioniști sau verificări editoriale. VIASEE
            separă informațiile de director de profilurile revendicate și de
            informațiile verificate.
          </p>
          <p>
            Metoda editorială, regulile de actualizare și modul în care sunt
            folosite sursele sunt descrise în pagina{" "}
            <Link
              to="/cum-verificam-informatiile"
              className="font-semibold text-[#171717] underline underline-offset-4"
            >
              Cum verificăm informațiile
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "acoperire",
      title: "Acoperire în România",
      content: (
        <>
          <p>
            VIASEE este destinat utilizatorilor și furnizorilor de servicii de
            vedere din România. Acoperirea se extinde controlat, pe baza
            informațiilor care pot fi documentate și menținute corect.
          </p>
          <p>
            Paginile publice ale locațiilor și profesioniștilor sunt publicate și
            indexate numai atunci când îndeplinesc regulile platformei privind
            calitatea, siguranța și transparența informației.
          </p>
        </>
      ),
    },
    {
      id: "operator",
      title: "Cine operează VIASEE",
      content: (
        <>
          <p>
            VIASEE este un brand operat de {VIASEE_COMPANY.legalName}, societate
            înregistrată în România, CUI {VIASEE_COMPANY.taxId}, ONRC{" "}
            {VIASEE_COMPANY.registrationNumber}.
          </p>
          <p>
            Pentru întrebări despre platformă, parteneriate sau corectarea unei
            informații publice, ne poți contacta la{" "}
            <a
              href={`mailto:${VIASEE_COMPANY.contactEmail}`}
              className="font-semibold text-[#171717] underline underline-offset-4"
            >
              {VIASEE_COMPANY.contactEmail}
            </a>
            .
          </p>
        </>
      ),
    },
  ];

  return (
    <LegalPageLayout
      eyebrow="DESPRE PLATFORMĂ"
      title="Despre VIASEE"
      intro="Platforma românească prin care oamenii pot descoperi și înțelege mai ușor serviciile, locațiile și profesioniștii din domeniul vederii."
      sections={sections}
    />
  );
}
