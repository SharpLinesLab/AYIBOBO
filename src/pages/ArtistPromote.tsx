import { useEffect, useState } from 'react';
import { fmtDate, fmtUsd, plural, t, type Key } from '../i18n';
import { isoDay, packageEndDate, perDayCents, utcDay, PACKAGES, type PackageId, type PricedPackage, type PromotionStatus } from '../lib/promotionRules';
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

/** One package to pick: days, price, and the price per day so the discount shows. */
function PackageChoice({ pkg, checked, onPick }: { pkg: PricedPackage; checked: boolean; onPick: () => void }) {
  const best = PACKAGES.find((p) => p.id === pkg.id)?.bestValue;
  return (
    <label className={`promo__pkg${checked ? ' is-checked' : ''}`}>
      <input type="radio" name="promotion-package" value={pkg.id} checked={checked} onChange={onPick} />
      <span className="promo__pkg-days">{plural('account.promote.days', pkg.days)}</span>
      <span className="promo__pkg-price">{fmtUsd(pkg.priceCents)}</span>
      <span className="promo__pkg-per">{t('account.promote.perDay', { price: fmtUsd(perDayCents(pkg)) })}</span>
      {best && <span className="promo-badge promo__best">{t('account.promote.bestValue')}</span>}
    </label>
  );
}

/** Promote tab on #/account: boost a published song in feeds with a package, and see past promotions. */
export function ArtistPromote({ list }: { list: Submission[] | null }) {
  const { toast } = useApp();
  const published = (list ?? []).filter((s) => s.status === 'approved');
  // undefined while loading; null if it couldn't be loaded.
  const [data, setData] = useState<{ packages: PricedPackage[]; promotions: Promotion[] } | null | undefined>(undefined);
  // Dates are UTC days, as the server counts them.
  const today = isoDay(Date.now());
  const [trackId, setTrackId] = useState('');
  const [packageId, setPackageId] = useState<PackageId>('day1');
  const [start, setStart] = useState(today);
  const [error, setError] = useState<PromotionError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void myPromotions().then(setData);
  }, []);
  // Default to the first published song once the list arrives.
  const chosen = published.some((s) => s.id === trackId) ? trackId : (published[0]?.id ?? '');

  const pkg = data?.packages.find((p) => p.id === packageId);
  const last = pkg ? packageEndDate(start, pkg.days) : null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await createPromotion(chosen, packageId, start);
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
            <fieldset className="promo__pkgs">
              <legend>{t('account.promote.package')}</legend>
              {data.packages.map((p) => (
                <PackageChoice key={p.id} pkg={p} checked={p.id === packageId} onPick={() => setPackageId(p.id)} />
              ))}
            </fieldset>
            <label className="field promo__start">
              {t('account.promote.start')}
              <input className="input" type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <div className="promo__total" aria-live="polite">
              {pkg && last ? (
                <>
                  <p>{t('account.promote.runs', { from: day(utcDay(start)!), to: day(utcDay(last)!) })}</p>
                  <p className="promo__sum">{t('account.promote.total', { total: fmtUsd(pkg.priceCents) })}</p>
                </>
              ) : (
                <p>{t('account.promote.pickStart')}</p>
              )}
            </div>
            <p className="muted account__fine">{t('account.promote.payNote')}</p>
            {error && (
              <div className="notice notice--error" role="alert">
                {t(`account.promote.error.${error}` as Key)}
              </div>
            )}
            <button className="cta cta--solid" type="submit" disabled={busy || !last}>
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
