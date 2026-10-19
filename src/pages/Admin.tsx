import { useEffect, useState } from 'react';
import { GENRES } from '../catalog/genres';
import { ExplicitBadge } from '../components/music/bits';
import { fmtDate, t } from '../i18n';
import { useAccount } from '../lib/account';
import { CATALOG_CHANGED } from '../lib/serverCatalog';
import { moderate, pendingReviews, type ReviewItem } from '../lib/submissions';
import { pendingVerifications, reviewVerification, type VerificationReview } from '../lib/verification';
import { fmtTime, useMusic } from '../music';
import { useApp } from '../store';
import { AdsAdmin } from './AdminAds';
import { NotFound, PageHead } from './Browse';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Artists asking to be verified, oldest first. Approving puts a checkmark next to their name. */
function VerificationQueue() {
  const { toast } = useApp();
  const m = useMusic();
  const [items, setItems] = useState<VerificationReview[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void pendingVerifications().then((list) => (list ? setItems(list) : setFailed(true)));
  }, []);

  const act = async (item: VerificationReview, action: 'approve' | 'reject') => {
    if (action === 'reject' && !window.confirm(t('admin.verify.rejectConfirm', { name: item.artistName }))) return;
    setBusy(item.id);
    const ok = await reviewVerification(item.id, action);
    setBusy(null);
    if (!ok) return toast(t('admin.failed'));
    setItems((list) => list?.filter((x) => x.id !== item.id) ?? null);
    toast(t(action === 'approve' ? 'admin.verify.approved' : 'admin.verify.rejected', { name: item.artistName }));
    if (action === 'approve') window.dispatchEvent(new Event(CATALOG_CHANGED));
  };

  return (
    <section className="admin__verify" aria-labelledby="admin-verify-title">
      <h2 className="panel-title" id="admin-verify-title">
        {t('admin.verify.title')}
      </h2>
      {failed && <p className="notice notice--error">{t('admin.failed')}</p>}
      {!items && !failed && <span className="spinner" role="status" aria-label={t('account.busy')} />}
      {items && items.length === 0 && <p className="notice">{t('admin.verify.empty')}</p>}
      {items && items.length > 0 && (
        <ul className="admin__list">
          {items.map((v) => {
            // The artist page exists once the artist has a published song.
            const page = m.artist(`ar-srv-${v.userId}`) ? `#/artist/ar-srv-${v.userId}` : null;
            return (
              <li key={v.id} className="card-panel admin__item">
                {v.avatarUrl ? (
                  <img className="admin__avatar" src={v.avatarUrl} alt={t('account.profile.pictureOf', { name: v.artistName })} width={72} height={72} loading="lazy" />
                ) : (
                  <span className="studio__me" aria-hidden>
                    {v.artistName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="admin__body">
                  <h3>{v.artistName}</h3>
                  <p className="muted">
                    {v.displayName} · {v.email} · {t('admin.verify.requested', { date: fmtDate(v.requestedAt, { day: true, month: 'short', year: true }) })}
                    {page && (
                      <>
                        {' · '}
                        <a href={page}>{t('admin.verify.artistPage')}</a>
                      </>
                    )}
                  </p>
                  {v.bio && <p className="admin__bio">{v.bio}</p>}
                  <p className="admin__message">{v.message ?? <span className="muted">{t('admin.verify.noMessage')}</span>}</p>
                  <div className="admin__actions">
                    <button className="btn-accent" disabled={busy === v.id} onClick={() => void act(v, 'approve')}>
                      {t('admin.approve')}
                    </button>
                    <button className="btn-glass" disabled={busy === v.id} onClick={() => void act(v, 'reject')}>
                      {t('admin.reject')}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

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
                <h2>
                  {u.title}
                  {u.explicit && <ExplicitBadge />}
                </h2>
                <p className="muted">
                  {u.artistName}
                  {u.featuredArtists && ` ${t('browse.feat')} ${u.featuredArtists}`} · {GENRES.find((g) => g.id === u.genre)?.label} · {fmtTime(u.duration)} · {mb(u.audioSize)}
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
      <VerificationQueue />
      <AdsAdmin />
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
