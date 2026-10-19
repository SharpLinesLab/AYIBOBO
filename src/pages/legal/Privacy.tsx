/*
 * <!-- DRAFT FOR ATTORNEY REVIEW: this Privacy Policy is a plain-language draft, not legal advice.
 *      Have a lawyer review it and fill in every [BRACKETED PLACEHOLDER] before ASF launches
 *      publicly. The text lives in src/i18n/locales/{en,fr,ht}/legal.ts. -->
 */
import { LegalPage, type LegalSection } from './LegalPage';

const SECTIONS: LegalSection[] = [
  { id: 'short', title: 'legal.privacy.short.h', blocks: [{ ul: ['legal.privacy.short.li1', 'legal.privacy.short.li2', 'legal.privacy.short.li3', 'legal.privacy.short.li4'] }] },
  {
    id: 'device',
    title: 'legal.privacy.device.h',
    blocks: [
      { p: 'legal.privacy.device.p' },
      { ul: ['legal.privacy.device.li1', 'legal.privacy.device.li2', 'legal.privacy.device.li3', 'legal.privacy.device.li4', 'legal.privacy.device.li5'] },
      { p: 'legal.privacy.device.p2' },
      { p: 'legal.privacy.device.p3' },
    ],
  },
  {
    id: 'account',
    title: 'legal.privacy.account.h',
    blocks: [
      { p: 'legal.privacy.account.p' },
      { ul: ['legal.privacy.account.li1', 'legal.privacy.account.li2', 'legal.privacy.account.li3', 'legal.privacy.account.li4'] },
      { p: 'legal.privacy.account.p2' },
      { p: 'legal.privacy.account.p3' },
    ],
  },
  {
    id: 'sync',
    title: 'legal.privacy.sync.h',
    blocks: [
      { p: 'legal.privacy.sync.p' },
      { ul: ['legal.privacy.sync.li1', 'legal.privacy.sync.li2', 'legal.privacy.sync.li3', 'legal.privacy.sync.li4'] },
      { p: 'legal.privacy.sync.p2' },
      { p: 'legal.privacy.sync.p3' },
    ],
  },
  { id: 'reset', title: 'legal.privacy.reset.h', blocks: [{ p: 'legal.privacy.reset.p' }, { p: 'legal.privacy.reset.p2' }] },
  { id: 'uploads', title: 'legal.privacy.uploads.h', blocks: [{ p: 'legal.privacy.uploads.p' }, { p: 'legal.privacy.uploads.p2' }, { p: 'legal.privacy.uploads.p3' }] },
  { id: 'newsletter', title: 'legal.privacy.newsletter.h', blocks: [{ p: 'legal.privacy.newsletter.p' }, { p: 'legal.privacy.newsletter.p2' }] },
  { id: 'logs', title: 'legal.privacy.logs.h', blocks: [{ p: 'legal.privacy.logs.p' }, { p: 'legal.privacy.logs.p2' }] },
  { id: 'ads', title: 'legal.privacy.ads.h', blocks: [{ p: 'legal.privacy.ads.p' }, { p: 'legal.privacy.ads.p2' }, { p: 'legal.privacy.ads.p3' }] },
  {
    id: 'not-collected',
    title: 'legal.privacy.notCollected.h',
    blocks: [{ ul: ['legal.privacy.notCollected.li1', 'legal.privacy.notCollected.li2', 'legal.privacy.notCollected.li3', 'legal.privacy.notCollected.li4', 'legal.privacy.notCollected.li5'] }],
  },
  { id: 'sharing', title: 'legal.privacy.sharing.h', blocks: [{ p: 'legal.privacy.sharing.p' }, { p: 'legal.privacy.sharing.p2' }] },
  { id: 'children', title: 'legal.privacy.children.h', blocks: [{ p: 'legal.privacy.children.p' }] },
  {
    id: 'rights',
    title: 'legal.privacy.rights.h',
    blocks: [
      { p: 'legal.privacy.rights.p' },
      { ul: ['legal.privacy.rights.li1', 'legal.privacy.rights.li2', 'legal.privacy.rights.li3'] },
      { p: 'legal.privacy.rights.p2' },
      { p: 'legal.privacy.rights.p3' },
      { p: 'legal.privacy.rights.p4' },
    ],
  },
  { id: 'changes', title: 'legal.privacy.changes.h', blocks: [{ p: 'legal.privacy.changes.p' }] },
  { id: 'contact', title: 'legal.privacy.contact.h', blocks: [{ p: 'legal.privacy.contact.p' }] },
];

export function PrivacyPage() {
  return <LegalPage id="privacy" intro="legal.privacy.intro" sections={SECTIONS} />;
}
