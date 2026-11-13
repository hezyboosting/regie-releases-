// File d'attente : qui joue avec le streamer, dans l'ordre. Les viewers tapent !join dans le chat.
import { el, tag, isPreview, avatar } from '../lib.js';

const DEMO = {
  open: true, join: '!join', total: 5,
  current: { name: 'kenza.live', platform: 'tiktok' },
  list: [{ name: 'Marius', platform: 'twitch' }, { name: 'Nolan', platform: 'youtube' }, { name: 'Lena_RL', platform: 'kick' }, { name: 'toto.gaming', platform: 'tiktok' }],
};

export function mount(root) {
  let s = {};
  let q = null;
  const box = el('div', 'qu scaled');
  root.append(box);

  function render() {
    const data = q || (isPreview ? DEMO : { open: true, join: '!join', list: [], current: null, total: 0 });
    box.textContent = '';
    box.style.setProperty('--accent', s.accent || '#8FD3FF');
    box.style.setProperty('--bg', s.bg || '#10131A');
    box.style.setProperty('--text', s.text || '#F2F5F9');
    const head = el('div', 'qu-head');
    head.append(el('b', 'qu-title', s.title || 'Joue avec moi'), el('span', `qu-state ${data.open ? 'on' : ''}`, data.open ? `${data.total ?? data.list.length} en attente` : 'File fermée'));
    box.append(head);
    if (data.current) {
      const now = el('div', 'qu-now');
      if (s.avatars !== false) now.append(avatar(data.current.avatar, data.current.name, 'qu-av'));
      const t = el('div', 'qu-now-t');
      t.append(el('small', '', 'À toi de jouer'), el('b', '', data.current.name));
      now.append(t, tag(data.current.platform));
      box.append(now);
    }
    const list = el('ol', 'qu-list');
    data.list.slice(0, s.show || 8).forEach((x, i) => {
      const li = el('li', 'qu-row');
      li.append(el('span', 'qu-n', String(i + 1)));
      if (s.avatars !== false) li.append(avatar(x.avatar, x.name, 'qu-av sm'));
      li.append(el('span', 'qu-name', x.name), tag(x.platform));
      list.append(li);
    });
    box.append(list);
    if (!data.list.length && !data.current) box.append(el('p', 'qu-empty', 'Personne pour le moment'));
    if (s.showCmd !== false && data.open) {
      const cmd = el('div', 'qu-cmd');
      cmd.append('Tape ', el('b', '', data.join || '!join'), ' dans le chat');
      box.append(cmd);
    }
  }

  return {
    update(settings, data) { s = settings; if (data?.queue) q = data.queue; render(); },
    on(msg) { if (msg.t === 'queue') { q = msg.queue; render(); } },
  };
}
