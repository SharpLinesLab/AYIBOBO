/**
 * When the free tier hears an ad. A break is due after 4 songs or 15 minutes of listening since
 * the last one, whichever comes first, or sooner when someone skips more than 6 songs within an
 * hour. The player asks `due()` each time it moves to a new song, so an ad only ever plays between
 * songs, never in the middle of one.
 */
export const AD_RULES = {
  songs: 4,
  listenMs: 15 * 60_000,
  /** More skips than this within `skipWindowMs` makes a break due before the next song. */
  skips: 6,
  skipWindowMs: 60 * 60_000,
};

export class AdSchedule {
  private songs = 0;
  private listened = 0;
  private skips: number[] = [];

  /** A song started playing. */
  songStarted(): void {
    this.songs++;
  }

  /** `ms` more of a song was heard (not counting pauses or ads). */
  listen(ms: number): void {
    this.listened += Math.max(0, ms);
  }

  /** The listener skipped to the next song. */
  skipped(now = Date.now()): void {
    this.skips.push(now);
  }

  due(now = Date.now()): boolean {
    this.skips = this.skips.filter((t) => now - t < AD_RULES.skipWindowMs);
    return this.songs >= AD_RULES.songs || this.listened >= AD_RULES.listenMs || this.skips.length > AD_RULES.skips;
  }

  /** An ad break happened (or there was no ad to play): start counting again. */
  breakTaken(): void {
    this.songs = 0;
    this.listened = 0;
    this.skips = [];
  }
}
