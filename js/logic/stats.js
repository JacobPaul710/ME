import { working } from './progression.js';
import { diffDays } from './dates.js';

// Heaviest working weight per session, oldest first.
export function bestSeries(sess) {
  return sess.map((s) => {
    const w = working(s);
    return w ? { date: s.date, value: w.weight } : null;
  }).filter(Boolean);
}

// Strength gained: best weight ever vs the first session, in percent.
export function gainPct(series) {
  if (series.length < 2) return null;
  const first = series[0].value;
  if (!first) return null;
  const best = Math.max(...series.map((p) => p.value));
  return ((best - first) / first) * 100;
}

export function averageGain(gains) {
  const g = gains.filter((x) => x != null);
  return g.length ? g.reduce((a, b) => a + b, 0) / g.length : null;
}

// weighins sorted oldest first: [{date, lb}]
export function weightSummary(weighins, today) {
  if (!weighins.length) return null;
  const latest = weighins[weighins.length - 1];
  const first = weighins[0];
  const since = (days) => {
    const base = [...weighins].reverse().find((w) => diffDays(today, w.date) >= days);
    return base ? latest.lb - base.lb : null;
  };
  return { latest, first, total: latest.lb - first.lb, week: since(7), month: since(30) };
}
