import { useEffect, useState } from 'react';
import { fmtUsd, t, type Key } from '../i18n';
import { PROMOTION_RULES } from '../lib/promotionRules';
import { activatePromotion, adminPromotions, cancelPromotion, setPromotionRate, type Promotion } from '../lib/promotions';
import { useApp } from '../store';
import { PromotionStatusPill, promotionSummary } from './ArtistPromote';

/**
 * Promotions tab on #/admin: every promotion, the test path to activate one until payments are
 * connected, the per-day rate, and the revenue collected — which has nothing to do with royalties.
 */
export function PromotionsAdmin() {
  const { toast } = useApp();
  const [data, setData] = useState<{ rateCents: number; revenueCents: number; promotions: Promotion[] } | null | undefined>(undefined);
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    void adminPromotions().then((d) => {
      setData(d);
      if (d) setRate((d.rateCents / 100).toFixed(2));
    });
  useEffect(load, []);

  const act = async (p: Promotion, action: 'activate' | 'cancel') => {
    if (action === 'cancel' && !window.confirm(t('admin.promotions.cancelConfirm', { title: p.title }))) return;
    setBusy(p.id);
    const r = await (action === 'activate' ? activatePromotion(p.id) : cancelPromotion(p.id));
    setBusy(null);
    if (!r.ok) return toast(t(`admin.promotions.error.${r.error}` as Key));
    toast(t(action === 'activate' ? 'admin.promotions.activated' : 'admin.promotions.cancelled', { title: p.title }));
    // The revenue total changes too: reload everything.
    load();
  };

  const saveRate = async () => {
    setBusy('rate');
    const r = await setPromotionRate(Math.round(Number(rate) * 100));
    setBusy(null);
    if (!r.ok) return toast(t(`admin.promotions.error.${r.error}` as Key));
    setData((d) => d && { ...d, rateCents: r.value });
    toast(t('admin.promotions.rateSaved', { rate: fmtUsd(r.value) }));
  };

  return (
    <section className="admin__promotions" aria-labelledby="admin-promotions-title">
      <h2 className="panel-title" id="admin-promotions-title">
        {t('admin.promotions.title')}
      </h2>
      <p className="notice royalties__prelaunch">{t('admin.promotions.testPath')}</p>
      {data === undefined && <span className="spinner" role="status" aria-label={t('account.busy')} />}
      {data === null && <p className="notice notice--error">{t('admin.failed')}</p>}
      {data && (
        <>
          <div className="kpis promo__kpis">
            <div className="kpi card-panel">
              <span className="kpi__label">{t('admin.promotions.revenue')}</span>
              <span className="kpi__value">{fmtUsd(data.revenueCents)}</span>
            </div>
            <div className="kpi card-panel">
              <span className="kpi__label">{t('admin.promotions.currentRate')}</span>
              <span className="kpi__value">{fmtUsd(data.rateCents)}</span>
            </div>
          </div>
          <p className="muted account__fine">{t('admin.promotions.separate')}</p>

          <form
            className="promo__rate"
            onSubmit={(e) => {
              e.preventDefault();
              void saveRate();
            }}
          >
            <label className="field">
              {t('admin.promotions.rate')}
              <input className="input" type="number" min={0.01} max={PROMOTION_RULES.maxRateCents / 100} step="0.01" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} required />
            </label>
            <button className="btn-glass" type="submit" disabled={busy === 'rate'}>
              {t('admin.promotions.saveRate')}
            </button>
          </form>
          <p className="muted account__fine">{t('admin.promotions.rateNote')}</p>

          {data.promotions.length === 0 ? (
            <p className="notice">{t('admin.promotions.empty')}</p>
          ) : (
            <ul className="admin__list">
              {data.promotions.map((p) => (
                <li key={p.id} className="card-panel admin__item">
                  <div className="admin__body">
                    <h3>{p.title}</h3>
                    <p className="muted">
                      {p.artistName} · {promotionSummary(p)}
                    </p>
                    <p>
                      <PromotionStatusPill status={p.status} />
                    </p>
                    <div className="admin__actions">
                      {p.status === 'pending_payment' && (
                        <button className="btn-accent" disabled={busy === p.id} onClick={() => void act(p, 'activate')}>
                          {t('admin.promotions.activate')}
                        </button>
                      )}
                      {(p.status === 'pending_payment' || p.status === 'scheduled' || p.status === 'active') && (
                        <button className="btn-glass" disabled={busy === p.id} onClick={() => void act(p, 'cancel')}>
                          {t('admin.promotions.cancel')}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
