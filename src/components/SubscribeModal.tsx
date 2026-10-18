import { useState } from 'react';
import { BRAND } from '../brand';
import { t } from '../i18n';
import { subscribeEmail } from '../lib/newsletter';
import { useApp } from '../store';
import { AsfLogo } from './icons';
import { Modal } from './Modal';

export function SubscribeModal({ onClose }: { onClose: () => void }) {
  const { toast } = useApp();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError(t('common.subscribe.invalid'));
      return;
    }
    setBusy(true);
    const res = await subscribeEmail(value).catch(() => ({ ok: false, error: t('common.subscribe.error') }));
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? t('common.subscribe.error'));
      return;
    }
    toast(t('common.subscribe.welcome', { brand: BRAND.short }));
    onClose();
  };

  return (
    <Modal onClose={onClose} label={t('common.top.subscribe')}>
      <div className="stack">
        <AsfLogo />
        <h2>{t('common.subscribe.title')}</h2>
        <p className="modal__sub" style={{ margin: 0 }}>
          {t('common.subscribe.body', { brand: BRAND.name })}
        </p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            {t('common.subscribe.email')}
            <input
              className="input"
              type="email"
              autoComplete="email"
              data-autofocus
              value={email}
              placeholder={t('common.subscribe.placeholder')}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
          </label>
          {error && (
            <div className="notice notice--error" role="alert">
              {error}
            </div>
          )}
          <button className="cta cta--solid" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : t('common.top.subscribe')}
          </button>
        </form>
      </div>
    </Modal>
  );
}
