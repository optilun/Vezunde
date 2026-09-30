// Sectiunile recomandarilor, derivate STRICT din `result_bucket` primit de la server (2026-09-30,
// mutat din MatchResults.jsx fara schimbari). Top 3 = `result_bucket === "top3"`, niciodata primele
// trei din lista. Functii pure, fara importuri: nu reordoneaza, nu taie pozitional, nu recalculeaza
// nimic - doar impart o lista deja ordonata de server, pastrandu-i ordinea.

export function splitByBucket(list) {
  const rows = Array.isArray(list) ? list : [];
  return {
    top3: rows.filter((result) => result.result_bucket === "top3"),
    confirmed: rows.filter((result) => result.result_bucket === "extended_confirmed"),
    directory: rows.filter((result) => result.result_bucket === "extended_directory"),
    // Profiluri din director fara servicii declarate, afisate doar cand nu exista optiuni mai bune.
    structural: rows.filter((result) => result.result_bucket === "structural_directory"),
  };
}

// 2026-09-28 (audit sectiunea 18): lista de rezerva poate avea acum ambele tipuri - intai cel
// potrivit nevoii, apoi alternativa. Fiecare tip are titlul lui si, pentru alternativa, o nota
// scurta primita de la server. Ordinea ramane exact cea primita.
export function groupStructural(structural) {
  return (Array.isArray(structural) ? structural : []).reduce((groups, result) => {
  const capability = result.structural_capability === "medical" ? "medical" : "optical";
  let group = groups.find((item) => item.capability === capability);
  if (!group) {
    group = {
      capability,
      label: result.structural_group_label
        || (capability === "medical" ? "Alte cabinete și clinici oftalmologice din zonă" : "Alte optici din zonă"),
      note: result.structural_group_note || "",
      items: [],
    };
    groups.push(group);
  }
  group.items.push(result);
  return groups;
  }, []);
}
