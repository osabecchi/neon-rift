'use strict';
/* NEON RIFT — 入力(キーボード・マウス・タッチ・ゲームパッド) */
(function () {
  const NR = window.NR;
  const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
  const ACTIONS = {
    dash: ['Space', 'ShiftLeft', 'ShiftRight', 'Mouse2', 'Pad0', 'Pad5', 'TouchDash'],
    od: ['KeyE', 'KeyQ', 'Mouse1', 'Pad2', 'Pad3', 'Pad4', 'TouchOd'],
    pause: ['Escape', 'KeyP', 'Pad9', 'TouchPause'],
    confirm: ['Enter', 'NumpadEnter', 'Pad0'],
    back: ['Escape', 'Pad1'],
    reroll: ['KeyR', 'Pad2'],
    banish: ['KeyB', 'Pad3'],
    left: ['ArrowLeft', 'KeyA', 'Pad14'],
    right: ['ArrowRight', 'KeyD', 'Pad15'],
    up: ['ArrowUp', 'KeyW', 'Pad12'],
    down: ['ArrowDown', 'KeyS', 'Pad13'],
    n1: ['Digit1', 'Numpad1'],
    n2: ['Digit2', 'Numpad2'],
    n3: ['Digit3', 'Numpad3'],
    n4: ['Digit4', 'Numpad4'],
    retry: ['KeyR'],
    fullscreen: ['KeyF'],
  };

  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = new Set();
      this.pressed = new Set();
      this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
      this.device = 'kb';
      this.onDevice = null;
      this.stickR = 62;
      this.tMove = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
      this.tAim = { id: null, ox: 0, oy: 0, x: 0, y: 0, ang: 0 };
      this.pad = { on: false, lx: 0, ly: 0, rx: 0, ry: 0, rt: 0, cur: new Array(17).fill(false), prev: new Array(17).fill(false), navX: 0, navY: 0 };
      this.mv = { x: 0, y: 0 };
      // タッチ操作: 'drag' = どこでもなぞった分だけ動く / 'stick' = 左で移動・右で照準
      this.touchMode = 'drag';
      this.touchSens = 1.2;
      this.drag = { id: null, x: 0, y: 0, dx: 0, dy: 0 };
      // スマホではタッチイベントで受ける(ブラウザーのスクロールやスワイプに指を奪われないようにする)
      this.useTouchEvents = typeof TouchEvent !== 'undefined' && 'ontouchstart' in window;

      addEventListener('keydown', (e) => {
        const tag = e.target && e.target.tagName;
        if (BLOCK.has(e.code) && tag !== 'INPUT') e.preventDefault();
        if (!e.repeat) this.pressed.add(e.code);
        this.keys.add(e.code);
        this.setDevice('kb');
      });
      addEventListener('keyup', (e) => this.keys.delete(e.code));
      addEventListener('blur', () => {
        this.keys.clear();
        this.mouse.down = false;
        this.releaseTouches();
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('pointerdown', (e) => this.onDown(e));
      addEventListener('pointermove', (e) => this.onMove(e), { passive: true });
      addEventListener('pointerup', (e) => this.onUp(e));
      addEventListener('pointercancel', (e) => this.onUp(e));
      if (this.useTouchEvents) {
        canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        addEventListener('touchend', (e) => this.onTouchEnd(e));
        addEventListener('touchcancel', (e) => this.onTouchEnd(e));
      }
    }
    releaseTouches() {
      this.tMove.id = null;
      this.tAim.id = null;
      this.drag.id = null;
      this.drag.dx = 0;
      this.drag.dy = 0;
    }
    // 指が触れた。stick モードは画面の左右で役割を分ける
    touchBegin(id, x, y) {
      this.setDevice('touch');
      if (this.touchMode !== 'stick') {
        const d = this.drag;
        if (d.id !== null) return false;
        d.id = id; d.x = x; d.y = y;
        return true;
      }
      const t = x < innerWidth / 2 ? this.tMove : this.tAim;
      if (t.id !== null) return false;
      t.id = id;
      t.ox = t.x = x;
      t.oy = t.y = y;
      return true;
    }
    touchMoveTo(id, x, y) {
      const d = this.drag;
      if (id === d.id) {
        d.dx += x - d.x; d.dy += y - d.y;
        d.x = x; d.y = y;
        return true;
      }
      const t = id === this.tMove.id ? this.tMove : id === this.tAim.id ? this.tAim : null;
      if (!t) return false;
      t.x = x;
      t.y = y;
      const dx = t.x - t.ox, dy = t.y - t.oy, dist = Math.hypot(dx, dy), max = this.stickR * 1.35;
      if (dist > max) {
        t.ox = t.x - (dx / dist) * max;
        t.oy = t.y - (dy / dist) * max;
      }
      return true;
    }
    touchEnd(id) {
      if (id === this.drag.id) this.drag.id = null;
      if (id === this.tMove.id) this.tMove.id = null;
      if (id === this.tAim.id) this.tAim.id = null;
    }
    onTouchStart(e) {
      e.preventDefault();
      // 画面に残っている指と食い違っていたら(離した通知を取りこぼした場合)握りっぱなしを解除する
      const live = new Set();
      for (let i = 0; i < e.touches.length; i++) live.add(e.touches[i].identifier);
      for (const t of [this.drag, this.tMove, this.tAim]) if (t.id !== null && !live.has(t.id)) t.id = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        this.touchBegin(t.identifier, t.clientX, t.clientY);
      }
    }
    onTouchMove(e) {
      let ours = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.touchMoveTo(t.identifier, t.clientX, t.clientY)) ours = true;
      }
      if (ours && e.cancelable) e.preventDefault();
    }
    onTouchEnd(e) {
      for (let i = 0; i < e.changedTouches.length; i++) this.touchEnd(e.changedTouches[i].identifier);
      if (!e.touches || e.touches.length === 0) this.releaseTouches();
    }
    setDevice(d) {
      if (this.device !== d) {
        this.device = d;
        if (this.onDevice) this.onDevice(d);
      }
    }
    onDown(e) {
      if (e.pointerType === 'mouse') {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        if (e.button === 0) this.mouse.down = true;
        else if (e.button === 2) this.pressed.add('Mouse2');
        else if (e.button === 1) { this.pressed.add('Mouse1'); e.preventDefault(); }
        this.setDevice('kb');
        return;
      }
      // タッチイベントが使える環境ではそちらで処理する(二重に数えない)
      if (this.useTouchEvents) return;
      e.preventDefault();
      this.touchBegin(e.pointerId, e.clientX, e.clientY);
    }
    onMove(e) {
      if (e.pointerType === 'mouse') {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        return;
      }
      if (!this.useTouchEvents) this.touchMoveTo(e.pointerId, e.clientX, e.clientY);
    }
    onUp(e) {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) this.mouse.down = false;
        return;
      }
      if (!this.useTouchEvents) this.touchEnd(e.pointerId);
    }
    poll() {
      const P = this.pad;
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      let gp = null;
      if (pads) for (const p of pads) if (p && p.connected) { gp = p; break; }
      P.on = !!gp;
      if (!gp) return;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
      P.lx = dz(gp.axes[0] || 0);
      P.ly = dz(gp.axes[1] || 0);
      P.rx = dz(gp.axes[2] || 0);
      P.ry = dz(gp.axes[3] || 0);
      const tmp = P.prev; P.prev = P.cur; P.cur = tmp;
      let any = Math.abs(P.lx) + Math.abs(P.ly) + Math.abs(P.rx) + Math.abs(P.ry) > 0.4;
      for (let i = 0; i < 17; i++) {
        const b = gp.buttons[i];
        const v = b ? b.pressed || b.value > 0.45 : false;
        P.cur[i] = v;
        if (v && !P.prev[i]) { this.pressed.add('Pad' + i); any = true; }
      }
      P.rt = gp.buttons[7] ? gp.buttons[7].value : 0;
      // スティックでメニュー移動
      const nx = P.lx > 0.6 ? 1 : P.lx < -0.6 ? -1 : 0, ny = P.ly > 0.6 ? 1 : P.ly < -0.6 ? -1 : 0;
      if (nx && nx !== P.navX) this.pressed.add(nx > 0 ? 'Pad15' : 'Pad14');
      if (ny && ny !== P.navY) this.pressed.add(ny > 0 ? 'Pad13' : 'Pad12');
      P.navX = nx; P.navY = ny;
      if (any) this.setDevice('pad');
    }
    move() {
      const m = this.mv, k = this.keys, P = this.pad;
      let x = 0, y = 0;
      if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
      if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
      if (P.on && (P.lx || P.ly)) { x = P.lx; y = P.ly; }
      if (this.tMove.id !== null) {
        x = (this.tMove.x - this.tMove.ox) / this.stickR;
        y = (this.tMove.y - this.tMove.oy) / this.stickR;
      }
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      m.x = x; m.y = y;
      return m;
    }
    // プレイヤーの画面座標を受けて照準角を返す。null なら自動照準
    aim(px, py) {
      const P = this.pad;
      if (P.on && (Math.abs(P.rx) > 0.2 || Math.abs(P.ry) > 0.2)) return Math.atan2(P.ry, P.rx);
      if (this.device === 'touch') {
        const t = this.tAim;
        if (t.id !== null) {
          const dx = t.x - t.ox, dy = t.y - t.oy;
          if (dx * dx + dy * dy > 100) t.ang = Math.atan2(dy, dx);
          return t.ang;
        }
        return null;
      }
      if (this.device === 'pad') return null;
      return Math.atan2(this.mouse.y - py, this.mouse.x - px);
    }
    firing() {
      return this.mouse.down || this.pad.rt > 0.3 || this.tAim.id !== null;
    }
    hit(action) {
      const list = ACTIONS[action];
      for (let i = 0; i < list.length; i++) if (this.pressed.has(list[i])) return true;
      return false;
    }
    // 押下を消費する(1フレームに複数回更新しても1回だけ反応させる)
    take(action) {
      const list = ACTIONS[action];
      let hit = false;
      for (let i = 0; i < list.length; i++) if (this.pressed.delete(list[i])) hit = true;
      return hit;
    }
    endFrame() { this.pressed.clear(); }
  }

  NR.Input = Input;
})();
