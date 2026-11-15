// Your routine, as you sent it (Nov 14, 2026). Loaded once; the fixed ids mean
// two devices loading it at the same time won't make duplicates.
const D = '2026-11-14';
const s = (weight, reps, goal, hits, change = null) => ({ weight, reps, goal, hits, change });
const lr = (weight, repsR, repsL, goal, hits = 0) => ({ weight, repsR, repsL, goal, hits });

export const ROUTINE = [
  // ---- Push ----
  { id: 'flat-bench', name: 'Flat Bench', day: 'Push', group: 'Chest', standard: 'bench',
    notes: 'Position for palm pain. Setting 13, below number. Ring finger on line.',
    sets: [s(45, 10, 11, 1, 0), s(45, 9, 9, 2, 1), s(45, 7, 8, 1, 1)] },
  { id: 'incline-bench', name: 'Incline Bench', day: 'Push', group: 'Chest', standard: 'none',
    notes: 'Bring shoulder blades together. Pinky on the line. 35 degrees seems best. Setting 19.',
    sets: [s(22.5, 10, 12, 0, 0), s(22.5, 10, 12, 0, 0), s(22.5, 10, 12, 0, 0)] },
  { id: 'skull-crushers', name: 'Skull Crushers', day: 'Push', group: 'Chest', variant: { key: 'push-tri', n: 1 },
    notes: 'Pivot at elbow only.',
    sets: [s(20, 10, 10, 2, 1), s(20, 10, 10, 1, 1), s(20, 9, 9, 1, 1)] },
  { id: 'overhead-extensions', name: 'Overhead Extensions', day: 'Push', group: 'Chest', variant: { key: 'push-tri', n: 2 },
    notes: '',
    sets: [s(25, 11, 12, 0, 0), s(25, 12, 12, 1, 0), s(25, 12, 12, 1, 0)] },
  { id: 'overhead-press', name: 'Overhead Press', day: 'Push', group: 'Shoulders',
    notes: '75 degree bench.',
    sets: [s(25, 12, 12, 1, 0), s(25, 11, 11, 1, 0), { weight: 25, reps: null, goal: 10, hits: 0 }] },
  { id: 'front-db-raises', name: 'Front DB Raises', day: 'Push', group: 'Shoulders', repStart: 15, repTop: 17,
    notes: '1 notch down from 90.',
    sets: [s(30, 15, 16, 0), s(30, 15, 16, 0), s(30, 15, 16, 0)] },
  { id: 'side-lateral-raises', name: 'Side Lateral Raises', day: 'Push', group: 'Shoulders', notes: '', sets: [] },

  // ---- Pull ----
  { id: 'standing-db-curls', name: 'Standing DB Curls', day: 'Pull', group: 'Biceps',
    notes: 'True form. Keep arms fixed and pivot at the elbow to focus the bicep. Elbows back; lift with the bicep, not the shoulders.',
    sets: [s(25, 12, 12, 3, 0), s(25, 12, 12, 2, 0), s(25, 10, 10, 5, 0)] },
  { id: 'incline-db-curls', name: 'Incline DB Curls', day: 'Pull', group: 'Biceps', variant: { key: 'pull-bi', n: 1 },
    notes: '50 degrees.',
    sets: [s(15, 10, 11, 0, 0), s(15, 11, 12, 0, 0), s(15, 12, 12, 0, 2)] },
  { id: 'hammer-curls', name: 'Hammer Curls', day: 'Pull', group: 'Biceps', variant: { key: 'pull-bi', n: 2 },
    notes: 'Watch the path.',
    sets: [s(25, 12, 12, 1, 1), s(25, 11, 11, 2, 0), s(25, 10, 11, 0, 0)] },
  { id: 'trap-shrugs-pull', name: 'Trap Shrugs', day: 'Pull', group: 'Back', repStart: 20, repTop: 22,
    notes: '',
    sets: [s(45, 20, 21, 0, 2), s(45, 20, 21, 0, 0), s(45, 18, 20, 0, -2)] },

  // ---- Legs ----
  { id: 'hex-bar-squat', name: 'Hex Bar Squat', day: 'Legs', group: 'Legs', standard: 'squat',
    notes: '',
    sets: [s(15, 8, 9, 0, 0), s(15, 9, 10, 0, 0), s(15, 9, 10, 0, 0)] },
  { id: 'calf-raises', name: 'Calf Raises', day: 'Legs', group: 'Legs', repStart: 20, repTop: 22,
    notes: '',
    sets: [s(25, 20, 22, 0, 0), s(25, 20, 22, 0, 0), s(25, 20, 22, 0, 0)] },

  // ---- Back ----
  { id: 'trap-shrugs-back', name: 'Trap Shrugs (slow)', day: 'Back', group: 'Back',
    notes: 'Slow and straight. Shoulders only, no neck. Slow, full lower.',
    sets: [s(35, 10, 11, 0, 0), s(35, 11, 12, 0, 0), s(35, 11, 12, 0, 0)] },

  // ---- Forearms (left and right counted separately) ----
  { id: 'back-curl', name: 'Back Curl', day: 'Forearms', group: 'Forearms', sides: true, repStart: 20, repTop: 20,
    notes: '',
    sets: [lr(27.5, 35, 35, 20), lr(27.5, 26, 24, 20), lr(27.5, 20, 17, 20), lr(27.5, 16, 14, 20)] },
  { id: 'front-curl', name: 'Front Curl', day: 'Forearms', group: 'Forearms', sides: true, repStart: 20, repTop: 20,
    notes: '',
    sets: [lr(10, 23, 23, 20), lr(10, 21, 16, 20), lr(7.5, 21, 20, 20), lr(7.5, 21, 18, 20)] },
];

export function seedRecords() {
  return ROUTINE.map((r, i) => ({
    id: `ex:seed-${r.id}`,
    data: {
      name: r.name, type: 'strength', dayTypes: [r.day], group: r.group, notes: r.notes || '',
      variant: r.variant || null, sides: !!r.sides, repStart: r.repStart ?? 10, repTop: r.repTop ?? 12,
      standard: r.standard || null,
      baseline: r.sets.length ? { date: D, sets: r.sets } : null,
      created: `2026-11-14T12:00:${String(i).padStart(2, '0')}.000Z`,
    },
  }));
}
