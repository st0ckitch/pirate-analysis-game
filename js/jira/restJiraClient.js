// Live Jira client. Talks to our own server (/api/jira/*), which holds the credentials
// and proxies Jira Cloud. Same method names as MockJiraClient.
import { STATUSES } from './mockData.js';

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Returns a live client if the server has Jira configured, otherwise null. */
export async function detectLiveJira() {
  try {
    const cfg = await api('/api/config');
    return cfg.live ? { client: new RestJiraClient(cfg.board), board: cfg.board, writable: !!cfg.writable } : { client: null, error: cfg.error };
  } catch { return { client: null }; } // static hosting without the server: mock mode
}

export class RestJiraClient {
  live = true;
  constructor(board) { this.board = board; this.cache = new Map(); this.currentSprintId = null; }

  async getBoard() { return { id: this.board.id, name: this.board.name, projectKey: '' }; }

  async getSprints() {
    const sprints = await api('/api/jira/sprints');
    // Keep the list playable: the last 2 closed sprints, the active one, and the next future one.
    const closed = sprints.filter(s => s.state === 'closed').slice(-2);
    const active = sprints.filter(s => s.state === 'active');
    const future = sprints.filter(s => s.state === 'future').slice(0, 1);
    const shown = [...closed, ...active, ...future];
    return Promise.all(shown.map(async s => {
      const issues = await this.getSprintIssues(s.id, { quiet: true });
      return {
        ...s,
        totalPoints: issues.reduce((a, i) => a + i.fields.storyPoints, 0),
        donePoints: issues.filter(i => i.fields.status.name === 'Done').reduce((a, i) => a + i.fields.storyPoints, 0),
        issueCount: issues.length,
      };
    }));
  }

  async getSprintIssues(sprintId, { quiet = false } = {}) {
    const issues = await api(`/api/jira/sprints/${sprintId}/issues`);
    if (!quiet) this.currentSprintId = sprintId;
    return issues;
  }

  transitionIssue(key, statusName) {
    return api(`/api/jira/issues/${encodeURIComponent(key)}/transition`, { method: 'POST', body: { status: statusName } });
  }

  setFlagged(key, flagged) {
    return api(`/api/jira/issues/${encodeURIComponent(key)}/flag`, { method: 'POST', body: { flagged } });
  }

  /** Re-reads the sprint and reports teammates' changes the game doesn't know about yet. */
  async pollUpdates(tickets) {
    if (!this.currentSprintId) return [];
    const issues = await this.getSprintIssues(this.currentSprintId, { quiet: true });
    const updates = [];
    for (const i of issues) {
      const t = tickets.find(x => x.key === i.key);
      if (!t) continue;
      const stage = STATUSES.indexOf(i.fields.status.name);
      const by = i.fields.assignee?.displayName;
      if (stage > t.stage) updates.push({ type: 'transition', key: t.key, to: STATUSES[stage], by });
      else if (t.blocked && !i.fields.flagged && stage >= t.stage) updates.push({ type: 'unblock', key: t.key, by });
    }
    return updates;
  }
}
