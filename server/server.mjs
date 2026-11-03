// Zero-dependency server: serves the game and proxies Jira so the API token stays server-side.
//   node server/server.mjs      (reads .env; PORT and HOST are optional)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JiraCloud, configFromEnv } from './jira.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDotenv() {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch { /* no .env: mock mode */ }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.webp': 'image/webp' };
const PUBLIC_DIRS = new Set(['css', 'js', 'vendor', 'assets']);

export function createServer(jira, { allowWrites = false } = {}) {
  const send = (res, code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const readBody = req => new Promise((resolve, reject) => {
    let d = ''; req.on('data', c => { d += c; if (d.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(Object.assign(e, { status: 400 })); } });
  });

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    try {
      if (p === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
      if (p.startsWith('/api/')) {
        if (p === '/api/config') {
          if (!jira) return send(res, 200, { live: false });
          try { const b = await jira.getBoard(); return send(res, 200, { live: true, board: b, writable: allowWrites }); }
          catch (e) { return send(res, 200, { live: false, error: e.message }); }
        }
        if (!jira) return send(res, 503, { error: 'Jira is not configured' });
        let m;
        if (req.method === 'GET' && p === '/api/jira/sprints') return send(res, 200, await jira.getSprints());
        if (req.method === 'GET' && (m = p.match(/^\/api\/jira\/sprints\/(\d+)\/issues$/))) return send(res, 200, await jira.getSprintIssues(m[1]));
        // Writes change real tickets, so they are off unless JIRA_ALLOW_WRITES=true.
        if (req.method === 'POST' && p.startsWith('/api/jira/issues/') && !allowWrites) return send(res, 403, { error: 'Writing to Jira is disabled on this server (set JIRA_ALLOW_WRITES=true to enable).' });
        if (req.method === 'POST' && (m = p.match(/^\/api\/jira\/issues\/([A-Z][A-Z0-9_]*-\d+)\/transition$/))) return send(res, 200, await jira.transition(m[1], (await readBody(req)).status));
        if (req.method === 'POST' && (m = p.match(/^\/api\/jira\/issues\/([A-Z][A-Z0-9_]*-\d+)\/flag$/))) return send(res, 200, await jira.setFlagged(m[1], !!(await readBody(req)).flagged));
        return send(res, 404, { error: 'Not found' });
      }
      // Static files (allow-listed so .env, server/ and tests/ are never served).
      let rel = decodeURIComponent(p === '/' ? '/index.html' : p).replace(/^\/+/, '');
      const top = rel.split('/')[0];
      if (rel !== 'index.html' && !PUBLIC_DIRS.has(top)) { res.writeHead(404); return res.end('Not found'); }
      const file = path.resolve(ROOT, rel);
      if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    } catch (e) {
      send(res, e.status && e.status >= 400 && e.status < 600 ? (e.status === 401 || e.status === 403 ? 502 : e.status) : 500, { error: e.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadDotenv();
  const cfg = configFromEnv();
  const port = Number(process.env.PORT) || 8000;
  // Hosting platforms (Railway etc.) set PORT and need a public bind; locally stay on loopback.
  const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  const allowWrites = process.env.JIRA_ALLOW_WRITES === 'true';
  createServer(cfg ? new JiraCloud(cfg) : null, { allowWrites }).listen(port, host, () => {
    console.log(`Sprint Voyage → http://localhost:${port}`);
    console.log(cfg ? `Jira: live (${cfg.baseUrl}), writes ${allowWrites ? 'ENABLED' : 'disabled'}` : 'Jira: not configured, using mock data. Copy .env.example to .env to connect.');
  });
}
