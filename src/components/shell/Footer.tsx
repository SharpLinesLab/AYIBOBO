import { BRAND, socialUrl } from '../../brand';
import { t } from '../../i18n';
import { LEGAL_PAGES } from '../../pages/legal/pages';
import { AsfLogo, FacebookIcon, InstagramIcon, XIcon, YoutubeIcon } from '../icons';

export function SocialLinks({ size = 20 }: { size?: number }) {
  const items = [
    { k: 'facebook' as const, label: 'Facebook', Icon: FacebookIcon },
    { k: 'instagram' as const, label: 'Instagram', Icon: InstagramIcon },
    { k: 'youtube' as const, label: 'YouTube', Icon: YoutubeIcon },
    { k: 'x' as const, label: 'X', Icon: XIcon },
  ];
  return (
    <span className="social">
      {items.map(({ k, label, Icon }) => (
        <a key={k} href={socialUrl(k)} target="_blank" rel="noopener noreferrer" aria-label={t('common.footer.socialOn', { brand: BRAND.short, network: label })} className="social__link">
          <Icon width={size} height={size} />
        </a>
      ))}
    </span>
  );
}

const LINKS = [
  { href: '#/', label: 'common.nav.discover' },
  { href: '#/trending', label: 'common.nav.trending' },
  { href: '#/charts', label: 'common.nav.charts' },
  { href: '#/genres', label: 'common.nav.genres' },
  { href: '#/account', label: 'common.nav.uploadMusic' },
  { href: '#/studio', label: 'common.nav.studio' },
  { href: '#/settings', label: 'common.nav.settings' },
] as const;

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__brand">
        <AsfLogo />
      </div>
      <nav className="footer__links" aria-label={t('common.footer.nav')}>
        {LINKS.map((l) => (
          <a key={l.href} href={l.href}>
            {t(l.label)}
          </a>
        ))}
        {BRAND.contactEmail && <a href={`mailto:${BRAND.contactEmail}`}>{t('common.footer.contact')}</a>}
      </nav>
      <nav className="footer__links footer__legal" aria-label={t('common.footer.legal')}>
        {LEGAL_PAGES.map((l) => (
          <a key={l.href} href={l.href}>
            {t(l.title)}
          </a>
        ))}
      </nav>
      <div className="footer__social">
        <SocialLinks size={18} />
      </div>
      <p className="footer__fine">{t('common.footer.rights', { year: new Date().getFullYear(), short: BRAND.short, name: BRAND.name })}</p>
    </footer>
  );
}
