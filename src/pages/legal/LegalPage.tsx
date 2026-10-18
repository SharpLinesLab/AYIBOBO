import { t, type Key } from '../../i18n';
import { PageHead } from '../Browse';
import { LEGAL_PAGES, type LegalPageId } from './pages';

/** A paragraph or a bulleted list. */
export type LegalBlock = { p: Key } | { ul: Key[] };

export interface LegalSection {
  id: string;
  title: Key;
  blocks: LegalBlock[];
}

/** Shared layout for the legal pages: short headed sections in a readable column. */
export function LegalPage({ id, intro, sections }: { id: LegalPageId; intro: Key; sections: LegalSection[] }) {
  const current = LEGAL_PAGES.find((p) => p.page === id)!;
  const others = LEGAL_PAGES.filter((p) => p.page !== id);
  return (
    <div className="page-music legal">
      <PageHead kicker={t('legal.kicker')} title={t(current.title)} sub={t('legal.effective')} />
      <article className="legal__body">
        <p className="legal__intro">{t(intro)}</p>
        {sections.map((s) => (
          <section key={s.id} aria-labelledby={`legal-${s.id}`}>
            <h2 id={`legal-${s.id}`}>{t(s.title)}</h2>
            {s.blocks.map((b, i) =>
              'p' in b ? (
                <p key={i}>{t(b.p)}</p>
              ) : (
                <ul key={i}>
                  {b.ul.map((k) => (
                    <li key={k}>{t(k)}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </article>
      {others.length > 0 && (
        <nav className="legal__related" aria-label={t('legal.related')}>
          <h2>{t('legal.related')}</h2>
          {others.map((p) => (
            <a key={p.href} href={p.href}>
              {t(p.title)}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
