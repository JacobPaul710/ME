// Local-calendar date helpers. Dates are stored as 'YYYY-MM-DD' strings.
const pad = (n) => String(n).padStart(2, '0');

export function iso(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

// a - b in whole days
export function diffDays(a, b) {
  return Math.round((parse(a) - parse(b)) / 86400000);
}

export function nice(s) {
  return parse(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function short(s) {
  return parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ago(s, today) {
  const n = diffDays(today, s);
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  return `${n} days ago`;
}
