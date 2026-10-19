import { useState } from 'react';
import { t, type Key } from '../i18n';
import { saveArtistProfile, uploadArtistPicture, useAccount, type ProfileError } from '../lib/account';
import { CATALOG_CHANGED } from '../lib/serverCatalog';
import { useApp } from '../store';

/** On #/account for artists: the name songs are credited to by default, a picture and a bio. */
export function ArtistProfile() {
  const { toast } = useApp();
  const { user } = useAccount();
  // The artist name starts as the display name until the artist sets their own.
  const [name, setName] = useState(user?.artistName ?? user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [error, setError] = useState<ProfileError | null>(null);
  const [busy, setBusy] = useState(false);
  const [pictureBusy, setPictureBusy] = useState(false);
  if (!user) return null;
  const shownName = user.artistName ?? user.displayName;

  // The artist page reads the profile from the catalog, so open pages refresh it.
  const done = (key: Key) => {
    toast(t(key));
    window.dispatchEvent(new Event(CATALOG_CHANGED));
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    const r = await saveArtistProfile({ artistName: name.trim(), bio: bio.trim() });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    done('account.profile.saved');
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPictureBusy(true);
    setError(null);
    const r = await uploadArtistPicture(file);
    setPictureBusy(false);
    if (!r.ok) return setError(r.error);
    done('account.profile.pictureSaved');
  };

  return (
    <section className="card-panel account__panel" aria-labelledby="artist-profile-title">
      <h2 className="panel-title" id="artist-profile-title">
        {t('account.profile.title')}
      </h2>
      <p className="muted">{t('account.profile.intro')}</p>
      <div className="account__picture">
        {user.avatarUrl ? (
          <img className="account__avatar" src={user.avatarUrl} alt={t('account.profile.pictureOf', { name: shownName })} width={72} height={72} />
        ) : (
          <span className="studio__me" aria-hidden>
            {shownName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <label className="field">
          {t(user.avatarUrl ? 'account.profile.changePicture' : 'account.profile.picture')}
          <input className="input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={pictureBusy} onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="field">
          {t('account.profile.name')}
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={user.displayName} />
        </label>
        <p className="muted account__fine">{t('account.profile.nameHint')}</p>
        <label className="field">
          {t('account.profile.bio')}
          <textarea className="input" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} />
        </label>
        {error && (
          <div className="notice notice--error" role="alert">
            {t(`account.profile.error.${error}` as Key)}
          </div>
        )}
        <button className="cta cta--solid" type="submit" disabled={busy}>
          {busy ? t('account.busy') : t('account.profile.save')}
        </button>
      </form>
    </section>
  );
}
