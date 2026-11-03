// Pure sprint logic: no DOM, no three.js. Covered by tests/sprintModel.test.mjs.
import { STATUSES } from '../jira/mockData.js';

export const DONE = 3;

/** Work crates needed to move a ticket one stage, by story points. */
export function effortFor(points) {
  if (points <= 2) return 1;
  if (points <= 5) return 2;
  if (points <= 8) return 3;
  return 4;
}

/** Convert Jira issues into game tickets. `fresh` resets everything to To Do (replays). */
export function ticketsFromIssues(issues, { fresh = false } = {}) {
  return issues.map(i => {
    const stage = fresh ? 0 : Math.max(0, STATUSES.indexOf(i.fields.status.name));
    return {
      key: i.key,
      title: i.fields.summary,
      description: i.fields.description,
      points: i.fields.storyPoints,
      stage,
      blocked: !fresh && stage < DONE && !!i.fields.flagged,
      assignee: i.fields.assignee?.displayName || 'Unassigned',
      priority: i.fields.priority?.name || 'Medium',
      work: 0,
    };
  });
}

export function totals(tickets) {
  const total = tickets.reduce((a, t) => a + t.points, 0);
  const done = tickets.filter(t => t.stage === DONE).reduce((a, t) => a + t.points, 0);
  return { total, done };
}

/** Story-point weighted average stage, 0..3. This is where the ship sails to. */
export function shipPosition(tickets) {
  const { total } = totals(tickets);
  if (!total) return 0;
  return tickets.reduce((a, t) => a + t.points * (t.stage + Math.min(t.work / effortFor(t.points), 0.99) * (t.stage < DONE ? 1 : 0)), 0) / total;
}

/** Total crates still needed to finish the sprint. */
export function remainingEffort(tickets) {
  return tickets.reduce((a, t) => a + Math.max(0, (DONE - t.stage) * effortFor(t.points) - t.work), 0);
}

export function isComplete(tickets) {
  return tickets.every(t => t.stage === DONE);
}

/** The ticket that receives the next work crate: the focused one if possible, else the least-advanced open ticket. */
export function pickWorkTarget(tickets, focusKey) {
  const f = tickets.find(t => t.key === focusKey);
  if (f && f.stage < DONE && !f.blocked) return f;
  const open = tickets.filter(t => t.stage < DONE && !t.blocked);
  if (!open.length) return null;
  // Finish what's closest to the next stage first, then lower stages, then bigger tickets.
  return open.slice().sort((a, b) =>
    (b.work / effortFor(b.points)) - (a.work / effortFor(a.points)) ||
    a.stage - b.stage || b.points - a.points)[0];
}

/**
 * Apply one work crate. Returns an event describing what happened, or null if
 * there's nothing to work on. Mutates the ticket in place.
 */
export function applyWork(tickets, focusKey) {
  const t = pickWorkTarget(tickets, focusKey);
  if (!t) return null;
  t.work += 1;
  if (t.work >= effortFor(t.points)) {
    t.work = 0;
    t.stage += 1;
    return { type: 'advance', ticket: t, to: STATUSES[t.stage] };
  }
  return { type: 'work', ticket: t };
}

/** A hazard hit flags a random active ticket as blocked. `rand` is injectable for tests. */
export function blockRandom(tickets, rand = Math.random) {
  const pool = tickets.filter(t => t.stage > 0 && t.stage < DONE && !t.blocked);
  const fallback = tickets.filter(t => t.stage < DONE && !t.blocked);
  const from = pool.length ? pool : fallback;
  if (!from.length) return null;
  const t = from[Math.floor(rand() * from.length)];
  t.blocked = true;
  t.work = Math.max(0, t.work - 1);
  return { type: 'blocked', ticket: t };
}

/** An emerald orb clears the focused blocker, or the oldest one. */
export function clearBlocker(tickets, focusKey) {
  const blocked = tickets.filter(t => t.blocked);
  if (!blocked.length) return null;
  const t = blocked.find(x => x.key === focusKey) || blocked[0];
  t.blocked = false;
  return { type: 'unblocked', ticket: t };
}

/** Apply a remote update coming from Jira (a teammate's change). */
export function applyRemote(tickets, update) {
  const t = tickets.find(x => x.key === update.key);
  if (!t) return null;
  if (update.type === 'unblock') {
    if (!t.blocked) return null;
    t.blocked = false;
    return { type: 'unblocked', ticket: t, remote: update.by };
  }
  if (update.type === 'transition') {
    const to = STATUSES.indexOf(update.to);
    if (to <= t.stage) return null;
    t.stage = to; t.work = 0; t.blocked = false;
    return { type: 'advance', ticket: t, to: update.to, remote: update.by };
  }
  return null;
}

/** Stars: 3 = everything Done, 2 = 80%+ of points, 1 = 50%+. */
export function starsFor(tickets) {
  const { total, done } = totals(tickets);
  if (isComplete(tickets)) return 3;
  const r = total ? done / total : 0;
  return r >= 0.8 ? 2 : r >= 0.5 ? 1 : 0;
}
