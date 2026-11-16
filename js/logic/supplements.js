// Common supplements with a suggested daily amount worked out from your details
// (weight, sex, birthday). These are typical research doses, not medical advice.
import { ageFrom } from './targets.js';

const KG = 0.45359237;
const round = (n, step) => Math.round(n / step) * step;

export const PRESETS = [
  { id: 'creatine', name: 'Creatine monohydrate',
    dose: () => '5 g', note: '3–5 g a day keeps muscles topped up (International Society of Sports Nutrition).' },
  { id: 'protein', name: 'Protein powder',
    dose: () => '1 scoop (about 25 g protein)', note: 'Only to fill the gap to your protein target; log it as food too.' },
  { id: 'caffeine', name: 'Caffeine / pre-workout',
    dose: (p) => (p.weightLb ? `${Math.min(400, round(3 * p.weightLb * KG, 25))} mg` : '200 mg'),
    note: '3 mg per kg of body weight, 30–60 min before training (ISSN). Stay under 400 mg a day (FDA).' },
  { id: 'fishoil', name: 'Fish oil (omega-3)',
    dose: () => '1–2 g EPA + DHA', note: 'Common amount in heart and recovery studies.' },
  { id: 'vitd', name: 'Vitamin D3',
    dose: () => '1,000–2,000 IU', note: 'Typical adult amount (Endocrine Society); more only if a blood test says so.' },
  { id: 'magnesium', name: 'Magnesium',
    dose: () => '200 mg', note: 'Keep supplements at or under 350 mg a day (NIH upper limit); food covers the rest.' },
  { id: 'zinc', name: 'Zinc',
    dose: (p) => (p.sex === 'women' ? '8 mg' : '11 mg'), note: 'Daily need for adults (NIH): 11 mg men, 8 mg women.' },
  { id: 'multi', name: 'Multivitamin',
    dose: () => '1 serving', note: 'Covers small gaps in your diet.' },
];

// p: { weightLb, sex, birthday }
export function suggest(id, p = {}) {
  const pre = PRESETS.find((x) => x.id === id);
  return pre ? pre.dose({ ...p, age: ageFrom(p.birthday) }) : '';
}
