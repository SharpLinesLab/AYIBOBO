import type { catalog as En } from '../en/catalog';

// Uses U+00A0 non-breaking spaces before : ; ! ? and inside « » (invisible in most editors).
export const catalog: { [K in keyof typeof En]: string } = {
  // Artist bios
  'catalog.bio.lavi-soley': 'Groupe de kompa à sept musiciens, connu pour ses concerts marathon et ses lignes de cuivres qu’on fredonne pendant des semaines.',
  'catalog.bio.tiga-blaze': 'Conteur du rap kreyòl venu d’Okap. Des 808 lourdes, une plume plus lourde encore.',
  'catalog.bio.nadege-fleur': 'Une voix de velours et la romance caribéenne, enregistrées entre Montréal et Jacmel.',
  'catalog.bio.kreyol-kingz': 'Collectif de Little Haiti : quatre MC et deux producteurs. Uniquement des morceaux en groupe.',
  'catalog.bio.mano-jakmel': 'Les cuivres du rara rencontrent les rythmes afro — l’énergie du Kanaval toute l’année.',
  'catalog.bio.sisi-lune': 'Autrice-compositrice-interprète afro-fusion, au falsetto qui flotte sur les log drums.',
  'catalog.bio.dj-bele': 'Sélecteur et producteur qui relie amapiano, remixes kompa et musique de club.',
  'catalog.bio.port-lights': 'Duo électronique qui compose pour rouler la nuit, avec des percussions caribéennes.',
  'catalog.bio.ti-pol': 'Deejay dancehall à la touche kreyòl. Des riddims à n’en plus finir.',
  'catalog.bio.marlo-vibe': 'Drill mélodique, 808 glissantes et boucles de piano de fin de soirée.',
  'catalog.bio.ch-ur-lumiere': 'Une chorale de quarante voix et un orgue — le dimanche matin, tous les jours.',
  'catalog.bio.roots-lakay': 'Du reggae roots aux influences rasin haïtiennes. Un rythme, un amour.',
  'catalog.bio.azeline': 'Chanteuse et productrice d’alt-R&B. Des rythmes épurés, une émotion maximale.',
  'catalog.bio.kalfou': 'Projet rara électronique qui échantillonne les processions de rue pour en faire des morceaux de club.',
  'catalog.bio.zenn-saj': 'Duo producteur-chanteur qui mitonne des tubes afro et amapiano.',
  'catalog.bio.okap-express': 'Ils font revivre le kompa direk d’antan, avec un mixage d’aujourd’hui.',
  'catalog.bio.nova-dlo': 'Grandi à Atlanta, racines haïtiennes. Des chansons sur l’eau, la distance et le pays.',
  'catalog.bio.laj-mizik': 'Sound system transfrontalier, entre dembow et dancehall.',

  // Release descriptions
  'catalog.release.album': 'Album de {name}.',
  'catalog.release.ep': 'EP de {name}.',
  'catalog.release.mixtape': 'Mixtape de {name}.',
  'catalog.desc.0': 'Enregistré en live sur bande, en un seul week-end.',
  'catalog.desc.1': 'Produit entre Port-au-Prince et Brooklyn.',
  'catalog.desc.2': 'Le premier extrait du prochain projet.',
  'catalog.desc.3': 'Un hymne d’été taillé pour la fête de quartier.',
  'catalog.desc.4': 'Écrit sur la côte de Jacmel, au lever du soleil.',
  'catalog.desc.5': 'Une lettre d’amour au pays, en kreyòl.',
  'catalog.desc.6': 'Pensé pour rouler tard le soir.',

  // Editorial playlists
  'catalog.curator': 'Rédaction ASF',
  'catalog.cover.playlist': 'Playlist ASF',
  'catalog.cover.everyFriday': 'Chaque vendredi',
  'catalog.playlist.new-heat-friday': 'Les sorties les plus fraîches d’ASF, renouvelées chaque semaine.',
  'catalog.playlist.kompa-kings': 'L’essentiel du kompa du moment — du renouveau direk aux chansons d’amour de la nouvelle génération.',
  'catalog.playlist.rap-kreyol-heat': 'Les rimes kreyòl les plus dures d’ASF. Mise à jour chaque vendredi.',
  'catalog.playlist.afro-wave': 'Afrobeats et amapiano pour l’heure dorée.',
  'catalog.playlist.late-night-r-b': 'Lent, doux, après minuit.',
  'catalog.playlist.kanaval-mode': 'Rara, dancehall et électro pour la rue.',
  'catalog.playlist.sunday-praise': 'Gospel et roots pour bien commencer la semaine.',
  'catalog.playlist.drill-pressure': '808 glissantes et piano sombre.',
  'catalog.playlist.lakay-chill': 'Musique tout en douceur, du pays et de la diaspora.',
};
