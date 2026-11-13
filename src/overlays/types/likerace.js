// Course aux likes : chaque viewer avance sur sa piste à chaque like (et, si réglé, à chaque message ou cadeau).
// Le premier qui touche la ligne d'arrivée gagne, puis une nouvelle course repart.
import { el, avatar, tag, fmt, isPreview, confetti } from '../lib.js';

const NAMES = ['Léna', 'Marius', 'kenza.live', 'Yanis', 'Inès', 'Théo'];
const PLAT = ['tiktok', 'tiktok', 'tiktok', 'twitch', 'youtube', 'tiktok'];

export function mount(root) {
  let s = {};
  let race = null;
  let demo = null;
  let demoTimer = null;
  let lastWinner = '';
  const rows = new Map();

  const box = el('div', 'lr scaled');
  const head = el('div', 'lr-head');
  const title = el('b', 'lr-title');
  const goal = el('span', 'lr-goal');
  head.append(title, goal);
  const track = el('div', 'lr-track');
  const finish = el('div', 'lr-finish');
  track.append(finish);
  const empty = el('p', 'lr-empty', 'Likez le live pour entrer dans la course !');
  const win = el('div', 'lr-win');
  box.append(head, track, empty, win);
  root.append(box);

  function demoTick() {
    if (!demo) demo = { status: 'running', target: 500, racers: NAMES.slice(0, 5).map((name, i) => ({ key: name, name, platform: PLAT[i], score: 40 + i * 25 })), winner: null };
    if (demo.status === 'won') { demo = null; demoTick(); return; }
    for (const r of demo.racers) r.score = Math.min(demo.target, r.score + Math.floor(Math.random() * 45));
    demo.racers.sort((a, b) => b.score - a.score);
    const top = demo.racers[0];
    if (top.score >= demo.target) { demo.status = 'won'; demo.winner = { name: top.name, platform: top.platform, score: top.score }; }
    render(demo);
  }

  function render(d) {
    const data = d || race || { status: 'idle', target: 500, racers: [], winner: null };
    box.style.setProperty('--accent', s.accent || '#FF4D6D');
    box.style.setProperty('--track', s.track || '#10131A');
    box.style.setProperty('--text', s.text || '#F2F5F9');
    box.dataset.style = s.style || 'piste';
    title.textContent = data.title || 'Course aux likes';
    title.hidden = s.showTitle === false;
    goal.textContent = `🏁 ${fmt(data.target)} likes`;
    goal.hidden = s.showTarget === false;
    finish.hidden = s.showTarget === false;
    const lanes = data.racers || [];
    const laneH = 64;
    track.style.height = `${Math.max(1, lanes.length) * laneH}px`;
    const seen = new Set();
    lanes.forEach((r, i) => {
      seen.add(r.key);
      let row = rows.get(r.key);
      if (!row) {
        row = { node: el('div', 'lr-row'), bar: el('div', 'lr-bar'), runner: el('div', 'lr-runner'), name: el('span', 'lr-name'), score: el('span', 'lr-score'), rank: el('span', 'lr-rank') };
        const lbl = el('div', 'lr-lbl');
        lbl.append(row.name, row.score);
        row.node.append(row.rank, row.bar, row.runner, lbl);
        row.node.style.top = `${lanes.length * laneH}px`;
        track.append(row.node);
        rows.set(r.key, row);
      }
      row.runner.textContent = '';
      if (s.avatars !== false) row.runner.append(avatar(r.avatar, r.name, 'lr-av'));
      else row.runner.append(tag(r.platform));
      row.name.textContent = r.name;
      row.score.textContent = fmt(r.score);
      row.rank.textContent = String(i + 1);
      const p = Math.max(0, Math.min(1, r.score / (data.target || 1)));
      row.node.style.top = `${i * laneH}px`;
      row.node.style.setProperty('--p', p.toFixed(4));
      row.node.classList.toggle('lead', i === 0);
    });
    for (const [k, row] of rows) if (!seen.has(k)) { row.node.remove(); rows.delete(k); }
    empty.hidden = lanes.length > 0;
    win.textContent = '';
    if (data.status === 'won' && data.winner) {
      const card = el('div', 'lr-win-card');
      card.append(avatar(data.winner.avatar, data.winner.name, 'lr-win-av'), el('small', '', 'Vainqueur'), el('b', '', data.winner.name));
      win.append(card);
      win.className = 'lr-win on';
      const id = `${data.round}:${data.winner.name}`;
      if (id !== lastWinner) { lastWinner = id; confetti([s.accent || '#FF4D6D', '#FFFFFF', '#FFD24A']); }
    } else win.className = 'lr-win';
    box.classList.toggle('idle-hide', Boolean(s.hideIdle) && data.status === 'idle' && !isPreview);
  }

  // Dans l'aperçu, une course de démonstration tant qu'aucun viewer ne court.
  function refresh() {
    const useDemo = isPreview && (!race || !race.racers?.length);
    if (useDemo) {
      if (!demoTimer) { demoTick(); demoTimer = setInterval(demoTick, 1100); }
      render(demo);
    } else {
      clearInterval(demoTimer); demoTimer = null; demo = null;
      render();
    }
  }

  return {
    update(settings, d) { s = settings; if (d?.race) race = d.race; refresh(); },
    on(msg) { if (msg.t === 'likerace') { race = msg.race; refresh(); } },
  };
}
