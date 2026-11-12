import { el, media, playSound, setVars, PLATFORM, isPreview, avatar } from '../lib.js';

export function mount(root) {
  let s = {};
  let current = null;
  let outTimer = null;
  let lastTheme = '';

  const show = (a) => {
    clear();
    const theme = ['verre', 'carte', 'minimal'].includes(a.theme) ? a.theme : s.theme;
    const box = el('div', `al ${theme}`);
    root.className = `type-alerts ${a.position || s.position}`;
    const usePf = s.platformColor && PLATFORM[a.platform];
    if (usePf) box.style.setProperty('--accent', PLATFORM[a.platform].color);
    const title = el('div', 'al-title', a.title);
    const body = el('div', 'al-body');
    body.append(title);
    if (a.text) body.append(el('div', 'al-text', a.text));
    let pic = null;
    if (/\.(mp4|webm)$/i.test(a.image || '')) {
      pic = el('video', 'al-img');
      pic.src = media(a.image);
      pic.autoplay = true; pic.muted = true; pic.playsInline = true;
    } else if (a.image) { pic = el('img', 'al-img'); pic.src = media(a.image); pic.alt = ''; } else if (s.avatar) pic = avatar(a.avatar, a.user, 'al-av');
    if (pic && pic.tagName === 'IMG') pic.referrerPolicy = 'no-referrer';
    if (pic) box.append(pic);
    box.append(body);
    root.append(box);
    current = box;
    playSound(a.sound, a.volume, s.volume);
    outTimer = setTimeout(() => {
      box.classList.add('out');
      setTimeout(() => box.remove(), 600);
    }, Math.max(1, a.duration - 0.5) * 1000);
  };

  const clear = () => { clearTimeout(outTimer); current?.remove(); current = null; };

  return {
    update(settings) {
      s = settings;
      root.className = `type-alerts ${s.position}`;
      setVars(root, { accent: s.accent, bg: s.bg, text: s.text });
      if (isPreview && (!current || lastTheme !== s.theme)) show({ platform: 'twitch', user: 'Lena', title: 'Lena suit la chaîne', text: '', image: '', avatar: '', sound: 'none', duration: 3600 });
      lastTheme = s.theme;
    },
    on(msg) {
      if (msg.t === 'alert') show(msg.alert);
      if (msg.t === 'alertSkip') clear();
    },
  };
}
