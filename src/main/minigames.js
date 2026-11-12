// Mini-jeux du chat : devinette, quiz et roulette. Un seul à la fois.
const crypto = require('crypto');
const { Viewers } = require('./viewers');

const QUIZ = [
  { q: 'Quelle planète est la plus proche du Soleil ?', a: ['Vénus', 'Mercure', 'Mars', 'Terre'], c: 1 },
  { q: 'Combien de joueurs par équipe au football ?', a: ['9', '10', '11', '12'], c: 2 },
  { q: 'Quel langage s\'exécute dans le navigateur ?', a: ['Python', 'C', 'JavaScript', 'Rust'], c: 2 },
  { q: 'Quelle est la capitale du Japon ?', a: ['Séoul', 'Kyoto', 'Pékin', 'Tokyo'], c: 3 },
  { q: 'Combien de côtés a un hexagone ?', a: ['5', '6', '7', '8'], c: 1 },
];

const rand = (n) => crypto.randomInt(n);
const clean = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

class MiniGames {
  constructor(engine) { this.e = engine; }

  get g() { return this.e.s.minigame; }

  get cfg() { return this.e.s.minigames; }

  view() {
    const g = this.g;
    const { secret, ...rest } = g;
    return { ...rest, hint: g.kind === 'guess' && g.mode === 'word' && g.status === 'running' ? this.maskWord() : '', answer: g.status === 'ended' ? secret : undefined };
  }

  push() {
    this.e.save();
    this.e.push('minigame', this.view());
    this.e.server.broadcast({ t: 'minigame', game: this.view() }, 'minigame');
  }

  maskWord() {
    const g = this.g;
    return [...String(g.secret)].map((c, i) => (g.revealed?.includes(i) || c === ' ' ? c : '•')).join('');
  }

  stop() { clearTimeout(this.timer); clearInterval(this.hintTimer); }

  reset() {
    this.stop();
    this.e.s.minigame = { kind: '', status: 'idle' };
    this.push();
  }

  award(ev, points) {
    const key = Viewers.key(ev);
    const box = this.e.viewers.file.data.list[key] || this.e.viewers.session.viewers[key];
    if (box) box.points += points;
    this.e.viewers.file.save();
  }

  // Devinette : un nombre ou un mot, le premier qui trouve gagne.
  startGuess({ mode = 'number', secret, min = 1, max = 100, seconds = 90, prize = 100 } = {}) {
    this.stop();
    const value = mode === 'number' ? (secret !== undefined && secret !== '' ? Number(secret) : min + rand(max - min + 1)) : String(secret || '').trim();
    if (mode === 'word' && !value) throw new Error('Entre le mot à deviner.');
    this.e.s.minigame = { kind: 'guess', status: 'running', mode, secret: value, min, max, prize, tries: 0, near: '', winner: null, revealed: [], endsAt: Date.now() + seconds * 1000 };
    this.timer = setTimeout(() => this.finish(null), seconds * 1000);
    if (mode === 'word') {
      this.hintTimer = setInterval(() => {
        const g = this.g;
        const hidden = [...String(g.secret)].map((c, i) => i).filter((i) => !g.revealed.includes(i) && g.secret[i] !== ' ');
        if (hidden.length > 2) { g.revealed.push(hidden[rand(hidden.length)]); this.push(); }
      }, (seconds * 1000) / Math.max(3, String(value).length));
    }
    this.push();
  }

  onChat(ev, text) {
    const g = this.g;
    if (g.status !== 'running') return false;
    if (g.kind === 'guess') return this.guess(ev, text);
    if (g.kind === 'quiz') return this.quizAnswer(ev, text);
    return false;
  }

  guess(ev, text) {
    const g = this.g;
    if (g.mode === 'number') {
      const n = Number(text);
      if (!Number.isInteger(n)) return false;
      g.tries += 1;
      if (n === g.secret) { this.award(ev, g.prize); this.finish({ name: ev.user.display, platform: ev.platform }); return true; }
      g.near = n < g.secret ? `Plus que ${n}` : `Moins que ${n}`;
      this.push();
      return true;
    }
    g.tries += 1;
    if (clean(text) === clean(g.secret)) { this.award(ev, g.prize); this.finish({ name: ev.user.display, platform: ev.platform }); return true; }
    return false;
  }

  finish(winner) {
    this.stop();
    const g = this.g;
    g.status = 'ended';
    g.winner = winner;
    if (g.kind === 'quiz') g.board = this.quizBoard();
    this.push();
    this.e.fireCustom?.(`minigame:${g.kind}`);
  }

  // Quiz : réponse par 1, 2, 3, 4 ou A, B, C, D. Une réponse par question.
  startQuiz({ questions, seconds = 20, prize = 50 } = {}) {
    this.stop();
    const list = (questions?.length ? questions : this.cfg.quiz?.length ? this.cfg.quiz : QUIZ).map((x) => ({ ...x }));
    this.e.s.minigame = { kind: 'quiz', status: 'running', questions: list, index: 0, seconds, prize, answers: {}, scores: {}, counts: [], endsAt: 0, reveal: false };
    this.nextQuestion();
  }

  nextQuestion() {
    const g = this.g;
    const q = g.questions[g.index];
    if (!q) { this.finish(null); return; }
    g.current = { q: q.q, a: q.a };
    g.answers = {};
    g.counts = q.a.map(() => 0);
    g.reveal = false;
    g.correct = null;
    g.endsAt = Date.now() + g.seconds * 1000;
    this.push();
    this.timer = setTimeout(() => this.revealQuestion(), g.seconds * 1000);
  }

  quizAnswer(ev, text) {
    const g = this.g;
    if (g.reveal) return false;
    const t = String(text).trim().toUpperCase();
    const i = /^[1-4]$/.test(t) ? Number(t) - 1 : /^[A-D]$/.test(t) ? t.charCodeAt(0) - 65 : -1;
    const q = g.questions[g.index];
    if (i < 0 || i >= q.a.length) return false;
    const key = Viewers.key(ev);
    if (g.answers[key] !== undefined) return true;
    g.answers[key] = i;
    g.counts[i] += 1;
    if (i === q.c) {
      const row = g.scores[key] || { name: ev.user.display, platform: ev.platform, points: 0 };
      row.points += 1;
      g.scores[key] = row;
      this.award(ev, g.prize);
    }
    this.push();
    return true;
  }

  revealQuestion() {
    const g = this.g;
    g.reveal = true;
    g.correct = g.questions[g.index].c;
    this.push();
    this.timer = setTimeout(() => { g.index += 1; this.nextQuestion(); }, 5000);
  }

  quizBoard() { return Object.values(this.g.scores).sort((a, b) => b.points - a.points).slice(0, 5); }

  // Roulette : tirage pondéré, puis l'action du segment gagnant.
  spin(ev) {
    const segs = this.cfg.roulette.filter((x) => x.weight > 0);
    if (!segs.length) throw new Error('Ajoute des cases à la roulette.');
    const total = segs.reduce((n, x) => n + x.weight, 0);
    let r = rand(total);
    let index = 0;
    for (let i = 0; i < segs.length; i += 1) { r -= segs[i].weight; if (r < 0) { index = i; break; } }
    const win = segs[index];
    this.stop();
    this.e.s.minigame = { kind: 'roulette', status: 'spinning', segments: segs.map((x) => ({ label: x.label, color: x.color })), index, turns: 4 + rand(3), user: ev?.user?.display || '', result: '' };
    this.push();
    this.timer = setTimeout(() => {
      this.g.status = 'ended';
      this.g.result = win.label;
      this.push();
      if (ev && win.points) this.award(ev, win.points);
      const event = ev || { type: 'custom', platform: 'twitch', user: { display: 'Régie' } };
      (win.actions || []).forEach((a) => this.e.runAction(a, event, this.e.commandVars(event, '', null)));
    }, 5200);
    return win;
  }
}

module.exports = { MiniGames, QUIZ };
