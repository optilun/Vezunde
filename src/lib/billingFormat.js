// Formatarea sumelor din Stripe (2026-10-08). Parte pură, folosită de contul de furnizor și de Plăți din admin.
//
// Suma vine în subunități (bani). O monedă lipsă sau necunoscută (null, "", cod invalid) nu mai aruncă
// „Invalid currency code” și nu mai prăbușește ecranul: se folosește RON (sau codul primit, scris ca text),
// iar o sumă care nu e număr se arată „—”.
export function money(amount, currency = "ron") {
  const value = Number(amount);
  if (amount === null || amount === undefined || amount === "" || !Number.isFinite(value)) return "—";
  const code = String(currency || "").trim() || "ron";
  try {
    return new Intl.NumberFormat("ro-RO", { style: "currency", currency: code }).format(value / 100);
  } catch {
    return `${(value / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code.toUpperCase()}`;
  }
}
