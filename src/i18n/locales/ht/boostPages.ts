import type { boostPages as En } from '../en/boostPages';

export const boostPages: { [K in keyof typeof En]: string } = {
  // Shared board names
  'boost.pages.board.allTime': 'Tout tan',
  'boost.pages.board.today': 'Jodi a',
  'boost.pages.board.daily': 'Achiv chak jou',
  'boost.pages.toggle.label': 'Peryòd klasman an',

  // Category filter bar & live pill
  'boost.pages.bar.filter': 'Filtre anons yo',
  'boost.pages.bar.all': 'Tout',
  'boost.pages.bar.leaderboards': 'Klasman',
  'boost.pages.bar.explore': 'Eksplore',
  'boost.pages.live.online': '{n} konekte',
  'boost.pages.live.visitors': '{n} vizitè jodi a',
  'boost.pages.live.stats': 'estatistik →',

  // Home
  'boost.pages.home.allTime': 'Klasman tout tan',
  'boost.pages.home.today': 'Klasman jodi a',
  'boost.pages.home.lifetimeSpend': 'total depi kòmansman',
  'boost.pages.home.sinceMidnight': 'depi 00:00 UTC',
  'boost.pages.home.emptyToday': 'Poko gen moun ki mize jodi a',
  'boost.pages.home.emptyAll': 'Poko gen anons la a',
  'boost.pages.home.emptyCta': 'Pran plas #1 pou {amount} — se ou ki premye.',

  // Leaderboards by category
  'boost.pages.lb.title': 'Klasman pa kategori',
  'boost.pages.lb.subAll': 'tout tan · plas global',
  'boost.pages.lb.subToday': 'jodi a · plas global',
  'boost.pages.lb.openSpot': 'Plas la lib — fè premye anons nan {name}.',

  // Explore
  'boost.pages.row.scrollLeft': 'Fè {label} defile sou bò goch',
  'boost.pages.row.scrollRight': 'Fè {label} defile sou bò dwat',
  'boost.pages.explore.rising': 'K ap monte semèn sa a',
  'boost.pages.explore.risingSub': 'plis lajan depanse nan 7 dènye jou yo',
  'boost.pages.explore.newest': 'Dènye anons yo',

  // Daily archive
  'boost.pages.daily.intro':
    'Chak jou kalandriye UTC gen pwòp klasman fiks pa l. Chak peman konte an menm tan pou jou yo te fè l la, pou klasman Jodi a ak pou klasman Tout tan an.',
  'boost.pages.daily.prev': 'Jou anvan',
  'boost.pages.daily.next': 'Jou apre',
  'boost.pages.daily.live': 'an dirèk',
  'boost.pages.daily.emptyTitle': 'Pa t gen okenn mize jou sa a',
  'boost.pages.daily.emptyBody': 'Jou ki pa gen peman, klasman an rete vid.',

  // Categories
  'boost.pages.cats.title': 'Kategori',
  'boost.pages.cats.intro': 'Douz kwen mizik sou entènèt. Plas yo global — lè w gade yon kategori, se jis klasman prensipal la ki filtre.',
  'boost.pages.cats.listed_one': '{n} anons',
  'boost.pages.cats.listed_other': '{n} anons',
  'boost.pages.cats.top': 'Devan: {title} nan plas {rank} · {amount} antou',
  'boost.pages.cats.empty': 'Poko gen anons — pran premye plas la.',

  // About
  'boost.pages.about.title': 'Yon klasman ou ka antre ladan l jis lè w peye.',
  'boost.pages.about.p1':
    '{site} se yon klasman piblik pou mizik sou entènèt, kote w peye pou w jwenn plas ou: sit atis endepandan, DAW ak VST k ap mache nan navigatè, bibliyotèk son, label endepandan, boutik beat, faktori ki prese disk, bibliyotèk sync ak tout kominote ki antoure yo.',
  'boost.pages.about.p2':
    'Pa gen okenn algoritm k ap deside kiyès moun ap wè, pa gen moun k ap fè playlist pou w al flate, ni rezo piblisite nan mitan. Règ la menm pou yon pwodiktè k ap travay nan chanm li ak yon startup ki gen lajan dèyè l: {rule}',
  'boost.pages.about.rule': 'plas ou se egzakteman sa w peye a.',
  'boost.pages.about.howTitle': 'Kijan sa mache',
  'boost.pages.about.how1': 'Kole lyen sit ou, lyen yon sòti (Bandcamp, Spotify, SoundCloud…) oswa @non ou.',
  'boost.pages.about.how2': 'Chwazi yon montan — tit la ap di w an dirèk ki plas lajan sa a ap ba ou. Plas #1 la koute sa #1 aktyèl la genyen plis {step}.',
  'boost.pages.about.how3': 'Peye. Anons ou an ap glise vin pran plas li sou klasman Tout tan an, klasman jodi a ak achiv jodi a.',
  'boost.pages.about.how4': 'Ou vle monte pita? Antre menm lyen an ankò epi peye diferans lan sèlman.',
  'boost.pages.about.whyTitle': 'Poukisa mizik?',
  'boost.pages.about.why':
    'Pou moun dekouvri mizik endepandan, se motè rekòmandasyon ki kanpe nan mitan, e yo favorize sa ki deja gwo. Yon klasman transparan kote w peye sa sa mande a, se yon bagay brit — e se sa menm nou vle. Tout moun ka wè egzakteman poukisa yon anons kote l ye a.',
  'boost.pages.about.listenTitle': 'Koute, pa sèlman li',
  'boost.pages.about.listen':
    'Yon anons ka gen yon ti moso odyo — yon demo preset synthé, yon ti avangou yon pack sample oswa yon chante vedèt — ou ka jwe l dirèkteman sou klasman an san w pa kite paj la.',

  // Rules
  'boost.pages.rules.title': 'Règ yo',
  'boost.pages.rules.intro': 'Menm règ yo aplike pou tout anons. Se sèvè a ki fè yo respekte lè w ap peye, pa sèlman entèfas la.',
  'boost.pages.rules.r1Title': '1. Yon sèl peman, twa klasman',
  'boost.pages.rules.r1AllTime': '— tout lajan yo peye pou yon anons depi l kòmanse, mete ansanm. Li pa janm ekspire.',
  'boost.pages.rules.r1Today': '— sa yo peye depi 00:00 UTC jodi a. Li retounen a zewo a minwi UTC.',
  'boost.pages.rules.r1Daily': '— yon foto fiks pou chak jou kalandriye UTC.',
  'boost.pages.rules.r2Title': '2. Montan ak mize pi wo',
  'boost.pages.rules.r2Whole': 'Se dola ameriken won sèlman. Minimòm {min} pou yon nouvo anons, maksimòm {max}, pa tranch {step}.',
  'boost.pages.rules.r2FirstLabel': 'Pran plas #1',
  'boost.pages.rules.r2First': '{label} koute omwen {step} plis pase #1 aktyèl la sou klasman sa a (#1 a {from} → {to}).',
  'boost.pages.rules.r2OtherLabel': 'Nenpòt lòt plas',
  'boost.pages.rules.r2Other': '{label} koute omwen {step} plis pase anons ki okipe l la (#4 a {from} → {to}).',
  'boost.pages.rules.r2TiesLabel': 'Egalite',
  'boost.pages.rules.r2Ties': '{label}: lòd kwonolojik la rete — anons ki te rive la anvan an kenbe plas ki pi wo a.',
  'boost.pages.rules.r3Title': '3. Monte plas ou',
  'boost.pages.rules.r3Recognized': 'Si w antre yon lyen ki deja nan lis la, sistèm nan rekonèt li otomatikman.',
  'boost.pages.rules.r3NewTotal': 'Chwazi yon nouvo total ki omwen {step} pi wo pase sa ki la a; se diferans lan sèlman ou peye.',
  'boost.pages.rules.r3Different': 'Yon lòt lyen toujou peye tout montan an — pesonn pa ka pran lajan yon lòt moun te depanse lè l peye diferans lan sèlman.',
  'boost.pages.rules.r4Title': '4. Lyen yo',
  'boost.pages.rules.r4Tracking': 'Nou retire paramèt swivi, parennaj ak afilyasyon ({params}…).',
  'boost.pages.rules.r4Short': 'Lyen kout yo ({links}…) ranplase pa adrès final kote yo mennen an.',
  'boost.pages.rules.r4Keyed':
    'Sit òdinè yo idantifye pa domèn yo. Platfòm mizik pataje yo idantifye pa chemen paj la, konsa chak atis, chak sòti, chak pack ak chak plugin gen pwòp anons pa l: {examples}.',
  'boost.pages.rules.r4Handles': '{handles} yo parèt kòm pwofil X.',
  'boost.pages.rules.r4Private': 'Envitasyon pou chat prive (Discord, Telegram, WhatsApp, Signal…) ak lyen NSFW / pou granmoun pa otorize.',

  // FAQ
  'boost.pages.faq.title': 'Kesyon moun poze',
  'boost.pages.faq.q1': 'Èske m ka jwenn lajan m tounen si yon moun mize pi wo pase m?',
  'boost.pages.faq.a1':
    'Non. Peman yo definitif e pa gen plas ki janm garanti — se konsa jwèt la ye. Lajan ou depanse a rete sou anons ou pou tout tan sou klasman Tout tan an.',
  'boost.pages.faq.q2': 'Èske m bezwen yon kont?',
  'boost.pages.faq.a2': 'Non. Se lyen anons ou an, apre nou fin mete l nan fòma estanda, ki idantifye l. Nenpòt moun ka ajoute lajan sou nenpòt anons — sa ka sèlman fè l monte.',
  'boost.pages.faq.q3': 'Èske m ka chanje tit, deskripsyon oswa ti moso odyo m nan?',
  'boost.pages.faq.a3': 'Nou pran enfòmasyon yo sou sit ou premye fwa w pran yon plas. Ekri nou ak yon imèl ki sou menm domèn nan pou mande yon chanjman.',
  'boost.pages.faq.q4': 'Kisa ki konte kòm yon klik?',
  'boost.pages.faq.a4': 'Chak fwa yon moun klike pou l al sou lyen ou, depi sou klasman an oswa sou yon paj detay. Kontè a piblik.',
  'boost.pages.faq.q5': 'Poukisa plas mwen chanje san m pa fè anyen?',
  'boost.pages.faq.a5': 'Yon lòt moun peye plis. Anons ki gen plis lajan total pase devan otomatikman.',
  'boost.pages.faq.q6': 'Ki lajan ak ki mwayen peman?',
  'boost.pages.faq.a6': 'Dola ameriken atravè Stripe Checkout — kat, Apple Pay ak Google Pay kote yo disponib.',

  // Footer
  'boost.footer.socialOn': '{brand} sou {network}',
  'boost.footer.visitors': 'vizitè',
  'boost.footer.revenue': 'revni total',
  'boost.footer.listed': 'sit mizik nan lis la',
  'boost.footer.nav': 'Pye paj',
  'boost.footer.advertise': 'Fè piblisite',
  'boost.footer.terms': 'Kondisyon ak règ',
  'boost.footer.faq': 'Kesyon',
  'boost.footer.liveStats': 'Estatistik an dirèk',
  'boost.footer.contact': 'Kontak',
  'boost.footer.resetDemo': 'Rekòmanse demo a',
  'boost.footer.resetDone': 'Done demo yo retounen jan yo te ye.',
  'boost.footer.modeDemo': '● Mòd demo — peman yo se similasyon, yo sove nan navigatè sa a',
  'boost.footer.modeLive': '● An dirèk — peman pase pa Stripe',
  'boost.footer.modeServer': '● Mòd sèvè — peman yo se similasyon',
  'boost.footer.rights': '© {year} {short} — {name}. Tout dwa rezève. Anons ki parèt nan demo a pa reyèl.',
};
