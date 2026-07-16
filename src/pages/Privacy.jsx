import React from "react";
import LegalPageLayout, { LegalList, LegalNote } from "@/components/legal/LegalPageLayout";
import { VIASEE_COMPANY } from "@/lib/legal";

export default function Privacy() {
  const sections = [
    {
      id: "operator",
      title: "Cine administrează VIASEE",
      content: (
        <>
          <p>
            Operatorul platformei VIASEE este <strong>{VIASEE_COMPANY.legalName}</strong>, cu sediul în {VIASEE_COMPANY.registeredOffice}, CUI {VIASEE_COMPANY.taxId}, nr. ONRC {VIASEE_COMPANY.registrationNumber}.
          </p>
          <p>
            Pentru întrebări privind confidențialitatea sau pentru exercitarea drepturilor tale ne poți scrie la <a className="font-semibold text-[#171717] underline underline-offset-4" href={`mailto:${VIASEE_COMPANY.contactEmail}`}>{VIASEE_COMPANY.contactEmail}</a>.
          </p>
        </>
      ),
    },
    {
      id: "aplicabilitate",
      title: "Cui i se aplică politica",
      content: (
        <>
          <p>Această politică se aplică vizitatorilor, persoanelor care trimit o cerere, utilizatorilor cu cont și specialiștilor sau organizațiilor care își administrează profilul pe VIASEE.</p>
          <p>Atunci când un specialist primește datele unei persoane și decide independent cum le folosește pentru a răspunde solicitării, acesta poate avea propriile obligații de operator de date. VIASEE îi transmite numai informațiile necesare și permise de utilizator.</p>
        </>
      ),
    },
    {
      id: "date-colectate",
      title: "Ce date putem colecta",
      content: (
        <LegalList>
          <li>Date de identificare și contact: nume, email, telefon și datele contului.</li>
          <li>Informații despre solicitare: serviciul căutat, localitatea, intervalul dorit și preferințele comunicate.</li>
          <li>Informații care pot privi vederea sau sănătatea, numai atunci când alegi să le comunici.</li>
          <li>Fotografii sau fișiere încărcate pentru evaluarea unei cereri, de exemplu pentru o reparație.</li>
          <li>Localizare aproximativă sau precisă, numai în limita permisiunii acordate.</li>
          <li>Mesaje, răspunsuri, istoricul cererii și interacțiunile cu suportul.</li>
          <li>Date despre profilurile profesionale, servicii, echipă, locații și documente de verificare.</li>
          <li>Date de facturare și identificatori de plată. VIASEE nu stochează numărul complet al cardului.</li>
          <li>Date tehnice: adresă IP, dispozitiv, browser, jurnale de securitate și preferințe cookies.</li>
        </LegalList>
      ),
    },
    {
      id: "scopuri-temeiuri",
      title: "De ce folosim datele",
      content: (
        <>
          <p>Folosim datele pentru a furniza platforma, a interpreta cererea, a afișa variante relevante, a facilita comunicarea, a administra profilurile, a procesa abonamentele și a proteja serviciul.</p>
          <LegalList>
            <li><strong>Executarea contractului sau demersuri înainte de contract</strong>, pentru cont, cereri, profiluri și abonamente.</li>
            <li><strong>Consimțământ</strong>, pentru date sensibile, localizare precisă, analiză opțională și marketing.</li>
            <li><strong>Obligație legală</strong>, pentru facturare, evidențe și răspunsuri către autorități.</li>
            <li><strong>Interes legitim</strong>, pentru securitate, prevenirea abuzurilor, suport și îmbunătățirea serviciului, după evaluarea impactului asupra persoanelor.</li>
          </LegalList>
        </>
      ),
    },
    {
      id: "date-sensibile",
      title: "Date despre vedere și sănătate",
      content: (
        <>
          <p>O cerere poate include informații despre vedere, simptome, afecțiuni, prescripții sau investigații. Aceste informații pot constitui date cu caracter special.</p>
          <LegalNote>
            Solicităm acord explicit înainte de transmiterea acestor date. VIASEE oferă orientare și potrivire cu servicii disponibile; nu stabilește un diagnostic și nu înlocuiește consultația medicală.
          </LegalNote>
          <p>Poți retrage consimțământul, fără a afecta prelucrările realizate legal înainte de retragere. Retragerea poate împiedica finalizarea unei cereri care depinde de informațiile respective.</p>
        </>
      ),
    },
    {
      id: "destinatari",
      title: "Cui putem transmite datele",
      content: (
        <>
          <LegalList>
            <li>Specialiștilor sau locațiilor relevante, numai în limita necesară gestionării cererii.</li>
            <li>Base44 și furnizorilor tehnici folosiți pentru găzduire, autentificare, stocare și funcționare.</li>
            <li>Stripe și furnizorilor de facturare, atunci când inițiezi sau administrezi un abonament.</li>
            <li>Furnizorilor de email, suport, securitate și comunicații operaționale.</li>
            <li>Google Analytics și Meta Pixel numai dacă vor fi activate și numai după acordul tău pentru categoria relevantă.</li>
            <li>Autorităților sau consultanților, când legea impune sau este necesară apărarea unui drept.</li>
          </LegalList>
          <p>Nu vindem datele personale. Furnizorii primesc numai accesul necesar serviciului lor și sunt supuși obligațiilor contractuale aplicabile.</p>
        </>
      ),
    },
    {
      id: "plati",
      title: "Plăți și Stripe",
      content: (
        <>
          <p>Plățile pentru abonamentele profesionale vor fi procesate prin Stripe. Datele cardului sunt introduse în mediul securizat al Stripe și nu sunt stocate integral de VIASEE.</p>
          <p>Putem păstra identificatori tehnici precum ID-ul clientului Stripe, abonamentul, factura, starea plății, perioada facturată și evenimentele necesare reconcilierii.</p>
        </>
      ),
    },
    {
      id: "pastrare",
      title: "Cât timp păstrăm datele",
      content: (
        <>
          <p>Păstrăm datele numai cât este necesar pentru scopul în care au fost colectate, pentru funcționarea contului sau cererii și pentru obligațiile legale aplicabile.</p>
          <LegalList>
            <li>Datele contului și profilului sunt păstrate cât timp contul este activ și ulterior doar cât este justificat.</li>
            <li>Cererile, mesajele și fișierele sunt păstrate cât este necesar gestionării și urmăririi solicitării, apoi sunt șterse sau anonimizate.</li>
            <li>Documentele și evidențele de facturare sunt păstrate pe durata prevăzută de legislația contabilă și fiscală.</li>
            <li>Dovezile consimțământului și jurnalele de securitate pot fi păstrate cât este necesar demonstrării conformității și protejării platformei.</li>
          </LegalList>
        </>
      ),
    },
    {
      id: "drepturi",
      title: "Drepturile tale",
      content: (
        <>
          <p>În condițiile prevăzute de lege, poți cere accesul, corectarea, ștergerea, restricționarea, portabilitatea sau opoziția față de anumite prelucrări. Poți retrage oricând consimțământul acordat.</p>
          <p>Detaliile și pașii de urmat sunt disponibili în pagina <a className="font-semibold text-[#171717] underline underline-offset-4" href="/drepturile-tale">Drepturile tale</a>.</p>
        </>
      ),
    },
    {
      id: "copii",
      title: "Cereri pentru copii",
      content: (
        <p>Cererile referitoare la un copil trebuie trimise de un părinte, tutore sau alt reprezentant legal. Nu solicităm copilului să își creeze direct un cont și colectăm numai datele necesare orientării către serviciul potrivit.</p>
      ),
    },
    {
      id: "securitate-transferuri",
      title: "Securitate și transferuri",
      content: (
        <>
          <p>Aplicăm măsuri tehnice și organizatorice proporționale cu natura datelor, inclusiv controlul accesului, separarea rolurilor, jurnale de activitate și limitarea informațiilor afișate.</p>
          <p>Dacă un furnizor prelucrează date în afara Spațiului Economic European, folosim mecanismele legale aplicabile, precum clauze contractuale standard sau o decizie de adecvare.</p>
        </>
      ),
    },
    {
      id: "contact-modificari",
      title: "Contact și modificări",
      content: (
        <>
          <p>Putem actualiza politica atunci când funcțiile, furnizorii sau cerințele legale se schimbă. Data versiunii curente este afișată în partea de sus.</p>
          <p>Pentru orice întrebare: <a className="font-semibold text-[#171717] underline underline-offset-4" href={`mailto:${VIASEE_COMPANY.contactEmail}`}>{VIASEE_COMPANY.contactEmail}</a>.</p>
        </>
      ),
    },
  ];

  return (
    <LegalPageLayout
      eyebrow="DATE ȘI CONFIDENȚIALITATE"
      title="Politica de confidențialitate"
      intro="Explicăm clar ce date folosim, de ce sunt necesare și cum îți poți exercita drepturile atunci când folosești VIASEE."
      sections={sections}
    />
  );
}

