import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Footer } from '../src/components/shell/Footer';
import { setLang, type Lang } from '../src/i18n';
import { dict as en } from '../src/i18n/locales/en';
import { dict as fr } from '../src/i18n/locales/fr';
import { dict as ht } from '../src/i18n/locales/ht';
import { PrivacyPage } from '../src/pages/legal/Privacy';
import { TermsPage } from '../src/pages/legal/Terms';
import { CopyrightPage } from '../src/pages/legal/Copyright';
import { LEGAL_PAGES } from '../src/pages/legal/pages';
import { parseRoute } from '../src/store';

const PAGES: [string, ComponentType][] = [
  ['privacy', PrivacyPage],
  ['terms', TermsPage],
  ['copyright', CopyrightPage],
];
const LANGS: [Lang, Record<string, string>][] = [
  ['en', en],
  ['fr', fr],
  ['ht', ht],
];
const placeholders = (s: string) => (s.match(/\[[A-Z][A-Z ]*\]/g) ?? []).sort();

// setLang marks <html lang>; the unit tests run without a DOM.
beforeAll(() => {
  (globalThis as { document?: unknown }).document = { documentElement: {} };
});
afterAll(() => setLang('en', false));

describe('legal pages', () => {
  it('each has its own route', () => {
    for (const [page] of PAGES) expect(parseRoute(`#/${page}`)).toEqual({ page });
    expect(LEGAL_PAGES.map((p) => p.page)).toEqual(PAGES.map(([p]) => p));
  });

  it('every string is translated and keeps the same placeholders', () => {
    const keys = Object.keys(en).filter((k) => k.startsWith('legal.'));
    expect(keys.length).toBeGreaterThan(0);
    for (const [lang, d] of LANGS) {
      for (const k of keys) {
        expect(d[k]?.trim(), `${lang} ${k}`).toBeTruthy();
        expect(placeholders(d[k]), `${lang} ${k}`).toEqual(placeholders(en[k as keyof typeof en]));
        if (lang !== 'en' && !/^(Contact|Newsletter)$/.test(en[k as keyof typeof en])) expect(d[k], `${lang} ${k} is untranslated`).not.toBe(en[k as keyof typeof en]);
      }
    }
  });

  for (const [lang] of LANGS) {
    it(`render in ${lang} with no missing keys`, async () => {
      await setLang(lang, false);
      for (const [page, Page] of PAGES) {
        const html = renderToStaticMarkup(createElement(Page));
        expect(html, page).not.toMatch(/legal\.[a-z]/);
        expect(html).toContain(`<h1>${escape(lang, LEGAL_PAGES.find((p) => p.page === page)!.title)}</h1>`);
      }
    });

    it(`footer links to every legal page in ${lang}`, async () => {
      await setLang(lang, false);
      const html = renderToStaticMarkup(createElement(Footer));
      for (const p of LEGAL_PAGES) expect(html).toContain(`href="${p.href}"`);
      expect(html).not.toMatch(/(legal|common)\.[a-z]+\.[a-z]/);
    });
  }
});

/** A dictionary string as React prints it in HTML. */
function escape(lang: Lang, key: string): string {
  const s = Object.fromEntries(LANGS)[lang][key];
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
