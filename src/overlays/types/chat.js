import { el, tag, setVars, rgba, PLATFORM, isPreview, avatar } from '../lib.js';

const EVENT_TEXT = {
  follow: (e) => `${e.user.display} suit la chaîne`, sub: (e) => `${e.user.display} s'abonne`, resub: (e) => (e.months ? `${e.user.display} se réabonne (${e.months} mois)` : `${e.user.display} se réabonne`),
  giftsub: (e) => `${e.user.display} offre ${e.amount || 1} abonnements`, bits: (e) => `${e.user.display} envoie ${e.amount || 0} bits`, raid: (e) => `Raid de ${e.user.display} avec ${e.amount || 0} personnes`,
  gift: (e) => ((e.amount || 1) > 1 ? `${e.user.display} envoie ${e.amount} × ${e.gift?.name || 'un cadeau'}` : `${e.user.display} envoie ${e.gift?.name || 'un cadeau'}`), superchat: (e) => `${e.user.display} envoie ${e.money}`, supersticker: (e) => `${e.user.display} envoie ${e.money}`,
  member: (e) => `${e.user.display} devient membre`, share: (e) => `${e.user.display} partage le live`, superfan: (e) => `${e.user.display} devient Super Fan`,
};

const DEMO = [
  { platform: 'twitch', type: 'chat', user: { display: 'Marius', sub: true }, color: '#8FD3FF', text: 'Bien joué pour la dernière manche' },
  { platform: 'tiktok', type: 'follow', user: { display: 'Lena' } },
  { platform: 'tiktok', type: 'chat', user: { display: 'kenza.live', mod: true }, color: '#FF8FB1', text: 'Salut depuis TikTok, trop fort ce clutch !' },
  { platform: 'youtube', type: 'chat', user: { display: 'Nolan' }, color: '#FFD166', text: 'Il reste combien de temps ?' },
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
    if (e.id) row.dataset.id = e.id;
    row.style.setProperty('--pf', PLATFORM[e.platform]?.color || '#F0392B');
    // Carte de message : photo à gauche, puis le pseudo (plateforme, badge) et le texte en dessous.
    if (s.avatar && isChat) row.append(avatar(e.user?.avatar, e.user?.display, 'cx-av'));
    const body = el('div', 'cx-body');
    if (isChat) {
      const head = el('div', 'cx-head');
      if (s.platformTag && PLATFORM[e.platform]) head.append(tag(e.platform));
      const who = el('span', 'who', e.user?.display || '');
      if (e.color) who.style.color = e.color;
      head.append(who);
      if (s.badges) {
        const b = e.user?.owner ? 'Live' : e.user?.mod ? 'Modo' : e.user?.vip ? 'VIP' : e.user?.sub ? 'Abo' : '';
        if (b) head.append(el('span', `bdg b-${b.toLowerCase()}`, b));
      }
      body.append(head, el('span', 'txt', e.text));
    } else {
      if (s.platformTag && PLATFORM[e.platform]) body.append(tag(e.platform));
      body.append(el('span', 'txt sys', EVENT_TEXT[e.type](e)));
    }
    row.append(body);
    if (e.translation) addTranslation(row, { translation: e.translation, mode: 'below', showLang: true });
    root.append(row);
    while (root.children.length > s.maxLines) root.firstChild.remove();
    if (s.fade > 0) setTimeout(() => { row.classList.add('gone'); setTimeout(() => row.remove(), 700); }, s.fade * 1000);
  };
  // Traduction arrivée après le message : sous le texte, ou à sa place.
  function addTranslation(row, x) {
    if (!row || row.querySelector('.cx-tr')) return;
    const t = el('span', 'txt cx-tr');
    t.setAttribute('translate', 'no');
    if (x.showLang !== false && x.translation.from) t.append(el('b', 'cx-lang', x.translation.from.toUpperCase()));
    t.append(document.createTextNode(x.translation.text));
    if (x.mode === 'replace') { const orig = row.querySelector('.txt:not(.cx-tr)'); if (orig) { orig.replaceWith(t); return; } }
    (row.querySelector('.cx-body') || row).append(t);
  }
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
    on(msg) {
      if (msg.t === 'ev') add(msg.ev);
      if (msg.t === 'evx' && s.translate !== false) addTranslation(root.querySelector(`.msg[data-id="${CSS.escape(msg.id)}"]`), msg);
    },
  };
}
