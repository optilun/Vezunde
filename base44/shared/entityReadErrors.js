// Citiri care deosebesc „inregistrarea nu exista” de „nu s-a putut citi acum”.
//
// 2026-09-27. Functiile de profil public foloseau `.get(id).catch(() => null)` si
// `.filter(...).catch(() => [])`. Cand Base44 raspundea „Rate limit exceeded” (crawlerele deschideau
// sute de profiluri pe minut, dupa trimiterea sitemap-urilor), eroarea devenea „profil negasit” (404),
// iar pagina punea `noindex` pe un profil public valid. Acum doar lipsa reala a inregistrarii da
// `null`; o eroare trecatoare ajunge la apelant ca eroare (500), iar pagina reincearca.

export function isMissingRecordError(error) {
  const status = Number(error?.status ?? error?.response?.status);
  return status === 400 || status === 404 || status === 422;
}

/** `entity.get(id)`, cu `null` doar cand inregistrarea nu exista; orice alta eroare se propaga. */
export async function getRecordOrNull(entity, id) {
  try {
    return await entity.get(id);
  } catch (error) {
    if (isMissingRecordError(error)) return null;
    throw error;
  }
}
