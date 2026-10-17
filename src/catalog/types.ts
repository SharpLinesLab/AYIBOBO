export type GenreId =
  | 'kompa'
  | 'rap-kreyol'
  | 'afrobeats'
  | 'amapiano'
  | 'dancehall'
  | 'hip-hop'
  | 'drill'
  | 'rnb'
  | 'zouk'
  | 'reggae'
  | 'gospel'
  | 'rara'
  | 'electronic';

export type CoverTemplate = 'orb' | 'sun' | 'rings' | 'waves' | 'grid' | 'type' | 'split';

export interface CoverSpec {
  template: CoverTemplate;
  palette: [string, string, string];
  seed: number;
  /** Optional typography printed on the cover. */
  text?: string;
  subtext?: string;
}

export interface Artist {
  id: string;
  name: string;
  handle: string;
  bio: string;
  location: string;
  genres: GenreId[];
  verified: boolean;
  /** Baseline follower count (local follows are added on top). */
  followers: number;
  avatar: CoverSpec;
  banner: CoverSpec;
}

export interface SynthRecipe {
  genre: GenreId;
  bpm: number;
  /** MIDI root note. */
  root: number;
  seed: number;
  scale: 'minor' | 'major';
  /** `loop` = short preview that stays in the hook section (no intro/outro). */
  form?: 'song' | 'loop';
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  featuring?: string[];
  albumId?: string;
  genre: GenreId;
  /** Seconds. */
  duration: number;
  recipe: SynthRecipe;
  /** Popularity weight driving the synthetic play history. */
  popularity: number;
  releasedAt: number;
  cover: CoverSpec;
  explicit: boolean;
  description: string;
  lyrics?: string;
  /** Uploaded tracks play a real file instead of the synth recipe. */
  audioUrl?: string;
  uploaded?: boolean;
  /** Normalized waveform peaks (0..1) for uploaded audio. */
  peaks?: number[];
}

export interface Album {
  id: string;
  title: string;
  artistId: string;
  type: 'album' | 'ep' | 'mixtape';
  trackIds: string[];
  releasedAt: number;
  cover: CoverSpec;
  description: string;
}

export interface Playlist {
  id: string;
  title: string;
  curator: string;
  description: string;
  trackIds: string[];
  cover: CoverSpec;
  followers: number;
  editorial: boolean;
  /** User-created playlists live in the local library. */
  owned?: boolean;
}

export interface Catalog {
  artists: Artist[];
  tracks: Track[];
  albums: Album[];
  playlists: Playlist[];
}
