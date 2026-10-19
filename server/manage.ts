/**
 * Server administration from the command line. Uses the same DATABASE_FILE as the server.
 *
 *   node dist-server/manage.js set-role <email> <listener|artist|admin>
 *   node dist-server/manage.js reset-link <email>
 *   node dist-server/manage.js strike <email> <reason…> | lift-strikes <email>
 *   node dist-server/manage.js snapshot-royalties [YYYY-MM]
 *   npx tsx server/manage.ts …                                (from a checkout)
 *
 * In Docker:  docker exec <container> node dist-server/manage.js reset-link someone@example.com
 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createAuth, ROLES, type Role } from './auth';
import { Db } from './db';
import { resetLink } from './mail';
import { royaltiesRepo } from './royalties';

const HELP = `Usage:
  manage set-role <email> <listener|artist|admin>
      Change an account's role. Accounts can't make themselves admins; this is the only way.

  manage reset-link <email>
      Print a fresh password-reset link for an account (valid for 1 hour, single use; any
      earlier link for the account stops working). Give it to the person yourself.
      There is no email service yet: when one is added, the server sends these links itself
      (plug the provider into server/mail.ts) and this command stays as a fallback.
      Links use PUBLIC_URL (e.g. https://asf.example).

  manage strike <email> <reason…>
      Record an active policy strike on an account. While it has one, the artist can't qualify
      for royalties.

  manage lift-strikes <email>
      Lift every active policy strike on an account.

  manage snapshot-royalties [YYYY-MM]
      Write a closed month's royalty totals into royalty_periods (default: every closed month
      that has none yet). The server does this by itself every hour; running it again for the
      same month changes nothing. Pre-launch: no money moves.

Environment: DATABASE_FILE (default ./data/asf.db), PUBLIC_URL.`;

const [command, email, role, ...rest] = process.argv.slice(2);
const usage = () => {
  console.error(HELP);
  process.exit(2);
};

if (command === 'help' || command === '--help' || command === '-h') {
  console.log(HELP);
  process.exit(0);
}
const COMMANDS = ['set-role', 'reset-link', 'strike', 'lift-strikes', 'snapshot-royalties'];
if (!COMMANDS.includes(command) || (!email && command !== 'snapshot-royalties')) usage();
if (command === 'set-role' && !ROLES.includes(role as Role)) usage();
if (command === 'strike' && !role) usage();

const db = new Db(resolve(process.env.DATABASE_FILE ?? './data/asf.db'));
await db.init();

if (command === 'snapshot-royalties') {
  const repo = royaltiesRepo(db);
  if (email) {
    const out = repo.snapshot(email);
    db.close();
    const said = { created: `Snapshot written for ${email}.`, exists: `${email} already has a snapshot; nothing changed.`, open: `${email} hasn't ended yet.`, invalid: `Give the month as YYYY-MM.` };
    console.log(said[out]);
    process.exit(out === 'created' || out === 'exists' ? 0 : 1);
  }
  const written = repo.snapshotClosedMonths();
  db.close();
  console.log(written.length ? `Snapshots written for ${written.join(', ')}.` : 'Every closed month already has a snapshot.');
  process.exit(0);
}

if (command === 'strike' || command === 'lift-strikes') {
  const user = db.sql.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase()) as { id: string } | undefined;
  if (!user) {
    db.close();
    console.error(`No account with the email ${email}.`);
    process.exit(1);
  }
  const now = Date.now();
  if (command === 'strike') {
    db.sql.prepare('INSERT INTO policy_strikes (id, user_id, reason, issued_at) VALUES (?, ?, ?, ?)').run(randomUUID(), user.id, [role, ...rest].join(' '), now);
    console.log(`Strike recorded for ${email}.`);
  } else {
    const n = db.sql.prepare('UPDATE policy_strikes SET lifted_at = ? WHERE user_id = ? AND lifted_at IS NULL').run(now, user.id).changes;
    console.log(`${n} strike(s) lifted for ${email}.`);
  }
  db.close();
  process.exit(0);
}
// The secret only signs sessions, which these commands don't touch.
const auth = createAuth(db, { sessionSecret: 'unused', bcryptRounds: 4 });

if (command === 'set-role') {
  const user = auth.setRole(email, role as Role);
  db.close();
  if (!user) {
    console.error(`No account with the email ${email}. Sign up on the site first, then run this again.`);
    process.exit(1);
  }
  console.log(`${user.email} is now ${user.role}.`);
} else {
  const reset = auth.createResetToken(email);
  db.close();
  if (!reset) {
    console.error(`No account with the email ${email}.`);
    process.exit(1);
  }
  const base = process.env.PUBLIC_URL || 'http://localhost:8787';
  if (!process.env.PUBLIC_URL) console.error('⚠️  PUBLIC_URL is not set; the link uses http://localhost:8787.');
  console.log(resetLink(base, reset.token));
}
