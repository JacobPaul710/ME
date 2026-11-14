// Rep-goal progression: goal starts at 10. Hit it N sessions in a row and it goes
// to 11, then 12. Hit 12 N times in a row and it's time to add weight; the goal
// resets to 10 as soon as the working weight changes.
// A session "hits" the goal when every set at the working (heaviest) weight reaches it.
export const START_GOAL = 10;
export const TOP_GOAL = 12;

export function sessions(sets) {
  const by = new Map();
  for (const s of sets) {
    if (!s.done) continue;
    if (!by.has(s.date)) by.set(s.date, []);
    by.get(s.date).push(s);
  }
  return [...by.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, ss]) => ({ date, sets: ss.sort((a, b) => (a.n || 0) - (b.n || 0)) }));
}

export function working(session) {
  const ss = session.sets.filter((s) => s.reps != null && +s.reps > 0);
  if (!ss.length) return null;
  const weight = Math.max(...ss.map((s) => +s.weight || 0));
  const reps = ss.filter((s) => (+s.weight || 0) === weight).map((s) => +s.reps);
  return { weight, reps };
}

export function evaluate(sess, needed = 4) {
  let goal = START_GOAL, count = 0, ready = false, prevW = null;
  for (const s of sess) {
    const wk = working(s);
    if (!wk) continue;
    if (prevW !== null && wk.weight !== prevW) { goal = START_GOAL; count = 0; ready = false; }
    prevW = wk.weight;
    const hit = wk.reps.every((r) => r >= goal);
    if (!hit) { count = 0; ready = false; continue; }
    if (ready) continue;
    count++;
    if (count >= needed) {
      if (goal < TOP_GOAL) { goal++; count = 0; } else { ready = true; count = needed; }
    }
  }
  return { goal, count, needed, ready, weight: prevW };
}
