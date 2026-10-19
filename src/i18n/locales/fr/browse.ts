import type { browse as En } from '../en/browse';

// Note: " " is a non-breaking space (French typography before : ; ! ? and inside « »).
export const browse: { [K in keyof typeof En]: string } = {
  // Discover: hero carousel
  'browse.hero.label': 'Sorties à la une',
  'browse.hero.carousel': 'carrousel',
  'browse.hero.newAlbum': 'Nouvel album',
  'browse.hero.newEp': 'Nouvel EP',
  'browse.hero.newMixtape': 'Nouvelle mixtape',
  'browse.hero.newSingle': 'Nouveau single',
  'browse.hero.playsSoFar_one': 'Déjà {n} écoute.',
  'browse.hero.playsSoFar_other': 'Déjà {n} écoutes.',
  'browse.hero.playNow': 'Écouter',
  'browse.hero.slide': 'Diapo {n}',

  // Discover: shelves
  'browse.discover.jumpBack': 'Reprendre l’écoute',
  'browse.discover.trending': 'Tendances du moment',
  'browse.discover.trendingSub': 'Les titres qui montent le plus vite sur ASF cette semaine',
  'browse.discover.spotlight': 'Artistes à l’honneur',
  'browse.discover.spotlightSub': 'Les voix qui font le son du moment',
  'browse.discover.topSongs': 'Top titres de la semaine',
  'browse.discover.topSongsSub': 'Classés par écoutes sur les 7 derniers jours',
  'browse.discover.fullChart': 'Classement complet',
  'browse.discover.newReleases': 'Nouvelles sorties',
  'browse.discover.newReleasesSub': 'Albums, EP et singles tout frais',
  'browse.discover.forYou': 'Conçu pour vous',
  'browse.discover.forYouSub': 'D’après les titres que vous aimez',
  'browse.discover.mixes': 'Vos mix',
  'browse.discover.mixesSub': 'Conçus pour vous — mis à jour selon vos J’aime',
  'browse.discover.community': 'Tout frais de la communauté',
  'browse.discover.communitySub': 'Les nouveautés des artistes d’ASF — touchez la forme d’onde pour écouter',
  'browse.discover.toWatch': 'Artistes à suivre',
  'browse.discover.toWatchSub': 'Les voix montantes de la diaspora',
  'browse.empty.title': 'Pas encore de musique',
  'browse.empty.body': 'Les titres apparaissent ici dès leur publication sur ASF.',

  // Quick picks greeting
  'browse.greet.night': 'Bonne nuit',
  'browse.greet.morning': 'Bonjour',
  'browse.greet.afternoon': 'Bon après-midi',
  'browse.greet.evening': 'Bonsoir',

  // Stream card
  'browse.stream.posted': 'a publié un titre · {when}',
  'browse.stream.plays': 'Écoutes',

  // Personal mixes
  'browse.mix.title': 'Mix ASF {n}',
  'browse.mix.curator': 'Conçu pour vous',
  'browse.mix.desc': '{genre} — {names}',
  'browse.mix.descMore': '{genre} — {names} et plus',

  // Genre chips & chart filters
  'browse.filter': 'Filtrer',
  'browse.allGenres': 'Tous les genres',
  'browse.window.day': 'Aujourd’hui',
  'browse.window.week': 'Cette semaine',
  'browse.window.month': 'Ce mois-ci',
  'browse.window.year': 'Cette année',

  // Trending page
  'browse.trending.title': 'Tendances sur ASF',
  'browse.trending.titleGenre': 'Tendances : {genre}',
  'browse.trending.sub': 'Les titres qui gagnent le plus d’écoutes en ce moment, selon leur progression d’une semaine sur l’autre.',
  'browse.trending.playAll': 'Écouter les tendances',

  // Charts page
  'browse.charts.kicker': 'Classements',
  'browse.charts.songsTitle': 'Top titres',
  'browse.charts.albumsTitle': 'Top albums',
  'browse.charts.sub': 'Mis à jour en continu. Les flèches indiquent l’évolution par rapport à la période précédente.',
  'browse.charts.playAll': 'Écouter le classement',
  'browse.charts.songs': 'Titres',
  'browse.charts.albums': 'Albums',
  'browse.charts.empty': 'Ce classement est encore vide',

  // Genres pages
  'browse.genres.title': 'Genres et ambiances',
  'browse.genres.sub': 'Du kompa à la drill — plongez dans les sons d’Haïti et de la diaspora.',
  'browse.genre.kicker': 'Genre',
  'browse.genre.top': 'Top titres {genre}',
  'browse.genre.albums': 'Albums et EP',
  'browse.genre.artists': 'Artistes',
  'browse.count.artists_one': '{n} artiste',
  'browse.count.artists_other': '{n} artistes',

  // Not found
  'browse.notFound.page': 'Page introuvable',
  'browse.notFound.song': 'Titre introuvable',
  'browse.notFound.album': 'Album introuvable',
  'browse.notFound.playlist': 'Playlist introuvable',
  'browse.notFound.artist': 'Artiste introuvable',
  'browse.notFound.genre': 'Genre introuvable',
  'browse.notFound.body': 'Il a peut-être été supprimé, ou le lien est incorrect.',
  'browse.notFound.back': 'Retour à Découvrir',

  // Shelves, buttons, track rows
  'browse.shelf.scrollLeft': '{title} : défiler vers la gauche',
  'browse.shelf.scrollRight': '{title} : défiler vers la droite',
  'browse.unlike': 'Je n’aime plus',
  'browse.feat': 'feat.',
  'browse.row.unavailable': 'Non téléchargé — connexion requise',
  'browse.row.change': 'Évolution par rapport à la période précédente',
  'browse.col.title': 'Titre',
  'browse.col.plays': 'Écoutes',
  'browse.col.duration': 'Durée',
  'browse.wave.seek': 'Avancer dans {title}',

  // Track "⋯" menu
  'browse.menu.more': 'Plus d’options pour {title}',
  'browse.menu.playNext': 'Lire ensuite',
  'browse.menu.playingNext': 'Lecture à suivre',
  'browse.menu.addQueue': 'Ajouter à la file d’attente',
  'browse.menu.addedQueue': 'Ajouté à la file d’attente',
  'browse.menu.addPlaylist': 'Ajouter à une playlist',
  'browse.menu.removeFromPlaylist': 'Retirer de cette playlist',
  'browse.menu.removed': 'Retiré de la playlist',
  'browse.menu.undoRepost': 'Annuler la republication',
  'browse.menu.repostRemoved': 'Republication annulée',
  'browse.menu.reposted': 'Republié sur votre profil',
  'browse.menu.goArtist': 'Voir l’artiste',
  'browse.menu.goAlbum': 'Voir l’album',
  'browse.menu.details': 'Infos sur le titre',
  'browse.menu.defaultName': 'Ma playlist',
  'browse.menu.newName': 'Nom de la nouvelle playlist',
  'browse.menu.create': 'Créer',
  'browse.menu.created': '« {title} » créée',
  'browse.menu.noPlaylists': 'Aucune playlist pour l’instant.',
  'browse.menu.added': 'Ajouté à « {title} »',
};
