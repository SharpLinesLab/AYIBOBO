import { DownloadButton } from '../components/music/Offline';
import { useMemo, useState } from 'react';
import { GENRES } from '../catalog/genres';
import { searchCatalog } from '../catalog/search';
import type { Track } from '../catalog/types';
import { fmtTime, useMusic } from '../music';
import { useApp } from '../store';
import { Cover, PlayAll, Shelf } from '../components/music/bits';
import { AlbumCard, ArtistCard, GenreTile, PlaylistCard, TrackCard } from '../components/music/Cards';
import { TrackList } from '../components/music/TrackRow';
import { PageHead } from './Browse';
import { plural, t, type Key } from '../i18n';

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
            <a className="btn-accent" href="#/account">
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
            empty('pages.library.uploadsEmptyTitle', 'pages.library.uploadsEmptyBody', '#/account', 'common.nav.uploadMusic')
          )}
        </>
      )}
    </div>
  );
}

export function SearchPage({ q }: { q: string }) {
  const m = useMusic();
  const res = useMemo(() => searchCatalog(m.catalog, q, 24), [m.catalog, q]);
  const total = res.tracks.length + res.artists.length + res.albums.length + res.playlists.length;
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
    </div>
  );
}
