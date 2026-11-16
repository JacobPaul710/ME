// Character tab: your figure in your current gear tier, overall level, and ten skills.
import { h, svg, fmt } from './dom.js';
import { card, header, sheet } from './components.js';
import * as data from '../data.js';

// Armour colours per gear tier [main, shade]. No tier yet = plain cloth.
const TIER_COLORS = {
  none: ['#9a7b55', '#6b5338'], bronze: ['#b0763a', '#7a4f24'], iron: ['#7d8288', '#55595e'],
  steel: ['#aab3bc', '#78818a'], silver: ['#d5dade', '#9aa1a7'], gold: ['#d9ac3c', '#9b7522'],
  platinum: ['#cfe2e8', '#8fb0ba'], obsidian: ['#3a2f4a', '#1f1829'],
};

// An original, simple adventurer (not from any game).
function figure(tierId) {
  const [main, shade] = TIER_COLORS[tierId] || TIER_COLORS.none;
  const skin = '#d9a77a', ink = '#2c2117';
  const metal = tierId && tierId !== 'none';
  return svg(`<svg viewBox="0 0 60 100" width="96" height="160" aria-hidden="true">
    <circle cx="30" cy="16" r="9" fill="${skin}" stroke="${ink}" stroke-width="1.5"/>
    ${metal ? `<path d="M20 15 Q30 1 40 15 L40 11 Q30 -1 20 11 Z" fill="${main}" stroke="${ink}" stroke-width="1.2"/>` : `<path d="M21 13 Q30 3 39 13 L39 10 Q30 1 21 10 Z" fill="#6b4a2a" stroke="${ink}" stroke-width="1.2"/>`}
    <rect x="18" y="26" width="24" height="30" rx="5" fill="${main}" stroke="${ink}" stroke-width="1.5"/>
    <path d="M22 30 H38 M22 34 H38" stroke="${shade}" stroke-width="1.5"/>
    <rect x="18" y="40" width="24" height="5" fill="${shade}"/>
    <rect x="9" y="27" width="9" height="24" rx="4" fill="${metal ? main : skin}" stroke="${ink}" stroke-width="1.5"/>
    <rect x="42" y="27" width="9" height="24" rx="4" fill="${metal ? main : skin}" stroke="${ink}" stroke-width="1.5"/>
    <rect x="20" y="56" width="9" height="30" rx="3" fill="${metal ? shade : '#5a4632'}" stroke="${ink}" stroke-width="1.5"/>
    <rect x="31" y="56" width="9" height="30" rx="3" fill="${metal ? shade : '#5a4632'}" stroke="${ink}" stroke-width="1.5"/>
    <rect x="18" y="85" width="12" height="7" rx="2" fill="${ink}"/>
    <rect x="30" y="85" width="12" height="7" rx="2" fill="${ink}"/>
    <path d="M50 50 L58 12" stroke="${metal ? main : '#8b8b8b'}" stroke-width="3" stroke-linecap="round"/>
    <path d="M58 12 L58.6 9" stroke="${ink}" stroke-width="1"/>
    <path d="M45 47 L55 52" stroke="#6b4a2a" stroke-width="3" stroke-linecap="round"/>
  </svg>`);
}

function skillSheet(s) {
  sheet(`${s.name} · level ${s.level}`, h('div', { class: 'stack' },
    h('p', { style: 'margin:0' }, `Earned by: ${s.how}.`),
    h('div', { class: 'bar' }, h('i', { style: `width:${Math.max(0, Math.min(100, s.pct))}%` })),
    h('p', { class: 'sub', style: 'margin:0' }, s.level >= s.max ? 'Maxed out.' : `${fmt(s.toNext, 0)} XP to level ${s.level + 1}`),
    s.unit ? h('p', { class: 'sub', style: 'margin:0' }, `So far: ${fmt(s.count, s.unit === 'full days' ? 1 : 0)} ${s.unit}`) : null));
}

export function renderCharacter(root, ctx) {
  const { today } = ctx;
  const L = data.levelInfo(today);
  const gear = data.gearInfo(today);
  const streak = data.streakInfo(today);
  const skills = data.skillInfo(today);
  const tier = gear.current;
  root.append(
    header('Character'),
    card(h('div', { class: 'char-hero' },
      h('div', { class: 'char-figure' }, figure(tier?.id || 'none')),
      h('div', { class: 'char-name' }, `Level ${L.level}`),
      h('div', { class: 'sub' }, `${tier ? `${tier.name} gear` : 'No gear tier yet'} · ${streak.current} day streak`))),
    card(h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, 'Skills'), h('span', { class: 'sub' }, `Total ${skills.total}`)),
      h('div', { class: 'skills' }, skills.list.map((s) => h('button', { type: 'button', class: 'skill', 'aria-label': `${s.name} level ${s.level}`, onClick: () => skillSheet(s) },
        h('span', { class: 'skill-top' }, h('span', null, s.name), h('b', null, String(s.level))),
        h('span', { class: 'skill-bar' }, h('i', { style: `width:${Math.max(0, Math.min(100, s.pct))}%` })))))));
}
