'use strict';
/* NEON RIFT — 演出(パーティクル・歪むグリッド・星空) */
(function () {
  const NR = window.NR;
  const { U, R } = NR;

  // パーティクル(構造体の配列ではなく配列の構造体で持つ)
  class Particles {
    constructor(max) { this.setMax(max); }
    setMax(max) {
      this.max = max;
      this.n = 0;
      const F = () => new Float32Array(max);
      this.x = F(); this.y = F(); this.vx = F(); this.vy = F();
      this.life = F(); this.ml = F(); this.s0 = F(); this.s1 = F();
      this.r = F(); this.g = F(); this.b = F(); this.a = F();
      this.drag = F(); this.rot = F(); this.vr = F(); this.hot = F();
      this.fl = new Uint8Array(max);
      this.spr = new Array(max);
    }
    clear() { this.n = 0; }
    // fl: 1=速度方向に伸ばす 2=通常合成(暗い煙など)
    emit(spr, x, y, vx, vy, life, s0, s1, c, a, drag, fl, hot, rot, vr) {
      if (this.n >= this.max) return;
      const i = this.n++;
      this.spr[i] = spr;
      this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
      this.life[i] = life; this.ml[i] = life; this.s0[i] = s0; this.s1[i] = s1;
      this.r[i] = c[0]; this.g[i] = c[1]; this.b[i] = c[2]; this.a[i] = a;
      this.drag[i] = drag; this.fl[i] = fl; this.hot[i] = hot || 0;
      this.rot[i] = rot || 0; this.vr[i] = vr || 0;
    }
    copy(s, d) {
      this.spr[d] = this.spr[s];
      this.x[d] = this.x[s]; this.y[d] = this.y[s]; this.vx[d] = this.vx[s]; this.vy[d] = this.vy[s];
      this.life[d] = this.life[s]; this.ml[d] = this.ml[s]; this.s0[d] = this.s0[s]; this.s1[d] = this.s1[s];
      this.r[d] = this.r[s]; this.g[d] = this.g[s]; this.b[d] = this.b[s]; this.a[d] = this.a[s];
      this.drag[d] = this.drag[s]; this.fl[d] = this.fl[s]; this.hot[d] = this.hot[s];
      this.rot[d] = this.rot[s]; this.vr[d] = this.vr[s];
    }
    update(dt) {
      let n = this.n;
      for (let i = n - 1; i >= 0; i--) {
        const l = this.life[i] - dt;
        if (l <= 0) {
          n--;
          if (i !== n) this.copy(n, i);
          continue;
        }
        this.life[i] = l;
        const k = Math.exp(-this.drag[i] * dt);
        this.vx[i] *= k;
        this.vy[i] *= k;
        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        this.rot[i] += this.vr[i] * dt;
      }
      this.n = n;
    }
    render(r) {
      for (let i = 0; i < this.n; i++) {
        const t = this.life[i] / this.ml[i];
        const s = this.s1[i] + (this.s0[i] - this.s1[i]) * t;
        const a = this.a[i] * (t < 0.45 ? t / 0.45 : 1);
        const fl = this.fl[i];
        if (fl & 1) {
          const vx = this.vx[i], vy = this.vy[i];
          const sp = Math.sqrt(vx * vx + vy * vy);
          r.spr(this.spr[i], this.x[i], this.y[i], s * 2 + sp * 0.04, s * 0.55, Math.atan2(vy, vx), this.r[i], this.g[i], this.b[i], a, this.hot[i], 0);
        } else {
          r.spr(this.spr[i], this.x[i], this.y[i], s, s, this.rot[i], this.r[i], this.g[i], this.b[i], a, this.hot[i], fl & 2 ? 1 : 0);
        }
      }
    }
  }

  // ばねで繋がった背景グリッド(爆発で波打ち、重力で凹む)
  class Grid {
    constructor(w, h, spacing) { this.build(w, h, spacing); }
    build(w, h, sp) {
      const margin = sp * 2;
      this.w = w; this.h = h; this.sp = sp;
      this.x0 = -margin; this.y0 = -margin;
      this.cols = Math.round((w + margin * 2) / sp) + 1;
      this.rows = Math.round((h + margin * 2) / sp) + 1;
      const N = this.cols * this.rows;
      const F = () => new Float32Array(N);
      this.px = F(); this.py = F(); this.ox = F(); this.oy = F();
      this.vx = F(); this.vy = F(); this.ax = F(); this.ay = F();
      this.im = F(); this.br = F();
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const i = r * this.cols + c;
          this.ox[i] = this.px[i] = this.x0 + c * sp;
          this.oy[i] = this.py[i] = this.y0 + r * sp;
          this.im[i] = r === 0 || c === 0 || r === this.rows - 1 || c === this.cols - 1 ? 0 : 1;
        }
      }
      this.acc = 0;
      this.active = 0;
    }
    reset() {
      this.px.set(this.ox); this.py.set(this.oy);
      this.vx.fill(0); this.vy.fill(0);
    }
    update(dt) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= 1 / 60 && steps < 3) { this.step(); this.acc -= 1 / 60; steps++; }
      if (steps >= 3) this.acc = 0;
    }
    step() {
      const { cols, rows, px, py, vx, vy, ox, oy, im, ax, ay } = this;
      const k = 0.26, d = 0.05, kA = 0.014, dA = 0.03, rest = this.sp * 0.95;
      ax.fill(0); ay.fill(0);
      for (let r = 0; r < rows; r++) {
        let i = r * cols;
        for (let c = 0; c < cols - 1; c++, i++) {
          const j = i + 1;
          const dx = px[j] - px[i], dy = py[j] - py[i];
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > rest) {
            const f = ((len - rest) / len) * k;
            const fx = dx * f + (vx[j] - vx[i]) * d, fy = dy * f + (vy[j] - vy[i]) * d;
            ax[i] += fx; ay[i] += fy; ax[j] -= fx; ay[j] -= fy;
          }
        }
      }
      for (let r = 0; r < rows - 1; r++) {
        let i = r * cols;
        for (let c = 0; c < cols; c++, i++) {
          const j = i + cols;
          const dx = px[j] - px[i], dy = py[j] - py[i];
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > rest) {
            const f = ((len - rest) / len) * k;
            const fx = dx * f + (vx[j] - vx[i]) * d, fy = dy * f + (vy[j] - vy[i]) * d;
            ax[i] += fx; ay[i] += fy; ax[j] -= fx; ay[j] -= fy;
          }
        }
      }
      const N = cols * rows;
      for (let i = 0; i < N; i++) {
        if (!im[i]) continue;
        const fx = ax[i] + (ox[i] - px[i]) * kA - vx[i] * dA;
        const fy = ay[i] + (oy[i] - py[i]) * kA - vy[i] * dA;
        let nvx = (vx[i] + fx) * 0.97, nvy = (vy[i] + fy) * 0.97;
        if (nvx > 40) nvx = 40; else if (nvx < -40) nvx = -40;
        if (nvy > 40) nvy = 40; else if (nvy < -40) nvy = -40;
        vx[i] = nvx; vy[i] = nvy;
        px[i] += nvx; py[i] += nvy;
      }
    }
    range(x, y, rad) {
      const { sp, x0, y0, cols, rows } = this;
      return [
        Math.max(1, Math.floor((x - rad - x0) / sp)), Math.min(cols - 2, Math.ceil((x + rad - x0) / sp)),
        Math.max(1, Math.floor((y - rad - y0) / sp)), Math.min(rows - 2, Math.ceil((y + rad - y0) / sp)),
      ];
    }
    // 外向きの衝撃(strengthは1フレームあたりの移動量)
    impulse(x, y, rad, strength) {
      const [c0, c1, r0, r1] = this.range(x, y, rad);
      const { px, py, vx, vy, cols } = this;
      const r2 = rad * rad;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = r * cols + c;
          const dx = px[i] - x, dy = py[i] - y, d2 = dx * dx + dy * dy;
          if (d2 < r2) {
            const dd = Math.sqrt(d2) + 0.001, t = 1 - dd / rad;
            const f = (strength * t * t) / dd;
            vx[i] += dx * f; vy[i] += dy * f;
          }
        }
      }
    }
    // 内向きの引力
    pull(x, y, rad, strength) {
      const [c0, c1, r0, r1] = this.range(x, y, rad);
      const { px, py, vx, vy, cols } = this;
      const r2 = rad * rad;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = r * cols + c;
          const dx = x - px[i], dy = y - py[i], d2 = dx * dx + dy * dy;
          if (d2 < r2 && d2 > 16) {
            const dd = Math.sqrt(d2), t = 1 - dd / rad;
            const f = (strength * t * Math.min(1, dd / 40)) / dd;
            vx[i] += dx * f; vy[i] += dy * f;
          }
        }
      }
    }
    render(r, th) {
      const { px, py, ox, oy, cols, rows, sp, x0, y0, br } = this;
      const m = sp * 2;
      const c0 = Math.max(0, Math.floor((r.vl - m - x0) / sp)), c1 = Math.min(cols - 1, Math.ceil((r.vr + m - x0) / sp));
      const r0 = Math.max(0, Math.floor((r.vt - m - y0) / sp)), r1 = Math.min(rows - 1, Math.ceil((r.vb + m - y0) / sp));
      for (let rr = r0; rr <= r1; rr++) {
        for (let cc = c0; cc <= c1; cc++) {
          const i = rr * cols + cc;
          const dx = px[i] - ox[i], dy = py[i] - oy[i];
          const d = Math.sqrt(dx * dx + dy * dy);
          br[i] = d > 30 ? 1 : d / 30;
        }
      }
      const b = th.base, h = th.hi, A = th.a;
      for (let rr = r0; rr <= r1; rr++) {
        const major = rr % 4 === 0;
        const la = A * (major ? 1.9 : 1);
        for (let cc = c0; cc < c1; cc++) {
          const i = rr * cols + cc, j = i + 1;
          const ti = br[i], tj = br[j];
          r.line(px[i], py[i], px[j], py[j],
            b[0] + (h[0] - b[0]) * ti, b[1] + (h[1] - b[1]) * ti, b[2] + (h[2] - b[2]) * ti, la + ti * 0.7,
            b[0] + (h[0] - b[0]) * tj, b[1] + (h[1] - b[1]) * tj, b[2] + (h[2] - b[2]) * tj, la + tj * 0.7);
        }
      }
      for (let cc = c0; cc <= c1; cc++) {
        const major = cc % 4 === 0;
        const la = A * (major ? 1.9 : 1);
        for (let rr = r0; rr < r1; rr++) {
          const i = rr * cols + cc, j = i + cols;
          const ti = br[i], tj = br[j];
          r.line(px[i], py[i], px[j], py[j],
            b[0] + (h[0] - b[0]) * ti, b[1] + (h[1] - b[1]) * ti, b[2] + (h[2] - b[2]) * ti, la + ti * 0.7,
            b[0] + (h[0] - b[0]) * tj, b[1] + (h[1] - b[1]) * tj, b[2] + (h[2] - b[2]) * tj, la + tj * 0.7);
        }
      }
    }
  }

  // 視差スクロールする星空
  class Stars {
    constructor(count) { this.build(count); }
    build(count) {
      this.list = [];
      const tints = [[0.8, 0.9, 1], [1, 0.85, 0.95], [0.7, 0.85, 1], [1, 1, 1]];
      for (let i = 0; i < count; i++) {
        const layer = i % 3;
        this.list.push({
          x: Math.random() * 2600, y: Math.random() * 2600,
          f: [0.12, 0.25, 0.42][layer],
          s: [3, 4.5, 6.5][layer] * R.range(0.7, 1.3),
          a: [0.35, 0.55, 0.8][layer] * R.range(0.6, 1),
          ph: Math.random() * 10, c: R.pick(tints),
        });
      }
    }
    render(r, cx, cy, t) {
      const T = 2600, S = r.S.star16;
      for (const s of this.list) {
        let x = (s.x - cx * s.f + T / 2) % T; if (x < 0) x += T;
        let y = (s.y - cy * s.f + T / 2) % T; if (y < 0) y += T;
        const tw = 0.65 + 0.35 * Math.sin(t * 1.7 + s.ph);
        r.spr(S, cx - T / 2 + x, cy - T / 2 + y, s.s * 2.4, s.s * 2.4, 0, s.c[0], s.c[1], s.c[2], s.a * tw, 0.3, 0);
      }
    }
  }

  // よく使う演出をまとめたもの
  class FX {
    constructor(particles, grid, S) {
      this.p = particles;
      this.grid = grid;
      this.S = S;
      this.quality = 1;
    }
    sparks(x, y, n, c, spMin, spMax, life, size, ang, spread) {
      const p = this.p, S = this.S.spark;
      n = Math.max(1, Math.round(n * this.quality));
      for (let i = 0; i < n; i++) {
        const a = ang === undefined ? Math.random() * NR.TAU : ang + (Math.random() - 0.5) * spread;
        const sp = R.range(spMin, spMax);
        p.emit(S, x, y, Math.cos(a) * sp, Math.sin(a) * sp, life * R.range(0.6, 1.2), size, size * 0.4, c, 1, 3.2, 1, 0.5);
      }
    }
    glow(x, y, c, size, life, a = 1, hot = 0.4) {
      this.p.emit(this.S.glow, x, y, 0, 0, life, size, size * 0.3, c, a, 0, 0, hot);
    }
    ring(x, y, c, r0, r1, life, a = 1, thin) {
      const S = thin ? this.S.ringThin : this.S.ring;
      const k = S.unit * 2;
      this.p.emit(S, x, y, 0, 0, life, r0 * k, r1 * k, c, a, 0, 0, 0.3);
    }
    embers(x, y, n, c, sp, life, size) {
      const p = this.p, S = this.S.dot;
      n = Math.max(1, Math.round(n * this.quality));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * NR.TAU, v = Math.random() * sp;
        p.emit(S, x, y, Math.cos(a) * v, Math.sin(a) * v, life * R.range(0.5, 1.3), size * R.range(0.6, 1.4) * 3.2, size, c, 1, 1.6, 0, 0.6);
      }
    }
    explosion(x, y, c, scale = 1, gridForce = 1) {
      this.glow(x, y, c, 110 * scale, 0.28, 1, 1);
      this.glow(x, y, [1, 1, 1], 45 * scale, 0.12, 0.9, 1);
      this.sparks(x, y, 16 * scale, c, 160 * scale, 520 * scale, 0.55, 9 * Math.sqrt(scale));
      this.embers(x, y, 8 * scale, c, 140 * scale, 0.9, 2.2);
      this.ring(x, y, c, 6 * scale, 70 * scale, 0.32, 0.8);
      if (gridForce) this.grid.impulse(x, y, 160 * scale, 7 * scale * gridForce);
    }
    shockwave(x, y, c, rad, life) {
      this.ring(x, y, c, rad * 0.1, rad, life, 1);
      this.ring(x, y, [1, 1, 1], rad * 0.05, rad * 0.85, life * 0.8, 0.5, true);
      this.grid.impulse(x, y, rad * 1.4, 10);
    }
  }

  NR.Particles = Particles;
  NR.Grid = Grid;
  NR.Stars = Stars;
  NR.FX = FX;
})();
