function esc(v) {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+@\t]/.test(s)) s = "'" + s; // keep spreadsheets from treating text as a formula
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// cols: [[header, key or (row) => value], ...]
export function toCSV(rows, cols) {
  const head = cols.map((c) => esc(c[0])).join(',');
  const body = rows.map((r) => cols.map(([, k]) => esc(typeof k === 'function' ? k(r) : r[k])).join(','));
  return [head, ...body].join('\r\n') + '\r\n';
}
