import { useState } from 'react';
import { BRAND } from '../brand';
import { useApp } from '../store';
import { AsfLogo } from './icons';
import { Modal } from './Modal';

export function SubscribeModal({ onClose }: { onClose: () => void }) {
  const { backend, toast } = useApp();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    const res = await backend.subscribeEmail(value).catch(() => ({ ok: false, error: 'Something went wrong. Try again.' }));
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Something went wrong. Try again.');
      return;
    }
    toast(`You're subscribed to ${BRAND.short} — welcome!`);
    onClose();
  };

  return (
    <Modal onClose={onClose} label="Subscribe">
      <div className="stack">
        <AsfLogo />
        <h2>Stay in the mix</h2>
        <p className="modal__sub" style={{ margin: 0 }}>
          New #1s, daily rank shake-ups and fresh {BRAND.name} releases — straight to your inbox. No spam.
        </p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            Email
            <input
              className="input"
              type="email"
              autoComplete="email"
              data-autofocus
              value={email}
              placeholder="you@example.com"
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
            {busy ? <span className="spinner" /> : 'Subscribe'}
          </button>
        </form>
      </div>
    </Modal>
  );
}
