import { t } from '../i18n';
import { num, usd } from '../lib/format';
import { totalRevenue } from '../lib/stats';
import { useApp } from '../store';
import { BarChart } from './BarChart';
import { Modal } from './Modal';
import { Thumb } from './Thumb';

export function StatsModal({ onClose }: { onClose: () => void }) {
  const { snapshot, openDetail } = useApp();
  const { stats, state } = snapshot;
  const topClicked = [...state.listings].sort((a, b) => b.clicks - a.clicks).slice(0, 5);
  const last = stats.history.length - 1;

  return (
    <Modal onClose={onClose} label={t('boost.stats.label')} wide>
      <h2>{t('boost.stats.title')}</h2>
      <p className="modal__sub">{t('boost.stats.sub')}</p>
      <div className="stat-grid">
        <div className="stat">
          <small>
            <span className="live-dot" /> {t('boost.stats.online')}
          </small>
          <span className="num">{num(stats.online)}</span>
        </div>
        <div className="stat">
          <small>{t('boost.stats.visitorsToday')}</small>
          <span className="num">{num(stats.visitorsToday)}</span>
        </div>
        <div className="stat">
          <small>{t('boost.stats.clicksToday')}</small>
          <span className="num">{num(stats.clicksToday)}</span>
        </div>
        <div className="stat">
          <small>{t('boost.stats.revenue')}</small>
          <span className="num">{usd(totalRevenue(state))}</span>
        </div>
      </div>
      <div className="stack" style={{ marginTop: 14 }}>
        <BarChart
          title={t('boost.stats.visitorsChart')}
          subtitle={t('boost.stats.visitorsSub')}
          unit={t('boost.stats.unitVisitors')}
          data={stats.history.map((d, i) => ({ label: d.day, value: d.visitors, partial: i === last }))}
        />
        <BarChart
          title={t('boost.stats.clicksChart')}
          subtitle={t('boost.stats.clicksSub')}
          unit={t('boost.stats.unitClicks')}
          data={stats.history.map((d, i) => ({ label: d.day, value: d.clicks, partial: i === last }))}
        />
      </div>
      <h3 className="section-title">{t('boost.stats.mostClicked')}</h3>
      <ul className="mini-list">
        {topClicked.map((l, i) => (
          <li key={l.id}>
            <button
              className="mini-row"
              onClick={() => {
                onClose();
                openDetail(l.id);
              }}
            >
              <span className="mini-row__rank">#{i + 1}</span>
              <Thumb art={l.artwork} size="sm" />
              <span className="mini-row__title">
                {l.title}
                <span className="mini-row__sub">{l.display}</span>
              </span>
              <span className="num" style={{ fontWeight: 700, fontSize: 13 }}>
                {num(l.clicks)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
