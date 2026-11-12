import { el, clock, setVars, tag, isPreview } from '../lib.js';

const DEMO = { kind: 'quiz', status: 'running', current: { q: 'Combien de côtés a un hexagone ?', a: ['5', '6', '7', '8'] }, counts: [3, 14, 2, 1], endsAt: 0, index: 0, questions: [1, 2, 3], reveal: false };

export function mount(root) {
  let s = {};
  let g = { status: 'idle' };
  let spun = '';
  const box = el('div', 'mg scaled');
  root.append(box);

  const countdown = (to) => {
    const c = el('span', 'mg-time', '');
    const tick = () => { if (!c.isConnected && c.dataset.on) return; c.dataset.on = 1; c.textContent = clock((to - Date.now()) / 1000); if (to > Date.now()) setTimeout(tick, 500); };
    tick();
    return c;
  };

  function guess() {
    box.append(el('h1', '', g.mode === 'number' ? `Devine le nombre entre ${g.min} et ${g.max}` : 'Devine le mot'));
    if (g.mode === 'word') box.append(el('div', 'mg-word', g.status === 'ended' ? g.answer : g.hint));
    if (g.near && g.status === 'running') box.append(el('div', 'mg-near', g.near));
    if (g.status === 'running') {
      const f = el('div', 'mg-foot');
      f.append(el('span', '', `${g.tries} essais`), countdown(g.endsAt));
      box.append(f);
    } else box.append(result(g.winner ? `${g.winner.name} a trouvé` : `Personne n'a trouvé, c'était ${g.answer}`, g.winner));
  }

  function result(text, winner) {
    const r = el('div', 'mg-result', text);
    if (winner?.platform) r.append(tag(winner.platform));
    return r;
  }

  function quiz() {
    if (g.status === 'ended') {
      box.append(el('h1', '', 'Résultats du quiz'));
      (g.board || []).forEach((x, i) => { const r = el('div', 'mg-row'); r.append(el('b', '', String(i + 1)), el('span', '', x.name), el('i', '', `${x.points}`)); box.append(r); });
      if (!g.board?.length) box.append(el('div', 'mg-near', 'Aucune bonne réponse.'));
      return;
    }
    box.append(el('div', 'mg-sub', `Question ${g.index + 1} sur ${g.questions.length}`), el('h1', '', g.current.q));
    const total = Math.max(1, (g.counts || []).reduce((a, b) => a + b, 0));
    g.current.a.forEach((a, i) => {
      const r = el('div', `mg-ans${g.reveal && i === g.correct ? ' ok' : ''}${g.reveal && i !== g.correct ? ' ko' : ''}`);
      const f = el('i'); f.style.width = `${((g.counts?.[i] || 0) / total) * 100}%`;
      r.append(f, el('b', '', String(i + 1)), el('span', '', a), el('em', '', String(g.counts?.[i] || 0)));
      box.append(r);
    });
    if (!g.reveal && g.endsAt) box.append(countdown(g.endsAt));
  }

  function wheel() {
    const size = 360;
    const c = el('canvas', 'mg-wheel');
    c.width = size * 2; c.height = size * 2;
    const x = c.getContext('2d');
    const seg = g.segments || [];
    const part = (Math.PI * 2) / Math.max(1, seg.length);
    seg.forEach((sg, i) => {
      x.beginPath(); x.moveTo(size, size); x.arc(size, size, size - 6, i * part, (i + 1) * part); x.closePath();
      x.fillStyle = sg.color; x.fill();
      x.save(); x.translate(size, size); x.rotate((i + 0.5) * part);
      x.fillStyle = '#fff'; x.font = '700 30px Geist, sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle';
      x.fillText(String(sg.label).slice(0, 18), size - 34, 0); x.restore();
    });
    const holder = el('div', 'mg-spin');
    holder.append(c, el('div', 'mg-pin'));
    box.append(holder);
    if (g.user) box.append(el('div', 'mg-sub', g.user));
    const end = (Math.PI * 2 * g.turns) + (Math.PI * 1.5) - (g.index + 0.5) * part;
    const key = `${g.index}|${g.turns}|${seg.length}`;
    if (g.status === 'spinning' && spun !== key) {
      spun = key;
      c.animate([{ transform: 'rotate(0rad)' }, { transform: `rotate(${end}rad)` }], { duration: 5200, easing: 'cubic-bezier(.12,.72,.14,1)', fill: 'forwards' });
    } else c.style.transform = `rotate(${end}rad)`;
    if (g.status === 'ended') box.append(el('div', 'mg-result', g.result));
  }

  const render = () => {
    const d = g.status === 'idle' && isPreview ? DEMO : g;
    const keep = g;
    g = d;
    box.textContent = '';
    box.hidden = d.status === 'idle';
    if (d.kind === 'guess') guess();
    if (d.kind === 'quiz') quiz();
    if (d.kind === 'roulette') wheel();
    g = keep;
  };

  return {
    update(settings, data) { s = settings; setVars(root, { accent: s.accent, bg: s.bg, text: s.text }); if (data?.game) g = data.game; render(); },
    on(msg) { if (msg.t === 'minigame') { g = msg.game; render(); } },
  };
}
