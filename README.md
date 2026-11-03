# Sprint Voyage

A 3D browser game where a wooden boat sails a jungle river, driven by Jira sprint tickets (mock data).
Built with three.js and the Sprint Voyage design system (`design/DESIGN_SYSTEM.md`, tokens in `css/tokens/`).

## Run
```bash
npm start
```

Then visit http://localhost:8000. Without a `.env` file the game uses mock Jira data. With one it loads your real board.

## Connect your Jira
1. Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens
2. `cp .env.example .env` and fill in `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` (optionally `JIRA_BOARD_ID`; otherwise the first Scrum board is used).
3. `npm start`. The menu badge reads "Live Jira" when it connects.

The browser never sees your token: `server/server.mjs` serves the game and proxies Jira.
Real statuses map onto the four waypoints (done category → Done, names containing review/QA/test → In Review, other in-progress → In Progress, the rest → To Do).
Story points come from `JIRA_STORY_POINTS_FIELD` (default `customfield_10016`; unestimated issues count as 1).
The game never edits your tickets unless you turn on **Settings → Write changes to Jira**.

## How to play
The default difficulty is **Hardcore**: a fast current and walls of rocks with a tiny gap. Calm and Rapids are in Settings.

- Steer with ← → / A D, or drag on the river (touch buttons appear on phones).
- Catch **work crates** to move tickets toward Done. Bigger tickets need more crates.
- **Rocks and logs** flag a ticket as Blocked; **emerald orbs** clear blockers.
- Tap a crate in the cargo panel to open its ticket and **focus the crew** on it.
- **Sync Jira** pulls in teammates' (simulated) updates.
- Finish before day 10: 3 stars for all tickets Done, unlocking the next sprint.

## Mock Jira
Without credentials, `js/jira/mockData.js` holds four sprints of issues; `js/jira/mockJiraClient.js` is an async client with
Jira-like method names (`getSprints`, `getSprintIssues`, `transitionIssue`, `pollUpdates`). Swap it for a real
client with the same methods to go live.

## Tests
```bash
npm test
```

## Ship model
Put a `.glb` at `assets/ship.glb` and the game uses it instead of the built-in boat. It is auto-oriented,
scaled and placed on the water; tweak `js/game/shipConfig.js` if it faces backwards or sits too high/low.
Meshopt-compressed GLBs are supported. Keep it small (a few MB) so the game loads fast.

## Deploy on Railway
`railway.json` runs `node server/server.mjs` with a `/healthz` health check. Set the `JIRA_*` variables from
`.env.example` on the service to load your board; without them the game uses mock data.
Writing to Jira is off on the server unless `JIRA_ALLOW_WRITES=true`. Keep it off on a public URL, since anyone who
can open the site could otherwise move your tickets.
