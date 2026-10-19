import { useEffect, useState } from 'react';
import { fmtDate, fmtNumber, numberLocale, t, type Key } from '../i18n';
import { royaltySummary, type RoyaltyPeriod, type RoyaltySummary } from '../lib/royalties';
import { artistPayout, artistPool, periodOf, periodRange, type EligibilityCriteria } from '../lib/royaltyMath';

const usd = (n: number) => new Intl.NumberFormat(numberLocale(), { style: 'currency', currency: 'USD' }).format(n);
const pct = (n: number) => new Intl.NumberFormat(numberLocale(), { style: 'percent', maximumFractionDigits: 2 }).format(n);
const monthName = (period: string) => fmtDate(periodRange(period)!.start, { month: 'long', year: true, utc: true });

/** On #/admin, read-only: a month's royalty streams and each artist's share of a hypothetical pool. Pre-launch. */
export function RoyaltiesAdmin() {
  const [period, setPeriod] = useState(() => periodOf(Date.now()));
  const [data, setData] = useState<{ summary: RoyaltySummary; periods: RoyaltyPeriod[] } | null | undefined>(undefined);
  // Hypothetical inputs for the formula; nothing is saved.
  const [revenue, setRevenue] = useState('10000');
  const [fees, setFees] = useState('320');

  useEffect(() => {
    let live = true;
    setData(undefined);
    void royaltySummary(period).then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [period]);

  const pool = artistPool(Number(revenue) || 0, Number(fees) || 0);
  const s = data?.summary;
  const unmet = (c: EligibilityCriteria) =>
    (Object.keys(c) as (keyof EligibilityCriteria)[])
      .filter((k) => !c[k])
      .map((k) => t(`admin.royalties.unmet.${k}` as Key))
      .join(', ');

  return (
    <section className="admin__royalties" aria-labelledby="admin-royalties-title">
      <h2 className="panel-title" id="admin-royalties-title">
        {t('admin.royalties.title')}
      </h2>
      <p className="notice royalties__prelaunch">{t('admin.royalties.banner')}</p>
      <div className="admin__dates">
        <label className="field">
          {t('admin.royalties.month')}
          <input className="input" type="month" value={period} max={periodOf(Date.now())} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
        </label>
        <label className="field">
          {t('admin.royalties.revenue')}
          <input className="input" type="number" min={0} step="0.01" inputMode="decimal" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
        </label>
        <label className="field">
          {t('admin.royalties.fees')}
          <input className="input" type="number" min={0} step="0.01" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} />
        </label>
      </div>
      <p className="admin__plays-today">{t('admin.royalties.pool', { amount: usd(pool) })}</p>

      {data === undefined && <span className="spinner" role="status" aria-label={t('account.busy')} />}
      {data === null && <p className="notice notice--error">{t('admin.failed')}</p>}
      {s && (
        <>
          <div className="kpis">
            {(
              [
                ['admin.royalties.totalStreams', s.totalStreams],
                ['admin.royalties.premiumStreams', s.premiumStreams],
                ['admin.royalties.eligibleArtists', s.eligibleArtists],
                ['admin.royalties.eligibleStreams', s.eligibleStreams],
              ] as const
            ).map(([k, v]) => (
              <div className="kpi card-panel" key={k}>
                <span className="kpi__label">{t(k)}</span>
                <span className="kpi__value">{fmtNumber(v)}</span>
              </div>
            ))}
          </div>
          <p className="muted account__fine">{t('admin.royalties.asOf', { month: monthName(s.period), date: fmtDate(s.asOf - 1, { day: true, month: 'short', year: true, utc: true }) })}</p>
          {s.artists.length === 0 ? (
            <p className="notice">{t('admin.royalties.empty')}</p>
          ) : (
            <div className="royalties__scroll">
              <table className="admin__plays royalties__table">
                <caption>{t('admin.royalties.perArtist')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('admin.royalties.col.artist')}</th>
                    <th scope="col">{t('admin.royalties.col.streams')}</th>
                    <th scope="col">{t('admin.royalties.col.premium')}</th>
                    <th scope="col">{t('admin.royalties.col.premium90')}</th>
                    <th scope="col">{t('admin.royalties.col.eligible')}</th>
                    <th scope="col">{t('admin.royalties.col.share')}</th>
                    <th scope="col">{t('admin.royalties.col.payout')}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.artists.map((a) => {
                    const streams = a.eligible ? a.premiumStreams : 0;
                    return (
                      <tr key={a.artistId}>
                        <th scope="row">{a.artistName}</th>
                        <td>{fmtNumber(a.streams)}</td>
                        <td>{fmtNumber(a.premiumStreams)}</td>
                        <td>{fmtNumber(a.premiumStreams90d)}</td>
                        <td>{a.eligible ? t('admin.royalties.yes') : `${t('admin.royalties.no')} (${unmet(a.criteria)})`}</td>
                        <td>{pct(s.eligibleStreams > 0 ? streams / s.eligibleStreams : 0)}</td>
                        <td>{usd(artistPayout(streams, s.eligibleStreams, pool))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <h3 className="panel-sub">{t('admin.royalties.snapshots')}</h3>
          <p className="muted account__fine">{t('admin.royalties.snapshotsNote')}</p>
          {data!.periods.length === 0 ? (
            <p className="muted">{t('admin.royalties.noSnapshots')}</p>
          ) : (
            <div className="royalties__scroll">
              <table className="admin__plays royalties__table">
                <thead>
                  <tr>
                    <th scope="col">{t('admin.royalties.month')}</th>
                    <th scope="col">{t('admin.royalties.totalStreams')}</th>
                    <th scope="col">{t('admin.royalties.premiumStreams')}</th>
                    <th scope="col">{t('admin.royalties.eligibleArtists')}</th>
                    <th scope="col">{t('admin.royalties.eligibleStreams')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.periods.map((p) => (
                    <tr key={p.period}>
                      <th scope="row">{monthName(p.period)}</th>
                      <td>{fmtNumber(p.totalStreams)}</td>
                      <td>{fmtNumber(p.premiumStreams)}</td>
                      <td>{fmtNumber(p.eligibleArtists)}</td>
                      <td>{fmtNumber(p.eligibleStreams)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
