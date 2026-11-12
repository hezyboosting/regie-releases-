import { el, tag, setVars, rgba, PLATFORM, isPreview } from '../lib.js';

const EVENT_TEXT = {
  follow: (e) => `${e.user.display} suit la chaîne`, sub: (e) => `${e.user.display} s'abonne`, resub: (e) => `${e.user.display} se réabonne (${e.months} mois)`,
  giftsub: (e) => `${e.user.display} offre ${e.amount} abonnements`, bits: (e) => `${e.user.display} envoie ${e.amount} bits`, raid: (e) => `Raid de ${e.user.display} avec ${e.amount} personnes`,
  gift: (e) => `${e.user.display} envoie ${e.amount} × ${e.gift?.name}`, superchat: (e) => `${e.user.display} envoie ${e.money}`, supersticker: (e) => `${e.user.display} envoie ${e.money}`,
  member: (e) => `${e.user.display} devient membre`, share: (e) => `${e.user.display} partage le live`, superfan: (e) => `${e.user.display} devient Super Fan`,
};

const DEMO = [
  { platform: 'twitch', type: 'chat', user: { display: 'Marius' }, text: 'Bien joué pour la dernière manche' },
  { platform: 'tiktok', type: 'chat', user: { display: 'kenza.live' }, text: 'Salut depuis TikTok' },
  { platform: 'youtube', type: 'chat', user: { display: 'Nolan' }, text: 'Il reste combien de temps ?' },
];

export function mount(root) {
  let s = {};
  const blockedWords = () => String(s.blocked || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

  const add = (e) => {
    const isChat = e.type === 'chat';
    if (!isChat && (!s.events || !EVENT_TEXT[e.type])) return;
    if (isChat && s.hideCommands && String(e.text || '').startsWith('!')) return;
    if (isChat && blockedWords().some((w) => String(e.text || '').toLowerCase().includes(w))) return;
    const hl = isChat && s.highlight && (e.user?.mod || e.user?.owner || e.user?.sub || e.user?.vip);
    const row = el('div', `msg${isChat ? '' : ' event'}${hl ? ' hl' : ''}`);
    row.style.setProperty('--pf', PLATFORM[e.platform]?.color || '#F0392B');
    if (s.platformTag && PLATFORM[e.platform]) row.append(tag(e.platform));
    if (s.avatar && e.user?.avatar) { const i = el('img'); i.src = e.user.avatar; i.alt = ''; i.referrerPolicy = 'no-referrer'; row.append(i); }
    if (isChat) {
      if (s.badges) {
        const b = e.user?.owner ? 'Live' : e.user?.mod ? 'Modo' : e.user?.vip ? 'VIP' : e.user?.sub ? 'Abo' : '';
        if (b) row.append(el('span', 'bdg', b));
      }
      const who = el('span', 'who', e.user?.display || '');
      if (e.color) who.style.color = e.color;
      row.append(who, el('span', 'txt', e.text));
    } else row.append(el('span', 'txt', EVENT_TEXT[e.type](e)));
    root.append(row);
    while (root.children.length > s.maxLines) root.firstChild.remove();
    if (s.fade > 0) setTimeout(() => { row.classList.add('gone'); setTimeout(() => row.remove(), 700); }, s.fade * 1000);
  };
  return {
    update(settings, data) {
      const fresh = !s.theme;
      s = settings;
      root.className = `type-chat ${s.theme}`;
      setVars(root, { size: `${s.fontSize}px`, text: s.text, name: s.nameColor, back: rgba('#14181D', s.bgAlpha / 100) });
      if (fresh) {
        (data?.backlog || []).slice(-s.maxLines).forEach(add);
        if (isPreview && !root.children.length) DEMO.forEach(add);
      }
    },
    on(msg) { if (msg.t === 'ev') add(msg.ev); },
  };
}
