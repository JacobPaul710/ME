// Rep goals, one per set. Each set has its own goal and "sessions hit" count.
// Hit a set's goal N sessions in a row and that set's goal goes up by 1, until it
// reaches the top of the exercise's rep range (10–12 by default). When every set is
// at the top and has been hit N times, it's time to add weight; changing a set's
// weight resets its goal to the bottom of the range.
export const START_GOAL = 10;
export const TOP_GOAL = 12;

// Reps that count toward the goal. For left/right exercises, the weaker side.
export function effectiveReps(s) {
  if (s.repsR != null || s.repsL != null) {
    const r = +s.repsR || 0, l = +s.repsL || 0;
    return Math.min(r, l);
  }
  return +s.reps || 0;
}

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
  const ss = session.sets.filter((s) => effectiveReps(s) > 0);
  if (!ss.length) return null;
  const weight = Math.max(...ss.map((s) => +s.weight || 0));
  const reps = ss.filter((s) => (+s.weight || 0) === weight).map(effectiveReps);
  return { weight, reps };
}

export const range = (ex = {}) => ({ start: ex.repStart ?? START_GOAL, top: ex.repTop ?? TOP_GOAL });

// ex.baseline (optional): { date, sets: [{ weight, reps, repsR, repsL, goal, hits }] } —
// where you were before you started logging in the app.
export function evaluateSets(ex, sess, needed = 4) {
  const { start, top } = range(ex);
  const base = ex.baseline || null;
  const sets = (base ? base.sets : []).map((b) => ({
    weight: b.weight ?? null,
    reps: b.reps ?? (b.repsR != null ? Math.min(+b.repsR || 0, +b.repsL || 0) : null),
    repsR: b.repsR ?? null, repsL: b.repsL ?? null,
    goal: b.goal ?? (b.reps != null ? Math.min(top, Math.max(start, +b.reps + 1)) : start),
    hits: Math.min(needed, b.hits || 0), change: b.change ?? null,
  }));
  let lastDate = base ? base.date : null;
  // Goals you typed in yourself (ex.goals = { setIndex: { goal, date } }) take over from that date.
  const pending = Object.entries(ex.goals || {}).map(([i, g]) => ({ i: +i, ...g })).sort((a, b) => (a.date < b.date ? -1 : 1));
  const applyGoals = (upTo) => {
    while (pending.length && (upTo == null || pending[0].date <= upTo)) {
      const g = pending.shift();
      if (!sets[g.i]) sets[g.i] = { weight: null, reps: null, goal: start, hits: 0, change: null };
      sets[g.i].goal = Math.max(1, Math.round(+g.goal || start));
      sets[g.i].hits = 0;
    }
  };
  for (const s of sess) {
    if (base && s.date <= base.date) continue;
    applyGoals(s.date);
    s.sets.filter((x) => effectiveReps(x) > 0).forEach((x, i) => {
      if (!sets[i]) sets[i] = { weight: null, reps: null, goal: start, hits: 0, change: null };
      const st = sets[i];
      const w = +x.weight || 0;
      const reps = effectiveReps(x);
      st.change = st.weight === w && st.reps != null ? reps - st.reps : null;
      if (st.weight !== null && w !== st.weight) { st.goal = start; st.hits = 0; }
      st.weight = w;
      st.reps = reps;
      st.repsR = x.repsR ?? null; st.repsL = x.repsL ?? null;
      if (reps >= st.goal) {
        st.hits++;
        if (st.hits >= needed) {
          if (st.goal < top) { st.goal++; st.hits = 0; } else st.hits = needed;
        }
      } else st.hits = 0;
    });
    lastDate = s.date;
  }
  applyGoals(null);
  const ready = sets.length > 0 && sets.every((s) => s.goal >= top && s.hits >= needed);
  return { sets, ready, lastDate, needed, start, top };
}

// Kept for older callers: one goal for the whole exercise.
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
