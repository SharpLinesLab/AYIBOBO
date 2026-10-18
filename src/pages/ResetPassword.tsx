import { useState } from 'react';
import { t, type Key } from '../i18n';
import { resetPassword } from '../lib/account';
import { useApp } from '../store';
import { PageHead } from './Browse';

/** #/reset/<token>: the page a password-reset link opens. */
export function ResetPasswordPage({ token }: { token: string }) {
  const { toast } = useApp();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<'invalid_token' | 'weak_password' | 'long_password' | 'rate_limited' | 'unknown' | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await resetPassword(token, password);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast(t('account.reset.done'));
    // Replace this history entry so the used token isn't one Back press away.
    window.location.replace('#/account');
  };

  return (
    <div className="page-music account">
      <PageHead kicker={t('account.kicker')} title={t('account.reset.title')} />
      <section className="card-panel account__panel">
        {error === 'invalid_token' ? (
          <>
            <p className="notice notice--error" role="alert">
              {t('account.reset.invalid')}
            </p>
            <div className="account__actions">
              <a className="btn-accent" href="#/account">
                {t('account.reset.newLink')}
              </a>
            </div>
          </>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="field">
              {t('account.reset.password')}
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                aria-describedby="reset-password-hint"
                required
              />
              <small className="muted" id="reset-password-hint">
                {t('account.passwordHint')}
              </small>
            </label>
            {error && (
              <div className="notice notice--error" role="alert">
                {t(`account.error.${error}` as Key)}
              </div>
            )}
            <button className="cta cta--solid" type="submit" disabled={busy}>
              {busy ? t('account.busy') : t('account.reset.submit')}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
