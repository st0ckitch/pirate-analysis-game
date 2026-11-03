# Sprint Voyage

A 3D browser game where a wooden boat sails a jungle river, driven by Jira sprint tickets (mock data).
Built with three.js and the Sprint Voyage design system (`design/DESIGN_SYSTEM.md`, tokens in `css/tokens/`).

## Run
No build step. Serve the folder and open it:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## How to play
- Steer with ← → / A D, or drag on the river (touch buttons appear on phones).
- Catch **work crates** to move tickets toward Done. Bigger tickets need more crates.
- **Rocks and logs** flag a ticket as Blocked; **emerald orbs** clear blockers.
- Tap a crate in the cargo panel to open its ticket and **focus the crew** on it.
- **Sync Jira** pulls in teammates' (simulated) updates.
- Finish before day 10: 3 stars for all tickets Done, unlocking the next sprint.

## Mock Jira
`js/jira/mockData.js` holds four sprints of issues; `js/jira/mockJiraClient.js` is an async client with
Jira-like method names (`getSprints`, `getSprintIssues`, `transitionIssue`, `pollUpdates`). Swap it for a real
client with the same methods to go live.

## Tests
```bash
node --test tests/sprintModel.test.mjs
```
