import { useEffect, useState } from 'react';
import { Verified } from '../components/music/bits';
import { fmtDate, t, type Key } from '../i18n';
import { useAccount } from '../lib/account';
import { MAX_STRIKE_REASON, ROLES, adminUsers, issueStrike, liftStrikes, setUserRole, setUserVerified, type AdminUser, type AdminUserError, type Role } from '../lib/adminUsers';
import { CATALOG_CHANGED } from '../lib/serverCatalog';
import { useApp } from '../store';

/** One account: its details and the admin actions on it. */
function UserItem({ user, me, onChange }: { user: AdminUser; me: boolean; onChange: (u: AdminUser) => void }) {
  const { toast } = useApp();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  // The checkmark as just clicked, until the server answers (then the saved value again).
  const [verifying, setVerifying] = useState<boolean | null>(null);
  const name = user.artistName ?? user.displayName;

  const run = async (call: () => Promise<{ ok: true; user: AdminUser } | { ok: false; error: AdminUserError }>, done: Key, catalog = false) => {
    setBusy(true);
    const r = await call();
    setBusy(false);
    if (!r.ok) return toast(t(`admin.users.error.${r.error}` as Key));
    onChange(r.user);
    toast(t(done, { name }));
    // The checkmark shows on artist pages, which read it from the catalog.
    if (catalog) window.dispatchEvent(new Event(CATALOG_CHANGED));
    return true;
  };
  const changeRole = (role: Role) => {
    if (role === user.role) return;
    if (!window.confirm(t('admin.users.roleConfirm', { name, role: t(`account.role.${role}`) }))) return;
    void run(() => setUserRole(user.id, role), 'admin.users.roleChanged');
  };
  const toggleVerified = async (verified: boolean) => {
    setVerifying(verified);
    await run(() => setUserVerified(user.id, verified), verified ? 'admin.users.verifiedOn' : 'admin.users.verifiedOff', true);
    setVerifying(null);
  };
  const strike = async () => {
    if (await run(() => issueStrike(user.id, reason.trim()), 'admin.users.struck')) setReason('');
  };

  const id = `admin-user-${user.id}`;
  return (
    <li className="card-panel admin__item admin__user">
      <div className="admin__body">
        <h3>
          {name}
          {user.verified && <Verified />}
          {me && <span className="muted"> {t('admin.users.you')}</span>}
        </h3>
        <p className="muted">
          {user.email}
          {user.artistName && user.artistName !== user.displayName && ` · ${user.displayName}`}
        </p>
        <p className="muted">
          {t(`account.role.${user.role}`)} · {t(user.tier === 'premium' ? 'admin.users.premium' : 'admin.users.free')} ·{' '}
          {t('admin.users.joined', { date: fmtDate(user.createdAt, { day: true, month: 'short', year: true }) })} · {t(user.verified ? 'admin.users.verified' : 'admin.users.notVerified')}
          {user.activeStrikes > 0 && (
            <>
              {' · '}
              <span className="admin__strikes">{t('admin.users.strikes', { n: user.activeStrikes })}</span>
            </>
          )}
        </p>
        <div className="admin__user-actions">
          <label className="field">
            {t('admin.users.role')}
            <select className="input" value={user.role} disabled={busy || me} onChange={(e) => changeRole(e.target.value as Role)} aria-describedby={me ? `${id}-own` : undefined}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`account.role.${r}`)}
                </option>
              ))}
            </select>
            {me && (
              <small className="muted" id={`${id}-own`}>
                {t('admin.users.ownRole')}
              </small>
            )}
          </label>
          <label className="check">
            <input type="checkbox" checked={verifying ?? user.verified} disabled={busy} onChange={(e) => void toggleVerified(e.target.checked)} />{' '}
            {t('admin.users.verifiedLabel')}
          </label>
        </div>
        <form
          className="admin__strike"
          onSubmit={(e) => {
            e.preventDefault();
            void strike();
          }}
        >
          <label className="field">
            {t('admin.users.strikeReason')}
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={MAX_STRIKE_REASON} required />
          </label>
          <div className="admin__actions">
            <button className="btn-glass" type="submit" disabled={busy || !reason.trim()}>
              {t('admin.users.strike')}
            </button>
            {user.activeStrikes > 0 && (
              <button className="btn-glass" type="button" disabled={busy} onClick={() => void run(() => liftStrikes(user.id), 'admin.users.lifted')}>
                {t('admin.users.lift')}
              </button>
            )}
          </div>
        </form>
      </div>
    </li>
  );
}

/** Users tab on #/admin: every account, newest first, with role, checkmark and strike actions. */
export function UsersAdmin() {
  const { user: me } = useAccount();
  const [data, setData] = useState<{ total: number; users: AdminUser[] } | null | undefined>(undefined);

  useEffect(() => {
    void adminUsers().then(setData);
  }, []);

  const replace = (u: AdminUser) => setData((d) => d && { ...d, users: d.users.map((x) => (x.id === u.id ? u : x)) });

  return (
    <section className="admin__users" aria-labelledby="admin-users-title">
      <h2 className="panel-title" id="admin-users-title">
        {t('admin.users.title')}
      </h2>
      {data === undefined && <span className="spinner" role="status" aria-label={t('account.busy')} />}
      {data === null && <p className="notice notice--error">{t('admin.failed')}</p>}
      {data && (
        <>
          <p className="muted">{data.total > data.users.length ? t('admin.users.newest', { n: data.users.length, total: data.total }) : t('admin.users.count', { n: data.total })}</p>
          <ul className="admin__list">
            {data.users.map((u) => (
              <UserItem key={u.id} user={u} me={u.id === me?.id} onChange={replace} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
