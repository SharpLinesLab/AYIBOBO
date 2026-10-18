/*
 * <!-- DRAFT FOR ATTORNEY REVIEW: these Terms of Service are a plain-language draft, not legal
 *      advice. Have a lawyer review them and fill in every [BRACKETED PLACEHOLDER] before ASF
 *      launches publicly. The text lives in src/i18n/locales/{en,fr,ht}/legal.ts. -->
 */
import { LegalPage, type LegalSection } from './LegalPage';

const SECTIONS: LegalSection[] = [
  { id: 'age', title: 'legal.terms.age.h', blocks: [{ p: 'legal.terms.age.p' }] },
  { id: 'use', title: 'legal.terms.use.h', blocks: [{ p: 'legal.terms.use.p' }] },
  {
    id: 'rules',
    title: 'legal.terms.rules.h',
    blocks: [{ p: 'legal.terms.rules.p' }, { ul: ['legal.terms.rules.li1', 'legal.terms.rules.li2', 'legal.terms.rules.li3', 'legal.terms.rules.li4', 'legal.terms.rules.li5'] }],
  },
  { id: 'uploads', title: 'legal.terms.uploads.h', blocks: [{ p: 'legal.terms.uploads.p' }, { p: 'legal.terms.uploads.p2' }, { p: 'legal.terms.uploads.p3' }] },
  { id: 'ours', title: 'legal.terms.ours.h', blocks: [{ p: 'legal.terms.ours.p' }] },
  { id: 'as-is', title: 'legal.terms.asIs.h', blocks: [{ p: 'legal.terms.asIs.p' }] },
  { id: 'liability', title: 'legal.terms.liability.h', blocks: [{ p: 'legal.terms.liability.p' }] },
  { id: 'ending', title: 'legal.terms.ending.h', blocks: [{ p: 'legal.terms.ending.p' }] },
  { id: 'law', title: 'legal.terms.law.h', blocks: [{ p: 'legal.terms.law.p' }] },
  { id: 'changes', title: 'legal.terms.changes.h', blocks: [{ p: 'legal.terms.changes.p' }] },
  { id: 'contact', title: 'legal.terms.contact.h', blocks: [{ p: 'legal.terms.contact.p' }] },
];

export function TermsPage() {
  return <LegalPage id="terms" intro="legal.terms.intro" sections={SECTIONS} />;
}
