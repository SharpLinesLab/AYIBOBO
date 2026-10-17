import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, categoryById } from '../lib/categories';
import { quoteClaim, type ClaimQuote, type ListingDraft } from '../lib/claim';
import { usd } from '../lib/format';
import type { SiteMetadata } from '../lib/metadata';
import type { NormalizedTarget } from '../lib/normalize';
import { MAX_BID, MIN_BID, clampBid, getBoard, stepAmount, totalOnBoard } from '../lib/ranking';
import type { BoardId, CategoryId, Listing } from '../lib/types';
import { useApp } from '../store';
import { MinusIcon, PlusIcon } from './icons';
import { Modal } from './Modal';
import { Thumb } from './Thumb';

export interface CheckoutRequestState {
  input: string;
  amount: number;
  board: BoardId;
  category?: CategoryId;
}

type Phase = 'resolving' | 'scanning' | 'review' | 'paying' | 'done' | 'failed';

const SCAN_STEPS = ['Resolving & normalizing link', 'Reading title & description', 'Fetching artwork / favicon', 'Detecting category', 'Looking for an audio preview'];

export function CheckoutModal({ req, onClose, onClaimed }: { req: CheckoutRequestState; onClose: () => void; onClaimed: (listingId: string, board: BoardId, fromRank: number | null) => void }) {
  const { backend, snapshot, now } = useApp();
  const [phase, setPhase] = useState<Phase>('resolving');
  const [failure, setFailure] = useState<string | null>(null);
  const [target, setTarget] = useState<NormalizedTarget | null>(null);
  const [meta, setMeta] = useState<SiteMetadata | null>(null);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [board, setBoard] = useState<BoardId>(req.board);
  const [amount, setAmount] = useState(req.amount);
  const [scanStep, setScanStep] = useState(0);
  const [payError, setPayError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimQuote | null>(null);

  const existing: Listing | undefined = useMemo(
    () => (target ? snapshot.state.listings.find((l) => l.key === target.key) : undefined),
    [target, snapshot.state.listings],
  );

  // 1) resolve + normalize, 2) scrape metadata for new listings.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await backend.resolve(req.input).catch(() => null);
      if (cancelled) return;
      if (!t || !t.ok) {
        setFailure(t?.error ?? 'We couldn’t read that link. Check it and try again.');
        setPhase('failed');
        return;
      }
      setTarget(t);
      const known = snapshot.state.listings.find((l) => l.key === t.key);
      if (known) {
        setPhase('review');
        return;
      }
      setPhase('scanning');
      const timer = window.setInterval(() => setScanStep((s) => Math.min(SCAN_STEPS.length - 1, s + 1)), 260);
      const m = await backend.scrape(t).catch(() => null);
      clearInterval(timer);
      if (cancelled) return;
      if (!m) {
        setFailure('We couldn’t scan that site right now. Please try again.');
        setPhase('failed');
        return;
      }
      setScanStep(SCAN_STEPS.length);
      setMeta(m);
      setDraft({
        title: m.title,
        tagline: m.tagline,
        description: m.description,
        category: req.category ?? m.category,
        artwork: m.artwork,
        preview: m.preview,
      });
      window.setTimeout(() => !cancelled && setPhase('review'), 250);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo(() => getBoard(snapshot.state, board, now), [snapshot.state, board, now]);
  const quote = target ? quoteClaim(snapshot.state, target.key, board, amount, now) : null;
  const current = existing ? totalOnBoard(entries, existing.id) : 0;
  const floor = current > 0 ? current + 1 : MIN_BID;

  const pay = async () => {
    if (!target || !quote?.ok) return;
    const d: ListingDraft = existing
      ? { title: existing.title, tagline: existing.tagline, description: existing.description, category: existing.category, artwork: existing.artwork, preview: existing.preview }
      : draft!;
    if (!existing && !d.title.trim()) {
      setPayError('Give your listing a title.');
      return;
    }
    setPayError(null);
    setPhase('paying');
    const res = await backend
      .checkout({ input: target.kind === 'handle' ? target.key : target.url, board, amount, draft: d })
      .catch((e: Error) => ({ kind: 'error' as const, error: e.message || 'Payment failed. Please try again.', suggested: undefined }));
    if (res.kind === 'redirect') {
      window.location.assign(res.url);
      return;
    }
    if (res.kind === 'error') {
      setPayError(res.error);
      if (res.suggested) setAmount(res.suggested);
      setPhase('review');
      return;
    }
    setResult(res.quote);
    setPhase('done');
    onClaimed(res.listingId, board, res.quote.ranks[board].before);
  };

  const shown = existing ?? (draft && target ? { title: draft.title, tagline: draft.tagline, artwork: draft.artwork, display: target.display, category: draft.category } : null);

  return (
    <Modal onClose={onClose} label="Claim rank checkout">
      {(phase === 'resolving' || phase === 'scanning') && (
        <div className="stack">
          <h2>Scanning your link…</h2>
          <p className="modal__sub mono">{target?.display ?? req.input}</p>
          <div className="preview-card" aria-hidden>
            <span className="thumb skeleton" />
            <div className="stack" style={{ gap: 8 }}>
              <span className="skeleton" style={{ height: 14, width: '60%' }} />
              <span className="skeleton" style={{ height: 12, width: '90%' }} />
              <span className="skeleton" style={{ height: 12, width: '75%' }} />
            </div>
          </div>
          <ul className="scan-steps" aria-live="polite">
            {SCAN_STEPS.map((s, i) => {
              const done = phase === 'scanning' && (i < scanStep || scanStep >= SCAN_STEPS.length);
              return (
                <li key={s} className={done ? 'done' : ''}>
                  {done ? <span className="check">✓</span> : i === scanStep || (phase === 'resolving' && i === 0) ? <span className="spinner" style={{ color: 'var(--accent)' }} /> : <span style={{ width: 18 }} />}
                  {s}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {phase === 'failed' && (
        <div className="stack">
          <h2>That link can’t be listed</h2>
          <div className="notice notice--error" role="alert">
            {failure}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            Tip: paste the canonical page (e.g. <code className="mono">yourlabel.com</code>, <code className="mono">artist.bandcamp.com</code>,{' '}
            <code className="mono">open.spotify.com/artist/…</code>) or an <code className="mono">@handle</code>.
          </p>
          <button className="cta cta--ghost" onClick={onClose}>
            Edit link
          </button>
        </div>
      )}

      {(phase === 'review' || phase === 'paying') && target && shown && (
        <div className="stack">
          <div>
            <div className="row" style={{ marginBottom: 6, flexWrap: 'wrap' }}>
              {existing ? <span className="badge">Existing listing · top-up</span> : <span className="badge badge--green">New listing</span>}
              {meta && <span className="badge badge--muted">{meta.source === 'scraped' ? 'scraped' : 'auto-detected'}</span>}
            </div>
            <h2>{existing ? 'Raise your rank' : 'Claim your rank'}</h2>
            <p className="modal__sub" style={{ marginBottom: 0 }}>
              {existing
                ? 'This link is already on the leaderboard. Pick a new total — you only pay the difference.'
                : 'Check how your listing will look, then pay to place it.'}
            </p>
          </div>

          <div className="preview-card">
            <Thumb art={shown.artwork} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800 }}>
                {shown.title || target.display}
                {shown.tagline && <span className="muted" style={{ fontWeight: 500 }}> · {shown.tagline}</span>}
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {categoryById(shown.category).icon} <b style={{ color: 'var(--text)' }}>{categoryById(shown.category).label}</b> · {shown.display}
                {draft?.preview || existing?.preview ? ' · ▶ audio preview' : ''}
              </div>
            </div>
          </div>

          {!existing && draft && (
            <div className="stack">
              <label className="field">
                Title
                <input className="input" value={draft.title} maxLength={80} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <label className="field">
                Tagline
                <input className="input" value={draft.tagline} maxLength={80} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
              </label>
              <label className="field">
                Description
                <textarea className="input" rows={2} value={draft.description} maxLength={400} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>
              <label className="field">
                Category
                <select className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as CategoryId })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div className="segmented" style={{ margin: 0 }} role="tablist" aria-label="Board">
              <button type="button" className={board === 'all' ? 'is-active' : ''} onClick={() => setBoard('all')} role="tab" aria-selected={board === 'all'}>
                🏆 All-time
              </button>
              <button type="button" className={board === 'today' ? 'is-active' : ''} onClick={() => setBoard('today')} role="tab" aria-selected={board === 'today'}>
                <span className="dot" /> Today
              </button>
            </div>
            <div className="amount" style={{ fontSize: 24, fontWeight: 800 }}>
              <button type="button" className="stepper" style={{ width: 34, height: 34 }} aria-label="Decrease" onClick={() => setAmount((a) => stepAmount(entries, a, -1, floor, existing?.id))}>
                <MinusIcon />
              </button>
              <span className="mono accent" aria-live="polite">
                {usd(amount)}
              </span>
              <button type="button" className="stepper" style={{ width: 34, height: 34 }} aria-label="Increase" disabled={amount >= MAX_BID} onClick={() => setAmount((a) => stepAmount(entries, a, 1, floor, existing?.id))}>
                <PlusIcon />
              </button>
            </div>
          </div>

          {quote && !quote.ok && (
            <div className="notice notice--error" role="alert">
              {quote.error}{' '}
              {quote.suggested && (
                <button type="button" className="link-btn link-btn--accent" onClick={() => setAmount(clampBid(quote.suggested!))}>
                  Use {usd(quote.suggested)}
                </button>
              )}
            </div>
          )}

          {quote?.ok && (
            <>
              <div className="rank-preview">
                {(['all', 'today'] as BoardId[]).map((b) => {
                  const r = quote.ranks[b];
                  return (
                    <div className="rank-tile" key={b}>
                      <small>{b === 'all' ? '🏆 All-time' : '● Today'}</small>
                      <strong>#{r.after}</strong>
                      <span>
                        {' '}
                        {r.before ? `from #${r.before}` : 'new'} · {usd(r.totalAfter)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="summary">
                {quote.currentTotal > 0 && (
                  <div className="summary__row">
                    <span>Current spend ({board === 'all' ? 'all-time' : 'today'})</span>
                    <span className="num">{usd(quote.currentTotal)}</span>
                  </div>
                )}
                <div className="summary__row">
                  <span>New {board === 'all' ? 'all-time' : 'today'} total</span>
                  <span className="num">{usd(quote.targetTotal)}</span>
                </div>
                <div className="summary__row total">
                  <span>{quote.currentTotal > 0 ? 'You pay the difference' : 'You pay'}</span>
                  <span className="num">{usd(quote.charge)}</span>
                </div>
              </div>
            </>
          )}

          {payError && (
            <div className="notice notice--error" role="alert">
              {payError}
            </div>
          )}

          {!backend.stripe && (
            <div className="notice">
              <b>Demo checkout.</b> No card is charged — payments are simulated
              {backend.mode === 'local' ? ' and saved in this browser' : ' on this server'}. Connect Stripe on the server for real payments.
            </div>
          )}

          <button type="button" className="cta cta--solid" disabled={!quote?.ok || phase === 'paying'} onClick={pay} data-autofocus>
            {phase === 'paying' ? (
              <>
                <span className="spinner" /> Processing…
              </>
            ) : quote?.ok ? (
              backend.stripe ? `Continue to secure checkout · ${usd(quote.charge)}` : `Pay ${usd(quote.charge)}`
            ) : (
              'Adjust your bid'
            )}
          </button>
          <p className="hero__fine" style={{ textAlign: 'center' }}>
            Whole US dollars. Payments are final; anyone can outbid you. By paying you agree to the <a className="link-btn" href="#/rules" onClick={onClose}>rules</a>.
          </p>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="success">
          <div className="success__burst">🎉</div>
          <h2 style={{ margin: '0 0 6px' }}>You’re #{result.ranks.all.after} all-time</h2>
          <p className="modal__sub">
            and #{result.ranks.today.after} on today’s board · paid {usd(result.charge)} · new total {usd(result.ranks.all.totalAfter)}
          </p>
          <button className="cta cta--solid" onClick={onClose} data-autofocus>
            See it on the board
          </button>
        </div>
      )}
    </Modal>
  );
}
