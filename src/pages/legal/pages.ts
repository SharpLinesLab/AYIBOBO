import type { Key } from '../../i18n';

/** The legal pages, in footer order. Kept free of UI imports so the footer stays light. */
export const LEGAL_PAGES = [
  { page: 'privacy', href: '#/privacy', title: 'legal.privacy.title' },
  { page: 'terms', href: '#/terms', title: 'legal.terms.title' },
  { page: 'copyright', href: '#/copyright', title: 'legal.copyright.title' },
] as const satisfies readonly { page: string; href: string; title: Key }[];

export type LegalPageId = (typeof LEGAL_PAGES)[number]['page'];
