import { useEffect, useState } from 'react';
import { GENRES } from '../catalog/genres';
import type { GenreId } from '../catalog/types';
import { analyzeAudio } from '../catalog/uploads';
import { t, type Key } from '../i18n';
import { mySubmissions, submitSong, type Submission, type SubmissionError } from '../lib/submissions';
import { fmtTime } from '../music';
import { useApp } from '../store';

/** On #/account for artists: send a song for review, and see where each one is. */
export function ArtistUploads() {
  const { toast } = useApp();
  const [list, setList] = useState<Submission[] | null>(null);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState<GenreId>('kompa');
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [error, setError] = useState<SubmissionError | null>(null);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0); // remounts the form to clear the file inputs

  useEffect(() => {
    void mySubmissions().then(setList);
  }, []);

  const submit = async () => {
    if (!audio) return setError('missing_audio');
    if (!cover) return setError('missing_cover');
    setBusy(true);
    setError(null);
    let analysis: { duration: number; peaks: number[] };
    try {
      analysis = await analyzeAudio(audio);
    } catch {
      setBusy(false);
      return setError('unreadable');
    }
    const r = await submitSong({ title: title.trim(), genre, audio, cover, ...analysis });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast(t('account.upload.sent', { title: r.upload.title }));
    setList((l) => [r.upload, ...(l ?? [])]);
    setTitle('');
    setAudio(null);
    setCover(null);
    setFormKey((k) => k + 1);
  };

  return (
    <>
      <section className="card-panel account__panel" aria-labelledby="artist-upload-title">
        <h2 className="panel-title" id="artist-upload-title">
          {t('account.upload.title')}
        </h2>
        <p className="muted">{t('account.upload.intro')}</p>
        <form
          key={formKey}
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="field">
            {t('account.upload.songTitle')}
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required />
          </label>
          <label className="field">
            {t('account.upload.genre')}
            <select className="input" value={genre} onChange={(e) => setGenre(e.target.value as GenreId)}>
              {GENRES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t('account.upload.audio')}
            <input className="input" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.wav,.m4a,.ogg" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} required />
          </label>
          <label className="field">
            {t('account.upload.cover')}
            <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => setCover(e.target.files?.[0] ?? null)} required />
          </label>
          <p className="muted account__fine">{t('account.upload.terms')}</p>
          {error && (
            <div className="notice notice--error" role="alert">
              {t(`account.upload.error.${error}` as Key)}
            </div>
          )}
          <button className="cta cta--solid" type="submit" disabled={busy}>
            {busy ? t('account.upload.sending') : t('account.upload.submit')}
          </button>
        </form>
      </section>

      <section className="card-panel account__panel" aria-labelledby="artist-mine-title">
        <h2 className="panel-title" id="artist-mine-title">
          {t('account.upload.mine')}
        </h2>
        {list && list.length === 0 && <p className="muted">{t('account.upload.none')}</p>}
        {list && list.length > 0 && (
          <ul className="account__songs">
            {list.map((s) => (
              <li key={s.id}>
                <span>
                  <b>{s.title}</b>
                  <small className="muted">
                    {GENRES.find((g) => g.id === s.genre)?.label} · {fmtTime(s.duration)}
                  </small>
                </span>
                <span className={`status-pill status-pill--${s.status}`}>{t(`account.upload.status.${s.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
