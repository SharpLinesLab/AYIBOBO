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

const TABS = [
  { id: 'likes', label: 'Liked songs' },
  { id: 'playlists', label: 'Playlists & albums' },
  { id: 'following', label: 'Following' },
  { id: 'recent', label: 'Recently played' },
  { id: 'uploads', label: 'My uploads' },
];

export function LibraryPage({ tab }: { tab: string }) {
  const m = useMusic();
  const { toast } = useApp();
  const [name, setName] = useState('');
  const lib = m.library;
  const liked = m.tracksOf(lib.likes);
  const recent = m.tracksOf(lib.recents);
  const uploads = m.catalog.tracks.filter((t) => t.uploaded);
  const followed = m.catalog.artists.filter((a) => lib.follows.includes(a.id));
  const savedAlbums = m.catalog.albums.filter((a) => lib.likedAlbums.includes(a.id));
  const savedPlaylists = m.catalog.playlists.filter((p) => lib.likedPlaylists.includes(p.id));
  const empty = (title: string, body: string, href: string, cta: string) => (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
      <a className="btn-accent" href={href}>
        {cta}
      </a>
    </div>
  );

  return (
    <div className="page-music">
      <PageHead kicker="Your library" title={TABS.find((t) => t.id === tab)?.label ?? 'Library'} sub="Saved on this device — no account needed." />
      <div className="chips" role="tablist">
        {TABS.map((t) => (
          <a key={t.id} href={`#/library/${t.id}`} role="tab" aria-selected={tab === t.id} className={`chip2${tab === t.id ? ' is-active' : ''}`}>
            {t.label}
          </a>
        ))}
      </div>

      {tab === 'likes' &&
        (liked.length ? (
          <section className="card-panel">
            <div className="phead__actions" style={{ marginBottom: 12 }}>
              <PlayAll tracks={liked} label="Play liked songs" />
              <span className="muted">{liked.length} songs</span>
            </div>
            <TrackList tracks={liked} showAlbum />
          </section>
        ) : (
          empty('Songs you like will appear here', 'Tap the heart on any song to save it.', '#/trending', 'Find music')
        ))}

      {tab === 'playlists' && (
        <>
          <form
            className="create-pl"
            onSubmit={(e) => {
              e.preventDefault();
              const p = m.createPlaylist(name || 'My playlist');
              setName('');
              toast(`Created “${p.title}”`);
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist name" aria-label="New playlist name" maxLength={60} />
            <button className="btn-accent" type="submit">
              Create playlist
            </button>
          </form>
          {lib.playlists.length + savedPlaylists.length + savedAlbums.length === 0 ? (
            empty('No playlists yet', 'Create one above, or follow an editorial playlist.', '#/', 'Discover playlists')
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
          empty('Follow artists you love', 'Their new releases will be easy to find here.', '#/genres', 'Browse genres')
        ))}

      {tab === 'recent' &&
        (recent.length ? (
          <section className="card-panel">
            <TrackList tracks={recent} showAlbum />
          </section>
        ) : (
          empty('Nothing played yet', 'Your listening history shows up here.', '#/', 'Start listening')
        ))}

      {tab === 'uploads' && (
        <>
          <div className="card-panel uploads-head">
            <label className="field">
              Artist name for your uploads
              <div className="row">
                <input className="input" defaultValue={lib.displayName} placeholder="Your artist name" onChange={(e) => m.setDisplayName(e.target.value)} />
              </div>
            </label>
            <a className="btn-accent" href="#/upload">
              Upload a song
            </a>
          </div>
          {uploads.length ? (
            <section className="card-panel">
              <ul className="uplist">
                {uploads.map((t) => (
                  <li key={t.id}>
                    <Cover spec={t.cover} size={48} />
                    <span className="uplist__main">
                      <a href={`#/song/${t.id}`}>{t.title}</a>
                      <small className="muted">
                        {fmtTime(t.duration)} · {GENRES.find((g) => g.id === t.genre)?.label} {t.audioUrl ? '' : '· audio missing on this device'}
                      </small>
                    </span>
                    <PlayAll tracks={[t]} size="sm" label={`Play ${t.title}`} />
                    <button
                      className="btn-glass btn-sm"
                      onClick={async () => {
                        if (!confirm(`Delete “${t.title}”? This removes the audio from this browser.`)) return;
                        await m.deleteUpload(t.id);
                        toast('Upload deleted');
                      }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            empty('No uploads yet', 'Share your music with the ASF community.', '#/upload', 'Upload music')
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
        <PageHead kicker="Search" title="Browse all" sub="Press / anywhere to search." />
        <div className="genre-strip genre-strip--grid" role="list">
          {GENRES.map((g) => (
            <GenreTile key={g.id} id={g.id} />
          ))}
        </div>
      </div>
    );
  }
  const top = res.artists[0] && (!res.tracks[0] || res.artists[0].name.toLowerCase().startsWith(q.toLowerCase())) ? { kind: 'artist' as const, a: res.artists[0] } : res.tracks[0] ? { kind: 'track' as const, t: res.tracks[0] } : null;
  return (
    <div className="page-music">
      <PageHead kicker="Search" title={`Results for “${q}”`} sub={total ? `${total} matches` : 'No matches. Try another spelling — accents are optional.'} />
      {top && (
        <div className="two-col">
          <section className="card-panel top-result">
            <h2 className="panel-title">Top result</h2>
            {top.kind === 'artist' ? (
              <a href={`#/artist/${top.a.id}`} className="top-result__card">
                <Cover spec={top.a.avatar} size={96} round />
                <b>{top.a.name}</b>
                <span className="tag">Artist</span>
              </a>
            ) : (
              <a href={`#/song/${top.t.id}`} className="top-result__card">
                <Cover spec={top.t.cover} size={96} />
                <b>{top.t.title}</b>
                <span className="muted">{m.artistNames(top.t)}</span>
                <span className="tag">Song</span>
              </a>
            )}
          </section>
          <section className="card-panel">
            <h2 className="panel-title">Songs</h2>
            {res.tracks.length ? <TrackList tracks={res.tracks.slice(0, 5)} /> : <p className="muted">No songs.</p>}
          </section>
        </div>
      )}
      {res.tracks.length > 5 && (
        <Shelf title="More songs">
          {res.tracks.slice(5).map((t: Track) => (
            <TrackCard key={t.id} track={t} context={res.tracks} />
          ))}
        </Shelf>
      )}
      {res.artists.length > 0 && (
        <Shelf title="Artists">
          {res.artists.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </Shelf>
      )}
      {res.albums.length > 0 && (
        <Shelf title="Albums">
          {res.albums.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </Shelf>
      )}
      {res.playlists.length > 0 && (
        <Shelf title="Playlists">
          {res.playlists.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </Shelf>
      )}
      {listings.length > 0 && (
        <section className="card-panel">
          <h2 className="panel-title">On the Boost Board</h2>
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
    if (!/^image\/(jpeg|png|webp|avif)$/.test(f.type)) return setError('Cover art must be a JPG, PNG, WebP or AVIF image.');
    if (f.size > 8 * 1024 * 1024) return setError('Cover art can be up to 8 MB.');
    setError(null);
    setArt({ file: f, url: URL.createObjectURL(f) });
  };

  const pick = async (f: File | undefined) => {
    setError(null);
    setInfo(null);
    if (!f) return;
    if (!f.type.startsWith('audio/')) return setError('Choose an audio file (MP3, WAV, M4A, OGG…).');
    if (f.size > MAX_BYTES) return setError('Files up to 50 MB are supported.');
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80));
    try {
      setInfo(await analyzeAudio(f));
    } catch {
      setError('We couldn’t decode that file. Try MP3 or WAV.');
      setFile(null);
    }
  };

  const submit = async () => {
    if (!file || !info) return setError('Add an audio file first.');
    if (!title.trim()) return setError('Give your song a title.');
    setBusy(true);
    const id = `up-${Date.now().toString(36)}`;
    try {
      await saveAudio(id, file);
      if (art) await saveAudio(`${id}:cover`, art.file);
    } catch {
      setBusy(false);
      return setError('Your browser blocked storage for the audio file. Free up space or allow site data and try again.');
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
      description: description.trim().slice(0, 400) || 'Uploaded on ASF.',
      uploaded: true,
      peaks: info.peaks,
    };
    m.addUpload(track);
    setBusy(false);
    toast('Uploaded! Your song is live in your library.');
    navigate(`#/song/${id}`);
  };

  return (
    <div className="page-music">
      <PageHead kicker="Creators" title="Upload music" sub="Share a song with the ASF community. Free, no account needed — your upload is stored in this browser." />
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
                <span className="muted">{info ? `${fmtTime(info.duration)} · ${(file.size / 1048576).toFixed(1)} MB` : 'Analyzing…'}</span>
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
                <b>Drop an audio file here</b>
                <span className="muted">or click to choose · MP3, WAV, M4A, OGG · up to 50 MB</span>
              </>
            )}
          </label>
          <label className="field">
            Title
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Song title" />
          </label>
          <label className="field">
            Artist name
            <input className="input" value={m.library.displayName} onChange={(e) => m.setDisplayName(e.target.value)} maxLength={40} placeholder="How you want to be credited" />
          </label>
          <label className="field">
            Genre
            <select className="input" value={genre} onChange={(e) => setGenre(e.target.value as GenreId)}>
              {GENRES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Description
            <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} placeholder="Credits, story behind the song…" />
          </label>
          <label className="check">
            <input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} /> Explicit lyrics
          </label>
          {error && (
            <div className="notice notice--error" role="alert">
              {error}
            </div>
          )}
          <button className="btn-accent btn-lg" disabled={busy || !info} onClick={() => void submit()}>
            {busy ? 'Uploading…' : 'Publish'}
          </button>
        </section>
        <aside className="card-panel stack">
          <h2 className="panel-title">Cover art</h2>
          <Cover spec={shownCover} className="upload__cover" />
          <label className="btn-accent upload__art-btn">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => pickArt(e.target.files?.[0])} hidden />
            {art ? 'Replace your artwork' : 'Upload your own artwork'}
          </label>
          {art && (
            <button className="btn-glass" onClick={() => setArt(null)}>
              Use a generated design instead
            </button>
          )}
          <p className="muted upload__hint">Square JPG/PNG, at least 1000×1000. Or design one below.</p>
          <div className="chips">
            {TEMPLATES.map((t) => (
              <button key={t} className={`chip2${template === t ? ' is-active' : ''}`} onClick={() => setTemplate(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="swatches" role="radiogroup" aria-label="Palette">
            {PALETTES.map((p, i) => (
              <button
                key={i}
                role="radio"
                aria-checked={palette === i}
                className={palette === i ? 'is-active' : ''}
                style={{ background: `linear-gradient(135deg, ${p[0]}, ${p[1]} 55%, ${p[2]})` }}
                onClick={() => setPalette(i)}
                aria-label={`Palette ${i + 1}`}
              />
            ))}
          </div>
          <button className="btn-glass" onClick={() => setSeed(Math.floor(Math.random() * 1e6))}>
            Shuffle design
          </button>
        </aside>
      </div>
    </div>
  );
}
