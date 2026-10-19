/** English (source of truth) — "browse" namespace. Keys are "browse.something". */
export const browse = {
  // Discover: hero carousel
  'browse.hero.label': 'Featured releases',
  'browse.hero.carousel': 'carousel',
  'browse.hero.newAlbum': 'New album',
  'browse.hero.newEp': 'New EP',
  'browse.hero.newMixtape': 'New mixtape',
  'browse.hero.newSingle': 'New single',
  'browse.hero.playsSoFar_one': '{n} play so far.',
  'browse.hero.playsSoFar_other': '{n} plays so far.',
  'browse.hero.playNow': 'Play now',
  'browse.hero.slide': 'Slide {n}',

  // Discover: shelves
  'browse.discover.jumpBack': 'Jump back in',
  'browse.discover.trending': 'Trending now',
  'browse.discover.trendingSub': 'The fastest-rising songs on ASF this week',
  'browse.discover.spotlight': 'Artist spotlight',
  'browse.discover.spotlightSub': 'The voices defining the sound right now',
  'browse.discover.topSongs': 'Top songs this week',
  'browse.discover.topSongsSub': 'Ranked by plays over the last 7 days',
  'browse.discover.fullChart': 'Full chart',
  'browse.discover.newReleases': 'New releases',
  'browse.discover.newReleasesSub': 'Fresh albums, EPs and singles',
  'browse.discover.forYou': 'Made for you',
  'browse.discover.forYouSub': 'Based on the songs you’ve liked',
  'browse.discover.mixes': 'Your mixes',
  'browse.discover.mixesSub': 'Made for you — updated as you like songs',
  'browse.discover.community': 'Fresh from the community',
  'browse.discover.communitySub': 'New drops from artists on ASF — tap the waveform to jump in',
  'browse.discover.toWatch': 'Artists to watch',
  'browse.discover.toWatchSub': 'Rising voices across the diaspora',
  'browse.empty.title': 'No music yet',
  'browse.empty.body': 'Songs show up here as soon as they’re published on ASF.',

  // Quick picks greeting
  'browse.greet.night': 'Good night',
  'browse.greet.morning': 'Good morning',
  'browse.greet.afternoon': 'Good afternoon',
  'browse.greet.evening': 'Good evening',

  // Stream card
  'browse.stream.posted': 'posted a track · {when}',
  'browse.stream.plays': 'Plays',

  // Personal mixes
  'browse.mix.title': 'ASF Mix {n}',
  'browse.mix.curator': 'Made for you',
  'browse.mix.desc': '{genre} — {names}',
  'browse.mix.descMore': '{genre} — {names} and more',

  // Genre chips & chart filters
  'browse.filter': 'Filter',
  'browse.allGenres': 'All genres',
  'browse.window.day': 'Today',
  'browse.window.week': 'This week',
  'browse.window.month': 'This month',
  'browse.window.year': 'This year',

  // Trending page
  'browse.trending.title': 'Trending on ASF',
  'browse.trending.titleGenre': 'Trending in {genre}',
  'browse.trending.sub': 'Songs gaining the most plays right now, weighted by week-over-week growth.',
  'browse.trending.playAll': 'Play trending',

  // Charts page
  'browse.charts.kicker': 'Top charts',
  'browse.charts.songsTitle': 'Top Songs',
  'browse.charts.albumsTitle': 'Top Albums',
  'browse.charts.sub': 'Updated continuously. Arrows show movement versus the previous period.',
  'browse.charts.playAll': 'Play the chart',
  'browse.charts.songs': 'Songs',
  'browse.charts.albums': 'Albums',
  'browse.charts.empty': 'Nothing on this chart yet',

  // Genres pages
  'browse.genres.title': 'Genres & moods',
  'browse.genres.sub': 'From kompa to drill — dive into the sounds of Haiti and the diaspora.',
  'browse.genre.kicker': 'Genre',
  'browse.genre.top': 'Top {genre} songs',
  'browse.genre.albums': 'Albums & EPs',
  'browse.genre.artists': 'Artists',
  'browse.count.artists_one': '{n} artist',
  'browse.count.artists_other': '{n} artists',

  // Not found
  'browse.notFound.page': 'We couldn’t find that page',
  'browse.notFound.song': 'We couldn’t find that song',
  'browse.notFound.album': 'We couldn’t find that album',
  'browse.notFound.playlist': 'We couldn’t find that playlist',
  'browse.notFound.artist': 'We couldn’t find that artist',
  'browse.notFound.genre': 'We couldn’t find that genre',
  'browse.notFound.body': 'It may have been removed, or the link is wrong.',
  'browse.notFound.back': 'Back to Discover',

  // Shelves, buttons, track rows
  'browse.shelf.scrollLeft': 'Scroll {title} left',
  'browse.shelf.scrollRight': 'Scroll {title} right',
  'browse.unlike': 'Unlike',
  'browse.feat': 'ft.',
  'browse.row.unavailable': 'Not downloaded — needs a connection',
  'browse.row.change': 'Change vs previous period',
  'browse.col.title': 'Title',
  'browse.col.plays': 'Plays',
  'browse.col.duration': 'Duration',
  'browse.wave.seek': 'Seek {title}',

  // Track "⋯" menu
  'browse.menu.more': 'More options for {title}',
  'browse.menu.playNext': 'Play next',
  'browse.menu.playingNext': 'Playing next',
  'browse.menu.addQueue': 'Add to queue',
  'browse.menu.addedQueue': 'Added to queue',
  'browse.menu.addPlaylist': 'Add to playlist',
  'browse.menu.removeFromPlaylist': 'Remove from this playlist',
  'browse.menu.removed': 'Removed from playlist',
  'browse.menu.undoRepost': 'Undo repost',
  'browse.menu.repostRemoved': 'Repost removed',
  'browse.menu.reposted': 'Reposted to your profile',
  'browse.menu.goArtist': 'Go to artist',
  'browse.menu.goAlbum': 'Go to album',
  'browse.menu.details': 'Song details',
  'browse.menu.defaultName': 'My playlist',
  'browse.menu.newName': 'New playlist name',
  'browse.menu.create': 'Create',
  'browse.menu.created': 'Created “{title}”',
  'browse.menu.noPlaylists': 'No playlists yet.',
  'browse.menu.added': 'Added to “{title}”',
} as const;
