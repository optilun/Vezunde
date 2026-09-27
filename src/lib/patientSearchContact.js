import { base44 } from "@/api/base44Client";
import { withPatientOperationTimeout } from "./patientOperationControl.js";
import {
  PATIENT_SEARCH_CONTACT_CONSENT_VERSION,
  PATIENT_SEARCH_CONTACT_MODE,
} from "../../shared/patientSearchContact.js";

// Datele de contact cerute la fiecare cautare (2026-09-27, cererea owner-ului). Regulile sunt in
// shared/patientSearchContact.js. Aici: salvarea prin createPatientRequest si memorarea datelor in
// fila curenta, ca pacientul sa nu le scrie din nou la urmatoarea cautare sau in cererea finala.

export const PATIENT_SEARCH_CONTACT_SAVE_TIMEOUT_MS = 15_000;
const REMEMBERED_CONTACT_STORAGE_KEY = "viasee.patient_search_contact.v1";
const REMEMBERED_CONTACT_TTL_MS = 2 * 60 * 60 * 1000;

function sessionStorageOrNull(storage) {
  if (storage) return storage;
  try {
    return globalThis.sessionStorage || null;
  } catch (_error) {
    return null;
  }
}

function text(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

// Se memoreaza doar dupa o salvare reusita, deci doar cu acordul pacientului. sessionStorage se
// goleste cand fila se inchide.
export function rememberPatientContact(contact = {}, { storage, now = Date.now() } = {}) {
  try {
    sessionStorageOrNull(storage)?.setItem(REMEMBERED_CONTACT_STORAGE_KEY, JSON.stringify({
      saved_at: Number(now),
      name: text(contact.name, 120),
      email: text(contact.email, 254),
      phone: text(contact.phone, 32),
      age: text(contact.age, 3),
    }));
  } catch (_error) {
    // Cautarea ramane utilizabila si fara spatiu de stocare in browser.
  }
}

export function readRememberedPatientContact({ storage, now = Date.now() } = {}) {
  try {
    const target = sessionStorageOrNull(storage);
    const raw = target?.getItem(REMEMBERED_CONTACT_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || Number(now) - Number(value.saved_at) > REMEMBERED_CONTACT_TTL_MS) {
      target.removeItem(REMEMBERED_CONTACT_STORAGE_KEY);
      return null;
    }
    return {
      name: text(value.name, 120),
      email: text(value.email, 254),
      phone: text(value.phone, 32),
      age: text(value.age, 3),
    };
  } catch (_error) {
    return null;
  }
}

export async function savePatientSearchContact({
  contact,
  search,
  timeoutMs = PATIENT_SEARCH_CONTACT_SAVE_TIMEOUT_MS,
}) {
  const response = await withPatientOperationTimeout(
    () => base44.functions.invoke("createPatientRequest", {
      mode: PATIENT_SEARCH_CONTACT_MODE,
      contact,
      search,
      consent: {
        processing: true,
        version: PATIENT_SEARCH_CONTACT_CONSENT_VERSION,
      },
    }),
    { timeoutMs, operation: "patient_search_contact_save" },
  );
  const data = response?.data || {};
  if (data.error) throw Object.assign(new Error(data.error), { field: data.field || "" });
  return data;
}
