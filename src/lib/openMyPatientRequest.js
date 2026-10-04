import { base44 } from "@/api/base44Client";
import { storePatientRequestAccess } from "@/lib/patientRequestPersistenceClient";
import { readableErrorMessage } from "@/lib/transientRetry";

// 2026-10-04 (structura conturilor, pasul 5). Deschide din cont o cerere trimisă de acest cont,
// fără linkul din email: serverul dă un acces nou (30 de zile), salvat în acest browser ca și
// accesul din link. Întoarce adresa paginii cererii.
export async function openMyPatientRequest(requestId) {
  let data;
  try {
    const response = await base44.functions.invoke("openMyPatientRequest", { request_id: requestId });
    data = response?.data || {};
  } catch (error) {
    throw new Error(readableErrorMessage(error?.response?.data?.error || error?.message, "Cererea nu a putut fi deschisă. Încearcă din nou."));
  }
  if (data.error || !data.access_token || !data.public_reference || !data.request_id) {
    throw new Error(readableErrorMessage(data.error, "Cererea nu a putut fi deschisă. Încearcă din nou."));
  }
  storePatientRequestAccess(data.request_id, data.access_token, data.public_reference);
  return `/cerere?ref=${encodeURIComponent(data.public_reference)}`;
}
