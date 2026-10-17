/** Brand configuration for ASF — Ayiti Sakap Fet. Set the social URLs to your real profiles. */
export const BRAND = {
  short: 'ASF',
  name: 'Ayiti Sakap Fet',
  product: 'ASF Charts',
  tagline: 'No algorithms, no playlist gatekeepers, no ad networks. Claim a rank on the public music leaderboard — rank is strictly what you pay.',
  contactEmail: '',
  social: {
    facebook: '',
    instagram: '',
    youtube: '',
    x: '',
  },
};

const PLATFORM_HOME: Record<keyof typeof BRAND.social, string> = {
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  youtube: 'https://www.youtube.com/',
  x: 'https://x.com/',
};

/** Configured profile URL, or the platform home page until one is set. */
export function socialUrl(k: keyof typeof BRAND.social): string {
  return BRAND.social[k] || PLATFORM_HOME[k];
}
