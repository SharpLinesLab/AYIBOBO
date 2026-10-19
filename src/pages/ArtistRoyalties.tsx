import { useEffect, useState } from 'react';
import { fmtNumber, t, type Key } from '../i18n';
import { myRoyalties, type RoyaltyDashboard } from '../lib/royalties';
import { ROYALTY_RULES, type EligibilityCriteria } from '../lib/royaltyMath';

const CRITERIA: (keyof EligibilityCriteria)[] = ['verified', 'streams', 'tracks', 'noStrikes'];

/** On #/account for artists: streams so far and the royalty eligibility checklist. Pre-launch: no dollar figures. */
export function ArtistRoyalties() {
  // undefined while loading; null if it couldn't be loaded.
  const [data, setData] = useState<RoyaltyDashboard | null | undefined>(undefined);

  useEffect(() => {
    void myRoyalties().then(setData);
  }, []);

  const label = (c: keyof EligibilityCriteria, d: RoyaltyDashboard) =>
    t(`account.royalties.crit.${c}` as Key, {
      min: fmtNumber(c === 'streams' ? ROYALTY_RULES.minPremiumStreams : ROYALTY_RULES.minPublishedTracks),
      n: fmtNumber(c === 'streams' ? d.premiumStreams90d : d.publishedTracks),
    });

  let body;
  if (data === undefined) body = <span className="spinner" role="status" aria-label={t('account.busy')} />;
  else if (data === null) body = <p className="notice notice--error">{t('account.royalties.failed')}</p>;
  else
    body = (
      <>
        <div className="kpis royalties__kpis">
          <div className="kpi card-panel">
            <span className="kpi__label">{t('account.royalties.thisMonth')}</span>
            <span className="kpi__value">{fmtNumber(data.streamsThisMonth)}</span>
          </div>
          <div className="kpi card-panel">
            <span className="kpi__label">{t('account.royalties.last90')}</span>
            <span className="kpi__value">{fmtNumber(data.streams90d)}</span>
          </div>
        </div>
        <p className="muted account__fine">{t('account.royalties.streamNote', { seconds: ROYALTY_RULES.minSeconds })}</p>
        <h3 className="panel-sub">{t('account.royalties.checklist')}</h3>
        <ul className="royalties__checklist">
          {CRITERIA.map((c) => (
            <li key={c} className={data.criteria[c] ? 'is-met' : undefined}>
              <span className="royalties__mark" aria-hidden>
                {data.criteria[c] ? '✓' : '○'}
              </span>
              <span>
                {label(c, data)}
                <span className="sr-only"> — {t(data.criteria[c] ? 'account.royalties.met' : 'account.royalties.notMet')}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className={data.eligible ? 'notice' : 'muted'}>{t(data.eligible ? 'account.royalties.eligible' : 'account.royalties.notYet')}</p>
      </>
    );

  return (
    <section className="card-panel account__panel" aria-labelledby="account-royalties">
      <h2 className="panel-title" id="account-royalties">
        {t('account.royalties.title')}
      </h2>
      <p className="notice royalties__prelaunch">{t('account.royalties.preLaunch')}</p>
      {body}
    </section>
  );
}
