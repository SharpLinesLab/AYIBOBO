/*
 * <!-- DRAFT FOR ATTORNEY REVIEW: this Copyright / DMCA Policy is a plain-language draft, not legal
 *      advice. Have a lawyer review it, register the designated agent with the U.S. Copyright
 *      Office, and fill in every [BRACKETED PLACEHOLDER] before ASF launches publicly. The text
 *      lives in src/i18n/locales/{en,fr,ht}/legal.ts. -->
 */
import { LegalPage, type LegalSection } from './LegalPage';

const SECTIONS: LegalSection[] = [
  {
    id: 'report',
    title: 'legal.copyright.report.h',
    blocks: [{ p: 'legal.copyright.report.p' }, { ul: ['legal.copyright.report.li1', 'legal.copyright.report.li2', 'legal.copyright.report.li3'] }],
  },
  {
    id: 'notice',
    title: 'legal.copyright.notice.h',
    blocks: [
      {
        ul: [
          'legal.copyright.notice.li1',
          'legal.copyright.notice.li2',
          'legal.copyright.notice.li3',
          'legal.copyright.notice.li4',
          'legal.copyright.notice.li5',
          'legal.copyright.notice.li6',
        ],
      },
      { p: 'legal.copyright.notice.p' },
    ],
  },
  { id: 'next', title: 'legal.copyright.next.h', blocks: [{ p: 'legal.copyright.next.p' }] },
  {
    id: 'counter',
    title: 'legal.copyright.counter.h',
    blocks: [
      { p: 'legal.copyright.counter.p' },
      { ul: ['legal.copyright.counter.li1', 'legal.copyright.counter.li2', 'legal.copyright.counter.li3', 'legal.copyright.counter.li4'] },
      { p: 'legal.copyright.counter.p2' },
    ],
  },
  { id: 'repeat', title: 'legal.copyright.repeat.h', blocks: [{ p: 'legal.copyright.repeat.p' }] },
  { id: 'today', title: 'legal.copyright.today.h', blocks: [{ p: 'legal.copyright.today.p' }] },
  { id: 'contact', title: 'legal.copyright.contact.h', blocks: [{ p: 'legal.copyright.contact.p' }] },
];

export function CopyrightPage() {
  return <LegalPage id="copyright" intro="legal.copyright.intro" sections={SECTIONS} />;
}
