// Server-side Jira Cloud client + normalisation into the shape the game uses
// (same shape as js/jira/mockData.js). Credentials never reach the browser.

const STATUS_NAMES = ['To Do', 'In Progress', 'In Review', 'Done'];

export function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  const inner = (node.content || []).map(adfToText).join(node.type === 'doc' ? '\n' : '');
  return ['paragraph', 'heading', 'listItem'].includes(node.type) ? inner + ' ' : inner;
}

/** Map any Jira workflow status onto the game's four waypoints. */
export function stageFromStatus(status) {
  const cat = status?.statusCategory?.key;
  const name = (status?.name || '').toLowerCase();
  if (cat === 'done') return 3;
  if (/review|qa|test|verify|approval/.test(name)) return 2;
  if (cat === 'indeterminate') return 1;
  return 0;
}

export function normalizeIssue(raw, cfg) {
  const f = raw.fields || {};
  const pts = Number(f[cfg.storyPointsField] ?? f.customfield_10016 ?? f.customfield_10026 ?? f.storyPoints);
  const flaggedField = f[cfg.flagField];
  const labels = f.labels || [];
  return {
    key: raw.key,
    fields: {
      summary: f.summary || raw.key,
      description: adfToText(f.description).replace(/\s+/g, ' ').trim().slice(0, 400),
      status: { name: STATUS_NAMES[stageFromStatus(f.status)], jiraName: f.status?.name },
      assignee: f.assignee ? { accountId: f.assignee.accountId, displayName: f.assignee.displayName } : null,
      priority: { name: f.priority?.name || 'Medium' },
      storyPoints: Number.isFinite(pts) && pts > 0 ? pts : 1,
      flagged: (Array.isArray(flaggedField) && flaggedField.length > 0) || labels.some(l => /^(blocked|impediment)$/i.test(l)),
      labels,
    },
  };
}

export class JiraCloud {
  constructor(cfg, fetchImpl = fetch) {
    this.cfg = cfg;
    this.fetch = fetchImpl;
    this.auth = 'Basic ' + Buffer.from(`${cfg.email}:${cfg.token}`).toString('base64');
    this.boardId = cfg.boardId || null;
  }

  async req(path, { method = 'GET', body } = {}) {
    const res = await this.fetch(this.cfg.baseUrl.replace(/\/$/, '') + path, {
      method,
      headers: { Authorization: this.auth, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Jira ${res.status} ${method} ${path.split('?')[0]}: ${text.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  async paged(path, key, pageSize = 50) {
    const out = [];
    for (let startAt = 0; ; ) {
      const sep = path.includes('?') ? '&' : '?';
      const page = await this.req(`${path}${sep}startAt=${startAt}&maxResults=${pageSize}`);
      const items = page[key] || [];
      out.push(...items);
      startAt += items.length;
      if (page.isLast === true || !items.length || (page.total != null && startAt >= page.total)) break;
    }
    return out;
  }

  async getBoard() {
    if (!this.boardId) {
      const q = this.cfg.projectKey ? `&projectKeyOrId=${encodeURIComponent(this.cfg.projectKey)}` : '';
      const boards = await this.req(`/rest/agile/1.0/board?type=scrum&maxResults=1${q}`);
      if (!boards.values?.length) throw new Error('No Scrum board found. Set JIRA_BOARD_ID in .env.');
      this.boardId = boards.values[0].id;
      this.boardName = boards.values[0].name;
    }
    if (!this.boardName) {
      try { this.boardName = (await this.req(`/rest/agile/1.0/board/${this.boardId}`)).name; } catch { this.boardName = `Board ${this.boardId}`; }
    }
    return { id: this.boardId, name: this.boardName };
  }

  async getSprints() {
    const board = await this.getBoard();
    const list = await this.paged(`/rest/agile/1.0/board/${board.id}/sprint?state=active,closed,future`, 'values');
    return list.map((s, i) => ({
      id: s.id,
      number: Number((s.name.match(/(\d+)\s*$/) || s.name.match(/(\d+)/) || [])[1]) || i + 1,
      name: s.name,
      state: s.state,
      startDate: (s.startDate || s.endDate || '').slice(0, 10) || null,
      endDate: (s.endDate || '').slice(0, 10) || null,
      goal: s.goal || '',
    }));
  }

  async getSprintIssues(sprintId) {
    const c = this.cfg;
    const fields = ['summary', 'description', 'status', 'assignee', 'priority', 'labels', c.storyPointsField, c.flagField, 'customfield_10016', 'customfield_10026'].join(',');
    const raw = await this.paged(`/rest/agile/1.0/sprint/${Number(sprintId)}/issue?fields=${fields}&jql=${encodeURIComponent('issuetype != Epic')}`, 'issues', 100);
    return raw.map(r => normalizeIssue(r, c));
  }

  /** Move an issue to the workflow transition that lands on the requested game stage. */
  async transition(key, statusName) {
    const want = STATUS_NAMES.indexOf(statusName);
    if (want < 0) throw Object.assign(new Error(`Unknown status ${statusName}`), { status: 400 });
    const { transitions } = await this.req(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);
    const pick = transitions.find(t => stageFromStatus(t.to) === want) ;
    if (!pick) throw Object.assign(new Error(`No workflow transition to "${statusName}" from the current status`), { status: 409 });
    await this.req(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, { method: 'POST', body: { transition: { id: pick.id } } });
    return { transitioned: pick.to.name };
  }

  /** Flag/unflag as impediment. Falls back to a "blocked" label if the Flagged field can't be set. */
  async setFlagged(key, flagged) {
    const k = encodeURIComponent(key);
    try {
      await this.req(`/rest/api/3/issue/${k}`, { method: 'PUT', body: { fields: { [this.cfg.flagField]: flagged ? [{ value: 'Impediment' }] : [] } } });
    } catch {
      await this.req(`/rest/api/3/issue/${k}`, { method: 'PUT', body: { update: { labels: [{ [flagged ? 'add' : 'remove']: 'blocked' }] } } });
    }
    return { flagged };
  }
}

export function configFromEnv(env = process.env) {
  const baseUrl = env.JIRA_BASE_URL, email = env.JIRA_EMAIL, token = env.JIRA_API_TOKEN;
  if (!baseUrl || !email || !token) return null;
  return {
    baseUrl, email, token,
    boardId: env.JIRA_BOARD_ID ? Number(env.JIRA_BOARD_ID) : null,
    projectKey: env.JIRA_PROJECT_KEY || '',
    storyPointsField: env.JIRA_STORY_POINTS_FIELD || 'customfield_10016',
    flagField: env.JIRA_FLAG_FIELD || 'customfield_10021',
  };
}
