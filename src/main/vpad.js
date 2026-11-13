// Manette virtuelle : une manette Xbox 360 branchée par logiciel (pilote ViGEmBus), que le chat pilote.
// Utile pour les jeux qui ignorent les touches simulées du clavier (jeux manette, certains anti-triche).
const path = require('path');

const BTN = {
  haut: 0x0001, bas: 0x0002, gauche: 0x0004, droite: 0x0008, start: 0x0010, back: 0x0020, l3: 0x0040, r3: 0x0080,
  lb: 0x0100, rb: 0x0200, guide: 0x0400, a: 0x1000, b: 0x2000, x: 0x4000, y: 0x8000,
};
// Boutons, gâchettes et sticks proposés dans l'éditeur d'actions.
const PAD_INPUTS = [
  ['a', 'A'], ['b', 'B'], ['x', 'X'], ['y', 'Y'], ['lb', 'LB'], ['rb', 'RB'], ['lt', 'LT (gâchette)'], ['rt', 'RT (gâchette)'],
  ['haut', 'Croix haut'], ['bas', 'Croix bas'], ['gauche', 'Croix gauche'], ['droite', 'Croix droite'], ['start', 'Start'], ['back', 'Back'], ['l3', 'L3'], ['r3', 'R3'],
  ['ls-haut', 'Stick gauche haut'], ['ls-bas', 'Stick gauche bas'], ['ls-gauche', 'Stick gauche à gauche'], ['ls-droite', 'Stick gauche à droite'],
  ['rs-haut', 'Stick droit haut'], ['rs-bas', 'Stick droit bas'], ['rs-gauche', 'Stick droit à gauche'], ['rs-droite', 'Stick droit à droite'],
];
const ERR = { 0x20000000: '', 0xE0000001: 'Le pilote ViGEmBus n\'est pas installé.', 0xE0000002: 'Plus de place pour une manette virtuelle.', 0xE0000008: 'Version du pilote ViGEmBus incompatible.', 0xE0000009: 'Accès au pilote ViGEmBus refusé.' };

class VirtualPad {
  constructor(log = () => {}) {
    this.log = log;
    this.state = 'off';
    this.error = '';
    this.report = { wButtons: 0, bLeftTrigger: 0, bRightTrigger: 0, sThumbLX: 0, sThumbLY: 0, sThumbRX: 0, sThumbRY: 0 };
    this.timers = new Set();
    this.lastPress = 0;
  }

  dllPath() {
    return path.join(__dirname, 'native', 'ViGEmClient.dll').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  }

  load() {
    if (this.fn) return true;
    if (process.platform !== 'win32') { this.error = 'La manette virtuelle marche seulement sous Windows.'; return false; }
    try {
      const koffi = require('koffi');
      const lib = koffi.load(this.dllPath());
      const Report = koffi.struct('XUSB_REPORT', { wButtons: 'uint16', bLeftTrigger: 'uint8', bRightTrigger: 'uint8', sThumbLX: 'int16', sThumbLY: 'int16', sThumbRX: 'int16', sThumbRY: 'int16' });
      this.fn = {
        alloc: lib.func('void *vigem_alloc(void)'),
        connect: lib.func('uint32 vigem_connect(void *client)'),
        disconnect: lib.func('void vigem_disconnect(void *client)'),
        free: lib.func('void vigem_free(void *client)'),
        x360: lib.func('void *vigem_target_x360_alloc(void)'),
        add: lib.func('uint32 vigem_target_add(void *client, void *target)'),
        remove: lib.func('uint32 vigem_target_remove(void *client, void *target)'),
        tfree: lib.func('void vigem_target_free(void *target)'),
        update: lib.func('vigem_target_x360_update', 'uint32', ['void *', 'void *', Report]),
      };
      return true;
    } catch (e) {
      this.error = `Manette virtuelle indisponible : ${e.message}`;
      return false;
    }
  }

  start() {
    if (this.state === 'on') return this.status();
    this.error = '';
    if (!this.load()) { this.state = 'error'; return this.status(); }
    const f = this.fn;
    this.client = f.alloc();
    const r = f.connect(this.client);
    if (r !== 0x20000000) {
      this.error = ERR[r] || `Le pilote ViGEmBus a répondu ${r.toString(16)}.`;
      f.free(this.client); this.client = null; this.state = 'error';
      return this.status();
    }
    this.target = f.x360();
    const a = f.add(this.client, this.target);
    if (a !== 0x20000000) {
      this.error = ERR[a] || `Branchement refusé (${a.toString(16)}).`;
      f.tfree(this.target); f.disconnect(this.client); f.free(this.client); this.client = null; this.target = null; this.state = 'error';
      return this.status();
    }
    this.state = 'on';
    this.log('Manette virtuelle branchée');
    return this.status();
  }

  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    if (this.fn && this.client) {
      try { this.fn.remove(this.client, this.target); this.fn.tfree(this.target); this.fn.disconnect(this.client); this.fn.free(this.client); } catch { /* déjà débranchée */ }
    }
    this.client = null; this.target = null;
    if (this.state === 'on') this.state = 'off';
    return this.status();
  }

  status() { return { state: this.state, error: this.error }; }

  send() { if (this.state === 'on') this.fn.update(this.client, this.target, this.report); }

  // Applique (on = true) ou relâche une entrée : bouton, gâchette ou direction de stick.
  set(input, on) {
    const r = this.report;
    if (BTN[input]) r.wButtons = on ? (r.wButtons | BTN[input]) : (r.wButtons & ~BTN[input]);
    else if (input === 'lt') r.bLeftTrigger = on ? 255 : 0;
    else if (input === 'rt') r.bRightTrigger = on ? 255 : 0;
    else {
      const m = /^(ls|rs)-(haut|bas|gauche|droite)$/.exec(input);
      if (!m) throw new Error(`Entrée de manette inconnue : ${input}`);
      const x = m[1] === 'ls' ? 'sThumbLX' : 'sThumbRX';
      const y = m[1] === 'ls' ? 'sThumbLY' : 'sThumbRY';
      const v = on ? 32767 : 0;
      if (m[2] === 'haut') r[y] = v; if (m[2] === 'bas') r[y] = on ? -32768 : 0;
      if (m[2] === 'droite') r[x] = v; if (m[2] === 'gauche') r[x] = on ? -32768 : 0;
    }
  }

  // Appuie sur une ou plusieurs entrées (« a+b ») pendant « ms » millisecondes.
  press(combo, ms = 120) {
    if (this.state !== 'on') { this.start(); if (this.state !== 'on') throw new Error(this.error || 'Manette virtuelle débranchée.'); }
    const now = Date.now();
    if (now - this.lastPress < 60) throw new Error('Trop d\'appuis d\'un coup sur la manette virtuelle.');
    this.lastPress = now;
    const inputs = String(combo || '').split('+').map((x) => x.trim().toLowerCase()).filter(Boolean);
    for (const i of inputs) this.set(i, true);
    this.send();
    const t = setTimeout(() => { this.timers.delete(t); for (const i of inputs) this.set(i, false); this.send(); }, Math.max(30, Math.min(10000, Number(ms) || 120)));
    this.timers.add(t);
    return true;
  }
}

module.exports = { VirtualPad, PAD_INPUTS, BTN };
