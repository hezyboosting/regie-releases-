import { h as preactH, render as preactRender } from './vendor/preact.mjs';
import { EN } from './i18n.js';
import { makeTranslator } from './translate.js';
import { useEffect, useState, useRef, useMemo, useCallback } from './vendor/hooks.mjs';
import htm from './vendor/htm.mjs';

// Langue de l'interface : français par défaut, anglais au choix (bouton FR / EN en haut).
// Chaque texte rendu passe par tr() : en anglais, il est remplacé par sa traduction s'il en a une.
let LANG = (() => { try { return localStorage.getItem('regie.lang') === 'en' ? 'en' : 'fr'; } catch { return 'fr'; } })();
document.documentElement.lang = LANG;
export const getLang = () => LANG;
const translate = makeTranslator(EN);
export function tr(s) {
  if (LANG !== 'en' || typeof s !== 'string') return s;
  return translate(s);
}
const TR_PROPS = ['title', 'label', 'placeholder', 'aria-label', 'alt', 'hint', 'saved'];
const prim = (c) => typeof c === 'string' || typeof c === 'number';
// Les morceaux de texte voisins (« 12 », « emblèmes installés ») sont traduits ensemble, puis un par un sinon.
function trChildren(list) {
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i];
    if (Array.isArray(c)) { out.push(trChildren(c)); continue; }
    if (!prim(c)) { out.push(c); continue; }
    let j = i;
    while (j + 1 < list.length && prim(list[j + 1])) j += 1;
    if (j > i) {
      const run = list.slice(i, j + 1);
      const joined = run.join('');
      const t = translate(joined);
      if (t !== joined) out.push(t);
      else for (const r of run) out.push(typeof r === 'string' ? translate(r) : r);
      i = j;
    } else out.push(typeof c === 'string' ? translate(c) : c);
  }
  return out;
}
function h(type, props, ...children) {
  if (LANG === 'en') {
    if (props) {
      let copy = null;
      for (const k of TR_PROPS) {
        const v = props[k];
        if (typeof v === 'string') { const t = translate(v); if (t !== v) { copy = copy || { ...props }; copy[k] = t; } }
      }
      if (copy) props = copy;
    }
    children = trChildren(children);
  }
  return preactH(type, props, ...children);
}
export const html = htm.bind(h);
export { useEffect, useState, useRef, useMemo, useCallback, preactRender };

let state = null;
const subs = new Set();

export const getState = () => state;
export function setState(patch) {
  state = { ...state, ...patch };
  subs.forEach((f) => f(state));
}
export function setLang(l) {
  LANG = l === 'en' ? 'en' : 'fr';
  try { localStorage.setItem('regie.lang', LANG); } catch { /* préférence facultative */ }
  document.documentElement.lang = LANG;
  setState({ uiLang: LANG });
  // Les overlays réglés sur « Comme l'appli » et les réponses du bot suivent la langue choisie.
  try { window.regie?.call('setUiLang', LANG)?.catch?.(() => {}); } catch { /* hors appli */ }
}
export function useStore() {
  const [s, set] = useState(state);
  useEffect(() => { subs.add(set); set(state); return () => subs.delete(set); }, []);
  return s;
}

export const cleanError = (e) => String(e?.message || e).replace(/^Error invoking remote method 'api': (Error: )?/, '');

let toastId = 0;
export function toast(text, kind = 'info') {
  const id = (toastId += 1);
  setState({ toasts: [...(state.toasts || []), { id, text, kind }] });
  setTimeout(() => setState({ toasts: state.toasts.filter((t) => t.id !== id) }), kind === 'error' ? 6500 : 3200);
}

// Appel au process principal. Une erreur devient un message lisible.
export async function act(method, ...args) {
  try {
    return await window.regie.call(method, ...args);
  } catch (e) {
    toast(cleanError(e), 'error');
    return undefined;
  }
}

export async function reload() { setState(await window.regie.call('snapshot')); }

export const copy = async (text, label = 'Lien copié') => { await act('copy', text); toast(label); };

export const PLATFORM = {
  tiktok: { label: 'TikTok', short: 'TT', color: '#FF3D71', chart: '#1FA598' },
  twitch: { label: 'Twitch', short: 'TW', color: '#9146FF', chart: '#9676EC' },
  youtube: { label: 'YouTube', short: 'YT', color: '#E5262B', chart: '#BE840E' },
  kick: { label: 'Kick', short: 'KI', color: '#2FB800', chart: '#4CAF50' },
};

export const fmt = (n) => Number(n || 0).toLocaleString(LANG === 'en' ? 'en-US' : 'fr-FR');
export const limitText = (v) => (v === -1 ? 'Illimité' : v);
export const clock = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const h_ = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (v) => String(v).padStart(2, '0');
  return h_ ? `${h_}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};
