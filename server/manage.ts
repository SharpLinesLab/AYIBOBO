/**
 * Server administration from the command line. Uses the same DATABASE_FILE as the server.
 *
 *   node dist-server/manage.js set-role <email> <listener|artist|admin>
 *   node dist-server/manage.js reset-link <email>
 *   npx tsx server/manage.ts …                                (from a checkout)
 *
 * In Docker:  docker exec <container> node dist-server/manage.js reset-link someone@example.com
 */
import { resolve } from 'node:path';
import { createAuth, ROLES, type Role } from './auth';
import { Db } from './db';
import { resetLink } from './mail';

const HELP = `Usage:
  manage set-role <email> <listener|artist|admin>
      Change an account's role. Accounts can't make themselves admins; this is the only way.

  manage reset-link <email>
      Print a fresh password-reset link for an account (valid for 1 hour, single use; any
      earlier link for the account stops working). Give it to the person yourself.
      There is no email service yet: when one is added, the server sends these links itself
      (plug the provider into server/mail.ts) and this command stays as a fallback.
      Links use PUBLIC_URL (e.g. https://asf.example).

Environment: DATABASE_FILE (default ./data/asf.db), PUBLIC_URL.`;

const [command, email, role] = process.argv.slice(2);
const usage = () => {
  console.error(HELP);
  process.exit(2);
};

if (command === 'help' || command === '--help' || command === '-h') {
  console.log(HELP);
  process.exit(0);
}
if (!email || (command !== 'set-role' && command !== 'reset-link')) usage();
if (command === 'set-role' && !ROLES.includes(role as Role)) usage();

const db = new Db(resolve(process.env.DATABASE_FILE ?? './data/asf.db'));
await db.init();
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
