import type { GenreId } from './types';

export interface Genre {
  id: GenreId;
  label: string;
  blurb: string;
  /** Gradient used for genre tiles. */
  colors: [string, string];
}

export const GENRES: Genre[] = [
  { id: 'kompa', label: 'Kompa', blurb: 'Haiti’s heartbeat — guitars, cowbell and that steady two-step.', colors: ['#0f766e', '#2ed573'] },
  { id: 'rap-kreyol', label: 'Rap Kreyòl', blurb: 'Bars in Kreyòl over hard 808s.', colors: ['#7f1d1d', '#f97316'] },
  { id: 'afrobeats', label: 'Afrobeats', blurb: 'Log drums, shakers and sunshine melodies.', colors: ['#a16207', '#facc15'] },
  { id: 'amapiano', label: 'Amapiano', blurb: 'Deep log-drum bass and soulful keys.', colors: ['#4c1d95', '#a78bfa'] },
  { id: 'dancehall', label: 'Dancehall', blurb: 'Riddims built for the session.', colors: ['#14532d', '#eab308'] },
  { id: 'hip-hop', label: 'Hip-Hop', blurb: 'Boom-bap to trap — the culture.', colors: ['#1f2937', '#9ca3af'] },
  { id: 'drill', label: 'Drill', blurb: 'Sliding 808s and dark melodies.', colors: ['#0f172a', '#3b82f6'] },
  { id: 'rnb', label: 'R&B', blurb: 'Smooth keys, late nights.', colors: ['#831843', '#f472b6'] },
  { id: 'zouk', label: 'Zouk', blurb: 'Caribbean romance in every bar.', colors: ['#9f1239', '#fb7185'] },
  { id: 'reggae', label: 'Reggae', blurb: 'One drop, roots and culture.', colors: ['#166534', '#dc2626'] },
  { id: 'gospel', label: 'Gospel', blurb: 'Praise, choirs and organ.', colors: ['#78350f', '#fde68a'] },
  { id: 'rara', label: 'Rara', blurb: 'Street processions, vaksin and kata.', colors: ['#9a3412', '#fdba74'] },
  { id: 'electronic', label: 'Electronic', blurb: 'Club cuts and future sounds.', colors: ['#1e1b4b', '#22d3ee'] },
];

const BY_ID = new Map(GENRES.map((g) => [g.id, g]));

export function genreById(id: GenreId): Genre {
  return BY_ID.get(id) ?? GENRES[0];
}

export function isGenreId(v: unknown): v is GenreId {
  return typeof v === 'string' && BY_ID.has(v as GenreId);
}
