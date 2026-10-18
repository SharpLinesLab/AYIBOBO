/** English (source of truth) — Boost Board pages (home, daily archive, categories, about, rules & FAQ) and the site footer. */
export const boostPages = {
  // Shared board names
  'boost.pages.board.allTime': 'All-time',
  'boost.pages.board.today': 'Today',
  'boost.pages.board.daily': 'Daily archive',
  'boost.pages.toggle.label': 'Leaderboard timeframe',

  // Category filter bar & live pill
  'boost.pages.bar.filter': 'Filter listings',
  'boost.pages.bar.all': 'All',
  'boost.pages.bar.leaderboards': 'Leaderboards',
  'boost.pages.bar.explore': 'Explore',
  'boost.pages.live.online': '{n} online',
  'boost.pages.live.visitors': '{n} visitors today',
  'boost.pages.live.stats': 'stats →',

  // Home
  'boost.pages.home.allTime': 'All-time leaderboard',
  'boost.pages.home.today': 'Today’s leaderboard',
  'boost.pages.home.lifetimeSpend': 'lifetime spend',
  'boost.pages.home.sinceMidnight': 'since 00:00 UTC',
  'boost.pages.home.emptyToday': 'Nobody has bid today yet',
  'boost.pages.home.emptyAll': 'No listings here yet',
  'boost.pages.home.emptyCta': 'Claim #1 for {amount} — be the first.',

  // Leaderboards by category
  'boost.pages.lb.title': 'Leaderboards by category',
  'boost.pages.lb.subAll': 'all-time · global ranks',
  'boost.pages.lb.subToday': 'today · global ranks',
  'boost.pages.lb.openSpot': 'Open spot — be the first {category} listing.',

  // Explore
  'boost.pages.row.scrollLeft': 'Scroll {label} left',
  'boost.pages.row.scrollRight': 'Scroll {label} right',
  'boost.pages.explore.rising': 'Rising this week',
  'boost.pages.explore.risingSub': 'most spend in the last 7 days',
  'boost.pages.explore.newest': 'Newest listings',

  // Daily archive
  'boost.pages.daily.intro':
    'Every UTC calendar day gets its own frozen board. Each payment counts toward the day it was made, the Today board and the All-time board at the same time.',
  'boost.pages.daily.prev': 'Previous day',
  'boost.pages.daily.next': 'Next day',
  'boost.pages.daily.live': 'live',
  'boost.pages.daily.emptyTitle': 'No bids on this day',
  'boost.pages.daily.emptyBody': 'Days without payments have an empty board.',

  // Categories
  'boost.pages.cats.title': 'Categories',
  'boost.pages.cats.intro': 'Twelve corners of music on the web. Ranks are global — a category view simply filters the main board.',
  'boost.pages.cats.listed_one': '{n} listed',
  'boost.pages.cats.listed_other': '{n} listed',
  'boost.pages.cats.top': 'Top: {title} at {rank} · {amount} total',
  'boost.pages.cats.empty': 'No listings yet — claim the first spot.',

  // About
  'boost.pages.about.title': 'A leaderboard you can simply buy your way onto.',
  'boost.pages.about.p1':
    '{site} is a public, pay-to-rank leaderboard for music on the web — standalone artist sites, browser DAWs and VSTs, sample libraries, indie labels, beat stores, pressing plants, sync libraries and the communities around them.',
  'boost.pages.about.p2':
    'There’s no algorithm deciding who gets seen, no playlist curator to win over and no ad network in the middle. The rule is the same for a bedroom producer and a funded startup: {rule}',
  'boost.pages.about.rule': 'rank is strictly what you pay.',
  'boost.pages.about.howTitle': 'How it works',
  'boost.pages.about.how1': 'Paste your site, release link (Bandcamp, Spotify, SoundCloud…) or @handle.',
  'boost.pages.about.how2': 'Pick an amount — the headline tells you which rank it buys in real time. #1 costs the current #1 plus {step}.',
  'boost.pages.about.how3': 'Pay. Your listing animates into place on the All-time board, today’s board and today’s archive.',
  'boost.pages.about.how4': 'Want to climb later? Enter the same link again and pay only the difference.',
  'boost.pages.about.whyTitle': 'Why music?',
  'boost.pages.about.why':
    'Discovery for independent music is mediated by recommendation engines that reward scale. A transparent, pay-what-it-takes board is crude — and that’s the point. Everyone can see exactly why a listing is where it is.',
  'boost.pages.about.listenTitle': 'Listening, not just reading',
  'boost.pages.about.listen':
    'Listings can include a short audio preview — a synth preset demo, a sample pack teaser or a featured track — playable right on the board without leaving the page.',

  // Rules
  'boost.pages.rules.title': 'Rules',
  'boost.pages.rules.intro': 'The same rules apply to every listing. They are enforced by the server at checkout, not just by the interface.',
  'boost.pages.rules.r1Title': '1. One payment, three boards',
  'boost.pages.rules.r1AllTime': '— lifetime cumulative spend per listing. Never expires.',
  'boost.pages.rules.r1Today': '— spend since 00:00 UTC today. Resets at midnight UTC.',
  'boost.pages.rules.r1Daily': '— a frozen snapshot of every UTC calendar day.',
  'boost.pages.rules.r2Title': '2. Amounts & outbidding',
  'boost.pages.rules.r2Whole': 'Whole US dollars only. Minimum {min} for a new listing, maximum {max}, {step} increments.',
  'boost.pages.rules.r2FirstLabel': 'Taking #1',
  'boost.pages.rules.r2First': '{label} costs at least {step} more than the current #1 on that board (#1 at {from} → {to}).',
  'boost.pages.rules.r2OtherLabel': 'Any other rank',
  'boost.pages.rules.r2Other': '{label} costs at least {step} more than the listing holding it (#4 at {from} → {to}).',
  'boost.pages.rules.r2TiesLabel': 'Ties',
  'boost.pages.rules.r2Ties': '{label} stay in chronological order — the listing that got there first keeps the higher rank.',
  'boost.pages.rules.r3Title': '3. Raising your rank',
  'boost.pages.rules.r3Recognized': 'Enter a link that’s already listed and it’s recognized automatically.',
  'boost.pages.rules.r3NewTotal': 'Choose a new total at least {step} above the current one; you’re charged only the difference.',
  'boost.pages.rules.r3Different': 'A different link always pays its full amount — nobody can take over someone else’s spend by paying the difference.',
  'boost.pages.rules.r4Title': '4. Links',
  'boost.pages.rules.r4Tracking': 'Tracking, referral and affiliate parameters ({params}…) are removed.',
  'boost.pages.rules.r4Short': 'Short links ({links}…) are resolved to their destination.',
  'boost.pages.rules.r4Keyed':
    'Regular sites are keyed by domain. Shared music platforms are keyed by path, so every artist, release, pack and plugin gets its own listing: {examples}.',
  'boost.pages.rules.r4Handles': '{handles} are listed as X profiles.',
  'boost.pages.rules.r4Private': 'Private chat invites (Discord, Telegram, WhatsApp, Signal…) and NSFW / adult links are not allowed.',

  // FAQ
  'boost.pages.faq.title': 'FAQ',
  'boost.pages.faq.q1': 'Can I get a refund if someone outbids me?',
  'boost.pages.faq.a1': 'No. Payments are final and rank is never guaranteed — that’s the game. Your spend stays on your listing forever on the All-time board.',
  'boost.pages.faq.q2': 'Do I need an account?',
  'boost.pages.faq.a2': 'No. Your listing is identified by its normalized link. Anyone can top up any listing — which only ever moves it up.',
  'boost.pages.faq.q3': 'Can I change my title, description or audio preview?',
  'boost.pages.faq.a3': 'Metadata is scraped from your site at first claim. Contact us from the domain’s email to request an update.',
  'boost.pages.faq.q4': 'What counts as a click?',
  'boost.pages.faq.a4': 'Every outbound click from the board or a details page to your link. The counter is public.',
  'boost.pages.faq.q5': 'Why did my rank change without me doing anything?',
  'boost.pages.faq.a5': 'Someone else paid more. Higher cumulative payments rank higher automatically.',
  'boost.pages.faq.q6': 'Which currency and payment methods?',
  'boost.pages.faq.a6': 'US dollars via Stripe Checkout — cards, Apple Pay and Google Pay where available.',

  // Footer
  'boost.footer.socialOn': '{brand} on {network}',
  'boost.footer.visitors': 'visitors',
  'boost.footer.revenue': 'total revenue',
  'boost.footer.listed': 'music websites listed',
  'boost.footer.nav': 'Footer',
  'boost.footer.advertise': 'Advertise',
  'boost.footer.terms': 'Terms & Rules',
  'boost.footer.faq': 'FAQ',
  'boost.footer.liveStats': 'Live stats',
  'boost.footer.contact': 'Contact',
  'boost.footer.resetDemo': 'Reset demo',
  'boost.footer.resetDone': 'Demo data reset.',
  'boost.footer.modeDemo': '● Demo mode — payments simulated, saved in this browser',
  'boost.footer.modeLive': '● Live — payments via Stripe',
  'boost.footer.modeServer': '● Server mode — payments simulated',
  'boost.footer.rights': '© {year} {short} — {name}. All rights reserved. Listings shown in the demo are fictional.',
} as const;
