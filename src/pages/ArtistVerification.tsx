import { useEffect, useState } from 'react';
import { Verified } from '../components/music/bits';
import { fmtDate, t, type Key } from '../i18n';
import { useAccount } from '../lib/account';
import { MAX_VERIFICATION_MESSAGE, myVerification, requestVerification, type VerificationError, type VerificationRequest } from '../lib/verification';
import { useApp } from '../store';

/** In the artist profile on #/account: ask to be verified, and see where the request is. */
export function ArtistVerification() {
  const { toast } = useApp();
  const { user } = useAccount();
  const verified = !!user?.verified;
  // undefined while loading; null when the artist never asked.
  const [request, setRequest] = useState<VerificationRequest | null | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<VerificationError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!verified) void myVerification().then((r) => setRequest(r ?? null));
  }, [verified]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await requestVerification(message.trim());
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setRequest(r.request);
    setMessage('');
    toast(t('account.verify.sent'));
  };

  let body;
  if (verified)
    body = (
      <p className="account__verified">
        <Verified /> {t('account.verify.verified')}
      </p>
    );
  else if (request === undefined) body = <span className="spinner" role="status" aria-label={t('account.busy')} />;
  else if (request?.status === 'pending')
    body = (
      <p className="notice" role="status">
        {t('account.verify.pending', { date: fmtDate(request.requestedAt, { day: true, month: 'long', year: true }) })}
      </p>
    );
  else
    body = (
      <>
        {request?.status === 'rejected' && <p className="notice notice--error">{t('account.verify.rejected')}</p>}
        <p className="muted">{t('account.verify.intro')}</p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            {t('account.verify.message')}
            <textarea className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MAX_VERIFICATION_MESSAGE} placeholder={t('account.verify.placeholder')} />
          </label>
          {error && (
            <div className="notice notice--error" role="alert">
              {t(`account.verify.error.${error}` as Key)}
            </div>
          )}
          <button className="btn-glass" type="submit" disabled={busy}>
            {busy ? t('account.busy') : t(request?.status === 'rejected' ? 'account.verify.again' : 'account.verify.request')}
          </button>
        </form>
      </>
    );

  return (
    <div className="account__verify">
      <h3 className="panel-sub">{t('account.verify.title')}</h3>
      {body}
    </div>
  );
}
