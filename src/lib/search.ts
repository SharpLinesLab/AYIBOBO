import { categoryById } from './categories';
import type { Listing, RankedEntry } from './types';

export interface SearchHit {
  listing: Listing;
  entry?: RankedEntry;
}

/** Rank listings for a query: title prefix > title/domain/tagline/category > description. Empty query = top spenders. */
export function searchListings(listings: Listing[], ranked: RankedEntry[], q: string, limit = 8): SearchHit[] {
  const byId = new Map(ranked.map((e) => [e.listing.id, e]));
  const query = q.trim().toLowerCase();
  return listings
    .map((l) => {
      if (!query) return { l, score: byId.get(l.id)?.total ?? 0 };
      const hay = [l.title, l.display, l.tagline, categoryById(l.category).label].join(' ').toLowerCase();
      let score = 0;
      if (l.title.toLowerCase().startsWith(query)) score += 100;
      if (hay.includes(query)) score += 50;
      if (l.description.toLowerCase().includes(query)) score += 10;
      return { l, score };
    })
    .filter((r) => r.score > 0 || !query)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({ listing: r.l, entry: byId.get(r.l.id) }));
}
