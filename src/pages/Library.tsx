import { DownloadButton } from '../components/music/Offline';
import { useEffect, useMemo, useState } from 'react';
import { PALETTES, TEMPLATES, makeCover } from '../catalog/covers';
import { GENRES } from '../catalog/genres';
import { searchCatalog } from '../catalog/search';
import type { CoverSpec, GenreId, Track } from '../catalog/types';
import { analyzeAudio, saveAudio } from '../catalog/uploads';
import { searchListings } from '../lib/search';
import { usd } from '../lib/format';
import { fmtTime, useMusic } from '../music';
import { useApp } from '../store';
import { Cover, PlayAll, Shelf } from '../components/music/bits';
import { AlbumCard, ArtistCard, GenreTile, PlaylistCard, TrackCard } from '../components/music/Cards';
import { TrackList } from '../components/music/TrackRow';
import { Thumb } from '../components/Thumb';
import { PageHead } from './Browse';
import { fmtNumber, plural, t, type Key } from '../i18n';

const TABS = [
  { id: 'likes', label: 'common.nav.likes' },
  { id: 'playlists', label: 'pages.library.tab.playlists' },
  { id: 'following', label: 'common.nav.following' },
  { id: 'recent', label: 'common.nav.recent' },
  { id: 'downloads', label: 'common.nav.downloads' },
  { id: 'uploads', label: 'common.nav.uploads' },
] as const;

export function LibraryPage({ tab }: { tab: string }) {
  const m = useMusic();
  const { toast } = useApp();
  const [name, setName] = useState('');
  const lib = m.library;
  const liked = m.tracksOf(lib.likes);
  const recent = m.tracksOf(lib.recents);
  const downloaded = m.tracksOf(lib.downloads);
  const uploads = m.catalog.tracks.filter((x) => x.uploaded);
  const followed = m.catalog.artists.filter((a) => lib.follows.includes(a.id));
  const savedAlbums = m.catalog.albums.filter((a) => lib.likedAlbums.includes(a.id));
  const savedPlaylists = m.catalog.playlists.filter((p) => lib.likedPlaylists.includes(p.id));
  const empty = (title: Key, body: Key, href: string, cta: Key) => (
    <div className="empty-state">
      <h2>{t(title)}</h2>
      <p>{t(body)}</p>
      <a className="btn-accent" href={href}>
        {t(cta)}
      </a>
    </div>
  );

  return (
    <div className="page-music">
      <PageHead kicker={t('common.nav.yourLibrary')} title={t(TABS.find((x) => x.id === tab)?.label ?? 'common.nav.library')} sub={t('pages.library.sub')} />
      <nav className="lib-links" aria-label={t('common.nav.more')}>
        <a className="btn-glass btn-sm" href="#/studio">
          {t('common.nav.studio')}
        </a>
        <a className="btn-glass btn-sm" href="#/settings">
          {t('common.nav.settings')}
        </a>
      </nav>
      <div className="chips" role="tablist">
        {TABS.map((x) => (
          <a key={x.id} href={`#/library/${x.id}`} role="tab" aria-selected={tab === x.id} className={`chip2${tab === x.id ? ' is-active' : ''}`}>
            {t(x.label)}
          </a>
        ))}
      </div>

      {tab === 'likes' &&
        (liked.length ? (
          <section className="card-panel">
            <div className="phead__actions" style={{ marginBottom: 12 }}>
              <PlayAll tracks={liked} label={t('pages.library.playLiked')} />
              <DownloadButton tracks={liked} label={t('common.nav.likes')} />
              <span className="muted">{plural('common.count.songs', liked.length)}</span>
            </div>
            <TrackList tracks={liked} showAlbum />
          </section>
        ) : (
          empty('pages.library.likesEmptyTitle', 'pages.library.likesEmptyBody', '#/trending', 'pages.library.findMusic')
        ))}

      {tab === 'playlists' && (
        <>
          <form
            className="create-pl"
            onSubmit={(e) => {
              e.preventDefault();
              const p = m.createPlaylist(name || t('pages.library.defaultPlaylistName'));
              setName('');
              toast(t('pages.library.created', { name: p.title }));
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('pages.library.newPlaylistName')} aria-label={t('pages.library.newPlaylistName')} maxLength={60} />
            <button className="btn-accent" type="submit">
              {t('pages.library.createPlaylist')}
            </button>
          </form>
          {lib.playlists.length + savedPlaylists.length + savedAlbums.length === 0 ? (
            empty('pages.library.playlistsEmptyTitle', 'pages.library.playlistsEmptyBody', '#/', 'pages.library.discoverPlaylists')
          ) : (
            <div className="card-grid" role="list">
              {lib.playlists.map((p) => (
                <PlaylistCard key={p.id} playlist={p} />
              ))}
              {savedPlaylists.map((p) => (
                <PlaylistCard key={p.id} playlist={p} />
              ))}
              {savedAlbums.map((a) => (
                <AlbumCard key={a.id} album={a} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'following' &&
        (followed.length ? (
          <div className="card-grid" role="list">
            {followed.map((a) => (
              <ArtistCard key={a.id} artist={a} />
            ))}
          </div>
        ) : (
          empty('pages.library.followingEmptyTitle', 'pages.library.followingEmptyBody', '#/genres', 'pages.library.browseGenres')
        ))}

      {tab === 'downloads' &&
        (downloaded.length ? (
          <section className="card-panel">
            <div className="phead__actions" style={{ marginBottom: 12 }}>
              <PlayAll tracks={downloaded} label={t('pages.library.playDownloads')} />
              <span className="muted">
                {plural('pages.library.onDevice', downloaded.length)} · <a href="#/settings">{t('pages.library.manageStorage')}</a>
              </span>
            </div>
            <TrackList tracks={downloaded} showAlbum />
          </section>
        ) : (
          empty('pages.library.downloadsEmptyTitle', 'pages.library.downloadsEmptyBody', '#/', 'pages.library.findToDownload')
        ))}

      {tab === 'recent' &&
        (recent.length ? (
          <section className="card-panel">
            <TrackList tracks={recent} showAlbum />
          </section>
        ) : (
          empty('pages.library.recentEmptyTitle', 'pages.library.recentEmptyBody', '#/', 'pages.library.startListening')
        ))}

      {tab === 'uploads' && (
        <>
          <div className="card-panel uploads-head">
            <label className="field">
              {t('pages.library.artistNameLabel')}
              <div className="row">
                <input className="input" defaultValue={lib.displayName} placeholder={t('pages.library.artistNamePlaceholder')} onChange={(e) => m.setDisplayName(e.target.value)} />
              </div>
            </label>
            <a className="btn-accent" href="#/upload">
              {t('pages.library.uploadSong')}
            </a>
          </div>
          {uploads.length ? (
            <section className="card-panel">
              <ul className="uplist">
                {uploads.map((u) => (
                  <li key={u.id}>
                    <Cover spec={u.cover} size={48} />
                    <span className="uplist__main">
                      <a href={`#/song/${u.id}`}>{u.title}</a>
                      <small className="muted">
                        {fmtTime(u.duration)} · {GENRES.find((g) => g.id === u.genre)?.label} {u.audioUrl ? '' : t('pages.library.audioMissing')}
                      </small>
                    </span>
                    <PlayAll tracks={[u]} size="sm" label={t('common.action.playName', { name: u.title })} />
                    <button
                      className="btn-glass btn-sm"
                      onClick={async () => {
                        if (!confirm(t('pages.library.deleteUploadConfirm', { name: u.title }))) return;
                        await m.deleteUpload(u.id);
                        toast(t('pages.library.uploadDeleted'));
                      }}
                    >
                      {t('common.action.delete')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            empty('pages.library.uploadsEmptyTitle', 'pages.library.uploadsEmptyBody', '#/upload', 'common.nav.uploadMusic')
          )}
        </>
      )}
    </div>
  );
}

export function SearchPage({ q }: { q: string }) {
  const m = useMusic();
  const { boards, snapshot, openDetail } = useApp();
  const res = useMemo(() => searchCatalog(m.catalog, q, 24), [m.catalog, q]);
  const listings = useMemo(() => (q.trim() ? searchListings(snapshot.state.listings, boards.all, q, 6) : []), [q, snapshot.state.listings, boards.all]);
  const total = res.tracks.length + res.artists.length + res.albums.length + res.playlists.length + listings.length;
  if (!q.trim()) {
    return (
      <div className="page-music">
        <PageHead kicker={t('common.search.label')} title={t('pages.search.browseAll')} sub={t('pages.search.slashHint')} />
        <nav className="genre-strip genre-strip--grid" aria-label={t('common.nav.genres')}>
          {GENRES.map((g) => (
            <GenreTile key={g.id} id={g.id} />
          ))}
        </nav>
      </div>
    );
  }
  const top = res.artists[0] && (!res.tracks[0] || res.artists[0].name.toLowerCase().startsWith(q.toLowerCase())) ? { kind: 'artist' as const, a: res.artists[0] } : res.tracks[0] ? { kind: 'track' as const, t: res.tracks[0] } : null;
  return (
    <div className="page-music">
      <PageHead kicker={t('common.search.label')} title={t('pages.search.resultsFor', { q })} sub={total ? plural('pages.search.matches', total) : t('pages.search.noMatches')} />
      {top && (
        <div className="two-col">
          <section className="card-panel top-result">
            <h2 className="panel-title">{t('pages.search.topResult')}</h2>
            {top.kind === 'artist' ? (
              <a href={`#/artist/${top.a.id}`} className="top-result__card">
                <Cover spec={top.a.avatar} size={96} round />
                <b>{top.a.name}</b>
                <span className="tag">{t('common.kind.artist')}</span>
              </a>
            ) : (
              <a href={`#/song/${top.t.id}`} className="top-result__card">
                <Cover spec={top.t.cover} size={96} />
                <b>{top.t.title}</b>
                <span className="muted">{m.artistNames(top.t)}</span>
                <span className="tag">{t('common.kind.song')}</span>
              </a>
            )}
          </section>
          <section className="card-panel">
            <h2 className="panel-title">{t('pages.search.songs')}</h2>
            {res.tracks.length ? <TrackList tracks={res.tracks.slice(0, 5)} /> : <p className="muted">{t('pages.search.noSongs')}</p>}
          </section>
        </div>
      )}
      {res.tracks.length > 5 && (
        <Shelf title={t('pages.search.moreSongs')}>
          {res.tracks.slice(5).map((x: Track) => (
            <TrackCard key={x.id} track={x} context={res.tracks} />
          ))}
        </Shelf>
      )}
      {res.artists.length > 0 && (
        <Shelf title={t('pages.search.artists')}>
          {res.artists.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </Shelf>
      )}
      {res.albums.length > 0 && (
        <Shelf title={t('pages.search.albums')}>
          {res.albums.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </Shelf>
      )}
      {res.playlists.length > 0 && (
        <Shelf title={t('common.nav.playlists')}>
          {res.playlists.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </Shelf>
      )}
      {listings.length > 0 && (
        <section className="card-panel">
          <h2 className="panel-title">{t('pages.search.onBoostBoard')}</h2>
          <ul className="mini-list">
            {listings.map((h) => (
              <li key={h.listing.id}>
                <button className="mini-row" onClick={() => openDetail(h.listing.id)}>
                  <span className="mini-row__rank">{h.entry ? `#${h.entry.rank}` : '—'}</span>
                  <Thumb art={h.listing.artwork} size="sm" />
                  <span className="mini-row__title">
                    {h.listing.title}
                    <span className="mini-row__sub">{h.listing.display}</span>
                  </span>
                  <span className="mini-row__amt">{h.entry ? usd(h.entry.total) : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const MAX_BYTES = 50 * 1024 * 1024;

export function UploadPage() {
  const m = useMusic();
  const { navigate, toast } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<{ duration: number; peaks: number[] } | null>(null);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState<GenreId>('kompa');
  const [description, setDescription] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [explicit, setExplicit] = useState(false);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [palette, setPalette] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [art, setArt] = useState<{ file: File; url: string } | null>(null);
  useEffect(
    () => () => {
      if (art) URL.revokeObjectURL(art.url);
    },
    [art],
  );
  const cover: CoverSpec = { ...makeCover(seed, { template, palette: PALETTES[palette] }), text: title.slice(0, 22) || undefined, subtext: m.library.displayName || undefined };
  const shownCover: CoverSpec = art ? { ...cover, imageUrl: art.url } : cover;

  const pickArt = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|avif)$/.test(f.type)) return setError(t('pages.upload.errArtType'));
    if (f.size > 8 * 1024 * 1024) return setError(t('pages.upload.errArtSize'));
    setError(null);
    setArt({ file: f, url: URL.createObjectURL(f) });
  };

  const pick = async (f: File | undefined) => {
    setError(null);
    setInfo(null);
    if (!f) return;
    if (!f.type.startsWith('audio/')) return setError(t('pages.upload.errAudioType'));
    if (f.size > MAX_BYTES) return setError(t('pages.upload.errAudioSize'));
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80));
    try {
      setInfo(await analyzeAudio(f));
    } catch {
      setError(t('pages.upload.errDecode'));
      setFile(null);
    }
  };

  const submit = async () => {
    if (!file || !info) return setError(t('pages.upload.errNoFile'));
    if (!title.trim()) return setError(t('pages.upload.errNoTitle'));
    setBusy(true);
    const id = `up-${Date.now().toString(36)}`;
    try {
      await saveAudio(id, file);
      if (art) await saveAudio(`${id}:cover`, art.file);
    } catch {
      setBusy(false);
      return setError(t('pages.upload.errStorage'));
    }
    const track: Track = {
      id,
      title: title.trim().slice(0, 80),
      artistId: 'me',
      genre,
      duration: info.duration,
      recipe: { genre, bpm: 100, root: 48, seed, scale: 'minor' },
      popularity: 0,
      releasedAt: Date.now(),
      cover,
      explicit,
      description: description.trim().slice(0, 400) || t('pages.upload.defaultDescription'),
      lyrics: lyrics.trim().slice(0, 20_000) || undefined,
      uploaded: true,
      peaks: info.peaks,
    };
    m.addUpload(track);
    setBusy(false);
    toast(t('pages.upload.done'));
    navigate(`#/song/${id}`);
  };

  return (
    <div className="page-music">
      <PageHead kicker={t('common.nav.creators')} title={t('common.nav.uploadMusic')} sub={t('pages.upload.sub')} />
      <div className="upload">
        <section className="card-panel stack">
          <label
            className={`dropzone${file ? ' has-file' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void pick(e.dataTransfer.files[0]);
            }}
          >
            <input type="file" accept="audio/*" onChange={(e) => void pick(e.target.files?.[0])} />
            {file ? (
              <>
                <b>{file.name}</b>
                <span className="muted">{info ? `${fmtTime(info.duration)} · ${t('pages.upload.fileSize', { size: fmtNumber(file.size / 1048576, 1) })}` : t('pages.upload.analyzing')}</span>
                {info && (
                  <span className="dropzone__wave" aria-hidden>
                    {info.peaks.filter((_, i) => i % 2 === 0).map((p, i) => (
                      <i key={i} style={{ height: `${p * 100}%` }} />
                    ))}
                  </span>
                )}
              </>
            ) : (
              <>
                <b>{t('pages.upload.drop')}</b>
                <span className="muted">{t('pages.upload.dropHint')}</span>
              </>
            )}
          </label>
          <label className="field">
            {t('pages.upload.titleLabel')}
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={t('pages.upload.titlePlaceholder')} />
          </label>
          <label className="field">
            {t('pages.upload.artistLabel')}
            <input className="input" value={m.library.displayName} onChange={(e) => m.setDisplayName(e.target.value)} maxLength={40} placeholder={t('pages.upload.artistPlaceholder')} />
          </label>
          <label className="field">
            {t('pages.upload.genreLabel')}
            <select className="input" value={genre} onChange={(e) => setGenre(e.target.value as GenreId)}>
              {GENRES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t('pages.upload.descriptionLabel')}
            <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} placeholder={t('pages.upload.descriptionPlaceholder')} />
          </label>
          <label className="field">
            {t('pages.lyrics.title')} <span className="muted">{t('pages.upload.lyricsHint')}</span>
            <textarea className="input" rows={4} value={lyrics} onChange={(e) => setLyrics(e.target.value)} maxLength={20_000} placeholder={t('pages.upload.lyricsPlaceholder')} />
          </label>
          <label className="check">
            <input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} /> {t('pages.upload.explicit')}
          </label>
          {error && (
            <div className="notice notice--error" role="alert">
              {error}
            </div>
          )}
          <button className="btn-accent btn-lg" disabled={busy || !info} onClick={() => void submit()}>
            {busy ? t('pages.upload.uploading') : t('pages.upload.publish')}
          </button>
        </section>
        <aside className="card-panel stack">
          <h2 className="panel-title">{t('pages.upload.coverArt')}</h2>
          <Cover spec={shownCover} className="upload__cover" />
          <label className="btn-accent upload__art-btn">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => pickArt(e.target.files?.[0])} hidden />
            {art ? t('pages.upload.replaceArt') : t('pages.upload.uploadArt')}
          </label>
          {art && (
            <button className="btn-glass" onClick={() => setArt(null)}>
              {t('pages.upload.useGenerated')}
            </button>
          )}
          <p className="muted upload__hint">{t('pages.upload.artHint')}</p>
          <div className="chips">
            {TEMPLATES.map((tp) => (
              <button key={tp} className={`chip2${template === tp ? ' is-active' : ''}`} onClick={() => setTemplate(tp)}>
                {t(`pages.upload.template.${tp}`)}
              </button>
            ))}
          </div>
          <div className="swatches" role="radiogroup" aria-label={t('pages.upload.palette')}>
            {PALETTES.map((p, i) => (
              <button
                key={i}
                role="radio"
                aria-checked={palette === i}
                className={palette === i ? 'is-active' : ''}
                style={{ background: `linear-gradient(135deg, ${p[0]}, ${p[1]} 55%, ${p[2]})` }}
                onClick={() => setPalette(i)}
                aria-label={t('pages.upload.paletteN', { n: i + 1 })}
              />
            ))}
          </div>
          <button className="btn-glass" onClick={() => setSeed(Math.floor(Math.random() * 1e6))}>
            {t('pages.upload.shuffleDesign')}
          </button>
        </aside>
      </div>
    </div>
  );
}
