import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { JiraCloud, normalizeIssue, stageFromStatus, adfToText } from '../server/jira.mjs';
import { createServer } from '../server/server.mjs';

// A fake Jira Cloud: enough of the agile + issue REST API to exercise the proxy.
function fakeJira() {
  const calls = [];
  const issues = [
    { key: 'ABC-1', fields: { summary: 'Login', description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fix it' }] }] }, status: { name: 'Selected', statusCategory: { key: 'new' } }, assignee: { accountId: 'a', displayName: 'Mara Lin' }, priority: { name: 'High' }, labels: [], customfield_10016: 5 } },
    { key: 'ABC-2', fields: { summary: 'API', status: { name: 'Code Review', statusCategory: { key: 'indeterminate' } }, assignee: null, priority: { name: 'Low' }, labels: ['blocked'], customfield_10016: null } },
    { key: 'ABC-3', fields: { summary: 'Docs', status: { name: 'Shipped', statusCategory: { key: 'done' } }, priority: { name: 'Medium' }, labels: [], customfield_10016: 3, customfield_10021: [{ value: 'Impediment' }] } },
  ];
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      calls.push(`${req.method} ${req.url}`);
      if (req.headers.authorization !== 'Basic ' + Buffer.from('me@x.com:tok').toString('base64')) { res.writeHead(401); return res.end('no'); }
      const json = (o, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      const u = new URL(req.url, 'http://x');
      if (u.pathname === '/rest/agile/1.0/board') return json({ values: [{ id: 9, name: 'ABC board' }] });
      if (u.pathname === '/rest/agile/1.0/board/9/sprint') {
        const start = +u.searchParams.get('startAt');
        const all = [{ id: 1, name: 'Sprint 1', state: 'closed', startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-14T00:00:00Z' }, { id: 2, name: 'Sprint 2', state: 'active', startDate: '2026-01-15T00:00:00Z', goal: 'Ship' }];
        return json({ values: all.slice(start, start + 1), isLast: start + 1 >= all.length }); // forces paging
      }
      if (u.pathname === '/rest/agile/1.0/sprint/2/issue') return json({ issues, total: 3 });
      if (u.pathname === '/rest/api/3/issue/ABC-1/transitions' && req.method === 'GET') return json({ transitions: [{ id: '11', to: { name: 'Working', statusCategory: { key: 'indeterminate' } } }, { id: '12', to: { name: 'Ready for QA', statusCategory: { key: 'indeterminate' } } }, { id: '13', to: { name: 'Shipped', statusCategory: { key: 'done' } } }] });
      if (u.pathname === '/rest/api/3/issue/ABC-1/transitions' && req.method === 'POST') return json(null, 204);
      if (u.pathname === '/rest/api/3/issue/ABC-2' && req.method === 'PUT') { const b = JSON.parse(body); return b.fields ? json({ errors: {} }, 400) : json(null, 204); }
      json({ error: 'nope' }, 404);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, calls, url: `http://127.0.0.1:${srv.address().port}` })));
}

test('normalisation maps statuses, points, flags and ADF', () => {
  assert.equal(stageFromStatus({ name: 'Code Review', statusCategory: { key: 'indeterminate' } }), 2);
  assert.equal(stageFromStatus({ name: 'Backlog', statusCategory: { key: 'new' } }), 0);
  assert.equal(adfToText({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }] }).trim(), 'Hi');
  const n = normalizeIssue({ key: 'X-1', fields: { summary: 's', status: { name: 'Done', statusCategory: { key: 'done' } }, customfield_10016: 8 } }, { storyPointsField: 'customfield_10016', flagField: 'customfield_10021' });
  assert.equal(n.fields.storyPoints, 8);
  assert.equal(n.fields.status.name, 'Done');
});

test('proxy loads sprints and issues, transitions, and flags via fallback', async () => {
  const fj = await fakeJira();
  const jira = new JiraCloud({ baseUrl: fj.url, email: 'me@x.com', token: 'tok', storyPointsField: 'customfield_10016', flagField: 'customfield_10021' });
  const app = createServer(jira, { allowWrites: true });
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const get = async p => (await fetch(base + p)).json();
  const post = async (p, b) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

  const cfg = await get('/api/config');
  assert.deepEqual(cfg, { live: true, board: { id: 9, name: 'ABC board' }, writable: true });

  const sprints = await get('/api/jira/sprints');
  assert.deepEqual(sprints.map(s => [s.id, s.number, s.state]), [[1, 1, 'closed'], [2, 2, 'active']]);
  assert.equal(sprints[1].goal, 'Ship');

  const issues = await get('/api/jira/sprints/2/issues');
  assert.deepEqual(issues.map(i => [i.key, i.fields.status.name, i.fields.storyPoints, i.fields.flagged]), [['ABC-1', 'To Do', 5, false], ['ABC-2', 'In Review', 1, true], ['ABC-3', 'Done', 3, true]]);
  assert.equal(issues[0].fields.description, 'Fix it');

  const t = await post('/api/jira/issues/ABC-1/transition', { status: 'In Review' });
  assert.equal(t.status, 200);
  assert.ok(fj.calls.includes('POST /rest/api/3/issue/ABC-1/transitions'));
  assert.equal((await post('/api/jira/issues/ABC-1/transition', { status: 'Bogus' })).status, 400);

  assert.equal((await post('/api/jira/issues/ABC-2/flag', { flagged: false })).status, 200); // falls back to labels
  assert.equal((await fetch(base + '/.env')).status, 404);
  assert.equal((await fetch(base + '/server/jira.mjs')).status, 404);
  assert.equal((await fetch(base + '/index.html')).status, 200);

  app.close(); fj.srv.close();
});

test('bad credentials surface as an error, not a crash', async () => {
  const fj = await fakeJira();
  const app = createServer(new JiraCloud({ baseUrl: fj.url, email: 'me@x.com', token: 'wrong', storyPointsField: 'x', flagField: 'y' }));
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const cfg = await (await fetch(`http://127.0.0.1:${app.address().port}/api/config`)).json();
  assert.equal(cfg.live, false);
  assert.match(cfg.error, /401/);
  app.close(); fj.srv.close();
});

test('without config the API reports mock mode', async () => {
  const app = createServer(null);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  assert.deepEqual(await (await fetch(base + '/api/config')).json(), { live: false });
  assert.equal((await fetch(base + '/api/jira/sprints')).status, 503);
  app.close();
});

test('writes are refused unless explicitly allowed', async () => {
  const fj = await fakeJira();
  const app = createServer(new JiraCloud({ baseUrl: fj.url, email: 'me@x.com', token: 'tok', storyPointsField: 'customfield_10016', flagField: 'customfield_10021' }));
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const r = await fetch(base + '/api/jira/issues/ABC-1/transition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"status":"Done"}' });
  assert.equal(r.status, 403);
  assert.ok(!fj.calls.some(c => c.startsWith('POST')));
  assert.equal((await (await fetch(base + '/api/config')).json()).writable, false);
  assert.equal(await (await fetch(base + '/healthz')).text(), 'ok');
  app.close(); fj.srv.close();
});
