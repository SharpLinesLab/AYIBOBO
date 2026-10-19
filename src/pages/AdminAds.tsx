import { useEffect, useState } from 'react';
import { analyzeAudio } from '../catalog/uploads';
import { fmtDate, fmtNumber, t, type Key } from '../i18n';
import { createAd, deleteAd, listAds, MAX_AD_SECONDS, updateAd, type AdError, type AdFields, type AdminAd } from '../lib/ads';
import { useApp } from '../store';

const DAY = 86_400_000;

/** `YYYY-MM-DD` for a date input (local time). */
function toInput(ms: number | null): string {
  if (ms === null) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Local midnight at the start of a date input's day; `end` = the next midnight (the day is included). */
function fromInput(v: string, end = false): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + (end ? 1 : 0)).getTime();
}
const shortDate = (ms: number) => fmtDate(ms, { day: true, month: 'short', year: true });

/** When an ad runs, in words. */
function runsWhen(ad: Pick<AdminAd, 'startsAt' | 'endsAt'>): string {
  // endsAt is exclusive (the next midnight), so show the last day it runs.
  const to = ad.endsAt === null ? null : shortDate(ad.endsAt - 1);
  if (ad.startsAt !== null && to) return t('admin.ads.window', { from: shortDate(ad.startsAt), to });
  if (ad.startsAt !== null) return t('admin.ads.from', { date: shortDate(ad.startsAt) });
  if (to) return t('admin.ads.until', { date: to });
  return t('admin.ads.always');
}

/** Title, advertiser, weight and dates: the fields an ad is created and edited with. */
function useFields(ad?: AdminAd) {
  const [title, setTitle] = useState(ad?.title ?? '');
  const [advertiser, setAdvertiser] = useState(ad?.advertiserName ?? '');
  const [weight, setWeight] = useState(String(ad?.weight ?? 1));
  const [starts, setStarts] = useState(toInput(ad?.startsAt ?? null));
  const [ends, setEnds] = useState(ad?.endsAt ? toInput(ad.endsAt - DAY) : '');
  const values = (): Omit<AdFields, 'active'> => ({
    title: title.trim(),
    advertiserName: advertiser.trim(),
    weight: Number(weight),
    startsAt: fromInput(starts),
    endsAt: fromInput(ends, true),
  });
  const reset = () => {
    setTitle('');
    setAdvertiser('');
    setWeight('1');
    setStarts('');
    setEnds('');
  };
  const inputs = (
    <>
      <label className="field">
        {t('admin.ads.adTitle')}
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required />
      </label>
      <label className="field">
        {t('admin.ads.advertiser')}
        <input className="input" value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} maxLength={100} required />
      </label>
      <label className="field">
        {t('admin.ads.weight')}
        <input className="input" type="number" min={1} max={100} step={1} value={weight} onChange={(e) => setWeight(e.target.value)} required />
      </label>
      <div className="admin__dates">
        <label className="field">
          {t('admin.ads.startsAt')}
          <input className="input" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
        </label>
        <label className="field">
          {t('admin.ads.endsAt')}
          <input className="input" type="date" value={ends} min={starts || undefined} onChange={(e) => setEnds(e.target.value)} />
        </label>
      </div>
    </>
  );
  return { inputs, values, reset };
}

function ErrorNote({ error }: { error: AdError | null }) {
  if (!error) return null;
  return (
    <div className="notice notice--error" role="alert">
      {t(`admin.ads.error.${error}` as Key)}
    </div>
  );
}

function NewAd({ onCreated }: { onCreated: (ad: AdminAd) => void }) {
  const { toast } = useApp();
  const fields = useFields();
  const [active, setActive] = useState(true);
  const [audio, setAudio] = useState<File | null>(null);
  const [error, setError] = useState<AdError | null>(null);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0); // remounts the file input to clear it

  const submit = async () => {
    if (!audio) return setError('missing_audio');
    setBusy(true);
    setError(null);
    let duration: number;
    try {
      duration = (await analyzeAudio(audio)).duration;
    } catch {
      setBusy(false);
      return setError('unreadable');
    }
    if (duration > MAX_AD_SECONDS) {
      setBusy(false);
      return setError('invalid_duration');
    }
    const r = await createAd({ ...fields.values(), active, audio, duration });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast(t('admin.ads.created', { title: r.ad.title }));
    onCreated(r.ad);
    fields.reset();
    setActive(true);
    setAudio(null);
    setFormKey((k) => k + 1);
  };

  return (
    <form
      key={formKey}
      className="card-panel stack admin__adform"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3>{t('admin.ads.new')}</h3>
      {fields.inputs}
      <label className="field">
        {t('admin.ads.audio')}
        <input className="input" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.wav,.m4a,.ogg" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} required />
      </label>
      <label className="check">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {t('admin.ads.activeNow')}
      </label>
      <ErrorNote error={error} />
      <button className="btn-accent" type="submit" disabled={busy}>
        {busy ? t('admin.ads.uploading') : t('admin.ads.upload')}
      </button>
    </form>
  );
}

function AdItem({ ad, onChange, onDelete }: { ad: AdminAd; onChange: (ad: AdminAd) => void; onDelete: () => void }) {
  const { toast } = useApp();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<AdError | null>(null);
  const [busy, setBusy] = useState(false);
  const fields = useFields(ad);
  const today = ad.playsByDay.at(-1)?.plays ?? 0;

  const save = async (patch: Partial<AdFields>, done?: Key) => {
    setBusy(true);
    setError(null);
    const r = await updateAd(ad.id, patch);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onChange(r.ad);
    setEditing(false);
    if (done) toast(t(done, { title: r.ad.title }));
  };
  const remove = async () => {
    if (!window.confirm(t('admin.ads.deleteConfirm', { title: ad.title }))) return;
    setBusy(true);
    const ok = await deleteAd(ad.id);
    setBusy(false);
    if (!ok) return toast(t('admin.failed'));
    toast(t('admin.ads.deleted', { title: ad.title }));
    onDelete();
  };

  return (
    <li className="card-panel admin__item admin__ad">
      <div className="admin__body">
        <h3>
          {ad.title} <span className={`status-pill status-pill--${ad.active ? 'approved' : 'pending'}`}>{t(ad.active ? 'admin.ads.active' : 'admin.ads.inactive')}</span>
        </h3>
        <p className="muted">
          {ad.advertiserName} · {t('admin.ads.meta', { seconds: fmtNumber(Math.round(ad.duration)), weight: ad.weight })} · {runsWhen(ad)}
        </p>
        <audio controls preload="none" src={ad.audioUrl} aria-label={t('admin.ads.preview', { title: ad.title })} />
        <p className="admin__plays-today">{t('admin.ads.playsToday', { n: fmtNumber(today) })}</p>
        <table className="admin__plays">
          <caption>{t('admin.ads.last7')}</caption>
          <tbody>
            <tr>
              {ad.playsByDay.map((d) => (
                <th key={d.day} scope="col">
                  {fmtDate(Date.parse(`${d.day}T12:00:00Z`), { day: true, month: 'short', utc: true })}
                </th>
              ))}
            </tr>
            <tr>
              {ad.playsByDay.map((d) => (
                <td key={d.day} className="num">
                  {fmtNumber(d.plays)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        {editing && (
          <form
            className="stack admin__adform"
            onSubmit={(e) => {
              e.preventDefault();
              void save(fields.values(), 'admin.ads.saved');
            }}
          >
            {fields.inputs}
            <div className="admin__actions">
              <button className="btn-accent" type="submit" disabled={busy}>
                {t('admin.ads.save')}
              </button>
              <button className="btn-glass" type="button" onClick={() => setEditing(false)}>
                {t('admin.ads.cancel')}
              </button>
            </div>
          </form>
        )}
        <ErrorNote error={error} />
        {!editing && (
          <div className="admin__actions">
            <button className={ad.active ? 'btn-glass' : 'btn-accent'} disabled={busy} onClick={() => void save({ active: !ad.active }, ad.active ? 'admin.ads.deactivated' : 'admin.ads.activated')}>
              {t(ad.active ? 'admin.ads.deactivate' : 'admin.ads.activate')}
            </button>
            <button className="btn-glass" disabled={busy} onClick={() => setEditing(true)}>
              {t('admin.ads.edit')}
            </button>
            <button className="btn-glass" disabled={busy} onClick={() => void remove()}>
              {t('admin.ads.delete')}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

/** #/admin: audio ads for the free tier. */
export function AdsAdmin() {
  const [ads, setAds] = useState<AdminAd[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void listAds().then((list) => (list ? setAds(list) : setFailed(true)));
  }, []);

  return (
    <section className="admin__ads" aria-labelledby="admin-ads-title">
      <h2 className="panel-title" id="admin-ads-title">
        {t('admin.ads.title')}
      </h2>
      <p className="muted">{t('admin.ads.sub')}</p>
      <NewAd onCreated={(ad) => setAds((list) => [ad, ...(list ?? [])])} />
      {failed && <p className="notice notice--error">{t('admin.failed')}</p>}
      {!ads && !failed && <span className="spinner" role="status" aria-label={t('account.busy')} />}
      {ads && ads.length === 0 && <p className="notice">{t('admin.ads.empty')}</p>}
      {ads && ads.length > 0 && (
        <ul className="admin__list">
          {ads.map((ad) => (
            <AdItem
              key={ad.id}
              ad={ad}
              onChange={(next) => setAds((list) => list?.map((x) => (x.id === next.id ? next : x)) ?? null)}
              onDelete={() => setAds((list) => list?.filter((x) => x.id !== ad.id) ?? null)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
