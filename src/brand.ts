/** Brand configuration for ASF — Ayiti Sakap Fet. Set the social URLs to your real profiles. */
export const BRAND = {
  short: 'ASF',
  name: 'Ayiti Sakap Fet',
  contactEmail: 'Contact@ayitisakapfet.com',
  social: {
    facebook: 'https://www.facebook.com/ayitisakapfet',
    instagram: 'https://www.instagram.com/Ayitisakapfet',
    youtube: 'https://www.youtube.com/@Ayitisakapfetmusic',
    x: 'https://x.com/ayitisakapfet',
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
