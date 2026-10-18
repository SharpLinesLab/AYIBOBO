import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { CATEGORIES } from '../lib/categories';
import { fmtNumber, t } from '../i18n';
import { rich, usd } from '../lib/format';
import { normalizeInput } from '../lib/normalize';
import { MAX_BID, MIN_BID, clampBid, minBidForRank, projectRank, stepAmount, totalOnBoard } from '../lib/ranking';
import type { CategoryId } from '../lib/types';
import { useApp } from '../store';
import { MinusIcon, PlusIcon, WaveGlobeIcon } from './icons';
import { Thumb } from './Thumb';

export function HeroClaim() {
  const { boards, board, now, snapshot, heroPrefill, openCheckout } = useApp();
  const entries = boards[board];
  const [input, setInput] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [draftAmount, setDraftAmount] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryId | 'auto'>('auto');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bump, setBump] = useState(0);
  const touched = useRef(false);
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Identify the listing the URL belongs to (for "raise your rank" top-ups).
  const target = useMemo(() => (input.trim() ? normalizeInput(input) : null), [input]);
  const existing = useMemo(
    () => (target?.ok ? snapshot.state.listings.find((l) => l.key === target.key) : undefined),
    [target, snapshot.state.listings],
  );
  const currentTotal = existing ? totalOnBoard(entries, existing.id) : 0;
  const floor = currentTotal > 0 ? currentTotal + 1 : MIN_BID;
  const topPrice = minBidForRank(entries, 1);

  // Default to "#1 + $5" until the visitor picks their own amount; reset when switching boards.
  useEffect(() => {
    touched.current = false;
  }, [board]);
  useEffect(() => {
    if (!touched.current) setAmount(Math.max(floor, existing && entries[0]?.listing.id === existing.id ? floor : topPrice));
  }, [topPrice, floor, existing, entries]);

  // Quick-bid / raise from a card.
  useEffect(() => {
    if (!heroPrefill.nonce) return;
    if (heroPrefill.input !== undefined) setInput(heroPrefill.input);
    if (heroPrefill.amount !== undefined) {
      touched.current = true;
      setAmount(heroPrefill.amount);
      setDraftAmount(null);
    }
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 450);
  }, [heroPrefill]);

  const value = Math.max(floor, clampBid(amount ?? topPrice, MIN_BID));
  const projection = projectRank(entries, value, existing?.id, now);
  const charge = Math.max(0, value - currentTotal);

  const prevRank = useRef(projection.rank);
  useEffect(() => {
    if (prevRank.current !== projection.rank) setBump((b) => b + 1);
    prevRank.current = projection.rank;
  }, [projection.rank]);

  const setValue = (n: number) => {
    touched.current = true;
    setAmount(clampBid(n, MIN_BID));
  };
  const step = (dir: 1 | -1) => {
    touched.current = true;
    setAmount((a) => stepAmount(entries, Math.max(floor, a ?? topPrice), dir, floor, existing?.id));
  };

  // Press-and-hold acceleration on the steppers.
  const hold = useRef<{ t: number; n: number } | null>(null);
  const startHold = (dir: 1 | -1) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    step(dir);
    const tick = (delay: number, n: number) => {
      hold.current = {
        n,
        t: window.setTimeout(() => {
          const times = n > 30 ? 25 : n > 12 ? 5 : 1;
          for (let i = 0; i < times; i++) step(dir);
          tick(Math.max(35, delay * 0.85), n + 1);
        }, delay),
      };
    };
    tick(380, 0);
  };
  const stopHold = () => {
    if (hold.current) clearTimeout(hold.current.t);
    hold.current = null;
  };
  useEffect(() => stopHold, []);

  const commitDraft = () => {
    if (draftAmount === null) return;
    const n = parseInt(draftAmount.replace(/[^\d]/g, ''), 10);
    setDraftAmount(null);
    if (!Number.isNaN(n)) {
      const p = projectRank(entries, clampBid(n), existing?.id, now);
      // Typed into the #1 dead band: round up to the real #1 price.
      setValue(p.belowTopPremium ? p.minForTop : Math.max(n, floor));
    }
  };

  const onAmountKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      commitDraft();
      step(e.key === 'ArrowUp' ? 1 : -1);
    } else if (e.key === 'Enter') {
      commitDraft();
      (e.target as HTMLInputElement).blur();
    }
  };

  const submit = () => {
    if (!input.trim()) {
      setError(t('boost.hero.pasteFirst'));
      inputRef.current?.focus();
      return;
    }
    if (target && !target.ok && target.code !== 'shortener') {
      setError(target.error);
      return;
    }
    if (projection.belowTopPremium) {
      setValue(projection.minForTop);
      return;
    }
    setError(null);
    openCheckout({ input: input.trim(), amount: value, board, category: category === 'auto' ? undefined : category });
  };

  const display = draftAmount ?? fmtNumber(value);
  const urlStatus = !target
    ? null
    : !target.ok
      ? target.code === 'shortener'
        ? { text: t('boost.hero.status.short'), bad: false }
        : { text: target.code === 'invalid' ? t('boost.hero.status.invalid') : t('boost.hero.status.blocked'), bad: true }
      : existing
        ? { text: currentTotal > 0 ? t('boost.hero.status.listedAmount', { amount: usd(currentTotal) }) : t('boost.hero.status.listed'), bad: false }
        : { text: t('boost.hero.status.new'), bad: false };

  let hint: ReactNode;
  if (projection.belowTopPremium) {
    hint = rich(t('boost.hero.hint.top'), { amount: <b className="num">{usd(projection.minForTop)}</b>, premium: usd(5) });
  } else if (existing && currentTotal > 0) {
    hint = rich(t('boost.hero.hint.raise'), {
      title: <b>{existing.title}</b>,
      current: <span className="num">{usd(currentTotal)}</span>,
      target: <span className="num">{usd(value)}</span>,
      charge: <b className="num accent">{usd(charge)}</b>,
    });
  } else if (board === 'today') {
    hint = t('boost.hero.hint.today');
  } else {
    hint = rich(t('boost.hero.hint.default'), { min: <span className="num">{usd(MIN_BID)}</span>, max: <span className="num">{usd(MAX_BID)}</span> });
  }

  return (
    <section className="hero" ref={rootRef} aria-labelledby="hero-title">
      <p className="hero__tagline">{t('boost.hero.tagline')}</p>
      <h1 className="hero__headline" id="hero-title">
        <span>
          {rich(t('boost.hero.headline'), {
            rank: (
              <span key={bump} className={`hero__rank${bump ? ' bump' : ''}`}>
                #{projection.rank}
              </span>
            ),
          })}
        </span>
        <span className="amount">
          <button
            type="button"
            className="stepper"
            aria-label={t('boost.hero.decrease', { step: usd(1) })}
            disabled={value <= floor}
            onPointerDown={startHold(-1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), step(-1))}
          >
            <MinusIcon />
          </button>
          <span>
            <span className="accent mono" aria-hidden style={{ fontWeight: 800 }}>
              $
            </span>
            <input
              className="amount__input"
              aria-label={t('boost.hero.amountLabel')}
              inputMode="numeric"
              value={display}
              style={{ width: `${Math.max(3, display.length) + 0.15}ch` }}
              onFocus={(e) => {
                setDraftAmount(String(value));
                requestAnimationFrame(() => e.target.select());
              }}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 6);
                setDraftAmount(digits);
                const n = parseInt(digits, 10);
                if (!Number.isNaN(n)) {
                  touched.current = true;
                  setAmount(clampBid(n));
                }
              }}
              onBlur={commitDraft}
              onKeyDown={onAmountKey}
            />
          </span>
          <button
            type="button"
            className="stepper"
            aria-label={t('boost.hero.increase', { step: usd(1) })}
            disabled={value >= MAX_BID}
            onPointerDown={startHold(1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), step(1))}
          >
            <PlusIcon />
          </button>
        </span>
      </h1>
      <p className={`hero__hint${projection.belowTopPremium ? ' warn' : ''}`} aria-live="polite">
        {hint}
      </p>

      <form
        className="hero__form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
        }}
      >
        <label className={`url-pill${error ? ' is-error' : ''}`} key={error ?? 'ok'}>
          <span className="url-pill__icon">{existing ? <Thumb art={existing.artwork} size="sm" /> : <WaveGlobeIcon />}</span>
          <span className="sr-only">{t('boost.hero.urlLabel')}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder={t('boost.hero.placeholder')}
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
          />
          {urlStatus && <span className={`url-pill__badge${urlStatus.bad ? ' is-bad' : ''}`}>{urlStatus.text}</span>}
        </label>
        {error && (
          <p className="hero__hint warn" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}
        <div className={`cat-select${focused || category !== 'auto' ? ' is-open' : ''}`} role="radiogroup" aria-label={t('boost.hero.category')}>
          <button type="button" role="radio" aria-checked={category === 'auto'} className={`cat-chip${category === 'auto' ? ' is-active' : ''}`} onClick={() => setCategory('auto')}>
            ✨ {t('boost.hero.autoDetect')}
          </button>
          {CATEGORIES.map((c) => (
            <button
              type="button"
              role="radio"
              aria-checked={category === c.id}
              key={c.id}
              className={`cat-chip${category === c.id ? ' is-active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              <span aria-hidden>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>
        <button type="submit" className="cta">
          {existing && currentTotal > 0 ? t('boost.hero.raiseCta', { amount: usd(charge) }) : t('boost.hero.claimCta')}
        </button>
      </form>
    </section>
  );
}
