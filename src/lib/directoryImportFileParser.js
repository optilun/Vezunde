const SUPPORTED_EXTENSIONS = {
  json: "json",
  ndjson: "ndjson",
  jsonl: "ndjson",
  csv: "csv",
  md: "markdown",
  markdown: "markdown",
};

function cleanHeader(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function uniqueHeaders(headers) {
  const counts = new Map();
  return headers.map((header, index) => {
    const base = cleanHeader(header) || `column_${index + 1}`;
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

function rowFromCells(headers, cells, rowNumber) {
  return {
    ...Object.fromEntries(headers.map((header, index) => [header, String(cells[index] ?? "").trim()])),
    __row_number: rowNumber,
  };
}

function parseDelimited(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = uniqueHeaders(rows[0]);
  return rows.slice(1).map((cells, index) => rowFromCells(headers, cells, index + 2));
}

function splitMarkdownRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cell = "";
  let escaped = false;
  for (const char of trimmed) {
    if (escaped) {
      cell += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function isMarkdownSeparator(line) {
  const cells = splitMarkdownRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function parseMarkdownTables(text) {
  const lines = text.split(/\r?\n/);
  const output = [];
  let index = 0;
  let globalRow = 1;
  while (index < lines.length - 1) {
    const headerLine = lines[index];
    const separatorLine = lines[index + 1];
    if (!headerLine.includes("|") || !isMarkdownSeparator(separatorLine)) {
      index += 1;
      continue;
    }
    const rawHeaders = splitMarkdownRow(headerLine);
    const headers = uniqueHeaders(rawHeaders);
    index += 2;
    while (index < lines.length && lines[index].includes("|") && lines[index].trim().startsWith("|")) {
      const cells = splitMarkdownRow(lines[index]);
      if (cells.some((cell) => cell.trim()) && cells.length >= Math.min(2, headers.length)) {
        globalRow += 1;
        output.push({
          ...rowFromCells(headers, cells, globalRow),
          __source_row_key: `md:${index + 1}`,
        });
      }
      index += 1;
    }
  }
  return output;
}

function parseJson(text) {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.rows)
      ? parsed.rows
      : Array.isArray(parsed?.locations)
        ? parsed.locations
        : [];
  return rows.filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row, index) => ({ ...row, __row_number: index + 1, __source_row_key: row.source_row_key || `json:${index + 1}` }));
}

function parseNdjson(text) {
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({ ...JSON.parse(line), __row_number: index + 1, __source_row_key: `ndjson:${index + 1}` }));
}

export function detectDirectorySourceFormat(filename = "") {
  const extension = String(filename).split(".").pop()?.toLowerCase() || "";
  return SUPPORTED_EXTENSIONS[extension] || "";
}

export function parseDirectorySource(text, format) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  if (format === "json") return parseJson(source);
  if (format === "ndjson") return parseNdjson(source);
  if (format === "csv") return parseDelimited(source, ",");
  if (format === "markdown") return parseMarkdownTables(source);
  throw new Error("Formatul fisierului nu este acceptat.");
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function sourceColumns(rows = []) {
  const columns = new Set();
  rows.slice(0, 100).forEach((row) => Object.keys(row || {}).filter((key) => !key.startsWith("__")).forEach((key) => columns.add(key)));
  return [...columns];
}
