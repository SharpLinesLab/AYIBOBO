# Translation review sheet

Every French and Kreyòl string was written to the style guide and glossary in `I18N.md`, and every page passes the automated accessibility and layout checks in both languages. A native speaker should still review them before launch. Start with these phrasings: the translators flagged them as judgement calls.

## Terms used everywhere (decide first)
| English | Français | Kreyòl | Question |
|---|---|---|---|
| Listing (Boost Board entry) | fiche | anons | Does *anons* read too much like an advert? |
| Bid / amount paid | montant | montan | Avoided *enchère* / *mise* on purpose. OK? |
| Trending | Tendances | Sa k cho | Natural enough for a nav item? |
| Genres | Genres | Estil mizik | |
| Queue | File d’attente | Lis datant | |
| Player (tab) | Lecteur | Lektè | |
| Vibe (sound panel) | Ambiance | Anbyans | |
| All-time (board) | Tous les temps | Tout tan | |
| Saves (Studio metric) | Enregistrements | Sove | *Sove* is used as a noun here |

## Kreyòl
- **Greetings:** Bonjou / Bonswa (used for both afternoon and evening) / Bòn nuit.
- **Discover page:**
  - Featured: "Sòti n ap mete devan"
  - Artist spotlight: "Atis an vedèt"
  - Artists to watch: "Atis pou w veye"
  - Jump back in: "Kontinye koute"
- **Song menu:** "Jwe l apre sa", "Li nan lis datant lan", "Pa renmen ankò", "Anile repataj la".
- **Song page:**
  - "Moman pataje · jwe apati {time}"
  - "Li parèt sou" (Appears on)
  - "Fanatik yo renmen tou" (Fans also like)
- **Lyrics editor:** "tape an mezi chante a ap jwe…", "Bouton Efase a anile dènye a".
- **Sound panel:** EQ presets "Plat", "Ton wo", "Ta lannwit", "Chalè kompa"; "Pi vit" / "Dousman + reverb"; "Kenbe ton orijinal la lè w chanje vitès".
- **Studio:** "7 dènye jou yo", "Vil ki koute plis", "Kote ekout yo soti".
- **Boost Board rules and payments:**
  - "Se dola ameriken won sèlman… pa tranch {step}"
  - "Peman yo final; nenpòt moun ka peye plis pase w"
  - "Nou pa debite okenn kat: peman yo se similasyon…"
  - "Se diferans lan sèlman ou peye"
- **Upload:** design names (boul, wonn, kadriyaj, de pati, melanj), "Pochèt" (cover art), "Koulè {n}" (palette).

## Français
- **Discover:** "Conçu pour vous" (Made for you), "Vos mix", "Tendances : {genre}".
- **Not-found pages:** the body "Il a peut-être été supprimé…" is masculine, which reads oddly under "Playlist".
- **Song menu:** "Lire ensuite" (Play next) and the toast "Lecture à suivre".
- **Sound panel:** "Neutre" (Flat), "Tard le soir" (Late night).
- **Studio:** "Évolution" (Change column), "Provenance des écoutes".
- **Boost Board:**
  - "Prenez la place #1 pour…": should it be "#1", "1re place" or "n° 1"?
  - « Dollars US entiers uniquement… par tranches de {step} »
  - « Vos paiements restent acquis à votre fiche »
  - « Aucune carte n’est débitée : les paiements sont simulés… »
- **Lyrics editor:** "Synchroniser", « tapez en rythme pendant la lecture… ».

## Known limits
- **Kreyòl formatting:** browsers have no Kreyòl locale data. Month and day names and "2 days ago" are written out in `src/i18n/index.ts`, and numbers use French formatting (1 234,5).
- **Server error messages** (rate limits, checkout failures) still come back in English from the API.
- **Text saved at creation time** stays in the language active when it was created: a playlist's default name ("My playlist") and an upload's default description.
