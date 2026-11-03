// Vanilla-DOM versions of the Sprint Voyage design-system components.
// Each returns an HTML string; styling lives in css/game.css.

const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
};

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function icon(name, size = 24, stroke = 2.5) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

const BTN_ICON = { sm: 16, md: 20, lg: 26 };
export function button(label, { variant = 'primary', size = 'md', ic, icRight, action, attrs = '', disabled = false } = {}) {
  const s = BTN_ICON[size];
  return `<button class="btn btn-${variant} btn-${size}" ${action ? `data-action="${action}"` : ''} ${disabled ? 'disabled' : ''} ${attrs}>${ic ? icon(ic, s) : ''}<span>${label}</span>${icRight ? icon(icRight, s) : ''}</button>`;
}

export function iconButton(ic, label, { variant = 'secondary', action, size = 52, attrs = '' } = {}) {
  return `<button class="icon-btn icon-btn-${variant}" style="--s:${size}px" aria-label="${esc(label)}" title="${esc(label)}" ${action ? `data-action="${action}"` : ''} ${attrs}>${icon(ic, Math.round(size * 0.46))}</button>`;
}

const BADGE = {
  todo: ['To Do', 'clock'], progress: ['In Progress', 'play'], review: ['In Review', 'compass'], done: ['Done', 'check'], blocked: ['Blocked', 'alert'],
};
export function badge(status, { size = 'md' } = {}) {
  const [label, ic] = BADGE[status] || BADGE.todo;
  return `<span class="badge badge-${status} badge-${size}">${icon(ic, size === 'sm' ? 12 : 14, 3)}${label}</span>`;
}

export function progressBar({ value, max, label = '', valueText, tone = 'leaf', size = 'md', onGlass = false }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return `<div class="pbar pbar-${size} pbar-${tone} ${onGlass ? 'on-glass' : ''}">
    ${(label || valueText) ? `<div class="pbar-head"><span>${esc(label)}</span><span class="num">${esc(valueText ?? Math.round(pct) + '%')}</span></div>` : ''}
    <div class="pbar-tube" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><div class="pbar-fill" style="width:${pct}%"><i></i></div></div>
  </div>`;
}

const CRATE_SIZE = { 1: 44, 2: 52, 3: 60, 5: 74, 8: 90, 13: 108 };
export function crate({ points, done = false, blocked = false, selected = false, focused = false, scale = 1, key = '', title = '', work = 0, effort = 1 }) {
  const s = Math.round((CRATE_SIZE[points] || 60) * scale);
  const meter = !done && work > 0 ? `<span class="crate-work" style="--w:${(work / effort) * 100}%"></span>` : '';
  return `<button class="crate ${done ? 'done' : ''} ${blocked ? 'blocked' : ''} ${selected ? 'selected' : ''} ${focused ? 'focused' : ''}" style="--s:${s}px" ${key ? `data-ticket="${esc(key)}"` : ''} title="${esc(title)}" aria-label="${esc(title)}">
    ${blocked ? '<span class="crate-band"></span>' : ''}
    <span class="crate-label">${done ? icon('check', Math.round(s * 0.3), 3.5) : points}</span>${meter}
  </button>`;
}

export function shipMarker(size = 90, bob = true) {
  return `<div class="ship-marker ${bob ? 'bob' : ''}" style="--s:${size}px">
    <i class="sm-wake"></i><i class="sm-mast"></i><i class="sm-sail"></i><i class="sm-jib"></i><i class="sm-flag"></i><i class="sm-hull"></i><i class="sm-trim"></i>
  </div>`;
}

export function stageTrack({ stages, position, shipSize = 46 }) {
  const last = stages.length - 1;
  const p = Math.max(0, Math.min(last, position));
  const pct = (p / last) * 100;
  return `<div class="track" style="--ship:${shipSize}px">
    <div class="track-tube"></div>
    <div class="track-fill" style="width:${pct}%"></div>
    ${stages.map((s, i) => {
      const reached = i <= p + 0.001;
      const current = Math.round(p) === i;
      const cls = reached ? (current ? 'current' : 'reached') : '';
      return `<div class="track-stop ${cls}" style="left:${(i / last) * 100}%">
        <div class="track-dot">${reached && !current && i > 0 ? icon('check', 18, 3.5) : i + 1}</div>
        <div class="track-label"><b>${esc(s.label)}</b>${s.count != null ? `<span>${s.count}</span>` : ''}</div>
      </div>`;
    }).join('')}
    <div class="track-ship" style="left:${pct}%">${shipMarker(shipSize)}</div>
  </div>`;
}

const PRI = { Highest: 'coral', High: 'coral', Medium: 'sun', Low: 'water', Lowest: 'water' };
export function ticketCard(t, { status, actions = '', effort = 1 } = {}) {
  const initials = (t.assignee || '?').split(' ').map(w => w[0]).join('').slice(0, 2);
  return `<div class="ticket-card" role="dialog" aria-label="${esc(t.key)} ${esc(t.title)}">
    <div class="tc-head"><span class="tc-key">${esc(t.key)}</span>${badge(status)}</div>
    <h3>${esc(t.title)}</h3>
    ${t.description ? `<p>${esc(t.description)}</p>` : ''}
    <div class="tc-meta">
      ${crate({ points: t.points, scale: 52 / (CRATE_SIZE[t.points] || 60) })}
      <div class="tc-info">
        <span class="tc-who"><span class="avatar">${esc(initials)}</span>${esc(t.assignee || 'Unassigned')}</span>
        <span class="tc-pri pri-${PRI[t.priority] || 'sun'}">${icon('flag', 16)} ${esc(t.priority)} priority · ${t.points} pts</span>
      </div>
    </div>
    ${t.stage < 3 ? `<div class="tc-work">${progressBar({ value: t.work, max: effort, label: t.blocked ? 'Blocked: catch an emerald orb to clear it' : 'Work toward next stage', valueText: `${t.work} / ${effort} crates`, size: 'sm', tone: t.blocked ? 'coral' : 'water' })}</div>` : ''}
    ${actions ? `<div class="tc-actions">${actions}</div>` : ''}
  </div>`;
}

export function sprintCard(s, { selected = false } = {}) {
  const locked = s.uiState === 'locked';
  const complete = s.uiState === 'complete';
  const ic = complete ? 'check' : locked ? 'lock' : 'play';
  const stars = s.stars ? `<div class="sc-stars" aria-label="${s.stars} of 3 stars">${[1, 2, 3].map(i => `<span class="${i <= s.stars ? 'on' : ''}">${icon('star', 18, 2.5)}</span>`).join('')}</div>` : '';
  return `<button class="sprint-card ${locked ? 'locked' : ''} ${selected ? 'selected' : ''} state-${s.uiState}" data-sprint="${s.id}" ${locked ? 'aria-disabled="true"' : ''}>
    <div class="sc-num">${s.number}</div>
    <div class="sc-name">${esc(s.name)}</div>
    <div class="sc-dates">${esc(s.dates)}</div>
    ${stars}
    <div class="sc-body">
      ${locked
        ? `<div class="sc-locked">${icon('lock', 18)} Unlocks after Sprint ${s.number - 1}</div>`
        : progressBar({ value: s.donePoints, max: s.totalPoints || 1, valueText: `${s.donePoints} / ${s.totalPoints} pts`, label: complete ? 'Completed' : 'In progress', size: 'sm', onGlass: true, tone: complete ? 'leaf' : 'sun' })}
    </div>
    <div class="sc-cta">${icon(ic, 16)} ${complete ? 'Replay' : locked ? 'Locked' : 'Set sail'}</div>
  </button>`;
}

export function stars(n, size = 44) {
  return `<div class="stars">${[1, 2, 3].map(i => `<span class="${i <= n ? 'on' : ''}" style="animation-delay:${i * 180}ms">${icon('star', size, 2.5)}</span>`).join('')}</div>`;
}
