import { useEffect, useState } from 'react';
import { GENRES } from '../catalog/genres';
import { t } from '../i18n';
import { useAccount } from '../lib/account';
import { CATALOG_CHANGED } from '../lib/serverCatalog';
import { moderate, pendingReviews, type ReviewItem } from '../lib/submissions';
import { fmtTime } from '../music';
import { useApp } from '../store';
import { NotFound, PageHead } from './Browse';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function Review() {
  const { toast } = useApp();
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void pendingReviews().then((list) => (list ? setItems(list) : setFailed(true)));
  }, []);

  const act = async (item: ReviewItem, action: 'approve' | 'reject') => {
    if (action === 'reject' && !window.confirm(t('admin.rejectConfirm', { title: item.title }))) return;
    setBusy(item.id);
    const ok = await moderate(item.id, action);
    setBusy(null);
    if (!ok) return toast(t('admin.failed'));
    setItems((list) => list?.filter((x) => x.id !== item.id) ?? null);
    toast(t(action === 'approve' ? 'admin.approved' : 'admin.rejected', { title: item.title }));
    if (action === 'approve') window.dispatchEvent(new Event(CATALOG_CHANGED));
  };

  return (
    <div className="page-music admin">
      <PageHead kicker={t('admin.kicker')} title={t('admin.title')} sub={t('admin.sub')} />
      {failed && <p className="notice notice--error">{t('admin.failed')}</p>}
      {!items && !failed && <span className="spinner" role="status" aria-label={t('account.busy')} />}
      {items && items.length === 0 && <p className="notice">{t('admin.empty')}</p>}
      {items && items.length > 0 && (
        <ul className="admin__list">
          {items.map((u) => (
            <li key={u.id} className="card-panel admin__item">
              <img className="admin__cover" src={u.coverUrl} alt={t('admin.coverOf', { title: u.title })} width={112} height={112} loading="lazy" />
              <div className="admin__body">
                <h2>{u.title}</h2>
                <p className="muted">
                  {u.artistName} · {GENRES.find((g) => g.id === u.genre)?.label} · {fmtTime(u.duration)} · {mb(u.audioSize)}
                </p>
                <audio controls preload="none" src={u.audioUrl} aria-label={t('admin.preview', { title: u.title })} />
                <div className="admin__actions">
                  <button className="btn-accent" disabled={busy === u.id} onClick={() => void act(u, 'approve')}>
                    {t('admin.approve')}
                  </button>
                  <button className="btn-glass" disabled={busy === u.id} onClick={() => void act(u, 'reject')}>
                    {t('admin.reject')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** #/admin: pending uploads to approve or reject. Anyone who isn't an admin gets "page not found". */
export function AdminPage() {
  const { status, user } = useAccount();
  if (status === 'loading') return <span className="spinner" role="status" aria-label={t('account.busy')} />;
  if (user?.role !== 'admin') return <NotFound what="page" />;
  return <Review />;
}
