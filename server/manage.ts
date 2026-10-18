/**
 * Server administration from the command line (accounts can't make themselves admins):
 *
 *   node dist-server/manage.js set-role <email> <listener|artist|admin>
 *   npx tsx server/manage.ts set-role <email> admin          (from a checkout)
 *
 * Uses the same DATABASE_FILE as the server. In Docker:
 *   docker exec <container> node dist-server/manage.js set-role you@example.com admin
 */
import { resolve } from 'node:path';
import { createAuth, ROLES, type Role } from './auth';
import { Db } from './db';

const [command, email, role] = process.argv.slice(2);

if (command !== 'set-role' || !email || !ROLES.includes(role as Role)) {
  console.error('Usage: manage set-role <email> <listener|artist|admin>');
  process.exit(2);
}

const db = new Db(resolve(process.env.DATABASE_FILE ?? './data/asf.db'));
await db.init();
// The secret only signs sessions, which this command doesn't touch.
const user = createAuth(db, { sessionSecret: 'unused', bcryptRounds: 4 }).setRole(email, role as Role);
db.close();
if (!user) {
  console.error(`No account with the email ${email}. Sign up on the site first, then run this again.`);
  process.exit(1);
}
console.log(`${user.email} is now ${user.role}.`);
