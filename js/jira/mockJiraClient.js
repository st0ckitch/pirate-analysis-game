// A fake Jira client. It mimics an async REST client (latency included) over
// the in-memory mock data, so the rest of the game can swap in a real client
// with the same method names later.

import { BOARD, SPRINTS, STATUSES } from './mockData.js';

const clone = v => JSON.parse(JSON.stringify(v));
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const latency = () => 180 + Math.random() * 320;

export class MockJiraClient {
  constructor() {
    this.sprints = clone(SPRINTS);
  }

  async getBoard() {
    await wait(latency());
    return clone(BOARD);
  }

  /** GET /rest/agile/1.0/board/{id}/sprint */
  async getSprints() {
    await wait(latency());
    return this.sprints.map(({ issues, ...s }) => ({
      ...clone(s),
      totalPoints: issues.reduce((a, i) => a + i.fields.storyPoints, 0),
      donePoints: issues.filter(i => i.fields.status.name === 'Done').reduce((a, i) => a + i.fields.storyPoints, 0),
      issueCount: issues.length,
    }));
  }

  /** GET /rest/agile/1.0/sprint/{id}/issue */
  async getSprintIssues(sprintId) {
    await wait(latency());
    const s = this.sprints.find(x => x.id === sprintId);
    if (!s) throw new Error(`Sprint ${sprintId} not found`);
    return clone(s.issues);
  }

  /** POST /rest/api/3/issue/{key}/transitions */
  async transitionIssue(key, statusName) {
    await wait(latency() / 2);
    if (!STATUSES.includes(statusName)) throw new Error(`Unknown status ${statusName}`);
    for (const s of this.sprints) {
      const i = s.issues.find(x => x.key === key);
      if (i) { i.fields.status.name = statusName; i.fields.flagged = false; return clone(i); }
    }
    throw new Error(`Issue ${key} not found`);
  }

  /** PUT /rest/api/3/issue/{key} (flag / unflag as impediment) */
  async setFlagged(key, flagged) {
    await wait(latency() / 2);
    for (const s of this.sprints) {
      const i = s.issues.find(x => x.key === key);
      if (i) { i.fields.flagged = flagged; return clone(i); }
    }
    throw new Error(`Issue ${key} not found`);
  }

  /**
   * Simulates polling the board for changes made by teammates.
   * Given the game's current ticket list, sometimes returns a remote update:
   * a teammate moves a ticket forward, or clears a blocker.
   */
  async pollUpdates(tickets) {
    await wait(latency() + 300);
    const open = tickets.filter(t => t.stage < 3);
    if (!open.length || Math.random() < 0.35) return [];
    const blocked = open.filter(t => t.blocked);
    if (blocked.length && Math.random() < 0.5) {
      const t = blocked[Math.floor(Math.random() * blocked.length)];
      return [{ type: 'unblock', key: t.key, by: t.assignee }];
    }
    const movable = open.filter(t => !t.blocked);
    if (!movable.length) return [];
    const t = movable[Math.floor(Math.random() * movable.length)];
    return [{ type: 'transition', key: t.key, to: STATUSES[t.stage + 1], by: t.assignee }];
  }
}

export const jira = new MockJiraClient();
