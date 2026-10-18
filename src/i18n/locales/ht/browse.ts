import type { browse as En } from '../en/browse';

export const browse: { [K in keyof typeof En]: string } = {
  // Discover: hero carousel
  'browse.hero.label': 'Sòti n ap mete devan',
  'browse.hero.carousel': 'karousèl',
  'browse.hero.newAlbum': 'Nouvo albòm',
  'browse.hero.newEp': 'Nouvo EP',
  'browse.hero.newMixtape': 'Nouvo mixtape',
  'browse.hero.newSingle': 'Nouvo single',
  'browse.hero.playsSoFar_one': 'Deja {n} ekout.',
  'browse.hero.playsSoFar_other': 'Deja {n} ekout.',
  'browse.hero.playNow': 'Jwe l kounye a',
  'browse.hero.slide': 'Imaj {n}',

  // Discover: Boost Board spotlight
  'browse.boost.title': 'Se sa w peye ki bay ou plas ou.',
  'browse.boost.body': 'Pa gen algoritm, pa gen moun k ap bloke w. Mete sit ou, sòti w oswa @non w sou tablo piblik la — plas #1 lan koute sa #1 aktyèl la peye plis {amount}.',
  'browse.boost.cta': 'Pran yon plas',

  // Discover: shelves
  'browse.discover.jumpBack': 'Kontinye koute',
  'browse.discover.trending': 'Sa k cho kounye a',
  'browse.discover.trendingSub': 'Chante k ap monte pi vit sou ASF semèn sa a',
  'browse.discover.spotlight': 'Atis an vedèt',
  'browse.discover.spotlightSub': 'Vwa k ap fè son an kounye a',
  'browse.discover.topSongs': 'Pi gwo chante semèn nan',
  'browse.discover.topSongsSub': 'Klase dapre ekout 7 dènye jou yo',
  'browse.discover.fullChart': 'Tout klasman an',
  'browse.discover.newReleases': 'Nouvo sòti',
  'browse.discover.newReleasesSub': 'Albòm, EP ak single tou cho',
  'browse.discover.forYou': 'Fèt pou ou',
  'browse.discover.forYouSub': 'Dapre chante ou renmen yo',
  'browse.discover.mixes': 'Mix ou yo',
  'browse.discover.mixesSub': 'Fèt pou ou — yo chanje chak fwa w renmen yon chante',
  'browse.discover.community': 'Tou cho nan kominote a',
  'browse.discover.communitySub': 'Nouvo mizik atis sou ASF — touche fòm son an pou w antre ladan l',
  'browse.discover.featured': 'Playlist n ap mete devan',
  'browse.discover.featuredSub': 'Chwazi pa ekip ASF la',
  'browse.discover.toWatch': 'Atis pou w veye',
  'browse.discover.toWatchSub': 'Vwa k ap leve nan dyaspora a',

  // Quick picks greeting
  'browse.greet.night': 'Bòn nuit',
  'browse.greet.morning': 'Bonjou',
  'browse.greet.afternoon': 'Bonswa',
  'browse.greet.evening': 'Bonswa',

  // Stream card
  'browse.stream.posted': 'mete yon chante · {when}',
  'browse.stream.plays': 'Ekout',

  // Personal mixes
  'browse.mix.title': 'Mix ASF {n}',
  'browse.mix.curator': 'Fèt pou ou',
  'browse.mix.desc': '{genre} — {names}',
  'browse.mix.descMore': '{genre} — {names} ak lòt ankò',

  // Genre chips & chart filters
  'browse.filter': 'Filtre',
  'browse.allGenres': 'Tout estil',
  'browse.window.day': 'Jodi a',
  'browse.window.week': 'Semèn sa a',
  'browse.window.month': 'Mwa sa a',
  'browse.window.year': 'Ane sa a',

  // Trending page
  'browse.trending.title': 'Sa k cho sou ASF',
  'browse.trending.titleGenre': 'Sa k cho nan {genre}',
  'browse.trending.sub': 'Chante k ap fè plis ekout kounye a, dapre jan yo monte de yon semèn a lòt.',
  'browse.trending.playAll': 'Jwe sa k cho yo',

  // Charts page
  'browse.charts.kicker': 'Klasman',
  'browse.charts.songsTitle': 'Pi gwo chante',
  'browse.charts.albumsTitle': 'Pi gwo albòm',
  'browse.charts.sub': 'Mete ajou tout tan. Flèch yo montre si yon chante monte oswa desann konpare ak peryòd anvan an.',
  'browse.charts.playAll': 'Jwe klasman an',
  'browse.charts.songs': 'Chante',
  'browse.charts.albums': 'Albòm',

  // Genres pages
  'browse.genres.title': 'Estil mizik ak atmosfè',
  'browse.genres.sub': 'Depi kompa rive nan drill — antre nan son Ayiti ak dyaspora a.',
  'browse.genre.kicker': 'Estil mizik',
  'browse.genre.top': 'Pi gwo chante {genre}',
  'browse.genre.albums': 'Albòm ak EP',
  'browse.genre.artists': 'Atis',
  'browse.count.artists_one': '{n} atis',
  'browse.count.artists_other': '{n} atis',

  // Not found
  'browse.notFound.page': 'Nou pa jwenn paj sa a',
  'browse.notFound.song': 'Nou pa jwenn chante sa a',
  'browse.notFound.album': 'Nou pa jwenn albòm sa a',
  'browse.notFound.playlist': 'Nou pa jwenn playlist sa a',
  'browse.notFound.artist': 'Nou pa jwenn atis sa a',
  'browse.notFound.genre': 'Nou pa jwenn estil mizik sa a',
  'browse.notFound.body': 'Petèt yo retire l, oswa lyen an pa bon.',
  'browse.notFound.back': 'Retounen nan Dekouvri',

  // Shelves, buttons, track rows
  'browse.shelf.scrollLeft': 'Defile {title} agoch',
  'browse.shelf.scrollRight': 'Defile {title} adwat',
  'browse.unlike': 'Pa renmen ankò',
  'browse.feat': 'feat.',
  'browse.row.unavailable': 'Pa telechaje — fò w gen entènèt',
  'browse.row.change': 'Chanjman konpare ak peryòd anvan an',
  'browse.col.title': 'Tit',
  'browse.col.plays': 'Ekout',
  'browse.col.duration': 'Dire',
  'browse.wave.seek': 'Deplase nan {title}',

  // Track "⋯" menu
  'browse.menu.more': 'Plis opsyon pou {title}',
  'browse.menu.playNext': 'Jwe l apre sa',
  'browse.menu.playingNext': 'L ap jwe apre sa',
  'browse.menu.addQueue': 'Mete l nan lis datant',
  'browse.menu.addedQueue': 'Li nan lis datant lan',
  'browse.menu.addPlaylist': 'Mete l nan yon playlist',
  'browse.menu.removeFromPlaylist': 'Retire l nan playlist sa a',
  'browse.menu.removed': 'Li retire nan playlist la',
  'browse.menu.undoRepost': 'Anile repataj la',
  'browse.menu.repostRemoved': 'Repataj la anile',
  'browse.menu.reposted': 'Repataje sou pwofil ou',
  'browse.menu.goArtist': 'Ale nan atis la',
  'browse.menu.goAlbum': 'Ale nan albòm nan',
  'browse.menu.details': 'Detay chante a',
  'browse.menu.defaultName': 'Playlist mwen',
  'browse.menu.newName': 'Non nouvo playlist la',
  'browse.menu.create': 'Kreye',
  'browse.menu.created': 'Ou kreye « {title} »',
  'browse.menu.noPlaylists': 'Ou poko gen playlist.',
  'browse.menu.added': 'Li nan « {title} »',
};
