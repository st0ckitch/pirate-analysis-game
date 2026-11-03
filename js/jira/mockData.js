// Mock Jira data for the "QUEST" board.
// The shape loosely follows Jira Cloud REST responses (sprint + issue fields),
// trimmed to what the game needs. Statuses use the four workflow columns the
// game maps to river waypoints.

export const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done'];
export const STATUS_KEYS = ['todo', 'progress', 'review', 'done'];

export const PEOPLE = [
  { accountId: 'u-mara', displayName: 'Mara Lin' },
  { accountId: 'u-dev', displayName: 'Dev Patel' },
  { accountId: 'u-ana', displayName: 'Ana Ruiz' },
  { accountId: 'u-sam', displayName: 'Sam Cole' },
  { accountId: 'u-kofi', displayName: 'Kofi Mensah' },
];

const P = Object.fromEntries(PEOPLE.map(p => [p.displayName.split(' ')[0].toLowerCase(), p]));

function issue(key, summary, points, status, assignee, priority, description, extra = {}) {
  return {
    key,
    fields: {
      summary,
      description,
      status: { name: status },
      assignee,
      priority: { name: priority },
      storyPoints: points,
      flagged: !!extra.flagged,
      labels: extra.labels || [],
    },
  };
}

export const BOARD = { id: 7, name: 'QUEST board', projectKey: 'QUEST' };

export const SPRINTS = [
  {
    id: 112, number: 12, name: 'Rapids Run', state: 'closed',
    startDate: '2026-09-23', endDate: '2026-10-06',
    goal: 'Stabilise checkout before the autumn campaign.',
    issues: [
      issue('QUEST-118', 'Fix double charge on retry', 5, 'Done', P.dev, 'High', 'Payment retries can create a second charge when the gateway times out.'),
      issue('QUEST-119', 'Add order confirmation email', 3, 'Done', P.ana, 'Medium', 'Send a branded receipt after a successful order.'),
      issue('QUEST-120', 'Cache shipping rates', 3, 'Done', P.sam, 'Medium', 'Rates change daily; cache per region for 24 hours.'),
      issue('QUEST-121', 'Coupon field validation', 2, 'Done', P.mara, 'Low', 'Show inline errors for expired or unknown coupon codes.'),
      issue('QUEST-122', 'Checkout load test', 5, 'Done', P.kofi, 'High', 'Run a 2,000 user load test against the new checkout service.'),
      issue('QUEST-123', 'Address autocomplete', 5, 'Done', P.ana, 'Medium', 'Suggest addresses as the user types in the shipping form.'),
      issue('QUEST-124', 'Remove legacy cart cookie', 2, 'Done', P.dev, 'Low', 'The old cart cookie is no longer read anywhere.'),
      issue('QUEST-125', 'Tax rounding bug', 3, 'Done', P.sam, 'High', 'Line item tax is rounded before summing instead of after.'),
    ],
  },
  {
    id: 113, number: 13, name: 'Mossy Bridge', state: 'closed',
    startDate: '2026-10-07', endDate: '2026-10-20',
    goal: 'Ship the new notifications centre.',
    issues: [
      issue('QUEST-126', 'Notification centre UI', 8, 'Done', P.ana, 'High', 'Bell menu with unread count, grouped by day.'),
      issue('QUEST-127', 'Notification preferences API', 5, 'Done', P.dev, 'Medium', 'Per-channel opt in and opt out for each notification type.'),
      issue('QUEST-128', 'Mark all as read', 2, 'Done', P.mara, 'Low', 'Single action to clear the unread badge.'),
      issue('QUEST-129', 'Push notification service', 8, 'Done', P.kofi, 'High', 'Deliver web push through the new queue worker.'),
      issue('QUEST-130', 'Digest email template', 3, 'Done', P.ana, 'Medium', 'Daily digest of unread notifications.'),
      issue('QUEST-131', 'Notification retention job', 2, 'Done', P.sam, 'Low', 'Delete read notifications older than 90 days.'),
      issue('QUEST-132', 'Analytics events for notifications', 2, 'Done', P.mara, 'Low', 'Track opens and clicks for each notification.'),
    ],
  },
  {
    id: 114, number: 14, name: 'Jungle Gym', state: 'active',
    startDate: '2026-10-21', endDate: '2026-11-04',
    goal: 'Single sign-on and a safer public API.',
    issues: [
      issue('QUEST-138', 'Fix login redirect loop', 3, 'Done', P.mara, 'High', 'Users bounce between /login and /home after the session cookie expires.'),
      issue('QUEST-139', 'Migrate user table', 5, 'Done', P.dev, 'Medium', 'Move legacy accounts to the new schema with zero downtime.'),
      issue('QUEST-140', 'Design empty states', 2, 'Done', P.ana, 'Low', 'Illustrations and copy for lists with no items.'),
      issue('QUEST-141', 'Rate limit public API', 5, 'In Review', P.sam, 'High', 'Apply per-token limits and return 429 with a Retry-After header.'),
      issue('QUEST-142', 'Add SSO login', 8, 'In Progress', P.mara, 'High', 'Users should be able to sign in with their company account.'),
      issue('QUEST-143', 'Upgrade build pipeline', 3, 'In Progress', P.dev, 'Medium', 'Waiting on a runner image from the platform team.', { flagged: true }),
      issue('QUEST-144', 'Write onboarding docs', 2, 'To Do', P.ana, 'Low', 'First-week guide for new engineers.'),
      issue('QUEST-145', 'Audit accessibility', 3, 'To Do', P.sam, 'Medium', 'Check contrast, focus order and labels on the main flows.'),
      issue('QUEST-146', 'Tune search relevance', 3, 'To Do', P.dev, 'Medium', 'Adjust ranking weights for title and tag matches.'),
    ],
  },
  {
    id: 115, number: 15, name: 'Hidden Falls', state: 'future',
    startDate: '2026-11-05', endDate: '2026-11-18',
    goal: 'Mobile offline mode.',
    issues: [
      issue('QUEST-147', 'Offline storage layer', 8, 'To Do', P.kofi, 'High', 'Persist drafts and lists locally with IndexedDB.'),
      issue('QUEST-148', 'Sync conflict resolution', 13, 'To Do', P.dev, 'High', 'Merge edits made offline with changes from the server.'),
      issue('QUEST-149', 'Offline banner', 2, 'To Do', P.ana, 'Low', 'Tell the user when they are working offline.'),
      issue('QUEST-150', 'Background sync worker', 5, 'To Do', P.sam, 'Medium', 'Retry queued writes when the connection returns.'),
      issue('QUEST-151', 'Offline QA checklist', 1, 'To Do', P.mara, 'Low', 'Manual test plan for flaky network conditions.'),
      issue('QUEST-152', 'Reduce bundle size', 3, 'To Do', P.kofi, 'Medium', 'Split vendor code so the offline shell loads fast.'),
    ],
  },
];
