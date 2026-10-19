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

  it('render every legal string somewhere, in every language', async () => {
    for (const [lang, d] of LANGS) {
      await setLang(lang, false);
      const html = PAGES.map(([, Page]) => renderToStaticMarkup(createElement(Page))).join('');
      for (const k of Object.keys(d).filter((x) => x.startsWith('legal.'))) expect(html, `${lang} ${k} is never shown`).toContain(escape(lang, k));
    }
  });

  it('describe the audio ads, their play log and the listener id, with no leftover "no ads" claims', () => {
    for (const [lang, d] of LANGS) {
      for (const k of ['legal.privacy.ads.h', 'legal.privacy.ads.p', 'legal.privacy.ads.p2', 'legal.privacy.ads.p3', 'legal.privacy.device.li5']) expect(d[k], `${lang} ${k}`).toBeTruthy();
      expect(d['legal.privacy.ads.p2'], lang).toMatch(/\b3\b/); // the daily cap
      expect(d['legal.privacy.ads.p'], lang).toMatch(/\b30\b/); // the longest ad
    }
    expect(en['legal.privacy.ads.p2']).toMatch(/random listener ID.*hashed version of your IP address/s);
    expect(en['legal.privacy.logs.p2']).toMatch(/hashed/);
    for (const [lang, d] of LANGS) expect(d['legal.privacy.short.li4'], lang).not.toMatch(/show ads|n’affichons pas de publicité|pa montre piblisite/);
  });

  it('describe the accounts that now exist, with no leftover "no accounts" claims', () => {
    for (const [lang, d] of LANGS) {
      const all = Object.entries(d)
        .filter(([k]) => k.startsWith('legal.privacy.') || k.startsWith('legal.terms.'))
        .map(([, v]) => v)
        .join('\n');
      // The pre-accounts drafts said these; they are false now.
      for (const stale of ['has no sign-up', 'only personal information we store is your email address', 'uploads are stored only in your own browser', 'n’a pas d’inscription', 'ne demande aucune inscription', 'Pa gen enskripsyon sou ASF']) expect(all, `${lang}: ${stale}`).not.toContain(stale);
      expect(all, lang).toContain('bcrypt');
      expect(all, lang).toContain('Contact@ayitisakapfet.com');
      expect(all, lang).toContain('Ayitisakapfet LLC');
      expect(all, lang).toMatch(/\b13\b/);
      expect(all, lang).toMatch(/\b30\b/); // the sign-in cookie's lifetime
    }
    // Every topic has its own section on the page.
    for (const k of ['account', 'sync', 'reset', 'uploads', 'rights']) expect(en[`legal.privacy.${k}.h` as keyof typeof en], k).toBeTruthy();
    for (const k of ['account', 'security', 'uploads']) expect(en[`legal.terms.${k}.h` as keyof typeof en], k).toBeTruthy();
    expect(en['legal.privacy.reset.p']).toMatch(/once.*1 hour.*hashed.*every device/s);
    expect(en['legal.privacy.uploads.p2']).toMatch(/only moderators/);
    expect(en['legal.privacy.rights.p2']).toMatch(/email address, display name and password hash.*synced library.*every song/s);
    expect(en['legal.terms.uploads.p3']).toMatch(/non-exclusive, worldwide, royalty-free licence to host, store, copy, stream and display/);
    expect(en['legal.terms.uploads.p3']).toMatch(/keep ownership/);
    // The Copyright Policy describes published artist uploads too (no more "stays in their own browser").
    for (const [lang, d] of LANGS) expect(d['legal.copyright.today.p'], lang).not.toMatch(/browser|navigateur|navigatè/);
    expect(en['legal.copyright.today.p']).toMatch(/stored on our servers.*only our moderators.*published publicly.*deleted/s);
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
