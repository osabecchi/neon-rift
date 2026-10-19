'use strict';
/* NEON RIFT — 共通ユーティリティ(数学・乱数・プール・空間ハッシュ) */
(function () {
  const NR = (window.NR = window.NR || {});
  const TAU = Math.PI * 2;

  const U = {
    TAU,
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    // フレームレートに依存しない追従
    damp(a, b, rate, dt) { return b + (a - b) * Math.exp(-rate * dt); },
    smooth(t) { return t * t * (3 - 2 * t); },
    wrapAngle(a) {
      a = (a + Math.PI) % TAU;
      if (a < 0) a += TAU;
      return a - Math.PI;
    },
    angleDiff(a, b) { return U.wrapAngle(b - a); },
    turnTo(cur, target, step) {
      const d = U.wrapAngle(target - cur);
      return cur + (d > step ? step : d < -step ? -step : d);
    },
    dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
    // 点と線分の距離の二乗
    segDist2(px, py, ax, ay, bx, by) {
      const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
      const l2 = vx * vx + vy * vy;
      let t = l2 > 0 ? (wx * vx + wy * vy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = wx - vx * t, dy = wy - vy * t;
      return dx * dx + dy * dy;
    },
    easeOutCubic(t) { return 1 - (1 - t) ** 3; },
    easeInCubic(t) { return t * t * t; },
    easeOutBack(t) { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
    easeOutExpo(t) { return t >= 1 ? 1 : 1 - 2 ** (-10 * t); },
    fmt(n) { return Math.floor(n).toLocaleString('en-US'); },
    fmtTime(s) {
      s = Math.max(0, Math.floor(s));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },
    hex(c) {
      const n = parseInt(c.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    },
    mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; },
    hsl(h, s, l) {
      const k = (n) => (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
      return [f(0), f(8), f(4)];
    },
    todayKey() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    todaySeed() {
      const d = new Date();
      return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    },
  };

  // シード付き乱数(mulberry32)。ゲーム進行に使う
  function RNG(seed) {
    let a = (seed >>> 0) || 1;
    const f = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + (hi - lo) * f();
    f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    f.angle = () => f() * TAU;
    f.sign = () => (f() < 0.5 ? -1 : 1);
    f.weighted = (list) => {
      let sum = 0;
      for (const it of list) sum += it.w;
      let r = f() * sum;
      for (const it of list) { r -= it.w; if (r <= 0) return it; }
      return list[list.length - 1];
    };
    return f;
  }

  // 演出用の乱数(再現性不要)
  const R = {
    range(lo, hi) { return lo + (hi - lo) * Math.random(); },
    int(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); },
    angle() { return Math.random() * TAU; },
    pick(a) { return a[(Math.random() * a.length) | 0]; },
    sign() { return Math.random() < 0.5 ? -1 : 1; },
  };

  // 使い回しプール。free() は配列を後ろから回すときに使う
  class Pool {
    constructor(factory, size, max = Infinity) {
      this.factory = factory;
      this.items = [];
      this.count = 0;
      this.max = max;
      for (let i = 0; i < size; i++) this.items.push(factory());
    }
    get() {
      if (this.count >= this.items.length) {
        if (this.items.length >= this.max) return null;
        this.items.push(this.factory());
      }
      return this.items[this.count++];
    }
    free(i) {
      const last = --this.count;
      if (i !== last) {
        const t = this.items[i];
        this.items[i] = this.items[last];
        this.items[last] = t;
      }
    }
    clear() { this.count = 0; }
  }

  // 一様グリッドの空間ハッシュ(連結リストを型付き配列で持つので毎フレーム確保しない)
  class SpatialHash {
    constructor(w, h, cell) {
      this.cell = cell;
      this.inv = 1 / cell;
      this.ox = -cell * 2;
      this.oy = -cell * 2;
      this.cols = Math.ceil(w / cell) + 4;
      this.rows = Math.ceil(h / cell) + 4;
      this.heads = new Int32Array(this.cols * this.rows).fill(-1);
      this.cap = 4096;
      this.next = new Int32Array(this.cap);
      this.objs = new Array(this.cap);
      this.n = 0;
      this.stamp = 1;
    }
    clear() { this.heads.fill(-1); this.n = 0; }
    _cx(x) { const c = ((x - this.ox) * this.inv) | 0; return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c; }
    _cy(y) { const c = ((y - this.oy) * this.inv) | 0; return c < 0 ? 0 : c >= this.rows ? this.rows - 1 : c; }
    insert(o, x, y, r) {
      const c0 = this._cx(x - r), c1 = this._cx(x + r), r0 = this._cy(y - r), r1 = this._cy(y + r);
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          if (this.n >= this.cap) this._grow();
          const idx = cy * this.cols + cx;
          this.objs[this.n] = o;
          this.next[this.n] = this.heads[idx];
          this.heads[idx] = this.n++;
        }
      }
    }
    _grow() {
      const nc = this.cap * 2;
      const nn = new Int32Array(nc);
      nn.set(this.next);
      this.next = nn;
      this.objs.length = nc;
      this.cap = nc;
    }
    // 円に重なりうるオブジェクトを out に重複なしで詰め、個数を返す
    query(x, y, r, out) {
      const stamp = ++this.stamp;
      const c0 = this._cx(x - r), c1 = this._cx(x + r), r0 = this._cy(y - r), r1 = this._cy(y + r);
      let k = 0;
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          for (let i = this.heads[cy * this.cols + cx]; i !== -1; i = this.next[i]) {
            const o = this.objs[i];
            if (o._qs !== stamp) { o._qs = stamp; out[k++] = o; }
          }
        }
      }
      return k;
    }
  }

  NR.U = U;
  NR.RNG = RNG;
  NR.R = R;
  NR.Pool = Pool;
  NR.SpatialHash = SpatialHash;
  NR.TAU = TAU;
})();
