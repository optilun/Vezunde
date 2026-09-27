import React, { useMemo, useRef, useState } from "react";
import { ArrowLeft, UserRound } from "lucide-react";
import InfoHint from "./InfoHint";
import {
  PATIENT_SEARCH_CONTACT_CONSENT_VERSION,
  PatientSearchContactValidationError,
  sanitizePatientSearchContact,
  searchContactAgeRefersTo,
} from "../../../shared/patientSearchContact.js";
import { isPatientOperationTimeout } from "@/lib/patientOperationControl";
import {
  readRememberedPatientContact,
  rememberPatientContact,
  savePatientSearchContact,
} from "@/lib/patientSearchContact";

// 2026-09-27, cererea owner-ului: la fiecare cautare cerem si datele de contact, inainte de
// rezultate (regulile: shared/patientSearchContact.js). Datele pleaca spre server doar la
// "Continua", cu acordul bifat; "Sari peste" nu salveaza nimic. Nu schimba rezultatele si nu
// ajung la locatii.
const CONTACT_INFO = [
  "Le folosim ca să te putem contacta despre această căutare.",
  "Datele rămân la VIASEE. Nu le trimitem locațiilor și nu schimbă rezultatele.",
  "Poți cere oricând ștergerea lor, din pagina „Drepturile tale”.",
];

const INPUT_CLASS = "mt-1.5 min-h-12 w-full rounded-2xl border bg-secondary/50 px-4 text-base font-normal text-foreground outline-none transition-colors placeholder:text-[#9B968D] focus:border-primary";

function serverErrorMessage(error) {
  return String(error?.response?.data?.error || error?.data?.error || "").trim();
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}

export default function PatientSearchContact({ forWhom = "", search = {}, onDone, onBack }) {
  const remembered = useMemo(() => readRememberedPatientContact(), []);
  const ageRefersTo = searchContactAgeRefersTo(forWhom);
  const [values, setValues] = useState(() => ({
    name: remembered?.name || "",
    phone: remembered?.phone || "",
    email: remembered?.email || "",
    age: ageRefersTo === "contact" ? remembered?.age || "" : "",
  }));
  const [consent, setConsent] = useState(false);
  const [fieldError, setFieldError] = useState({ field: "", message: "" });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inFlightRef = useRef(false);

  const update = (field) => (event) => {
    const value = event.target.value;
    setValues((current) => ({ ...current, [field]: value }));
    if (fieldError.field === field || (fieldError.field === "contact" && ["email", "phone"].includes(field))) {
      setFieldError({ field: "", message: "" });
    }
  };

  const errorFor = (field) => {
    if (fieldError.field === field) return fieldError.message;
    if (fieldError.field === "contact" && field === "phone") return fieldError.message;
    return "";
  };

  const submit = async (event) => {
    event.preventDefault();
    if (inFlightRef.current) return;
    const contact = { ...values, age: ageRefersTo ? values.age : "" };
    const payload = {
      contact,
      search: { ...search, for_whom: forWhom },
      consent: { processing: consent, version: PATIENT_SEARCH_CONTACT_CONSENT_VERSION },
    };
    try {
      sanitizePatientSearchContact(payload);
    } catch (error) {
      if (!(error instanceof PatientSearchContactValidationError)) throw error;
      setFieldError({ field: error.field, message: error.message });
      setFormError("");
      return;
    }

    inFlightRef.current = true;
    setIsSaving(true);
    setFieldError({ field: "", message: "" });
    setFormError("");
    try {
      const data = await savePatientSearchContact({ contact, search: payload.search });
      // Varsta altei persoane nu se propune la urmatoarea cautare.
      rememberPatientContact({ ...contact, age: ageRefersTo === "contact" ? contact.age : "" });
      onDone?.({ status: "saved", contactId: data?.contact_id || "" });
    } catch (error) {
      const message = serverErrorMessage(error) || (error?.field ? String(error.message || "") : "");
      setFormError(isPatientOperationTimeout(error)
        ? "Salvarea durează prea mult. Încearcă din nou sau sari peste."
        : message || "Nu am putut salva datele. Încearcă din nou sau sari peste.");
    } finally {
      inFlightRef.current = false;
      setIsSaving(false);
    }
  };

  const invalidProps = (field) => {
    const error = errorFor(field);
    return {
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `search-contact-${field}-error` : undefined,
      className: `${INPUT_CLASS} ${error ? "border-destructive" : "border-border"}`,
    };
  };

  return (
    <form onSubmit={submit} noValidate className="py-1 sm:py-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={isSaving}
          className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Înapoi
        </button>
      )}
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
        <UserRound className="h-3.5 w-3.5" />
        Date de contact
      </div>

      <h2 className="mt-5 font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        Cum te putem contacta?
        <InfoHint items={CONTACT_INFO} label="De ce cerem datele" />
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Numele și emailul sau telefonul.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="search-contact-name" label="Nume și prenume" error={errorFor("name")}>
            <input
              id="search-contact-name"
              value={values.name}
              onChange={update("name")}
              autoComplete="name"
              maxLength={120}
              {...invalidProps("name")}
            />
          </Field>
        </div>
        <Field id="search-contact-phone" label="Telefon" error={errorFor("phone")}>
          <input
            id="search-contact-phone"
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={update("phone")}
            autoComplete="tel"
            maxLength={32}
            {...invalidProps("phone")}
          />
        </Field>
        <Field id="search-contact-email" label="Email" error={errorFor("email")}>
          <input
            id="search-contact-email"
            type="email"
            inputMode="email"
            value={values.email}
            onChange={update("email")}
            autoComplete="email"
            maxLength={254}
            {...invalidProps("email")}
          />
        </Field>
        {ageRefersTo && (
          <Field
            id="search-contact-age"
            label={ageRefersTo === "patient" ? "Vârsta persoanei (opțional)" : "Vârsta ta (opțional)"}
            error={errorFor("age")}
          >
            <input
              id="search-contact-age"
              inputMode="numeric"
              value={values.age}
              onChange={update("age")}
              autoComplete="off"
              maxLength={3}
              {...invalidProps("age")}
            />
          </Field>
        )}
      </div>

      <label className={`mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border bg-background p-4 ${fieldError.field === "consent" ? "border-destructive" : "border-border"}`}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => {
            setConsent(event.target.checked);
            if (fieldError.field === "consent") setFieldError({ field: "", message: "" });
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
        />
        <span className="text-xs leading-relaxed text-muted-foreground">
          Sunt de acord ca VIASEE să păstreze aceste date și ce am căutat, ca să mă contacteze despre această căutare.{" "}
          <a href="/confidentialitate" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">
            Detalii
          </a>
        </span>
      </label>
      {fieldError.field === "consent" && (
        <p className="mt-1.5 text-xs font-medium text-destructive">{fieldError.message}</p>
      )}

      {formError && (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Salvăm..." : "Continuă"}
      </button>
      <div className="mt-2 text-center">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onDone?.({ status: "skipped", contactId: "" })}
          className="inline-flex min-h-11 items-center px-3 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-60"
        >
          Sari peste
        </button>
      </div>
    </form>
  );
}
