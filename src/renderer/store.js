import { h, render as preactRender } from './vendor/preact.mjs';
import { useEffect, useState, useRef, useMemo, useCallback } from './vendor/hooks.mjs';
import htm from './vendor/htm.mjs';

export const html = htm.bind(h);
export { useEffect, useState, useRef, useMemo, useCallback, preactRender };

let state = null;
const subs = new Set();

export const getState = () => state;
export function setState(patch) {
  state = { ...state, ...patch };
  subs.forEach((f) => f(state));
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

export const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
export const limitText = (v) => (v === -1 ? 'Illimité' : v);
export const clock = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const h_ = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (v) => String(v).padStart(2, '0');
  return h_ ? `${h_}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};
