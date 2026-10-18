import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'asf-boot-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Start server/index.ts with `env` and return how it exited (it must refuse before listening). */
function boot(env: Record<string, string>) {
  return spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--import', 'tsx', 'server/index.ts'], {
    env: { PATH: process.env.PATH ?? '', DATABASE_FILE: join(dir, 'x.db'), UPLOADS_DIR: join(dir, 'uploads'), PORT: '0', ...env },
    encoding: 'utf8',
    timeout: 90_000,
  });
}

describe('production fail-fast', () => {
  it('refuses to start without a strong SESSION_SECRET', () => {
    for (const secret of [undefined, 'too-short']) {
      const r = boot({ NODE_ENV: 'production', ...(secret ? { SESSION_SECRET: secret } : {}) });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('SESSION_SECRET');
    }
  }, 200_000);

  it('refuses to start without PUBLIC_URL (password-reset links must not trust the Host header)', () => {
    const r = boot({ NODE_ENV: 'production', SESSION_SECRET: 'a-strong-enough-secret-0123456789abcdef' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('PUBLIC_URL');
  }, 200_000);
});

describe('manage command', () => {
  it('makes an existing account an admin', async () => {
    const { Db } = await import('../server/db');
    const { createAuth } = await import('../server/auth');
    const file = join(dir, 'roles.db');
    const db = new Db(file);
    await db.init();
    await createAuth(db, { sessionSecret: 'x', bcryptRounds: 4 }).signup({ email: 'owner@example.com', password: 'long enough pw', displayName: 'Owner' });
    db.close();
    const run = (...args: string[]) =>
      spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--import', 'tsx', 'server/manage.ts', ...args], { env: { PATH: process.env.PATH ?? '', DATABASE_FILE: file }, encoding: 'utf8', timeout: 90_000 });
    expect(run('set-role', 'Owner@example.com', 'admin').stdout).toContain('owner@example.com is now admin');
    expect(run('set-role', 'ghost@example.com', 'admin').status).toBe(1);
    expect(run('set-role', 'owner@example.com', 'superuser').status).toBe(2);
    // reset-link prints a working single-use link for the account.
    const link = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--import', 'tsx', 'server/manage.ts', 'reset-link', 'owner@example.com'], {
      env: { PATH: process.env.PATH ?? '', DATABASE_FILE: file, PUBLIC_URL: 'https://asf.example' },
      encoding: 'utf8',
      timeout: 90_000,
    });
    expect(link.stdout.trim()).toMatch(/^https:\/\/asf\.example\/#\/reset\/[\w-]{43}$/);
    expect(run('reset-link', 'ghost@example.com').status).toBe(1);
    expect(run('help').stdout).toContain('email service');
    const again = new Db(file);
    await again.init();
    expect(again.sql.prepare("SELECT role FROM users WHERE email = 'owner@example.com'").get()).toMatchObject({ role: 'admin' });
    again.close();
  }, 300_000);
});
