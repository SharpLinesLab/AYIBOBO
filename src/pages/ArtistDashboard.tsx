import { useEffect, useState } from 'react';
import { Tabs } from '../components/Tabs';
import { fmtNumber, t, type Key } from '../i18n';
import { useAccount } from '../lib/account';
import { myRoyalties, type RoyaltyDashboard } from '../lib/royalties';
import { ROYALTY_RULES, type EligibilityCriteria } from '../lib/royaltyMath';
import { mySubmissions, type Submission } from '../lib/submissions';
import { ArtistProfile } from './ArtistProfile';
import { ArtistRoyalties } from './ArtistRoyalties';
import { ArtistSubmissions, ArtistUploads } from './ArtistUploads';

type Tab = 'overview' | 'upload' | 'music' | 'earnings' | 'profile';
const CRITERIA: (keyof EligibilityCriteria)[] = ['verified', 'streams', 'tracks', 'noStrikes'];

/** Overview tab: the numbers at a glance, the royalty checklist in short, and shortcuts. */
function Overview({ list, go }: { list: Submission[] | null; go: (tab: Tab) => void }) {
  // undefined while loading; null if it couldn't be loaded.
  const [royalties, setRoyalties] = useState<RoyaltyDashboard | null | undefined>(undefined);
  useEffect(() => {
    void myRoyalties().then(setRoyalties);
  }, []);

  const count = (n: number | undefined) => (n === undefined ? '–' : fmtNumber(n));
  const tiles: [Key, string][] = [
    ['account.royalties.thisMonth', count(royalties?.streamsThisMonth)],
    ['account.royalties.last90', count(royalties?.streams90d)],
    ['account.dash.published', count(list?.filter((s) => s.status === 'approved').length)],
    ['account.dash.pending', count(list?.filter((s) => s.status === 'pending').length)],
  ];
  const met = royalties ? CRITERIA.filter((c) => royalties.criteria[c]).length : 0;

  return (
    <section className="card-panel account__panel" aria-labelledby="artist-overview-title">
      <h2 className="panel-title" id="artist-overview-title">
        {t('account.dash.overview')}
      </h2>
      <div className="kpis">
        {tiles.map(([k, v]) => (
          <div className="kpi card-panel" key={k}>
            <span className="kpi__label">{t(k)}</span>
            <span className="kpi__value">{v}</span>
          </div>
        ))}
      </div>
      <h3 className="panel-sub">{t('account.royalties.checklist')}</h3>
      {royalties === undefined && <span className="spinner" role="status" aria-label={t('account.busy')} />}
      {royalties === null && <p className="notice notice--error">{t('account.royalties.failed')}</p>}
      {royalties && (
        <>
          <p className="muted">{t('account.dash.criteriaMet', { n: met, total: CRITERIA.length })}</p>
          <ul className="royalties__checklist">
            {CRITERIA.map((c) => (
              <li key={c} className={royalties.criteria[c] ? 'is-met' : undefined}>
                <span className="royalties__mark" aria-hidden>
                  {royalties.criteria[c] ? '✓' : '○'}
                </span>
                <span>
                  {t(`account.royalties.crit.${c}` as Key, {
                    min: fmtNumber(c === 'streams' ? ROYALTY_RULES.minPremiumStreams : ROYALTY_RULES.minPublishedTracks),
                    n: fmtNumber(c === 'streams' ? royalties.premiumStreams90d : royalties.publishedTracks),
                  })}
                  <span className="sr-only"> — {t(royalties.criteria[c] ? 'account.royalties.met' : 'account.royalties.notMet')}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="account__actions">
        <button className="btn-accent" onClick={() => go('upload')}>
          {t('account.dash.uploadSong')}
        </button>
        <button className="btn-glass" onClick={() => go('profile')}>
          {t('account.dash.editProfile')}
        </button>
      </div>
    </section>
  );
}

/** #/account for artists and admins: their music, earnings and profile, in tabs. */
export function ArtistDashboard() {
  const { user } = useAccount();
  const [tab, setTab] = useState<Tab>('overview');
  // Shared by Overview (counts), Upload (adds to it) and My Music (shows it).
  const [list, setList] = useState<Submission[] | null>(null);
  useEffect(() => {
    void mySubmissions().then(setList);
  }, []);
  const go = (to: Tab) => {
    setTab(to);
    // Bring the chosen tab into view (the bar may be scrolled away on small screens).
    requestAnimationFrame(() => document.getElementById(`artist-tab-${to}`)?.focus());
  };

  return (
    <Tabs
      id="artist"
      label={t('account.dash.label')}
      active={tab}
      onChange={setTab}
      tabs={[
        { id: 'overview', label: t('account.dash.overview'), panel: <Overview list={list} go={go} /> },
        { id: 'upload', label: t('account.dash.upload'), panel: <ArtistUploads onSent={(s) => setList((l) => [s, ...(l ?? [])])} /> },
        { id: 'music', label: t('account.dash.music'), badge: list?.filter((s) => s.status === 'pending').length, panel: <ArtistSubmissions list={list} /> },
        { id: 'earnings', label: t('account.dash.earnings'), panel: <ArtistRoyalties /> },
        { id: 'profile', label: t('account.dash.profile'), panel: <ArtistProfile key={user?.id} /> },
      ]}
    />
  );
}
