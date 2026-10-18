import { useMemo, useState } from 'react';
import { coverUrl } from '../catalog/covers';
import { genreById } from '../catalog/genres';
import { trending } from '../catalog/plays';
import type { CoverSpec, Track } from '../catalog/types';
import { hashString, mulberry32 } from '../lib/metadata';
import { compact, fmtTime, useMusic, usePlayerState, type Comment } from '../music';
import { getPosition, toggleShuffle, getState } from '../player/engine';
import { useApp } from '../store';
import { relativeTime } from '../lib/format';
import { Cover, ExplicitBadge, HeartIcon, LikeButton, PlayAll, RepostIcon, Shelf } from '../components/music/bits';
import { AlbumCard, ArtistCard, TrackCard, Verified } from '../components/music/Cards';
import { TrackMenu } from '../components/music/TrackMenu';
import { ArtistLinks, TrackList } from '../components/music/TrackRow';
import { LyricsEditor, LyricsView, hasLyrics } from '../components/music/Lyrics';
import { DownloadButton } from '../components/music/Offline';
import { Waveform } from '../components/music/Waveform';
import { PlayIcon, ShareIcon, ShuffleIcon } from '../components/icons';
import { openShare, type ShareTarget } from '../components/music/Share';
import { NotFound } from './Browse';
import { PageTint, StickyBar, useWatchRef } from '../components/music/premium';

const totalDuration = (ts: Track[]) => {
  const s = ts.reduce((a, t) => a + t.duration, 0);
  const h = Math.floor(s / 3600);
  const mm = Math.round((s % 3600) / 60);
  return h ? `${h} hr ${mm} min` : `${mm} min`;
};

function DetailHero({
  cover,
  round,
  kicker,
  title,
  name,
  tracks,
  children,
}: {
  cover: CoverSpec;
  round?: boolean;
  kicker: string;
  title: React.ReactNode;
  /** Plain-text title for the sticky bar. */
  name: string;
  tracks: Track[];
  children?: React.ReactNode;
}) {
  const ref = useWatchRef();
  return (
    <header className="dhero" ref={ref}>
      <PageTint spec={cover} />
      <StickyBar watch={ref} title={name} tracks={tracks} spec={cover} />
      <div className="dhero__art">
        <Cover spec={cover} round={round} />
      </div>
      <div className="dhero__body">
        <span className="phead__kicker">{kicker}</span>
        <h1 className="dhero__title">{title}</h1>
        {children}
      </div>
    </header>
  );
}

function ShufflePlay({ tracks }: { tracks: Track[] }) {
  const m = useMusic();
  return (
    <button
      className="btn-glass"
      onClick={() => {
        if (!getState().shuffle) toggleShuffle();
        m.play(tracks, Math.floor(Math.random() * tracks.length));
      }}
    >
      <ShuffleIcon width={16} height={16} /> Shuffle
    </button>
  );
}

// --- song ---------------------------------------------------------------------------------------

const FANS = ['kreyolvibes', 'jacmel_girl', 'ti_moun_okap', 'lakay4ever', 'dj_fanatik', 'bklyn_haitian', 'mizik_lover', 'soley509', 'nouvo_jenerasyon', 'konpa_head'];
const LINES = ['This one hits different 🔥', 'On repeat all week', 'Pure vibes, lakay proud 🇭🇹', 'That drop at the hook!!', 'Production is crazy', 'Who else here from the playlist?', 'Classic in the making', 'Need the music video ASAP', 'Played this at the cookout, everybody went crazy', 'Respè 💯'];

function seedComments(t: Track, now: number): Comment[] {
  const r = mulberry32(hashString(`cm:${t.id}`));
  const n = 2 + Math.floor(r() * 4);
  return Array.from({ length: n }, (_, i) => ({
    id: `seed-${t.id}-${i}`,
    author: FANS[Math.floor(r() * FANS.length)],
    text: LINES[Math.floor(r() * LINES.length)],
    at: Math.min(now - 3600_000, t.releasedAt + r() * (now - t.releasedAt)),
    position: r() < 0.6 ? Math.floor(r() * t.duration) : undefined,
  })).sort((a, b) => b.at - a.at);
}

function ShareButton({ target, icon }: { target: ShareTarget; icon?: boolean }) {
  return (
    <button className={icon ? 'round-btn' : 'btn-glass'} onClick={() => openShare(target)} aria-label={icon ? `Share ${target.title}` : undefined}>
      <ShareIcon width={16} height={16} /> {!icon && 'Share'}
    </button>
  );
}

/** "?t=83" on a shared song link: offer to play from that moment. */
function SharedMoment({ track }: { track: Track }) {
  const m = useMusic();
  const t = Number(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('t'));
  if (!t || t <= 0 || t >= track.duration) return null;
  return (
    <button className="moment" onClick={() => m.play([track], 0, t)}>
      <PlayIcon width={14} height={14} /> Shared moment · play from {fmtTime(t)}
    </button>
  );
}

function SongLyrics({ track }: { track: Track }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const has = hasLyrics(track);
  if (!has && !track.uploaded) return null;
  return (
    <section className={`card-panel song-lyrics${open ? ' is-open' : ''}`} aria-labelledby="lyrics-title">
      <div className="song-lyrics__head">
        <h2 className="panel-title" id="lyrics-title">
          Lyrics
        </h2>
        {track.uploaded && (
          <button className="btn-glass btn-sm" onClick={() => setEditing(true)}>
            {has ? 'Edit lyrics' : 'Add lyrics'}
          </button>
        )}
      </div>
      <div className="song-lyrics__body">
        <LyricsView track={track} variant="page" />
      </div>
      {has && (
        <button className="link-btn song-lyrics__more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Show less' : 'Show all lyrics'}
        </button>
      )}
      {editing && <LyricsEditor track={track} onClose={() => setEditing(false)} />}
    </section>
  );
}

export function SongPage({ id }: { id: string }) {
  const m = useMusic();
  const { toast } = useApp();
  const s = usePlayerState();
  const [text, setText] = useState('');
  const [atTime, setAtTime] = useState(true);
  const t = m.track(id);
  const more = useMemo(() => (t ? m.artistTracks(t.artistId).filter((x) => x.id !== t.id).slice(0, 8) : []), [m, t]);
  const similar = useMemo(() => (t ? trending(m.catalog.tracks.filter((x) => x.genre === t.genre && x.id !== t.id && x.artistId !== t.artistId), m.now).slice(0, 10) : []), [m, t]);
  if (!t) return <NotFound what="song" />;
  const album = t.albumId ? m.album(t.albumId) : undefined;
  const plays = m.totalPlays(t);
  const likes = Math.round(plays * 0.035) + (m.isLiked(t.id) ? 1 : 0);
  const reposted = m.library.reposts.includes(t.id);
  const comments = [...(m.library.comments[t.id] ?? []), ...seedComments(t, m.now)];
  const isCurrent = s.current?.id === t.id;

  return (
    <div className="page-music">
      <DetailHero cover={t.cover} name={t.title} tracks={[t, ...more]} kicker={t.uploaded ? 'Your upload' : 'Song'} title={<>{t.title}{t.explicit && <ExplicitBadge />}</>}>
        <div className="dhero__by">
          <ArtistLinks track={t} />
        </div>
        <SharedMoment track={t} />
        <div className="dhero__meta">
          <a href={`#/genres/${t.genre}`} className="tag">
            {genreById(t.genre).label}
          </a>
          {album && (
            <a href={`#/album/${album.id}`} className="tag">
              {album.title}
            </a>
          )}
          <span>{new Date(t.releasedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span>{fmtTime(t.duration)}</span>
          <span>{t.recipe.bpm} BPM</span>
        </div>
        <div className="dhero__stats">
          <span>
            <b className="num">{compact(plays)}</b> plays
          </span>
          <span>
            <b className="num">{compact(likes)}</b> likes
          </span>
          <span>
            <b className="num">{compact(comments.length)}</b> comments
          </span>
        </div>
        <div className="phead__actions">
          <PlayAll tracks={[t, ...more]} label={`Play ${t.title}`} />
          <LikeButton id={t.id} withLabel />
          <button className={`btn-glass${reposted ? ' is-on' : ''}`} onClick={() => (m.toggleRepost(t.id), toast(reposted ? 'Repost removed' : 'Reposted'))}>
            <RepostIcon /> {reposted ? 'Reposted' : 'Repost'}
          </button>
          <DownloadButton tracks={[t]} label={t.title} />
          <ShareButton
            target={{ kind: 'Song', title: t.title, subtitle: m.artistNames(t), cover: t.cover, href: `#/song/${t.id}`, trackId: t.id, peaks: m.peaks(t) }}
          />
          <TrackMenu track={t} />
        </div>
      </DetailHero>

      <section className="card-panel">
        <Waveform track={t} context={[t, ...more]} height={96} />
      </section>

      <SongLyrics track={t} />

      <div className="two-col">
        <section className="card-panel">
          <h2 className="panel-title">Comments</h2>
          <form
            className="comment-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              m.addComment(t.id, text, isCurrent && atTime ? Math.round(getPosition()) : undefined);
              setText('');
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" aria-label="Add a comment" maxLength={500} />
            {isCurrent && (
              <label className="comment-form__at">
                <input type="checkbox" checked={atTime} onChange={(e) => setAtTime(e.target.checked)} /> at current time
              </label>
            )}
            <button type="submit" className="btn-accent" disabled={!text.trim()}>
              Post
            </button>
          </form>
          <ul className="comments">
            {comments.map((c) => (
              <li key={c.id}>
                <span className="comments__avatar" aria-hidden>
                  {c.author.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <b>{c.author}</b>
                  {c.position !== undefined && <span className="comments__at num"> at {fmtTime(c.position)}</span>}
                  <span className="muted"> · {relativeTime(c.at, m.now)}</span>
                  <p>{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <aside className="card-panel">
          <h2 className="panel-title">About</h2>
          <p className="muted">{t.description}</p>
          {more.length > 0 && (
            <>
              <h3 className="panel-sub">More from {m.artist(t.artistId)?.name}</h3>
              <TrackList tracks={more.slice(0, 5)} showCover />
            </>
          )}
        </aside>
      </div>

      {similar.length > 0 && (
        <Shelf title="Similar songs" subtitle={`More ${genreById(t.genre).label}`}>
          {similar.map((x) => (
            <TrackCard key={x.id} track={x} context={similar} />
          ))}
        </Shelf>
      )}
    </div>
  );
}

// --- album --------------------------------------------------------------------------------------

export function AlbumPage({ id }: { id: string }) {
  const m = useMusic();
  const a = m.album(id);
  if (!a) return <NotFound what="album" />;
  const artist = m.artist(a.artistId);
  const tracks = m.tracksOf(a.trackIds);
  const saved = m.library.likedAlbums.includes(a.id);
  const more = m.catalog.albums.filter((x) => x.artistId === a.artistId && x.id !== a.id);
  return (
    <div className="page-music">
      <DetailHero cover={a.cover} name={a.title} tracks={tracks} kicker={a.type === 'ep' ? 'EP' : a.type === 'mixtape' ? 'Mixtape' : 'Album'} title={a.title}>
        {artist && (
          <a className="dhero__by dhero__artist" href={`#/artist/${artist.id}`}>
            <Cover spec={artist.avatar} size={28} round />
            {artist.name}
            {artist.verified && <Verified />}
          </a>
        )}
        <div className="dhero__meta">
          <span>{new Date(a.releasedAt).getFullYear()}</span>
          <span>{tracks.length} songs</span>
          <span>{totalDuration(tracks)}</span>
        </div>
        <p className="dhero__desc">{a.description}</p>
        <div className="phead__actions">
          <PlayAll tracks={tracks} label={`Play ${a.title}`} />
          <ShufflePlay tracks={tracks} />
          <button className={`btn-glass${saved ? ' is-on' : ''}`} onClick={() => m.toggleLikeAlbum(a.id)}>
            <HeartIcon filled={saved} /> {saved ? 'Saved' : 'Save'}
          </button>
          <DownloadButton tracks={tracks} label={a.title} />
          <ShareButton target={{ kind: 'Album', title: a.title, subtitle: m.artist(a.artistId)?.name ?? '', cover: a.cover, href: `#/album/${a.id}` }} />
        </div>
      </DetailHero>
      <section className="card-panel">
        <TrackList tracks={tracks} showCover={false} header />
      </section>
      {more.length > 0 && (
        <Shelf title={`More from ${artist?.name ?? 'this artist'}`}>
          {more.map((x) => (
            <AlbumCard key={x.id} album={x} />
          ))}
        </Shelf>
      )}
    </div>
  );
}

// --- playlist -----------------------------------------------------------------------------------

export function PlaylistPage({ id }: { id: string }) {
  const m = useMusic();
  const { navigate, toast } = useApp();
  const p = m.playlist(id);
  if (!p) return <NotFound what="playlist" />;
  const tracks = m.tracksOf(p.trackIds);
  const saved = m.library.likedPlaylists.includes(p.id);
  return (
    <div className="page-music">
      <DetailHero cover={p.cover} name={p.title} tracks={tracks} kicker={p.owned ? 'Your playlist' : 'Playlist'} title={p.title}>
        <p className="dhero__desc">{p.description || (p.owned ? 'Add songs with “⋯ → Add to playlist” on any track.' : '')}</p>
        <div className="dhero__meta">
          <span>{p.curator}</span>
          {!p.owned && <span>{compact(p.followers + (saved ? 1 : 0))} followers</span>}
          <span>{tracks.length} songs</span>
          {tracks.length > 0 && <span>{totalDuration(tracks)}</span>}
        </div>
        <div className="phead__actions">
          <PlayAll tracks={tracks} label={`Play ${p.title}`} />
          {tracks.length > 1 && <ShufflePlay tracks={tracks} />}
          {p.owned ? (
            <button
              className="btn-glass"
              onClick={() => {
                if (confirm(`Delete “${p.title}”?`)) {
                  m.deletePlaylist(p.id);
                  toast('Playlist deleted');
                  navigate('#/library/playlists');
                }
              }}
            >
              Delete
            </button>
          ) : (
            <button className={`btn-glass${saved ? ' is-on' : ''}`} onClick={() => m.toggleLikePlaylist(p.id)}>
              <HeartIcon filled={saved} /> {saved ? 'Following' : 'Follow'}
            </button>
          )}
          {tracks.length > 0 && <DownloadButton tracks={tracks} label={p.title} />}
          <ShareButton target={{ kind: 'Playlist', title: p.title, subtitle: `Playlist by ${p.curator}`, cover: p.cover, href: `#/playlist/${p.id}` }} />
        </div>
      </DetailHero>
      <section className="card-panel">
        {tracks.length ? (
          <TrackList tracks={tracks} showAlbum header playlistId={p.owned ? p.id : undefined} />
        ) : (
          <div className="empty-state">
            <h2>This playlist is empty</h2>
            <p>Find something you love and use “⋯ → Add to playlist”.</p>
            <a className="btn-accent" href="#/trending">
              Browse trending
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

// --- artist -------------------------------------------------------------------------------------

export function ArtistPage({ id }: { id: string }) {
  const m = useMusic();
  const heroRef = useWatchRef();
  const a = m.artist(id);
  const all = useMemo(() => (a ? m.artistTracks(a.id) : []), [m, a]);
  if (!a) return <NotFound what="artist" />;
  const own = all.filter((t) => t.artistId === a.id);
  const popular = [...own].sort((x, y) => m.totalPlays(y) - m.totalPlays(x)).slice(0, 6);
  const albums = m.catalog.albums.filter((x) => x.artistId === a.id);
  const singles = own.filter((t) => !t.albumId).sort((x, y) => y.releasedAt - x.releasedAt);
  const appears = all.filter((t) => t.artistId !== a.id);
  const similar = m.catalog.artists.filter((x) => x.id !== a.id && x.genres.some((g) => a.genres.includes(g)));
  const following = m.library.follows.includes(a.id);
  const monthly = own.reduce((s, t) => s + m.totalPlays(t), 0) / 12;
  return (
    <div className="page-music">
      <header className="ahero" ref={heroRef}>
        <PageTint spec={a.poster} />
        <StickyBar watch={heroRef} title={a.name} tracks={popular} spec={a.poster} />
        <div className="ahero__banner" style={{ backgroundImage: `url("${coverUrl(a.banner)}")` }} />
        <div className="ahero__row">
          <Cover spec={a.avatar} round className="ahero__avatar" />
          <div className="ahero__body">
            <span className="phead__kicker">{a.verified ? 'Verified artist' : 'Artist'}</span>
            <h1>
              {a.name} {a.verified && <Verified />}
            </h1>
            <div className="dhero__meta">
              <span>
                <b className="num">{compact(m.followerCount(a))}</b> followers
              </span>
              <span>
                <b className="num">{compact(Math.round(monthly))}</b> monthly plays
              </span>
              <span>{a.location}</span>
            </div>
            <div className="phead__actions">
              <PlayAll tracks={popular} label={`Play ${a.name}`} />
              <button className={`follow-btn follow-btn--lg${following ? ' is-on' : ''}`} onClick={() => m.toggleFollow(a.id)}>
                {following ? 'Following' : 'Follow'}
              </button>
              <ShareButton icon target={{ kind: 'Artist', title: a.name, subtitle: `${compact(m.followerCount(a))} followers on ASF`, cover: a.avatar, href: `#/artist/${a.id}` }} />
              <span className="muted">{a.handle}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="two-col">
        <section className="card-panel">
          <h2 className="panel-title">Popular</h2>
          <TrackList tracks={popular} showAlbum />
        </section>
        <aside className="card-panel">
          <h2 className="panel-title">About</h2>
          <p>{a.bio}</p>
          <div className="tags">
            {a.genres.map((g) => (
              <a key={g} className="tag" href={`#/genres/${g}`}>
                {genreById(g).label}
              </a>
            ))}
          </div>
        </aside>
      </div>

      {albums.length > 0 && (
        <Shelf title="Albums & EPs">
          {albums.map((x) => (
            <AlbumCard key={x.id} album={x} />
          ))}
        </Shelf>
      )}
      {singles.length > 0 && (
        <Shelf title="Singles">
          {singles.map((t) => (
            <TrackCard key={t.id} track={t} context={singles} />
          ))}
        </Shelf>
      )}
      {appears.length > 0 && (
        <Shelf title="Appears on">
          {appears.map((t) => (
            <TrackCard key={t.id} track={t} context={appears} />
          ))}
        </Shelf>
      )}
      {similar.length > 0 && (
        <Shelf title="Fans also like">
          {similar.map((x) => (
            <ArtistCard key={x.id} artist={x} />
          ))}
        </Shelf>
      )}
    </div>
  );
}
