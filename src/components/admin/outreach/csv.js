// CSV pentru Excel: separator ';' (setarea regionala romaneasca) si BOM UTF-8, fara dependente
// de browser, ca sa poata fi verificat si din scripts/verify-outreach-audience.mjs.
//
// Numele de firma, adresele si mesajele de eroare din raport vin din director si de la Resend, nu
// de la noi. Excel (si LibreOffice) trateaza o celula care incepe cu = + - @ (sau tab / CR) ca
// formula si o poate executa la deschiderea fisierului; o astfel de valoare primeste un apostrof
// in fata, deci ramane text.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  let text = String(value ?? "");
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(header, rows) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}`;
}
