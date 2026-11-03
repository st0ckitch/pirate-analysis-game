import { World, LANE, STAGE_X } from './game/world.js';
import { Voyage, DAYS } from './game/voyage.js';
import { ticketsFromIssues, totals, effortFor, DONE } from './game/sprintModel.js';
import { jira } from './jira/mockJiraClient.js';
import { STATUSES, STATUS_KEYS, BOARD } from './jira/mockData.js';
import { sfx, setSound, unlockAudio } from './audio.js';
import {
  esc, icon, button, iconButton, badge, progressBar, crate, stageTrack, ticketCard, sprintCard, stars, shipMarker,
} from './ui/components.js';

// ---------- persistence ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const settings = Object.assign({ sound: true, difficulty: 'calm' }, store.get('sv-settings', {}));
const progress = Object.assign({ stars: {}, unlocked: [] }, store.get('sv-progress', {}));
setSound(settings.sound);

// ---------- app state ----------
const ui = document.getElementById('ui');
const world = new World(document.getElementById('scene'));
const app = {
  screen: 'menu',
  sprints: [],
  selectedSprint: null,
  voyage: null,
  sprint: null,
  modal: null,
  openTicket: null,
  menuShip: { x: -6, z: 0, roll: 0, speed: 0 },
  prevStages: {},
  syncCooldown: 0,
  syncing: false,
};

const fmtDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const statusKey = t => t.blocked ? 'blocked' : STATUS_KEYS[t.stage];

function decorateSprints(list) {
  return list.map(s => {
    const allDone = s.totalPoints > 0 && s.donePoints === s.totalPoints;
    let uiState = 'current';
    if (s.state === 'closed' || allDone) uiState = 'complete';
    else if (s.state === 'future' && !progress.unlocked.includes(s.id)) uiState = 'locked';
    return { ...s, uiState, dates: `${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}`, stars: progress.stars[s.id] || 0 };
  });
}
async function loadSprints() { app.sprints = decorateSprints(await jira.getSprints()); }
const defaultSprint = () => app.sprints.find(s => s.uiState === 'current') || app.sprints.filter(s => s.uiState !== 'locked').at(-1);

// ---------- screens ----------
function setScreen(name) {
  app.screen = name;
  app.modal = null;
  if (name === 'menu') { world.setCameraMode('menu'); renderMenu(); }
  if (name === 'sprints') { world.setCameraMode('sprints'); renderSprints(); }
}

function renderMenu() {
  const cur = defaultSprint();
  ui.innerHTML = `<div class="screen fade-in">
    <div class="menu">
      <div class="title-tag">A Jira sprint adventure</div>
      <h1 class="game-title">Sprint<br>Voyage</h1>
      <div class="menu-buttons">
        ${button('Set Sail', { size: 'lg', ic: 'play', action: 'quick-play' })}
        ${button('Sprints', { size: 'lg', variant: 'secondary', ic: 'compass', action: 'sprints' })}
        ${button('How to Play', { size: 'lg', variant: 'secondary', ic: 'help', action: 'help' })}
        ${button('Settings', { size: 'lg', variant: 'secondary', ic: 'settings', action: 'settings' })}
      </div>
    </div>
    <div class="glass menu-jira"><span class="dot"></span> Mock Jira · ${esc(BOARD.name)}${cur ? ` · Sprint ${cur.number}` : ''}</div>
    <div class="menu-foot">Ticket data is mock Jira data. Your progress is saved in this browser.</div>
  </div><div id="modal-root"></div>`;
}

function renderSprints() {
  if (!app.selectedSprint || app.sprints.find(s => s.id === app.selectedSprint)?.uiState === 'locked') app.selectedSprint = defaultSprint()?.id;
  const sel = app.sprints.find(s => s.id === app.selectedSprint);
  ui.innerHTML = `<div class="screen fade-in">
    <div class="top-bar">${iconButton('arrowLeft', 'Back', { action: 'menu' })}<h2 class="screen-title">Choose your voyage</h2></div>
    <div class="sprint-row">${app.sprints.map(s => sprintCard(s, { selected: s.id === app.selectedSprint })).join('')}</div>
    ${sel ? `<div class="glass sprint-goal"><b>Sprint goal:</b> ${esc(sel.goal)} · ${sel.issueCount} tickets</div>` : ''}
    <div class="bottom-cta">${sel ? button(`${sel.uiState === 'complete' ? 'Replay' : 'Set Sail on'} Sprint ${sel.number}`, { size: 'lg', ic: 'play', action: 'play-selected' }) : ''}</div>
  </div><div id="modal-root"></div>`;
  ui.querySelector('.sprint-card.selected')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function modal(html) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = html ? `<div class="modal" data-action="modal-bg">${html}</div>` : '';
}

function helpHtml() {
  return `<div class="panel titled" data-stop><div class="panel-title">How to play</div>
    <h2>Sail your sprint to Done</h2>
    <p>Your boat's place on the river is the story-point weighted progress of the sprint's Jira tickets. Four waypoints mark To Do, In Progress, In Review and Done.</p>
    <div class="legend">
      <span class="sw sw-crate"></span><span><b>Work crates</b>: steer into them. Each one adds work to a ticket. Bigger tickets need more crates per stage.</span>
      <span class="sw sw-rock"></span><span><b>Rocks and logs</b>: a hit flags one of your tickets as Blocked.</span>
      <span class="sw sw-orb"></span><span><b>Emerald orbs</b>: clear a blocker. They only appear while something is blocked.</span>
    </div>
    <ul>
      <li>Steer with <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd>. On touch, drag on the river or use the arrow buttons.</li>
      <li>Tap a crate in the cargo panel to open its ticket. <b>Focus crew</b> sends all new work to that ticket.</li>
      <li>Teammates update Jira too. Press <b>Sync Jira</b> to pull their changes.</li>
      <li>Finish before Day ${DAYS} ends. 3 stars for every ticket Done, 2 for 80% of points, 1 for 50%.</li>
      <li><kbd>Esc</kbd> or <kbd>P</kbd> pauses.</li>
    </ul>
    <div class="row">${button('Got it', { action: app.screen === 'hud' ? 'pause-menu' : 'close-modal', size: 'sm' })}</div>
  </div>`;
}

function settingsHtml() {
  const seg = (name, val, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-action="set" data-k="${name}" data-v="${v}" class="${String(val) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  return `<div class="panel titled" data-stop><div class="panel-title">Settings</div>
    <div class="setting"><span>Sound</span>${seg('sound', settings.sound, [[true, 'On'], [false, 'Off']])}</div>
    <div class="setting"><span>River current<br><small style="font:500 13px var(--font-body);color:var(--ink-500)">Rapids: faster water, more hazards</small></span>${seg('difficulty', settings.difficulty, [['calm', 'Calm'], ['rapids', 'Rapids']])}</div>
    <div class="setting"><span>Saved stars and unlocks</span>${button('Reset', { variant: 'danger', size: 'sm', action: 'reset-progress' })}</div>
    <div class="row">${button('Done', { size: 'sm', action: 'close-modal' })}</div>
  </div>`;
}

// ---------- voyage / HUD ----------
async function startVoyage(sprintId) {
  unlockAudio();
  const s = app.sprints.find(x => x.id === sprintId);
  if (!s || s.uiState === 'locked') return;
  ui.innerHTML = `<div class="screen"><div class="glass hint" style="top:45%">${icon('refresh', 20)} Loading tickets from Jira…</div></div>`;
  const issues = await jira.getSprintIssues(s.id);
  const fresh = s.uiState === 'complete';
  const tickets = ticketsFromIssues(issues, { fresh });
  app.voyage?.dispose();
  app.sprint = s;
  app.prevStages = Object.fromEntries(tickets.map(t => [t.key, t.stage]));
  app.syncCooldown = 0;
  app.voyage = new Voyage(world, {
    sprint: s, tickets, difficulty: settings.difficulty, jira, writeBack: !fresh, onEvent: onVoyageEvent,
  });
  app.screen = 'hud';
  app.modal = null;
  renderHud();
}

function renderHud() {
  const v = app.voyage;
  ui.innerHTML = `<div class="screen" id="hud">
    <div class="glass hud-top-left" id="hud-progress"></div>
    <div class="hud-top-right">
      ${button('Sync Jira', { variant: 'ghost', size: 'sm', ic: 'refresh', action: 'sync', attrs: 'id="sync-btn"' }).replace('class="btn', 'class="sync-btn btn')}
      ${iconButton('pause', 'Pause', { variant: 'ghost', action: 'pause' })}
    </div>
    <div class="toasts" id="toasts"></div>
    <div class="glass hint" id="hint">Steer with <kbd>←</kbd> <kbd>→</kbd> or drag · catch crates · dodge rocks</div>
    <div class="touch-controls">
      ${iconButton('chevronLeft', 'Steer left', { variant: 'ghost', size: 72, attrs: 'data-steer="-1"' })}
      ${iconButton('chevronRight', 'Steer right', { variant: 'ghost', size: 72, attrs: 'data-steer="1"' })}
    </div>
    <div class="glass hud-bottom">
      <div class="cargo" id="cargo"></div>
      <div id="track-wrap">${stageTrack({ stages: STATUSES.map(l => ({ label: l, count: 0 })), position: v.position, shipSize: 46 })}</div>
    </div>
    <div id="pops"></div>
  </div><div id="modal-root"></div>`;
  updateHud(true);
  setTimeout(() => document.getElementById('hint')?.classList.add('hide'), 5500);
}

function updateHud(first = false) {
  const v = app.voyage;
  if (!v || app.screen !== 'hud') return;
  const { total, done } = totals(v.tickets);
  const prog = document.getElementById('hud-progress');
  if (prog) {
    prog.innerHTML = `<div class="hud-title"><span>Sprint ${app.sprint.number} · ${esc(app.sprint.name)}</span><span class="hud-day" id="hud-day"></span></div>
      ${progressBar({ value: done, max: total, size: 'lg', onGlass: true, valueText: `${done} / ${total} pts` })}
      <div class="days" id="days">${Array.from({ length: DAYS }, () => '<i></i>').join('')}</div>`;
    app.lastDay = null;
    updateClock();
  }
  const cargo = document.getElementById('cargo');
  if (cargo) {
    const narrow = innerWidth < 760;
    const scale = narrow ? 0.48 : innerHeight < 700 ? 0.6 : 0.72;
    cargo.innerHTML = STATUSES.map((_, i) => `<div class="cargo-col" style="left:${(i / 3) * 100}%">${
      v.tickets.filter(t => t.stage === i).map(t => {
        const moved = !first && app.prevStages[t.key] !== t.stage;
        return `<div class="${moved ? 'drop' : ''}">${crate({
          points: t.points, done: i === DONE, blocked: t.blocked, focused: v.focusKey === t.key, selected: app.openTicket === t.key, scale,
          key: t.key, title: `${t.key} · ${t.title}${t.blocked ? ' (blocked)' : ''}`, work: t.work, effort: effortFor(t.points),
        })}</div>`;
      }).join('')}</div>`).join('');
    app.prevStages = Object.fromEntries(v.tickets.map(t => [t.key, t.stage]));
  }
  // Track: update in place so the ship glides.
  const pos = v.position;
  const pct = (Math.max(0, Math.min(3, pos)) / 3) * 100;
  const track = document.querySelector('#track-wrap .track');
  if (track) {
    track.querySelector('.track-fill').style.width = pct + '%';
    track.querySelector('.track-ship').style.left = pct + '%';
    track.querySelectorAll('.track-stop').forEach((el, i) => {
      const reached = i <= pos + 0.001, current = Math.round(pos) === i;
      el.className = `track-stop ${reached ? (current ? 'current' : 'reached') : ''}`;
      el.querySelector('.track-dot').innerHTML = reached && !current && i > 0 ? icon('check', 18, 3.5) : String(i + 1);
      const n = v.tickets.filter(t => t.stage === i).length;
      el.querySelector('.track-label span').textContent = `${n} ${n === 1 ? 'ticket' : 'tickets'}`;
    });
  }
}

function updateClock() {
  const v = app.voyage;
  if (!v || app.screen !== 'hud') return;
  const dayEl = document.getElementById('hud-day');
  const day = v.day;
  const frac = ((v.elapsed / v.duration) * DAYS) % 1;
  if (dayEl && app.lastDay !== day) {
    app.lastDay = day;
    dayEl.innerHTML = `${icon('clock', 16)} Day ${day} of ${DAYS}`;
    dayEl.classList.toggle('low', day >= DAYS - 1);
  }
  const days = document.getElementById('days');
  if (days) [...days.children].forEach((el, i) => {
    el.className = i < day - 1 ? 'past' : i === day - 1 ? 'now' : '';
    if (i === day - 1) el.style.setProperty('--d', `${Math.round(frac * 100)}%`);
  });
  const sb = document.getElementById('sync-btn');
  if (sb) {
    sb.disabled = app.syncing || app.syncCooldown > 0 || v.state !== 'running';
    sb.classList.toggle('spin', app.syncing);
    const label = app.syncing ? 'Syncing…' : app.syncCooldown > 0 ? `Sync Jira (${Math.ceil(app.syncCooldown)})` : 'Sync Jira';
    const span = sb.querySelector('span');
    if (span.textContent !== label) span.textContent = label;
  }
}

function toast(html, tone = '') {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `glass toast ${tone}`;
  el.innerHTML = html;
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, 3200);
}

function pop(text, cls, at) {
  const box = document.getElementById('pops');
  if (!box || !at) return;
  const p = world.toScreen(...at);
  if (!p.visible) return;
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
  el.textContent = text;
  box.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function onVoyageEvent(ev) {
  const t = ev.ticket;
  switch (ev.type) {
    case 'work':
      sfx.crate();
      pop(`+1 ${t.key}`, 'good', ev.at);
      break;
    case 'advance':
      ev.to === 'Done' ? sfx.done() : ev.remote ? sfx.remote() : sfx.advance();
      if (!ev.remote) pop(`${t.key} → ${ev.to}`, 'good', ev.at);
      toast(`${badge(STATUS_KEYS[t.stage], { size: 'sm' })}<span>${esc(t.key)} moved to ${esc(ev.to)}${ev.remote ? ` <span class="who">· by ${esc(ev.remote)}</span>` : ''}</span>`);
      if (t.key === app.voyage?.focusKey && t.stage === DONE) app.voyage.focusKey = null;
      break;
    case 'blocked':
      break;
    case 'hit':
      sfx.hit();
      pop(t ? `${t.key} blocked!` : 'Bump!', 'bad', ev.at);
      if (t) toast(`${badge('blocked', { size: 'sm' })}<span>${esc(t.key)} hit an impediment</span>`);
      break;
    case 'unblocked':
      ev.remote ? sfx.remote() : sfx.orb();
      if (!ev.remote) pop(`${t.key} unblocked`, 'glow', ev.at);
      toast(`${badge(STATUS_KEYS[t.stage], { size: 'sm' })}<span>${esc(t.key)} blocker cleared${ev.remote ? ` <span class="who">· by ${esc(ev.remote)}</span>` : ''}</span>`);
      break;
    case 'miss':
      sfx.miss();
      break;
    case 'syncing':
      app.syncing = true;
      break;
    case 'synced':
      app.syncing = false;
      if (ev.manual && !ev.count) toast(`${icon('check', 16, 3)}<span>Jira is up to date</span>`);
      break;
    case 'complete':
      sfx.win();
      toast(`${badge('done', { size: 'sm' })}<span>Every ticket is Done. Land ho!</span>`);
      break;
    case 'end':
      showResults(ev.result);
      return;
  }
  updateHud();
  if (app.modal === 'ticket') renderTicketModal();
}

async function manualSync() {
  const v = app.voyage;
  if (!v || app.syncing || app.syncCooldown > 0) return;
  app.syncCooldown = 15;
  const applied = await v.poll();
  if (!applied.length && app.screen === 'hud') toast(`${icon('check', 16, 3)}<span>Jira is up to date</span>`);
}

function renderTicketModal() {
  const v = app.voyage;
  const t = v?.tickets.find(x => x.key === app.openTicket);
  if (!t) return closeModal();
  const focused = v.focusKey === t.key;
  const actions = [
    button('Close', { variant: 'secondary', size: 'sm', action: 'close-modal' }),
    t.stage < DONE ? button(focused ? 'Unfocus crew' : 'Focus crew here', { size: 'sm', ic: 'target', action: 'focus', attrs: `data-key="${esc(t.key)}"` }) : '',
  ].join('');
  modal(`<div data-stop>${ticketCard(t, { status: statusKey(t), actions, effort: effortFor(t.points) })}</div>`);
}

function openTicket(key) {
  if (!app.voyage || app.voyage.state !== 'running') return;
  sfx.click();
  app.openTicket = key;
  app.modal = 'ticket';
  app.voyage.paused = true;
  renderTicketModal();
  updateHud();
}

function pauseMenu() {
  const v = app.voyage;
  if (!v || v.state === 'ended') return;
  v.paused = true;
  app.modal = 'pause';
  modal(`<div class="panel titled" data-stop style="text-align:center"><div class="panel-title">Paused</div>
    <h2>Anchors down</h2>
    <p>Sprint ${app.sprint.number} · ${esc(app.sprint.name)} · Day ${v.day} of ${DAYS}</p>
    <div class="row" style="justify-content:center">
      ${button('Resume', { ic: 'play', action: 'resume' })}
      ${button('Restart', { variant: 'secondary', ic: 'refresh', action: 'restart' })}
    </div>
    <div class="row" style="justify-content:center;margin-top:8px">
      ${button('How to Play', { variant: 'secondary', size: 'sm', ic: 'help', action: 'help' })}
      ${button('Quit to Menu', { variant: 'danger', size: 'sm', action: 'quit' })}
    </div>
  </div>`);
}

function closeModal() {
  modal('');
  const wasTicket = app.modal === 'ticket';
  app.modal = null;
  app.openTicket = null;
  if (app.voyage && app.screen === 'hud') { app.voyage.paused = false; if (wasTicket) updateHud(); }
}

async function showResults(r) {
  const s = app.sprint;
  r.complete ? null : sfx.lose();
  const prev = progress.stars[s.id] || 0;
  progress.stars[s.id] = Math.max(prev, r.stars);
  let unlocked = null;
  if (r.stars >= 1) {
    const next = app.sprints.find(x => x.number === s.number + 1);
    if (next && next.state === 'future' && !progress.unlocked.includes(next.id)) { progress.unlocked.push(next.id); unlocked = next; }
  }
  store.set('sv-progress', progress);
  await loadSprints();
  const next = app.sprints.find(x => x.number === s.number + 1 && x.uiState !== 'locked');
  app.screen = 'results';
  app.modal = 'results';
  const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
  const title = r.complete ? 'Sprint complete!' : r.stars >= 2 ? 'Nearly there!' : 'Sprint ended';
  const sub = r.complete ? `Every ticket reached Done in ${r.daysUsed} ${r.daysUsed === 1 ? 'day' : 'days'}.` : `Time's up. ${pct}% of story points reached Done.`;
  const rows = r.tickets.slice().sort((a, b) => b.stage - a.stage).map(t => `<div><span><span class="k">${esc(t.key)}</span>${esc(t.title)}</span>${badge(statusKey(t), { size: 'sm' })}</div>`).join('');
  ui.innerHTML = `<div class="screen"><div id="modal-root"></div></div>`;
  modal(`<div class="panel titled results" data-stop><div class="panel-title">Sprint ${s.number} · ${esc(s.name)}</div>
    <h2>${title}</h2>
    ${stars(r.stars)}
    <p style="margin:0">${sub}</p>
    ${unlocked ? `<p style="margin:4px 0 0;color:var(--leaf-700);font-weight:700">${icon('lock', 16)} Sprint ${unlocked.number} · ${esc(unlocked.name)} unlocked!</p>` : ''}
    <div class="stat-grid">
      <div class="stat"><b>${r.done}/${r.total}</b><span>story points done</span></div>
      <div class="stat"><b>${r.stats.caught}</b><span>work crates caught</span></div>
      <div class="stat"><b>${r.stats.hits}</b><span>impediments hit</span></div>
      <div class="stat"><b>${r.stats.orbs}</b><span>blockers cleared</span></div>
      <div class="stat"><b>${r.stats.bestStreak}</b><span>best crate streak</span></div>
      <div class="stat"><b>${r.stats.remote}</b><span>teammate updates</span></div>
    </div>
    <div class="result-tickets">${rows}</div>
    <div class="row" style="justify-content:center">
      ${next && next.id !== s.id && unlocked ? button(`Sail Sprint ${next.number}`, { ic: 'play', action: 'play', attrs: `data-id="${next.id}"` }) : ''}
      ${button('Sail Again', { variant: unlocked ? 'secondary' : 'primary', ic: 'refresh', action: 'play', attrs: `data-id="${s.id}"` })}
      ${button('Sprints', { variant: 'secondary', ic: 'compass', action: 'sprints' })}
      ${button('Menu', { variant: 'secondary', action: 'menu' })}
    </div>
  </div>`);
}

function leaveVoyage() {
  app.voyage?.dispose();
  app.voyage = null;
  app.menuShip.x = -6;
  world.setReached(0);
  world.setCargo(0);
}

// ---------- input ----------
ui.addEventListener('click', async e => {
  const crateEl = e.target.closest('[data-ticket]');
  if (crateEl && app.screen === 'hud' && !crateEl.closest('.modal')) return openTicket(crateEl.dataset.ticket);
  const card = e.target.closest('[data-sprint]');
  if (card) {
    const s = app.sprints.find(x => x.id === +card.dataset.sprint);
    if (s && s.uiState !== 'locked') { sfx.click(); app.selectedSprint = s.id; renderSprints(); }
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'modal-bg') {
    if (e.target !== el) return; // click inside the panel
    if (app.modal === 'ticket' || app.modal === 'help' || app.modal === 'settings') { if (app.screen === 'hud' && app.modal === 'help') return pauseMenu(); return closeModal(); }
    return;
  }
  unlockAudio();
  sfx.click();
  switch (a) {
    case 'quick-play': { const s = defaultSprint(); if (s) startVoyage(s.id); break; }
    case 'sprints': leaveVoyage(); setScreen('sprints'); break;
    case 'menu': leaveVoyage(); setScreen('menu'); break;
    case 'play-selected': startVoyage(app.selectedSprint); break;
    case 'play': startVoyage(+el.dataset.id); break;
    case 'help': app.modal = 'help'; modal(helpHtml()); break;
    case 'settings': app.modal = 'settings'; modal(settingsHtml()); break;
    case 'close-modal': closeModal(); break;
    case 'set': {
      const k = el.dataset.k, v = el.dataset.v;
      settings[k] = k === 'sound' ? v === 'true' : v;
      setSound(settings.sound);
      store.set('sv-settings', settings);
      modal(settingsHtml());
      break;
    }
    case 'reset-progress':
      progress.stars = {}; progress.unlocked = [];
      store.set('sv-progress', progress);
      await loadSprints();
      modal(settingsHtml());
      break;
    case 'pause': pauseMenu(); break;
    case 'pause-menu': pauseMenu(); break;
    case 'resume': closeModal(); break;
    case 'restart': startVoyage(app.sprint.id); break;
    case 'quit': leaveVoyage(); setScreen('menu'); break;
    case 'sync': manualSync(); break;
    case 'focus': app.voyage?.setFocus(el.dataset.key); closeModal(); break;
  }
});

const keys = new Set();
function steerFromKeys() {
  if (!app.voyage) return;
  const l = keys.has('ArrowLeft') || keys.has('KeyA');
  const r = keys.has('ArrowRight') || keys.has('KeyD');
  app.voyage.input = (r ? 1 : 0) - (l ? 1 : 0);
}
addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
    keys.add(e.code); steerFromKeys(); e.preventDefault();
    document.getElementById('hint')?.classList.add('hide');
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (app.screen !== 'hud') { if (app.modal) closeModal(); return; }
    if (app.modal === 'pause') closeModal();
    else if (app.modal) { if (app.modal === 'help') pauseMenu(); else closeModal(); }
    else pauseMenu();
  }
});
addEventListener('keyup', e => { keys.delete(e.code); steerFromKeys(); });
addEventListener('blur', () => { keys.clear(); steerFromKeys(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && app.screen === 'hud' && !app.modal) pauseMenu(); });

// Drag-to-steer on the river, and hold-to-steer touch buttons.
const canvas = document.getElementById('scene');
let dragging = false;
const zFromX = x => Math.max(-LANE, Math.min(LANE, ((x / innerWidth) * 2 - 1) * LANE * 1.25));
canvas.addEventListener('pointerdown', e => {
  if (!app.voyage || app.modal) return;
  dragging = true; canvas.setPointerCapture(e.pointerId);
  app.voyage.pointerZ = zFromX(e.clientX);
  document.getElementById('hint')?.classList.add('hide');
});
canvas.addEventListener('pointermove', e => { if (dragging && app.voyage) app.voyage.pointerZ = zFromX(e.clientX); });
const endDrag = () => { dragging = false; if (app.voyage) app.voyage.pointerZ = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
ui.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-steer]');
  if (!b || !app.voyage) return;
  app.voyage.input = +b.dataset.steer;
  const stop = () => { if (app.voyage) app.voyage.input = 0; removeEventListener('pointerup', stop); removeEventListener('pointercancel', stop); };
  addEventListener('pointerup', stop); addEventListener('pointercancel', stop);
});
addEventListener('resize', () => { if (app.screen === 'hud') updateHud(); });

// ---------- loop ----------
let last = performance.now();
let clockAcc = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const v = app.voyage;
  if (v) {
    v.update(dt);
    if (!v.paused && app.syncCooldown > 0) app.syncCooldown = Math.max(0, app.syncCooldown - dt);
    clockAcc += dt;
    if (clockAcc > 0.2) { clockAcc = 0; updateClock(); }
  }
  world.update(dt, v ? v.ship : app.menuShip);
  world.render();
  requestAnimationFrame(frame);
}

// ---------- boot ----------
(async function boot() {
  const fonts = document.fonts?.ready?.catch(() => {}) ?? Promise.resolve();
  await Promise.all([loadSprints(), Promise.race([fonts, new Promise(r => setTimeout(r, 1500))])]);
  app.selectedSprint = defaultSprint()?.id;
  setScreen('menu');
  requestAnimationFrame(t => { last = t; frame(t); });
  const l = document.getElementById('loading');
  l.classList.add('hide');
  setTimeout(() => l.remove(), 800);
  // Debug hook for automated checks.
  window.__sv = { app, world };
})();

void STAGE_X; void shipMarker; void progressBar;
