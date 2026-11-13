// Mini-jeux du chat : devinette, quiz et roulette.
import { html, useState, act, setState, toast, copy } from '../store.js';
import { ICONS, Btn, Bay, Field, Num, Lazy, Text, Select, Color, Segments, PageHead, Pro, Upsell } from '../ui.js';

const uid = () => Math.random().toString(36).slice(2, 10);

function Current({ s }) {
  const g = s.minigame;
  const overlay = s.overlays.find((o) => o.type === 'minigame');
  const running = g.status === 'running' || g.status === 'spinning';
  const text = g.kind === 'guess' ? 'Devinette' : g.kind === 'quiz' ? 'Quiz' : g.kind === 'roulette' ? 'Roulette' : '';
  return html`<${Bay} title="En cours" aside=${overlay && html`<div class="row tight"><${Btn} icon=${ICONS.copy} onClick=${() => copy(overlay.link)}>Copier le lien<//><${Btn} onClick=${() => setState({ view: 'overlays', overlayId: overlay.id })}>Apparence<//></div>`}>
    ${g.status === 'idle' ? html`<p class="note">Aucun mini-jeu en cours. Lance-en un ci-dessous.</p>` : html`<div class="row tight">
      <span class="badge ${running ? 'ok' : ''}"><i></i>${text}, ${running ? 'en cours' : 'terminé'}</span>
      ${g.kind === 'guess' && html`<span class="tagline">${g.tries} essais</span>`}
      ${g.result && html`<b>${g.result}</b>`}
      ${g.winner && html`<b>${g.winner.name} gagne</b>`}
      <${Btn} onClick=${() => act('resetMiniGame')}>Fermer<//>
    </div>`}
  <//>`;
}

function Guess({ locked }) {
  const [c, set] = useState({ mode: 'number', secret: '', min: 1, max: 100, seconds: 90, prize: 100 });
  const up = (patch) => set({ ...c, ...patch });
  return html`<${Bay} title="Devinette">
    <${Segments} value=${c.mode} onChange=${(mode) => up({ mode })} options=${[{ value: 'number', label: 'Un nombre' }, { value: 'word', label: 'Un mot' }]} />
    <div class="row wrap">
      ${c.mode === 'number' && html`<${Field} label="De"><${Num} value=${c.min} onSave=${(min) => up({ min })} /><//>`}
      ${c.mode === 'number' && html`<${Field} label="À"><${Num} value=${c.max} onSave=${(max) => up({ max })} /><//>`}
      <${Field} label=${c.mode === 'word' ? 'Le mot' : 'Nombre secret'} hint=${c.mode === 'number' ? 'Vide pour le hasard' : 'Des lettres se révèlent peu à peu'}><${Text} value=${c.secret} onChange=${(secret) => up({ secret })} /><//>
      <${Field} label="Durée (s)"><${Num} value=${c.seconds} min="10" onSave=${(seconds) => up({ seconds })} /><//>
      <${Field} label="Points à gagner"><${Num} value=${c.prize} min="0" onSave=${(prize) => up({ prize })} /><//>
    </div>
    <${Btn} kind="primary" disabled=${locked} onClick=${() => act('startGuess', c)}>Lancer la devinette<//>
  <//>`;
}

function Quiz({ s, locked }) {
  const m = s.minigames;
  const [seconds, setSeconds] = useState(20);
  const [prize, setPrize] = useState(50);
  const save = async (patch) => { const r = await act('updateMiniGames', patch); if (r) setState({ minigames: { ...r } }); };
  const upQ = (i, patch) => save({ quiz: m.quiz.map((q, j) => (i === j ? { ...q, ...patch } : q)) });
  return html`<${Bay} title="Quiz" aside=${html`<${Btn} icon=${ICONS.plus} onClick=${() => save({ quiz: [...m.quiz, { q: 'Nouvelle question', a: ['Réponse 1', 'Réponse 2', 'Réponse 3', 'Réponse 4'], c: 0 }] })}>Ajouter une question<//>`}>
    <div class="row wrap">
      <${Field} label="Temps par question (s)"><${Num} value=${seconds} min="5" onSave=${setSeconds} /><//>
      <${Field} label="Points par bonne réponse"><${Num} value=${prize} min="0" onSave=${setPrize} /><//>
    </div>
    ${m.quiz.map((q, i) => html`<div class="quiz-q" key=${i}>
      <${Lazy} value=${q.q} aria-label="Question" onSave=${(v) => upQ(i, { q: v })} />
      ${q.a.map((a, n) => html`<div class="quiz-a" key=${n}>
        <input type="radio" name=${`q${i}`} checked=${q.c === n} aria-label="Bonne réponse" onChange=${() => upQ(i, { c: n })} />
        <${Lazy} value=${a} aria-label=${`Réponse ${n + 1}`} onSave=${(v) => upQ(i, { a: q.a.map((x, j) => (j === n ? v : x)) })} />
      </div>`)}
      <button type="button" class="mini danger" onClick=${() => save({ quiz: m.quiz.filter((_, j) => j !== i) })}>Retirer cette question</button>
    </div>`)}
    ${!m.quiz.length && html`<p class="note">Sans question à toi, le quiz utilise cinq questions de culture générale.</p>`}
    <p class="note">Les spectateurs répondent par 1, 2, 3, 4 ou A, B, C, D.</p>
    <${Btn} kind="primary" disabled=${locked} onClick=${() => act('startQuiz', { seconds, prize, questions: m.quiz })}>Lancer le quiz<//>
  <//>`;
}

function Roulette({ s, locked }) {
  const m = s.minigames;
  const save = async (patch) => { const r = await act('updateMiniGames', patch); if (r) setState({ minigames: { ...r } }); };
  const up = (i, patch) => save({ roulette: m.roulette.map((x, j) => (i === j ? { ...x, ...patch } : x)) });
  return html`<${Bay} title="Roulette" aside=${html`<${Btn} icon=${ICONS.plus} onClick=${() => save({ roulette: [...m.roulette, { id: uid(), label: 'Nouvelle case', color: '#8B3DFF', weight: 10, points: 0, actions: [] }] })}>Ajouter une case<//>`}>
    <div class="row wrap">
      <${Field} label="Commande"><${Lazy} value=${m.rouletteCommand} onSave=${(rouletteCommand) => save({ rouletteCommand })} /><//>
      <${Field} label="Prix en points"><${Num} value=${m.rouletteCost} min="0" onSave=${(rouletteCost) => save({ rouletteCost })} /><//>
      <${Field} label="Attente par spectateur (s)"><${Num} value=${m.rouletteCooldown} min="0" onSave=${(rouletteCooldown) => save({ rouletteCooldown })} /><//>
    </div>
    <div class="col">
      ${m.roulette.map((x, i) => html`<div class="rank-row wheel-row" key=${x.id}>
        <${Color} value=${x.color} onChange=${(color) => up(i, { color })} />
        <${Lazy} value=${x.label} aria-label="Nom de la case" onSave=${(label) => up(i, { label })} />
        <${Num} value=${x.weight} min="0" aria-label="Chance" title="Chance" onSave=${(weight) => up(i, { weight })} />
        <${Num} value=${x.points} aria-label="Points gagnés" title="Points gagnés" onSave=${(points) => up(i, { points })} />
        <button type="button" class="icon" aria-label="Retirer" onClick=${() => save({ roulette: m.roulette.filter((_, j) => j !== i) })}>${ICONS.x}</button>
      </div>`)}
    </div>
    <p class="note">Colonnes : chance, puis points gagnés.</p>
    <${Btn} kind="primary" disabled=${locked} onClick=${() => act('spinRoulette')}>Lancer la roulette<//>
  <//>`;
}

export function MiniGamesView({ s }) {
  const locked = !s.features.miniGames;
  void toast; void Select;
  return html`<div class="page">
    <${PageHead} title="Mini-jeux">${locked ? html`<${Pro} />` : ''}<//>
    <${Current} s=${s} />
    <div class="two"><${Guess} locked=${locked} /><${Quiz} s=${s} locked=${locked} /></div>
    <${Roulette} s=${s} locked=${locked} />
    <${Upsell}>Les mini-jeux sont inclus dans PRO. Les duels et le combat de boss restent disponibles en FREE.<//>
  </div>`;
}
