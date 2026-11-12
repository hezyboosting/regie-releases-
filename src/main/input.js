// Capture clavier, souris et manette pour les overlays d'entrées.
// La capture ne tourne que si un overlay concerné est ouvert. Rien n'est enregistré sur disque.

const { SonyPads } = require('./pads');

const XI = { UP: 0x1, DOWN: 0x2, LEFT: 0x4, RIGHT: 0x8, START: 0x10, BACK: 0x20, LS: 0x40, RS: 0x80, LB: 0x100, RB: 0x200, A: 0x1000, B: 0x2000, X: 0x4000, Y: 0x8000 };

// XInput vers la disposition standard de l'API Gamepad, pour que l'overlay n'ait qu'un seul format.
function xinputToStandard(g) {
  const bit = (m) => Boolean(g.wButtons & m);
  const axis = (v) => Math.max(-1, Math.min(1, Math.round((v / 32767) * 1000) / 1000));
  return {
    b: [bit(XI.A), bit(XI.B), bit(XI.X), bit(XI.Y), bit(XI.LB), bit(XI.RB), g.bLeftTrigger > 20, g.bRightTrigger > 20, bit(XI.BACK), bit(XI.START), bit(XI.LS), bit(XI.RS), bit(XI.UP), bit(XI.DOWN), bit(XI.LEFT), bit(XI.RIGHT), false, false],
    a: [axis(g.sThumbLX), -axis(g.sThumbLY), axis(g.sThumbRX), -axis(g.sThumbRY)],
    lt: g.bLeftTrigger / 255,
    rt: g.bRightTrigger / 255,
  };
}

class InputHub {
  constructor({ onKey, onMouse, onPad, onPads, log }) {
    Object.assign(this, { onKey, onMouse, onPad, onPads, log });
    this.xiOn = [false, false, false, false];
    this.sony = new SonyPads({ log, onChange: () => this.padsChanged(), onPad: (key, st) => this.emitPad(key, 'playstation', st) });
    this.paused = false;
    this.want = { hook: false, pad: false };
    this.hook = null;
    this.hooked = false;
    this.xi = null;
    this.padTimer = null;
    this.lastPad = [];
    this.mouseAcc = { dx: 0, dy: 0, last: null, sent: 0 };
    this.available = { hook: true, xinput: process.platform === 'win32' };
  }

  setPaused(p) { this.paused = p; this.apply(); }

  setWanted(want) { this.want = want; this.apply(); }

  apply() {
    if (this.want.hook && !this.paused) this.startHook(); else this.stopHook();
    if (this.want.pad && !this.paused) this.startPad(); else this.stopPad();
  }

  startHook() {
    if (this.hooked) return;
    try {
      const { uIOhook, UiohookKey } = require('uiohook-napi');
      if (!this.hook) {
        const names = {};
        for (const [name, code] of Object.entries(UiohookKey)) if (names[code] === undefined) names[code] = name;
        this.hook = uIOhook;
        uIOhook.on('keydown', (e) => this.onKey?.({ code: e.keycode, name: names[e.keycode] || String(e.keycode), down: true }));
        uIOhook.on('keyup', (e) => this.onKey?.({ code: e.keycode, name: names[e.keycode] || String(e.keycode), down: false }));
        uIOhook.on('mousedown', (e) => this.onMouse?.({ k: 'btn', button: e.button, down: true }));
        uIOhook.on('mouseup', (e) => this.onMouse?.({ k: 'btn', button: e.button, down: false }));
        uIOhook.on('wheel', (e) => this.onMouse?.({ k: 'wheel', dir: e.rotation > 0 ? 1 : -1 }));
        uIOhook.on('mousemove', (e) => this.onMove(e));
      }
      this.hook.start();
      this.hooked = true;
    } catch (e) {
      this.available.hook = false;
      this.log?.(`Capture clavier indisponible : ${e.message}`);
    }
  }

  // Simule une touche. Les noms viennent d'une liste fixe, jamais du chat.
  tap(name, hold = 60) {
    try {
      const { uIOhook, UiohookKey } = require('uiohook-napi');
      const code = UiohookKey[name];
      if (code === undefined) return false;
      uIOhook.keyToggle(code, 'down');
      setTimeout(() => uIOhook.keyToggle(code, 'up'), hold);
      return true;
    } catch (e) {
      this.log?.(`Touche simulée impossible : ${e.message}`);
      return false;
    }
  }

  stopHook() {
    if (!this.hooked) return;
    try { this.hook.stop(); } catch { /* déjà arrêté */ }
    this.hooked = false;
  }

  onMove(e) {
    const m = this.mouseAcc;
    if (m.last) { m.dx += e.x - m.last.x; m.dy += e.y - m.last.y; }
    m.last = { x: e.x, y: e.y };
    const now = Date.now();
    if (now - m.sent > 33) {
      this.onMouse?.({ k: 'move', dx: m.dx, dy: m.dy });
      m.dx = 0; m.dy = 0; m.sent = now;
    }
  }

  loadXInput() {
    if (this.xi || process.platform !== 'win32') return this.xi;
    try {
      const koffi = require('koffi');
      const lib = koffi.load('xinput1_4.dll');
      const Gamepad = koffi.struct('XINPUT_GAMEPAD', { wButtons: 'uint16', bLeftTrigger: 'uint8', bRightTrigger: 'uint8', sThumbLX: 'int16', sThumbLY: 'int16', sThumbRX: 'int16', sThumbRY: 'int16' });
      koffi.struct('XINPUT_STATE', { dwPacketNumber: 'uint32', Gamepad });
      this.xi = lib.func('uint32 __stdcall XInputGetState(uint32 dwUserIndex, _Out_ XINPUT_STATE *pState)');
    } catch (e) {
      this.available.xinput = false;
      this.log?.(`XInput indisponible : ${e.message}`);
    }
    return this.xi;
  }

  // Numéro d'ordre stable : XInput d'abord, puis les manettes PlayStation.
  pads() {
    const out = [];
    this.xiOn.forEach((on, i) => { if (on) out.push({ key: `xi${i}`, kind: 'xbox', name: 'Manette Xbox ou XInput' }); });
    return [...out, ...this.sony.list()];
  }

  emitPad(key, kind, st) {
    const pad = this.pads().findIndex((p) => p.key === key);
    this.onPad?.({ pad: Math.max(0, pad), kind, ...st });
  }

  padsChanged() { this.onPads?.(this.pads()); }

  startPad() {
    this.sony.start();
    if (this.padTimer || !this.loadXInput()) return;
    const down = [0, 0, 0, 0];
    let frame = 0;
    this.padTimer = setInterval(() => {
      frame += 1;
      for (let i = 0; i < 4; i += 1) {
        // Interroger une manette absente est lent : une fois toutes les deux secondes suffit.
        if (down[i] && frame % 120) continue;
        const st = {};
        const rc = this.xi(i, st);
        if (rc !== 0) {
          down[i] = 1;
          if (this.xiOn[i]) { this.xiOn[i] = false; this.padsChanged(); }
          continue;
        }
        down[i] = 0;
        if (!this.xiOn[i]) { this.xiOn[i] = true; this.padsChanged(); }
        if (st.dwPacketNumber !== this.lastPad[i]) {
          this.lastPad[i] = st.dwPacketNumber;
          this.emitPad(`xi${i}`, 'xbox', xinputToStandard(st.Gamepad));
        }
      }
    }, 16);
  }

  stopPad() { clearInterval(this.padTimer); this.padTimer = null; this.sony.stop(); }

  stop() { this.stopHook(); this.stopPad(); }
}

module.exports = { InputHub, xinputToStandard };
