import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, categoryById } from '../lib/categories';
import { quoteClaim, type ClaimQuote, type ListingDraft } from '../lib/claim';
import { t, type Key } from '../i18n';
import { rich, usd } from '../lib/format';
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

const SCAN_STEPS: Key[] = ['boost.checkout.scan.resolve', 'boost.checkout.scan.read', 'boost.checkout.scan.artwork', 'boost.checkout.scan.category', 'boost.checkout.scan.audio'];

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
      const res = await backend.resolve(req.input).catch(() => null);
      if (cancelled) return;
      if (!res || !res.ok) {
        setFailure(res?.error ?? t('boost.checkout.readFail'));
        setPhase('failed');
        return;
      }
      setTarget(res);
      const known = snapshot.state.listings.find((l) => l.key === res.key);
      if (known) {
        setPhase('review');
        return;
      }
      setPhase('scanning');
      const timer = window.setInterval(() => setScanStep((s) => Math.min(SCAN_STEPS.length - 1, s + 1)), 260);
      const m = await backend.scrape(res).catch(() => null);
      clearInterval(timer);
      if (cancelled) return;
      if (!m) {
        setFailure(t('boost.checkout.scanFail'));
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
      setPayError(t('boost.checkout.needTitle'));
      return;
    }
    setPayError(null);
    setPhase('paying');
    const res = await backend
      .checkout({ input: target.kind === 'handle' ? target.key : target.url, board, amount, draft: d })
      .catch((e: Error) => ({ kind: 'error' as const, error: e.message || t('boost.checkout.payFail'), suggested: undefined }));
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
    <Modal onClose={onClose} label={t('boost.checkout.label')}>
      {(phase === 'resolving' || phase === 'scanning') && (
        <div className="stack">
          <h2>{t('boost.checkout.scanning')}</h2>
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
                  {t(s)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {phase === 'failed' && (
        <div className="stack">
          <h2>{t('boost.checkout.failedTitle')}</h2>
          <div className="notice notice--error" role="alert">
            {failure}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            {rich(t('boost.checkout.tip'), {
              a: <code className="mono">yourlabel.com</code>,
              b: <code className="mono">artist.bandcamp.com</code>,
              c: <code className="mono">open.spotify.com/artist/…</code>,
              handle: <code className="mono">@handle</code>,
            })}
          </p>
          <button className="cta cta--ghost" onClick={onClose}>
            {t('boost.checkout.editLink')}
          </button>
        </div>
      )}

      {(phase === 'review' || phase === 'paying') && target && shown && (
        <div className="stack">
          <div>
            <div className="row" style={{ marginBottom: 6, flexWrap: 'wrap' }}>
              {existing ? <span className="badge">{t('boost.checkout.badgeTopup')}</span> : <span className="badge badge--green">{t('boost.checkout.badgeNew')}</span>}
              {meta && <span className="badge badge--muted">{meta.source === 'scraped' ? t('boost.checkout.scraped') : t('boost.checkout.autoDetected')}</span>}
            </div>
            <h2>{existing ? t('boost.checkout.raiseTitle') : t('boost.checkout.claimTitle')}</h2>
            <p className="modal__sub" style={{ marginBottom: 0 }}>
              {existing
                ? t('boost.checkout.raiseSub')
                : t('boost.checkout.claimSub')}
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
                {draft?.preview || existing?.preview ? ` · ▶ ${t('boost.checkout.audioPreview')}` : ''}
              </div>
            </div>
          </div>

          {!existing && draft && (
            <div className="stack">
              <label className="field">
                {t('boost.checkout.title')}
                <input className="input" value={draft.title} maxLength={80} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <label className="field">
                {t('boost.checkout.tagline')}
                <input className="input" value={draft.tagline} maxLength={80} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
              </label>
              <label className="field">
                {t('boost.checkout.description')}
                <textarea className="input" rows={2} value={draft.description} maxLength={400} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>
              <label className="field">
                {t('boost.hero.category')}
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
            <div className="segmented" style={{ margin: 0 }} role="tablist" aria-label={t('boost.board.choose')}>
              <button type="button" className={board === 'all' ? 'is-active' : ''} onClick={() => setBoard('all')} role="tab" aria-selected={board === 'all'}>
                🏆 {t('boost.board.all')}
              </button>
              <button type="button" className={board === 'today' ? 'is-active' : ''} onClick={() => setBoard('today')} role="tab" aria-selected={board === 'today'}>
                <span className="dot" /> {t('boost.board.today')}
              </button>
            </div>
            <div className="amount" style={{ fontSize: 24, fontWeight: 800 }}>
              <button type="button" className="stepper" style={{ width: 34, height: 34 }} aria-label={t('boost.checkout.decrease')} onClick={() => setAmount((a) => stepAmount(entries, a, -1, floor, existing?.id))}>
                <MinusIcon />
              </button>
              <span className="mono accent" aria-live="polite">
                {usd(amount)}
              </span>
              <button type="button" className="stepper" style={{ width: 34, height: 34 }} aria-label={t('boost.checkout.increase')} disabled={amount >= MAX_BID} onClick={() => setAmount((a) => stepAmount(entries, a, 1, floor, existing?.id))}>
                <PlusIcon />
              </button>
            </div>
          </div>

          {quote && !quote.ok && (
            <div className="notice notice--error" role="alert">
              {quote.error}{' '}
              {quote.suggested && (
                <button type="button" className="link-btn link-btn--accent" onClick={() => setAmount(clampBid(quote.suggested!))}>
                  {t('boost.checkout.use', { amount: usd(quote.suggested) })}
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
                      <small>{b === 'all' ? `🏆 ${t('boost.board.all')}` : `● ${t('boost.board.today')}`}</small>
                      <strong>#{r.after}</strong>
                      <span>
                        {' '}
                        {r.before ? t('boost.checkout.fromRank', { rank: r.before }) : t('boost.checkout.newRank')} · {usd(r.totalAfter)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="summary">
                {quote.currentTotal > 0 && (
                  <div className="summary__row">
                    <span>{board === 'all' ? t('boost.checkout.currentAll') : t('boost.checkout.currentToday')}</span>
                    <span className="num">{usd(quote.currentTotal)}</span>
                  </div>
                )}
                <div className="summary__row">
                  <span>{board === 'all' ? t('boost.checkout.newTotalAll') : t('boost.checkout.newTotalToday')}</span>
                  <span className="num">{usd(quote.targetTotal)}</span>
                </div>
                <div className="summary__row total">
                  <span>{quote.currentTotal > 0 ? t('boost.checkout.payDifference') : t('boost.checkout.youPay')}</span>
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
              <b>{t('boost.checkout.demoTitle')}</b> {backend.mode === 'local' ? t('boost.checkout.demoLocal') : t('boost.checkout.demoServer')}
            </div>
          )}

          <button type="button" className="cta cta--solid" disabled={!quote?.ok || phase === 'paying'} onClick={pay} data-autofocus>
            {phase === 'paying' ? (
              <>
                <span className="spinner" /> {t('boost.checkout.processing')}
              </>
            ) : quote?.ok ? (
              backend.stripe ? t('boost.checkout.continueStripe', { amount: usd(quote.charge) }) : t('boost.checkout.pay', { amount: usd(quote.charge) })
            ) : (
              t('boost.checkout.adjust')
            )}
          </button>
          <p className="hero__fine" style={{ textAlign: 'center' }}>
            {rich(t('boost.checkout.fine'), {
              rules: (
                <a className="link-btn" href="#/rules" onClick={onClose}>
                  {t('boost.checkout.rules')}
                </a>
              ),
            })}
          </p>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="success">
          <div className="success__burst">🎉</div>
          <h2 style={{ margin: '0 0 6px' }}>{t('boost.checkout.doneTitle', { rank: result.ranks.all.after })}</h2>
          <p className="modal__sub">
            {t('boost.checkout.doneSub', { today: result.ranks.today.after, paid: usd(result.charge), total: usd(result.ranks.all.totalAfter) })}
          </p>
          <button className="cta cta--solid" onClick={onClose} data-autofocus>
            {t('boost.checkout.seeBoard')}
          </button>
        </div>
      )}
    </Modal>
  );
}
