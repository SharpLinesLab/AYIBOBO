import { useState, type ReactNode } from 'react';
import { t, type Key } from '../i18n';
import { requestPasswordReset, signIn, signOut, signUp, useAccount, type AccountError } from '../lib/account';
import { useApp } from '../store';
import { ArtistProfile } from './ArtistProfile';
import { ArtistUploads } from './ArtistUploads';
import { PageHead } from './Browse';

/** "Forgot password?": ask for a reset link. The answer never says whether the account exists. */
function ForgotForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<AccountError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await requestPasswordReset(email.trim());
    setBusy(false);
    if (r.ok) setSentTo(email.trim());
    else setError(r.error);
  };

  return (
    <section className="card-panel account__panel" aria-labelledby="account-forgot-title">
      <h2 className="panel-title" id="account-forgot-title">
        {t('account.forgot.title')}
      </h2>
      {sentTo ? (
        <p className="notice" role="status">
          {t('account.forgot.sent', { email: sentTo })}
        </p>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="muted">{t('account.forgot.intro')}</p>
          <label className="field">
            {t('account.email')}
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          {error && (
            <div className="notice notice--error" role="alert">
              {t(`account.error.${error}` as Key)}
            </div>
          )}
          <button className="cta cta--solid" type="submit" disabled={busy}>
            {busy ? t('account.busy') : t('account.forgot.submit')}
          </button>
        </form>
      )}
      <button className="link-btn account__switch" onClick={onBack}>
        {t('account.forgot.back')}
      </button>
    </section>
  );
}

function SignInForm() {
  const { toast } = useApp();
  const [mode, setMode] = useState<'signIn' | 'signUp' | 'forgot'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'listener' | 'artist'>('listener');
  const [error, setError] = useState<AccountError | null>(null);
  const [busy, setBusy] = useState(false);
  const signingUp = mode === 'signUp';

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = signingUp ? await signUp({ email, password, displayName: name, role }) : await signIn(email, password);
    setBusy(false);
    if (r.ok) toast(t('account.welcome', { name: r.user.displayName }));
    else setError(r.error);
  };

  if (mode === 'forgot') return <ForgotForm initialEmail={email} onBack={() => setMode('signIn')} />;

  return (
    <section className="card-panel account__panel" aria-labelledby="account-form-title">
      <h2 className="panel-title" id="account-form-title">
        {t(signingUp ? 'account.signUpTitle' : 'account.signInTitle')}
      </h2>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {signingUp && (
          <label className="field">
            {t('account.displayName')}
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" maxLength={60} required />
          </label>
        )}
        <label className="field">
          {t('account.email')}
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="field">
          {t('account.password')}
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            minLength={signingUp ? 8 : undefined}
            aria-describedby={signingUp ? 'account-password-hint' : undefined}
            required
          />
          {signingUp && (
            <small className="muted" id="account-password-hint">
              {t('account.passwordHint')}
            </small>
          )}
        </label>
        {!signingUp && (
          <button
            type="button"
            className="link-btn account__forgot"
            onClick={() => {
              setMode('forgot');
              setError(null);
            }}
          >
            {t('account.forgot.link')}
          </button>
        )}
        {signingUp && (
          <fieldset className="account__type">
            <legend>{t('account.type')}</legend>
            {(['listener', 'artist'] as const).map((r) => (
              <label key={r} className="account__choice">
                <input type="radio" name="account-type" value={r} checked={role === r} onChange={() => setRole(r)} /> {t(`account.type.${r}`)}
              </label>
            ))}
            <small className="muted">{t('account.type.artistHint')}</small>
          </fieldset>
        )}
        {error && (
          <div className="notice notice--error" role="alert">
            {t(`account.error.${error}` as Key)}
          </div>
        )}
        <button className="cta cta--solid" type="submit" disabled={busy}>
          {busy ? t('account.busy') : t(signingUp ? 'account.signUp' : 'account.signIn')}
        </button>
      </form>
      <button
        className="link-btn account__switch"
        onClick={() => {
          setMode(signingUp ? 'signIn' : 'signUp');
          setError(null);
        }}
      >
        {t(signingUp ? 'account.switchToSignIn' : 'account.switchToSignUp')}
      </button>
    </section>
  );
}

/** #/account: sign in or create an account; once signed in, the account (and, for artists, their songs). */
export function AccountPage() {
  const { toast } = useApp();
  const { status, user } = useAccount();
  let body: ReactNode;
  if (status === 'loading') body = <span className="spinner" role="status" aria-label={t('account.busy')} />;
  else if (status === 'unavailable') body = <p className="notice">{t('account.unavailable')}</p>;
  else if (!user) body = <SignInForm />;
  else
    body = (
      <>
        <section className="card-panel account__panel" aria-labelledby="account-me">
          <h2 className="panel-title" id="account-me">
            {user.displayName}
          </h2>
          <p className="muted">{t('account.signedInAs', { email: user.email })}</p>
          <p className="muted">{t('account.role', { role: t(`account.role.${user.role}`) })}</p>
          <p className="muted">{t('account.sync.note')}</p>
          <p className="muted account__fine">{t('account.sync.signOutNote')}</p>
          <div className="account__actions">
            {user.role === 'admin' && (
              <a className="btn-accent" href="#/admin">
                {t('admin.link')}
              </a>
            )}
            <button
              className="btn-glass"
              onClick={async () => {
                await signOut();
                toast(t('account.signedOut'));
              }}
            >
              {t('account.signOut')}
            </button>
          </div>
        </section>
        {(user.role === 'artist' || user.role === 'admin') && (
          <>
            <ArtistProfile key={user.id} />
            <ArtistUploads />
          </>
        )}
      </>
    );
  return (
    <div className="page-music account">
      <PageHead kicker={t('account.kicker')} title={t('account.title')} />
      {body}
    </div>
  );
}
