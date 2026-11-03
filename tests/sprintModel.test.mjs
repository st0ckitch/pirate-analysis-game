import test from 'node:test';
import assert from 'node:assert/strict';
import { SPRINTS } from '../js/jira/mockData.js';
import { ticketsFromIssues, shipPosition, totals, applyWork, blockRandom, clearBlocker, applyRemote, isComplete, starsFor } from '../js/game/sprintModel.js';

const sprint14 = () => ticketsFromIssues(SPRINTS.find(s => s.number === 14).issues);

test('sprint 14 starts at 10/34 points with one blocked ticket', () => {
  const t = sprint14();
  assert.deepEqual(totals(t), { total: 34, done: 10 });
  assert.equal(t.filter(x => x.blocked).length, 1);
});

test('ship position is point-weighted and between 0 and 3', () => {
  const p = shipPosition(sprint14());
  assert.ok(p > 1 && p < 2, String(p));
});

test('enough work crates complete the sprint', () => {
  const t = sprint14();
  let guard = 0;
  while (!isComplete(t) && guard++ < 500) { if (!applyWork(t)) clearBlocker(t); }
  assert.ok(isComplete(t));
  assert.equal(starsFor(t), 3);
});

test('hits block tickets and orbs clear them', () => {
  const t = sprint14();
  t.forEach(x => { x.blocked = false; });
  const ev = blockRandom(t, () => 0);
  assert.ok(ev.ticket.blocked);
  assert.equal(clearBlocker(t).ticket.blocked, false);
});

test('remote transitions only move tickets forward', () => {
  const t = sprint14();
  assert.equal(applyRemote(t, { type: 'transition', key: 'QUEST-141', to: 'To Do' }), null);
  assert.equal(applyRemote(t, { type: 'transition', key: 'QUEST-141', to: 'Done' }).to, 'Done');
});

test('fresh replays reset every ticket to To Do', () => {
  const t = ticketsFromIssues(SPRINTS[0].issues, { fresh: true });
  assert.ok(t.every(x => x.stage === 0));
});
