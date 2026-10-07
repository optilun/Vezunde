// Validarea editării rapide de profil din panoul de admin (2026-10-07). Fără React.
//
// Înainte, telefonul, emailul și site-ul se trimiteau netestate direct pe profilul public. Regulile
// sunt permisive (nu blochează date reale, ex. două numere separate prin „/”), dar opresc greșelile
// evidente. Întoarce o listă de mesaje; goală = valid.

export function validateQuickEdit(fields = {}) {
  const errors = [];
  const phone = String(fields.phone_public ?? "").trim();
  const email = String(fields.public_email ?? "").trim();
  const website = String(fields.website ?? "").trim();

  if (phone && phone.replace(/\D/g, "").length < 6) {
    errors.push("Telefonul pare incomplet (cel puțin 6 cifre).");
  }
  if (phone && /[^\d\s+()./\-,;]/.test(phone)) {
    errors.push("Telefonul conține caractere neobișnuite. Folosește cifre, spații, + și separatori.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.push("Emailul nu pare valid (ex. contact@exemplu.ro).");
  }
  if (website && !/^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(website)) {
    errors.push("Site-ul trebuie să înceapă cu http:// sau https://.");
  }
  return errors;
}

// Din „https://www.exemplu.ro/pagina” rămâne „exemplu.ro”, pentru afișare scurtă a sursei.
export function sourceHost(url) {
  const value = String(url ?? "").trim();
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value.length > 40 ? `${value.slice(0, 37)}…` : value;
  }
}
