import { useEffect, useState } from 'react';
import { fmtDate, fmtUsd, t, type Key } from '../i18n';
import { PROMOTION_RULES, isoDay, promotionDays, promotionPrice, type PromotionStatus } from '../lib/promotionRules';
import { createPromotion, myPromotions, type Promotion, type PromotionError } from '../lib/promotions';
import type { Submission } from '../lib/submissions';
import { useApp } from '../store';

const DAY = 86_400_000;
const day = (ms: number) => fmtDate(ms, { day: true, month: 'short', year: true, utc: true });

/** Status pill colours: the same ones the upload list uses. */
const PILL: Record<PromotionStatus, string> = { active: 'approved', scheduled: 'pending', pending_payment: 'pending', ended: 'ended', cancelled: 'rejected' };

export function PromotionStatusPill({ status }: { status: PromotionStatus }) {
  return <span className={`status-pill status-pill--${PILL[status]}`}>{t(`account.promote.status.${status}` as Key)}</span>;
}

/** Dates (the last day included) and price. */
export function promotionSummary(p: Promotion) {
  return t('account.promote.summary', { from: day(p.startsAt), to: day(p.endsAt - DAY), price: fmtUsd(p.priceCents) });
}

const GROUPS: { key: Key; has: PromotionStatus[] }[] = [
  { key: 'account.promote.group.active', has: ['active'] },
  { key: 'account.promote.group.scheduled', has: ['scheduled'] },
  { key: 'account.promote.group.pending', has: ['pending_payment'] },
  { key: 'account.promote.group.past', has: ['ended', 'cancelled'] },
];

/** Promote tab on #/account: boost a published song in feeds for a few days, and see past promotions. */
export function ArtistPromote({ list }: { list: Submission[] | null }) {
  const { toast } = useApp();
  const published = (list ?? []).filter((s) => s.status === 'approved');
  // undefined while loading; null if it couldn't be loaded.
  const [data, setData] = useState<{ rateCents: number; promotions: Promotion[] } | null | undefined>(undefined);
  const today = isoDay(Date.now());
  const [trackId, setTrackId] = useState('');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(isoDay(Date.now() + 6 * DAY));
  const [error, setError] = useState<PromotionError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void myPromotions().then(setData);
  }, []);
  // Default to the first published song once the list arrives.
  const chosen = published.some((s) => s.id === trackId) ? trackId : (published[0]?.id ?? '');

  const days = promotionDays(start, end);
  const rate = data?.rateCents ?? PROMOTION_RULES.defaultRateCents;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await createPromotion(chosen, start, end);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setData((d) => d && { ...d, promotions: [r.value, ...d.promotions] });
    toast(t('account.promote.created', { title: r.value.title }));
  };

  return (
    <section className="card-panel account__panel" aria-labelledby="artist-promote-title">
      <h2 className="panel-title" id="artist-promote-title">
        {t('account.promote.title')}
      </h2>
      <p className="muted">{t('account.promote.intro')}</p>
      <p className="muted account__fine">{t('account.promote.separate')}</p>
      {data === undefined && <span className="spinner" role="status" aria-label={t('account.busy')} />}
      {data === null && <p className="notice notice--error">{t('account.promote.failed')}</p>}
      {data &&
        (published.length === 0 ? (
          <p className="notice">{t('account.promote.noSongs')}</p>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="field">
              {t('account.promote.song')}
              <select className="input" value={chosen} onChange={(e) => setTrackId(e.target.value)}>
                {published.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin__dates">
              <label className="field">
                {t('account.promote.start')}
                <input className="input" type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} required />
              </label>
              <label className="field">
                {t('account.promote.end')}
                <input className="input" type="date" value={end} min={start || today} onChange={(e) => setEnd(e.target.value)} required />
              </label>
            </div>
            <p className="promo__total" aria-live="polite">
              {days > 0 ? t('account.promote.total', { days, rate: fmtUsd(rate), total: fmtUsd(promotionPrice(rate, days)) }) : t('account.promote.pickDates')}
            </p>
            <p className="muted account__fine">{t('account.promote.payNote', { max: PROMOTION_RULES.maxDays })}</p>
            {error && (
              <div className="notice notice--error" role="alert">
                {t(`account.promote.error.${error}` as Key)}
              </div>
            )}
            <button className="cta cta--solid" type="submit" disabled={busy || days === 0}>
              {busy ? t('account.busy') : t('account.promote.submit')}
            </button>
          </form>
        ))}

      {data && data.promotions.length > 0 && (
        <div className="promo__mine">
          <h3 className="panel-sub">{t('account.promote.mine')}</h3>
          {GROUPS.map((g) => {
            const items = data.promotions.filter((p) => g.has.includes(p.status));
            if (!items.length) return null;
            return (
              <div key={g.key}>
                <h4 className="promo__group">{t(g.key)}</h4>
                <ul className="account__songs">
                  {items.map((p) => (
                    <li key={p.id}>
                      <span>
                        <b>{p.title}</b>
                        <small className="muted">{promotionSummary(p)}</small>
                      </span>
                      <PromotionStatusPill status={p.status} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
