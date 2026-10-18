import { useMemo, useState } from 'react';
import { coverUrl } from '../catalog/covers';
import { genreById } from '../catalog/genres';
import { trending } from '../catalog/plays';
import type { CoverSpec, Track } from '../catalog/types';
import { hashString, mulberry32 } from '../lib/random';
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
import { fmtDate, plural, t } from '../i18n';

const totalDuration = (ts: Track[]) => {
  const s = ts.reduce((a, x) => a + x.duration, 0);
  const h = Math.floor(s / 3600);
  const mm = Math.round((s % 3600) / 60);
  return h ? t('pages.detail.hoursMinutes', { h, m: mm }) : t('common.count.minutes', { n: mm });
};

const ALBUM_KIND = { album: 'common.kind.album', ep: 'common.kind.ep', mixtape: 'common.kind.mixtape' } as const;

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
      <ShuffleIcon width={16} height={16} /> {t('common.action.shuffle')}
    </button>
  );
}

// --- song ---------------------------------------------------------------------------------------

const FANS = ['kreyolvibes', 'jacmel_girl', 'ti_moun_okap', 'lakay4ever', 'dj_fanatik', 'bklyn_haitian', 'mizik_lover', 'soley509', 'nouvo_jenerasyon', 'konpa_head'];
const LINES = ['This one hits different 🔥', 'On repeat all week', 'Pure vibes, lakay proud 🇭🇹', 'That drop at the hook!!', 'Production is crazy', 'Who else here from the playlist?', 'Classic in the making', 'Need the music video ASAP', 'Played this at the cookout, everybody went crazy', 'Respè 💯'];

function seedComments(tr: Track, now: number): Comment[] {
  if (tr.published) return []; // real songs only show real comments
  const r = mulberry32(hashString(`cm:${tr.id}`));
  const n = 2 + Math.floor(r() * 4);
  return Array.from({ length: n }, (_, i) => ({
    id: `seed-${tr.id}-${i}`,
    author: FANS[Math.floor(r() * FANS.length)],
    text: LINES[Math.floor(r() * LINES.length)],
    at: Math.min(now - 3600_000, tr.releasedAt + r() * (now - tr.releasedAt)),
    position: r() < 0.6 ? Math.floor(r() * tr.duration) : undefined,
  })).sort((a, b) => b.at - a.at);
}

function ShareButton({ target, icon }: { target: ShareTarget; icon?: boolean }) {
  return (
    <button className={icon ? 'round-btn' : 'btn-glass'} onClick={() => openShare(target)} aria-label={icon ? t('pages.detail.shareName', { name: target.title }) : undefined}>
      <ShareIcon width={16} height={16} /> {!icon && t('common.action.share')}
    </button>
  );
}

/** "?t=83" on a shared song link: offer to play from that moment. */
function SharedMoment({ track }: { track: Track }) {
  const m = useMusic();
  const at = Number(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('t'));
  if (!at || at <= 0 || at >= track.duration) return null;
  return (
    <button className="moment" onClick={() => m.play([track], 0, at)}>
      <PlayIcon width={14} height={14} /> {t('pages.song.sharedMoment', { time: fmtTime(at) })}
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
          {t('pages.lyrics.title')}
        </h2>
        {track.uploaded && (
          <button className="btn-glass btn-sm" onClick={() => setEditing(true)}>
            {has ? t('pages.lyrics.edit') : t('pages.lyrics.add')}
          </button>
        )}
      </div>
      <div className="song-lyrics__body">
        <LyricsView track={track} variant="page" />
      </div>
      {has && (
        <button className="link-btn song-lyrics__more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? t('common.action.showLess') : t('pages.lyrics.showAll')}
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
  const tr = m.track(id);
  const more = useMemo(() => (tr ? m.artistTracks(tr.artistId).filter((x) => x.id !== tr.id).slice(0, 8) : []), [m, tr]);
  const similar = useMemo(() => (tr ? trending(m.catalog.tracks.filter((x) => x.genre === tr.genre && x.id !== tr.id && x.artistId !== tr.artistId), m.now).slice(0, 10) : []), [m, tr]);
  if (!tr) return <NotFound what="song" />;
  const album = tr.albumId ? m.album(tr.albumId) : undefined;
  const plays = m.totalPlays(tr);
  const likes = Math.round(plays * 0.035) + (m.isLiked(tr.id) ? 1 : 0);
  const reposted = m.library.reposts.includes(tr.id);
  const comments = [...(m.library.comments[tr.id] ?? []), ...seedComments(tr, m.now)];
  const isCurrent = s.current?.id === tr.id;

  return (
    <div className="page-music">
      <DetailHero cover={tr.cover} name={tr.title} tracks={[tr, ...more]} kicker={tr.uploaded ? t('pages.song.yourUpload') : t('common.kind.song')} title={<>{tr.title}{tr.explicit && <ExplicitBadge />}</>}>
        <div className="dhero__by">
          <ArtistLinks track={tr} />
        </div>
        <SharedMoment track={tr} />
        <div className="dhero__meta">
          <a href={`#/genres/${tr.genre}`} className="tag">
            {genreById(tr.genre).label}
          </a>
          {album && (
            <a href={`#/album/${album.id}`} className="tag">
              {album.title}
            </a>
          )}
          <span>{fmtDate(tr.releasedAt)}</span>
          <span>{fmtTime(tr.duration)}</span>
          {!tr.published && <span>{tr.recipe.bpm} BPM</span>}
        </div>
        <div className="dhero__stats">
          <span>
            <b className="num">{compact(plays)}</b> {t('common.word.plays')}
          </span>
          <span>
            <b className="num">{compact(likes)}</b> {t('common.word.likes')}
          </span>
          <span>
            <b className="num">{compact(comments.length)}</b> {t('common.word.comments')}
          </span>
        </div>
        <div className="phead__actions">
          <PlayAll tracks={[tr, ...more]} label={t('common.action.playName', { name: tr.title })} />
          <LikeButton id={tr.id} withLabel />
          <button className={`btn-glass${reposted ? ' is-on' : ''}`} onClick={() => (m.toggleRepost(tr.id), toast(reposted ? t('pages.song.repostRemoved') : t('common.action.reposted')))}>
            <RepostIcon /> {reposted ? t('common.action.reposted') : t('common.action.repost')}
          </button>
          <DownloadButton tracks={[tr]} label={tr.title} />
          <ShareButton
            target={{ kind: 'Song', title: tr.title, subtitle: m.artistNames(tr), cover: tr.cover, href: `#/song/${tr.id}`, trackId: tr.id, peaks: m.peaks(tr) }}
          />
          <TrackMenu track={tr} />
        </div>
      </DetailHero>

      <section className="card-panel">
        <Waveform track={tr} context={[tr, ...more]} height={96} />
      </section>

      <SongLyrics track={tr} />

      <div className="two-col">
        <section className="card-panel">
          <h2 className="panel-title">{t('pages.song.comments')}</h2>
          <form
            className="comment-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              m.addComment(tr.id, text, isCurrent && atTime ? Math.round(getPosition()) : undefined);
              setText('');
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('pages.song.addCommentPlaceholder')} aria-label={t('pages.song.addComment')} maxLength={500} />
            {isCurrent && (
              <label className="comment-form__at">
                <input type="checkbox" checked={atTime} onChange={(e) => setAtTime(e.target.checked)} /> {t('pages.song.atCurrentTime')}
              </label>
            )}
            <button type="submit" className="btn-accent" disabled={!text.trim()}>
              {t('pages.song.post')}
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
                  {c.position !== undefined && <span className="comments__at num">{t('pages.song.commentAt', { time: fmtTime(c.position) })}</span>}
                  <span className="muted"> · {relativeTime(c.at, m.now)}</span>
                  <p>{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <aside className="card-panel">
          <h2 className="panel-title">{t('pages.detail.about')}</h2>
          {tr.description && <p className="muted">{tr.description}</p>}
          {more.length > 0 && (
            <>
              <h3 className="panel-sub">{t('pages.detail.moreFrom', { name: m.artist(tr.artistId)?.name ?? '' })}</h3>
              <TrackList tracks={more.slice(0, 5)} showCover />
            </>
          )}
        </aside>
      </div>

      {similar.length > 0 && (
        <Shelf title={t('pages.song.similar')} subtitle={t('pages.song.moreGenre', { genre: genreById(tr.genre).label })}>
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
      <DetailHero cover={a.cover} name={a.title} tracks={tracks} kicker={t(ALBUM_KIND[a.type] ?? 'common.kind.album')} title={a.title}>
        {artist && (
          <a className="dhero__by dhero__artist" href={`#/artist/${artist.id}`}>
            <Cover spec={artist.avatar} size={28} round />
            {artist.name}
            {artist.verified && <Verified />}
          </a>
        )}
        <div className="dhero__meta">
          <span>{new Date(a.releasedAt).getFullYear()}</span>
          <span>{plural('common.count.songs', tracks.length)}</span>
          <span>{totalDuration(tracks)}</span>
        </div>
        <p className="dhero__desc">{a.description}</p>
        <div className="phead__actions">
          <PlayAll tracks={tracks} label={t('common.action.playName', { name: a.title })} />
          <ShufflePlay tracks={tracks} />
          <button className={`btn-glass${saved ? ' is-on' : ''}`} onClick={() => m.toggleLikeAlbum(a.id)}>
            <HeartIcon filled={saved} /> {saved ? t('common.action.saved') : t('common.action.save')}
          </button>
          <DownloadButton tracks={tracks} label={a.title} />
          <ShareButton target={{ kind: 'Album', title: a.title, subtitle: m.artist(a.artistId)?.name ?? '', cover: a.cover, href: `#/album/${a.id}` }} />
        </div>
      </DetailHero>
      <section className="card-panel">
        <TrackList tracks={tracks} showCover={false} header />
      </section>
      {more.length > 0 && (
        <Shelf title={artist ? t('pages.detail.moreFrom', { name: artist.name }) : t('pages.detail.moreFromThisArtist')}>
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
  const followers = p.followers + (saved ? 1 : 0);
  return (
    <div className="page-music">
      <DetailHero cover={p.cover} name={p.title} tracks={tracks} kicker={p.owned ? t('pages.playlist.yours') : t('common.kind.playlist')} title={p.title}>
        <p className="dhero__desc">{p.description || (p.owned ? t('pages.playlist.ownedHint') : '')}</p>
        <div className="dhero__meta">
          <span>{p.curator}</span>
          {!p.owned && <span>{plural('common.count.followers', followers, { n: compact(followers) })}</span>}
          <span>{plural('common.count.songs', tracks.length)}</span>
          {tracks.length > 0 && <span>{totalDuration(tracks)}</span>}
        </div>
        <div className="phead__actions">
          <PlayAll tracks={tracks} label={t('common.action.playName', { name: p.title })} />
          {tracks.length > 1 && <ShufflePlay tracks={tracks} />}
          {p.owned ? (
            <button
              className="btn-glass"
              onClick={() => {
                if (confirm(t('pages.playlist.deleteConfirm', { name: p.title }))) {
                  m.deletePlaylist(p.id);
                  toast(t('pages.playlist.deleted'));
                  navigate('#/library/playlists');
                }
              }}
            >
              {t('common.action.delete')}
            </button>
          ) : (
            <button className={`btn-glass${saved ? ' is-on' : ''}`} onClick={() => m.toggleLikePlaylist(p.id)}>
              <HeartIcon filled={saved} /> {saved ? t('common.action.following') : t('common.action.follow')}
            </button>
          )}
          {tracks.length > 0 && <DownloadButton tracks={tracks} label={p.title} />}
          <ShareButton target={{ kind: 'Playlist', title: p.title, subtitle: t('pages.playlist.by', { name: p.curator }), cover: p.cover, href: `#/playlist/${p.id}` }} />
        </div>
      </DetailHero>
      <section className="card-panel">
        {tracks.length ? (
          <TrackList tracks={tracks} showAlbum header playlistId={p.owned ? p.id : undefined} />
        ) : (
          <div className="empty-state">
            <h2>{t('pages.playlist.emptyTitle')}</h2>
            <p>{t('pages.playlist.emptyBody')}</p>
            <a className="btn-accent" href="#/trending">
              {t('pages.playlist.browseTrending')}
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
  const own = all.filter((x) => x.artistId === a.id);
  const popular = [...own].sort((x, y) => m.totalPlays(y) - m.totalPlays(x)).slice(0, 6);
  const albums = m.catalog.albums.filter((x) => x.artistId === a.id);
  const singles = own.filter((x) => !x.albumId).sort((x, y) => y.releasedAt - x.releasedAt);
  const appears = all.filter((x) => x.artistId !== a.id);
  const similar = m.catalog.artists.filter((x) => x.id !== a.id && x.genres.some((g) => a.genres.includes(g)));
  const following = m.library.follows.includes(a.id);
  const monthly = own.reduce((s, x) => s + m.totalPlays(x), 0) / 12;
  const followers = m.followerCount(a);
  return (
    <div className="page-music">
      <header className="ahero" ref={heroRef}>
        <PageTint spec={a.poster} />
        <StickyBar watch={heroRef} title={a.name} tracks={popular} spec={a.poster} />
        <div className="ahero__banner" style={{ backgroundImage: `url("${coverUrl(a.banner)}")` }} />
        <div className="ahero__row">
          <Cover spec={a.avatar} round className="ahero__avatar" />
          <div className="ahero__body">
            <span className="phead__kicker">{a.verified ? t('pages.artist.verified') : t('common.kind.artist')}</span>
            <h1>
              {a.name} {a.verified && <Verified />}
            </h1>
            <div className="dhero__meta">
              <span>
                <b className="num">{compact(followers)}</b> {t('common.word.followers')}
              </span>
              <span>
                <b className="num">{compact(Math.round(monthly))}</b> {t('common.word.monthlyPlays')}
              </span>
              <span>{a.location}</span>
            </div>
            <div className="phead__actions">
              <PlayAll tracks={popular} label={t('common.action.playName', { name: a.name })} />
              <button className={`follow-btn follow-btn--lg${following ? ' is-on' : ''}`} onClick={() => m.toggleFollow(a.id)}>
                {following ? t('common.action.following') : t('common.action.follow')}
              </button>
              <ShareButton icon target={{ kind: 'Artist', title: a.name, subtitle: plural('pages.artist.shareFollowers', followers, { n: compact(followers) }), cover: a.avatar, href: `#/artist/${a.id}` }} />
              <span className="muted">{a.handle}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="two-col">
        <section className="card-panel">
          <h2 className="panel-title">{t('pages.artist.popular')}</h2>
          <TrackList tracks={popular} showAlbum />
        </section>
        <aside className="card-panel">
          <h2 className="panel-title">{t('pages.detail.about')}</h2>
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
        <Shelf title={t('pages.artist.albums')}>
          {albums.map((x) => (
            <AlbumCard key={x.id} album={x} />
          ))}
        </Shelf>
      )}
      {singles.length > 0 && (
        <Shelf title={t('pages.artist.singles')}>
          {singles.map((x) => (
            <TrackCard key={x.id} track={x} context={singles} />
          ))}
        </Shelf>
      )}
      {appears.length > 0 && (
        <Shelf title={t('pages.artist.appearsOn')}>
          {appears.map((x) => (
            <TrackCard key={x.id} track={x} context={appears} />
          ))}
        </Shelf>
      )}
      {similar.length > 0 && (
        <Shelf title={t('pages.artist.fansAlsoLike')}>
          {similar.map((x) => (
            <ArtistCard key={x.id} artist={x} />
          ))}
        </Shelf>
      )}
    </div>
  );
}
