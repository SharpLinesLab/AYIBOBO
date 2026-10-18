import type { boostPages as En } from '../en/boostPages';

export const boostPages: { [K in keyof typeof En]: string } = {
  // Shared board names
  'boost.pages.board.allTime': 'Tous les temps',
  'boost.pages.board.today': 'Aujourd’hui',
  'boost.pages.board.daily': 'Archive quotidienne',
  'boost.pages.toggle.label': 'Période du classement',

  // Category filter bar & live pill
  'boost.pages.bar.filter': 'Filtrer les fiches',
  'boost.pages.bar.all': 'Tout',
  'boost.pages.bar.leaderboards': 'Classements',
  'boost.pages.bar.explore': 'Explorer',
  'boost.pages.live.online': '{n} en ligne',
  'boost.pages.live.visitors': '{n} visiteurs aujourd’hui',
  'boost.pages.live.stats': 'stats →',

  // Home
  'boost.pages.home.allTime': 'Classement de tous les temps',
  'boost.pages.home.today': 'Classement du jour',
  'boost.pages.home.lifetimeSpend': 'total depuis le début',
  'boost.pages.home.sinceMidnight': 'depuis 00 h 00 UTC',
  'boost.pages.home.emptyToday': 'Personne n’a encore misé aujourd’hui',
  'boost.pages.home.emptyAll': 'Aucune fiche ici pour l’instant',
  'boost.pages.home.emptyCta': 'Prenez le #1 pour {amount} — soyez le premier.',

  // Leaderboards by category
  'boost.pages.lb.title': 'Classements par catégorie',
  'boost.pages.lb.subAll': 'tous les temps · rangs globaux',
  'boost.pages.lb.subToday': 'aujourd’hui · rangs globaux',
  'boost.pages.lb.openSpot': 'Place libre — soyez la première fiche « {name} ».',

  // Explore
  'boost.pages.row.scrollLeft': 'Faire défiler « {label} » vers la gauche',
  'boost.pages.row.scrollRight': 'Faire défiler « {label} » vers la droite',
  'boost.pages.explore.rising': 'En hausse cette semaine',
  'boost.pages.explore.risingSub': 'plus gros montants des 7 derniers jours',
  'boost.pages.explore.newest': 'Dernières fiches',

  // Daily archive
  'boost.pages.daily.intro':
    'Chaque journée calendaire UTC a son propre classement figé. Chaque paiement compte à la fois pour le jour où il a été effectué, pour le classement du jour et pour celui de tous les temps.',
  'boost.pages.daily.prev': 'Jour précédent',
  'boost.pages.daily.next': 'Jour suivant',
  'boost.pages.daily.live': 'en direct',
  'boost.pages.daily.emptyTitle': 'Aucune mise ce jour-là',
  'boost.pages.daily.emptyBody': 'Les jours sans paiement, le classement reste vide.',

  // Categories
  'boost.pages.cats.title': 'Catégories',
  'boost.pages.cats.intro': 'Douze univers de la musique sur le web. Les rangs sont globaux : la vue par catégorie ne fait que filtrer le classement principal.',
  'boost.pages.cats.listed_one': '{n} fiche',
  'boost.pages.cats.listed_other': '{n} fiches',
  'boost.pages.cats.top': 'En tête : {title} au rang {rank} · {amount} au total',
  'boost.pages.cats.empty': 'Aucune fiche pour l’instant — prenez la première place.',

  // About
  'boost.pages.about.title': 'Un classement où il suffit de payer pour figurer.',
  'boost.pages.about.p1':
    '{site} est un classement public où le rang s’achète, consacré à la musique sur le web : sites d’artistes indépendants, DAW et VST dans le navigateur, banques de sons, labels indépendants, boutiques de beats, usines de pressage, catalogues de synchro et les communautés qui les entourent.',
  'boost.pages.about.p2':
    'Aucun algorithme ne décide qui est vu, aucun curateur de playlists à convaincre, aucune régie publicitaire au milieu. La règle est la même pour un producteur dans sa chambre et pour une start-up financée : {rule}',
  'boost.pages.about.rule': 'votre rang dépend uniquement de ce que vous payez.',
  'boost.pages.about.howTitle': 'Comment ça marche',
  'boost.pages.about.how1': 'Collez l’adresse de votre site, le lien d’une sortie (Bandcamp, Spotify, SoundCloud…) ou votre @pseudo.',
  'boost.pages.about.how2': 'Choisissez un montant : le titre vous indique en temps réel quel rang il vous offre. Le #1 coûte le montant du #1 actuel plus {step}.',
  'boost.pages.about.how3': 'Payez. Votre fiche prend sa place, avec une animation, sur le classement de tous les temps, celui du jour et l’archive du jour.',
  'boost.pages.about.how4': 'Envie de monter plus tard ? Saisissez à nouveau le même lien et ne payez que la différence.',
  'boost.pages.about.whyTitle': 'Pourquoi la musique ?',
  'boost.pages.about.why':
    'La découverte de la musique indépendante passe par des moteurs de recommandation qui favorisent ceux qui sont déjà gros. Un classement transparent, où l’on paie ce qu’il faut, c’est rudimentaire — et c’est voulu. Tout le monde voit exactement pourquoi une fiche occupe sa place.',
  'boost.pages.about.listenTitle': 'Écouter, pas seulement lire',
  'boost.pages.about.listen':
    'Les fiches peuvent inclure un court extrait audio — démo d’un preset de synthé, avant-goût d’un pack de samples ou titre phare — à écouter directement sur le classement, sans quitter la page.',

  // Rules
  'boost.pages.rules.title': 'Règles',
  'boost.pages.rules.intro': 'Les mêmes règles s’appliquent à toutes les fiches. Elles sont imposées par le serveur au moment du paiement, et pas seulement par l’interface.',
  'boost.pages.rules.r1Title': '1. Un paiement, trois classements',
  'boost.pages.rules.r1AllTime': '— total cumulé des paiements de chaque fiche depuis sa création. N’expire jamais.',
  'boost.pages.rules.r1Today': '— montants payés depuis 00 h 00 UTC aujourd’hui. Remis à zéro à minuit UTC.',
  'boost.pages.rules.r1Daily': '— un instantané figé de chaque journée calendaire UTC.',
  'boost.pages.rules.r2Title': '2. Montants et surenchères',
  'boost.pages.rules.r2Whole': 'Dollars US entiers uniquement. Minimum {min} pour une nouvelle fiche, maximum {max}, par tranches de {step}.',
  'boost.pages.rules.r2FirstLabel': 'Prendre le #1',
  'boost.pages.rules.r2First': '{label} coûte au moins {step} de plus que le #1 actuel de ce classement (#1 à {from} → {to}).',
  'boost.pages.rules.r2OtherLabel': 'Tout autre rang',
  'boost.pages.rules.r2Other': '{label} coûte au moins {step} de plus que la fiche qui l’occupe (#4 à {from} → {to}).',
  'boost.pages.rules.r2TiesLabel': 'Égalités',
  'boost.pages.rules.r2Ties': '{label} : l’ordre chronologique est conservé — la fiche arrivée en premier garde le meilleur rang.',
  'boost.pages.rules.r3Title': '3. Améliorer votre rang',
  'boost.pages.rules.r3Recognized': 'Saisissez un lien déjà présent dans le classement : il est reconnu automatiquement.',
  'boost.pages.rules.r3NewTotal': 'Choisissez un nouveau total supérieur d’au moins {step} au total actuel ; seule la différence vous est facturée.',
  'boost.pages.rules.r3Different': 'Un lien différent paie toujours son montant complet : personne ne peut s’approprier les paiements d’un autre en réglant la différence.',
  'boost.pages.rules.r4Title': '4. Liens',
  'boost.pages.rules.r4Tracking': 'Les paramètres de suivi, de parrainage et d’affiliation ({params}…) sont supprimés.',
  'boost.pages.rules.r4Short': 'Les liens raccourcis ({links}…) sont remplacés par leur destination finale.',
  'boost.pages.rules.r4Keyed':
    'Les sites classiques sont identifiés par leur domaine. Les plateformes musicales partagées le sont par leur chemin, si bien que chaque artiste, sortie, pack et plugin a sa propre fiche : {examples}.',
  'boost.pages.rules.r4Handles': 'Les {handles} sont listés comme profils X.',
  'boost.pages.rules.r4Private': 'Les invitations vers des discussions privées (Discord, Telegram, WhatsApp, Signal…) et les liens NSFW / pour adultes sont interdits.',

  // FAQ
  'boost.pages.faq.title': 'FAQ',
  'boost.pages.faq.q1': 'Puis-je être remboursé si quelqu’un mise plus que moi ?',
  'boost.pages.faq.a1':
    'Non. Les paiements sont définitifs et aucun rang n’est jamais garanti — c’est la règle du jeu. Vos paiements restent acquis à votre fiche, pour toujours, sur le classement de tous les temps.',
  'boost.pages.faq.q2': 'Ai-je besoin d’un compte ?',
  'boost.pages.faq.a2': 'Non. Votre fiche est identifiée par son lien normalisé. N’importe qui peut recharger n’importe quelle fiche — ce qui ne peut que la faire monter.',
  'boost.pages.faq.q3': 'Puis-je modifier mon titre, ma description ou mon extrait audio ?',
  'boost.pages.faq.a3':
    'Les métadonnées sont récupérées sur votre site lors de la première prise de rang. Contactez-nous depuis une adresse e-mail du domaine pour demander une mise à jour.',
  'boost.pages.faq.q4': 'Qu’est-ce qui compte comme un clic ?',
  'boost.pages.faq.a4': 'Chaque clic sortant vers votre lien, depuis le classement ou une page de détails. Le compteur est public.',
  'boost.pages.faq.q5': 'Pourquoi mon rang a-t-il changé alors que je n’ai rien fait ?',
  'boost.pages.faq.a5': 'Quelqu’un d’autre a payé plus. Plus le total cumulé des paiements est élevé, plus le rang est haut, automatiquement.',
  'boost.pages.faq.q6': 'Quelle devise et quels moyens de paiement ?',
  'boost.pages.faq.a6': 'Dollars US via Stripe Checkout — cartes bancaires, Apple Pay et Google Pay lorsqu’ils sont disponibles.',

  // Footer
  'boost.footer.socialOn': '{brand} sur {network}',
  'boost.footer.visitors': 'visiteurs',
  'boost.footer.revenue': 'revenus totaux',
  'boost.footer.listed': 'sites musicaux classés',
  'boost.footer.nav': 'Pied de page',
  'boost.footer.advertise': 'Publicité',
  'boost.footer.terms': 'Conditions et règles',
  'boost.footer.faq': 'FAQ',
  'boost.footer.liveStats': 'Stats en direct',
  'boost.footer.contact': 'Contact',
  'boost.footer.resetDemo': 'Réinitialiser la démo',
  'boost.footer.resetDone': 'Données de démo réinitialisées.',
  'boost.footer.modeDemo': '● Mode démo — paiements simulés, enregistrés dans ce navigateur',
  'boost.footer.modeLive': '● En direct — paiements via Stripe',
  'boost.footer.modeServer': '● Mode serveur — paiements simulés',
  'boost.footer.rights': '© {year} {short} — {name}. Tous droits réservés. Les fiches présentées dans la démo sont fictives.',
};
