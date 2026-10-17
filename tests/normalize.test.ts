import { describe, expect, it } from 'vitest';
import { normalizeInput, resolveAndNormalize } from '../src/lib/normalize';

const key = (raw: string) => {
  const r = normalizeInput(raw);
  if (!r.ok) throw new Error(`${raw}: ${r.error}`);
  return r.key;
};
const code = (raw: string) => {
  const r = normalizeInput(raw);
  return r.ok ? 'ok' : r.code;
};

describe('normalizeInput', () => {
  it('keys ordinary sites by domain and strips tracking', () => {
    expect(key('https://www.StemForge.ai/pricing?utm_source=x&ref=abc#top')).toBe('stemforge.ai');
    expect(key('stemforge.ai')).toBe('stemforge.ai');
    expect(key('http://m.stemforge.ai/')).toBe('stemforge.ai');
    const r = normalizeInput('https://stemforge.ai/tools/split?utm_medium=email&si=1');
    expect(r.ok && r.url).toBe('https://stemforge.ai/tools/split');
  });

  it('keys multi-tenant music platforms by tenant path', () => {
    expect(key('https://nightbus.bandcamp.com/')).toBe('nightbus.bandcamp.com');
    expect(key('https://nightbus.bandcamp.com/album/sodium-lights?from=embed')).toBe('nightbus.bandcamp.com/album/sodium-lights');
    expect(key('bandcamp.com/nightbus')).toBe('bandcamp.com/nightbus');
    expect(key('https://open.spotify.com/artist/4Zq8MaraOkoyeDemo01x?si=abc123')).toBe('open.spotify.com/artist/4Zq8MaraOkoyeDemo01x');
    expect(key('https://open.spotify.com/intl-de/album/1AbC?si=1')).toBe('open.spotify.com/album/1AbC');
    expect(key('https://soundcloud.com/KaiMori')).toBe('soundcloud.com/kaimori');
    expect(key('https://soundcloud.com/kaimori/tracks')).toBe('soundcloud.com/kaimori');
    expect(key('https://soundcloud.com/kaimori/night-drive?utm_source=clipboard')).toBe('soundcloud.com/kaimori/night-drive');
    expect(key('https://soundcloud.com/kaimori/sets/summer-edits')).toBe('soundcloud.com/kaimori/sets/summer-edits');
    expect(key('https://splice.com/sounds/packs/grainfield/dusty-keys/samples')).toBe('splice.com/sounds/packs/grainfield/dusty-keys');
    expect(key('https://gumroad.com/l/halcyonverb?wanted=true')).toBe('gumroad.com/l/halcyonverb');
    expect(key('https://halcyon.gumroad.com/l/verb')).toBe('halcyon.gumroad.com/l/verb');
    expect(key('https://music.apple.com/us/album/harmattan/1234567')).toBe('music.apple.com/album/1234567');
    expect(key('https://youtu.be/dQw4w9WgXcQ?si=xyz')).toBe('youtube.com/watch?v=dQw4w9WgXcQ');
    expect(key('https://www.youtube.com/@kaimori/videos')).toBe('youtube.com/@kaimori');
    expect(key('https://twitter.com/kaimori/status/1')).toBe('x.com/kaimori');
  });

  it('separates tenants on the same shared domain', () => {
    expect(key('soundcloud.com/artist-a')).not.toBe(key('soundcloud.com/artist-b'));
    expect(key('a.bandcamp.com')).not.toBe(key('b.bandcamp.com'));
  });

  it('accepts @handles', () => {
    const r = normalizeInput('@KaiMori');
    expect(r.ok && r.key).toBe('@kaimori');
    expect(r.ok && r.kind).toBe('handle');
    expect(code('@a')).toBe('invalid');
  });

  it('blocks private invites and NSFW', () => {
    expect(code('https://discord.gg/abc')).toBe('blocked_invite');
    expect(code('discord.com/invite/abc')).toBe('blocked_invite');
    expect(code('https://discord.com/')).toBe('ok');
    expect(code('t.me/joinchat/xyz')).toBe('blocked_invite');
    expect(code('https://chat.whatsapp.com/AbC')).toBe('blocked_invite');
    expect(code('wa.me/123')).toBe('blocked_invite');
    expect(code('onlyfans.com/someone')).toBe('blocked_nsfw');
    expect(code('free-porn-beats.com')).toBe('blocked_nsfw');
    expect(code('beats.xxx')).toBe('blocked_nsfw');
    expect(code('essexsound.com')).toBe('ok');
  });

  it('rejects invalid input', () => {
    expect(code('')).toBe('empty');
    expect(code('not a url')).toBe('invalid');
    expect(code('ftp://files.example.com')).toBe('invalid');
    expect(code('localhost:3000')).toBe('invalid');
    expect(code('http://192.168.0.1')).toBe('invalid');
  });

  it('flags shorteners and resolves them', async () => {
    expect(code('https://bit.ly/3abc')).toBe('shortener');
    const resolver = async (u: string) =>
      u.includes('bit.ly') ? 'https://ffm.to/x' : u.includes('ffm.to') ? 'https://open.spotify.com/album/9Xy?si=q' : u;
    const r = await resolveAndNormalize('bit.ly/3abc', resolver);
    expect(r.ok && r.key).toBe('open.spotify.com/album/9Xy');
    const noResolver = await resolveAndNormalize('bit.ly/3abc');
    expect(noResolver.ok).toBe(false);
    const lt = await resolveAndNormalize('https://linktr.ee/KaiMori', async (u) => u);
    expect(lt.ok && lt.key).toBe('linktr.ee/kaimori');
  });
});
