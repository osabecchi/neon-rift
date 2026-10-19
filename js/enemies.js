'use strict';
/* NEON RIFT — 敵の行動パターン(雑魚13種) */
(function () {
  const NR = window.NR;
  const { U, R, TAU } = NR;
  const C = {};
  for (const k in NR.COL) C[k] = U.hex(NR.COL[k]);
  const AI = {};

  function chase(g, e, dt, turn, lead) {
    const p = g.player;
    const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead;
    e.dir = U.turnTo(e.dir, Math.atan2(ty - e.y, tx - e.x), turn * dt);
    e.vx = Math.cos(e.dir) * e.speed;
    e.vy = Math.sin(e.dir) * e.speed;
  }

  AI.wanderer = {
    init(g, e) { e.dir = g.rng.angle(); e.a = g.rng.range(-1, 1); },
    update(g, e, dt) {
      if (Math.random() < dt * 0.6) e.a = R.range(-1.4, 1.4);
      e.dir += e.a * dt;
      e.dir = U.turnTo(e.dir, g.angleTo(e), 0.6 * dt);
      e.vx = Math.cos(e.dir) * e.speed;
      e.vy = Math.sin(e.dir) * e.speed;
      e.rot += 2.6 * dt;
    },
  };

  AI.chaser = {
    init(g, e) { e.dir = g.angleTo(e); },
    update(g, e, dt) {
      chase(g, e, dt, 3.2, 0.25);
      e.rot = e.dir;
    },
  };
  AI.mini = {
    init(g, e) { e.dir = g.angleTo(e); },
    update(g, e, dt) {
      chase(g, e, dt, 4, 0.1);
      e.rot += 4 * dt;
    },
  };

  AI.swarmer = {
    init(g, e) { e.dir = g.angleTo(e); e.a = Math.random() * 10; },
    update(g, e, dt) {
      const want = g.angleTo(e) + Math.sin(e.t * 5 + e.a) * 0.7;
      e.dir = U.turnTo(e.dir, want, 4.5 * dt);
      e.vx = Math.cos(e.dir) * e.speed;
      e.vy = Math.sin(e.dir) * e.speed;
      e.rot = e.dir;
    },
  };

  AI.dasher = {
    init(g, e) { e.state = 0; e.st = 0; e.dir = g.angleTo(e); },
    update(g, e, dt) {
      e.st += dt;
      const p = g.player;
      if (e.state === 0) {
        chase(g, e, dt, 2.5, 0);
        if (e.st > 1 && g.distTo(e) < 400) {
          e.state = 1; e.st = 0;
          e.a = Math.atan2(p.y + p.vy * 0.3 - e.y, p.x + p.vx * 0.3 - e.x);
        }
      } else if (e.state === 1) {
        e.vx *= Math.exp(-10 * dt);
        e.vy *= Math.exp(-10 * dt);
        e.dir = U.turnTo(e.dir, e.a, 8 * dt);
        if (e.st > (e.elite ? 0.5 : 0.7)) { e.state = 2; e.st = 0; e.dir = e.a; }
      } else if (e.state === 2) {
        const sp = e.speed * 8;
        e.vx = Math.cos(e.a) * sp;
        e.vy = Math.sin(e.a) * sp;
        if (Math.random() < 0.6) g.particles.emit(g.r.S.spark, e.x, e.y, -e.vx * 0.2, -e.vy * 0.2, 0.25, 10, 4, e.col, 0.8, 2, 1, 0.3);
        if (e.st > 0.45) { e.state = 3; e.st = 0; }
      } else {
        e.vx *= Math.exp(-6 * dt);
        e.vy *= Math.exp(-6 * dt);
        if (e.st > 0.8) { e.state = 0; e.st = 0; }
      }
      e.rot = e.dir;
    },
    render(g, e, r) {
      if (e.state !== 1) return;
      const a = 0.25 + 0.5 * Math.abs(Math.sin(e.st * 22));
      const x2 = e.x + Math.cos(e.a) * 440, y2 = e.y + Math.sin(e.a) * 440;
      r.beam(r.S.beam, e.x, e.y, x2, y2, 6, e.col[0], e.col[1], e.col[2], a, 0.3);
    },
  };

  AI.gunner = {
    init(g, e) { e.fireT = g.rng.range(1.2, 2.4); e.a = g.rng.sign(); e.st = 0; },
    update(g, e, dt) {
      const d = g.distTo(e), ang = g.angleTo(e);
      const mv = d > 420 ? 1 : d < 290 ? -1 : 0;
      e.st += dt;
      if (e.st > 2.5) { e.st = 0; e.a = -e.a; }
      const sa = ang + (Math.PI / 2) * e.a;
      e.vx = (Math.cos(ang) * mv + Math.cos(sa) * 0.6) * e.speed;
      e.vy = (Math.sin(ang) * mv + Math.sin(sa) * 0.6) * e.speed;
      e.rot = ang;
      e.fireT -= dt;
      e.charge = e.fireT < 0.4 ? 1 - e.fireT / 0.4 : 0;
      if (e.fireT <= 0) {
        e.fireT = Math.max(1.3, 2.4 - g.wave * 0.04) * (e.elite ? 0.65 : 1);
        const n = g.wave >= 14 ? 5 : g.wave >= 8 ? 3 : 1;
        g.fan(e.x, e.y, ang, n, 0.22 * (n - 1), 210 + Math.min(g.wave, 25) * 4, { col: C.yellow });
        g.audio.play('eshoot');
      }
    },
  };

  AI.splitter = {
    init(g, e) { e.dir = g.angleTo(e); },
    update(g, e, dt) {
      chase(g, e, dt, 2, 0);
      e.rot += 1.2 * dt;
    },
    onDeath(g, e) {
      for (let i = 0; i < 3; i++) {
        const a = e.dir + (i * TAU) / 3;
        const m = g.spawnEnemy('mini', e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, { instant: true, elite: false });
        if (m) { m.kx = Math.cos(a) * 260; m.ky = Math.sin(a) * 260; }
      }
    },
  };

  AI.spinner = {
    init(g, e) { e.fireT = g.rng.range(1.5, 3); e.a = g.rng.angle(); e.tx = e.x; e.ty = e.y; e.st = 0; e.burst = 0; },
    update(g, e, dt) {
      const p = g.player;
      e.st -= dt;
      if (e.st <= 0) {
        e.st = 3;
        const a = g.rng.angle(), d = g.rng.range(260, 420);
        e.tx = U.clamp(p.x + Math.cos(a) * d, 60, g.W - 60);
        e.ty = U.clamp(p.y + Math.sin(a) * d, 60, g.H - 60);
      }
      const dx = e.tx - e.x, dy = e.ty - e.y, dd = Math.sqrt(dx * dx + dy * dy);
      if (dd > 20) { e.vx = (dx / dd) * e.speed * 2; e.vy = (dy / dd) * e.speed * 2; } else { e.vx *= 0.9; e.vy *= 0.9; }
      e.rot += 1.6 * dt;
      e.fireT -= dt;
      if (e.fireT <= 0) { e.fireT = e.elite ? 2.4 : 3.4; e.burst = 2; e.bt = 0; }
      if (e.burst > 0) {
        e.bt -= dt;
        if (e.bt <= 0) {
          e.bt = 0.14; e.burst--; e.a += 0.22;
          g.ring(e.x, e.y, g.wave >= 12 ? 10 : 8, 150 + Math.min(g.wave, 25) * 2, e.a, { col: C.orange });
          g.audio.play('eshoot');
        }
      }
    },
  };

  AI.shield = {
    init(g, e) { e.dir = g.angleTo(e); },
    update(g, e, dt) {
      e.dir = U.turnTo(e.dir, g.angleTo(e), 1.3 * dt);
      e.vx = Math.cos(e.dir) * e.speed;
      e.vy = Math.sin(e.dir) * e.speed;
      e.rot = e.dir;
    },
    blocks(g, e, bx, by) {
      return Math.abs(U.angleDiff(e.dir, Math.atan2(by - e.y, bx - e.x))) < 1.05;
    },
    render(g, e, r) {
      const S = r.S.shieldArc, s = (e.r + 11) * 2 * S.unit;
      r.spr(S, e.x, e.y, s, s, e.dir, 0.75, 0.9, 1, 0.95, 0.8, 0);
    },
  };

  function bomberBlast(g, e, self) {
    const rad = 115;
    g.aoe(e.x, e.y, rad, 40 + g.wave * 8, 'chain', { knock: 280, exclude: e });
    const p = g.player;
    if (self && U.dist2(e.x, e.y, p.x, p.y) < (rad + p.r) * (rad + p.r)) g.hurtPlayer(1, e.x, e.y);
    if (self && g.wave >= 10) g.ring(e.x, e.y, 8, 170, g.rng.angle(), { col: C.orange });
    g.fx.explosion(e.x, e.y, e.col, 1.6);
    g.fx.ring(e.x, e.y, C.orange, 20, rad, 0.35, 0.8);
    g.audio.play('explode');
    g.shake(0.14);
  }
  AI.bomber = {
    init(g, e) { e.state = 0; e.dir = g.angleTo(e); },
    update(g, e, dt) {
      const d = g.distTo(e);
      if (e.state === 0) {
        const boost = 1 + Math.max(0, (320 - d) / 320) * 0.9;
        chase(g, e, dt, 3, 0.1);
        e.vx *= boost; e.vy *= boost;
        if (d < 80) { e.state = 1; e.st = 0; g.audio.play('charge'); }
        e.rot += 3 * dt;
      } else if (e.state === 1) {
        e.st += dt;
        e.vx *= Math.exp(-8 * dt);
        e.vy *= Math.exp(-8 * dt);
        e.rot += 14 * dt;
        e.flash = Math.sin(e.st * 40) > 0 ? 0.05 : 0;
        if (e.st >= 0.55) { e.state = 2; g.kill(e, 'self'); }
      }
    },
    render(g, e, r) {
      if (e.state !== 1) return;
      const k = r.S.ringThin.unit * 2 * 115 * Math.min(1, e.st / 0.55);
      r.spr(r.S.ringThin, e.x, e.y, k, k, 0, 1, 0.45, 0.25, 0.6, 0, 0);
    },
    onDeath(g, e) { bomberBlast(g, e, e.state === 2); },
  };

  AI.serpent = {
    init(g, e, o) {
      e.dir = g.angleTo(e);
      e.trail = [];
      e.segs = [];
      e.segIds = [];
      const n = 10;
      for (let i = 0; i < n; i++) {
        const s = g.spawnEnemy('segment', e.x, e.y, { instant: true, parent: e, idx: i, elite: e.elite });
        if (s) { e.segs.push(s); e.segIds.push(s.id); }
      }
    },
    update(g, e, dt) {
      const want = g.angleTo(e) + Math.sin(e.t * 2.6) * 0.8;
      e.dir = U.turnTo(e.dir, want, 2.4 * dt);
      e.vx = Math.cos(e.dir) * e.speed;
      e.vy = Math.sin(e.dir) * e.speed;
      e.rot = e.dir;
      const tr = e.trail;
      if (tr.length < 2 || U.dist2(tr[0], tr[1], e.x, e.y) >= 25) {
        tr.unshift(e.x, e.y);
        const max = (e.segs.length + 2) * 5 * 2 + 2;
        if (tr.length > max) tr.length = max;
      }
      for (let i = 0; i < e.segs.length; i++) {
        const s = e.segs[i];
        if (s.dead || s.id !== e.segIds[i]) continue;
        const k = (i + 1) * 5 * 2;
        if (k + 3 < tr.length) {
          s.x = tr[k]; s.y = tr[k + 1];
          s.rot = Math.atan2(tr[k - 1] - tr[k + 1], tr[k - 2] - tr[k]);
        }
      }
    },
    onDeath(g, e) {
      for (let i = 0; i < e.segs.length; i++) {
        const s = e.segs[i], id = e.segIds[i];
        g.timer(0.05 * (i + 1), () => { if (!s.dead && s.id === id) g.kill(s, 'chain'); });
      }
    },
  };
  AI.segment = {
    init(g, e) { e.noSep = true; e.knockRes = 0; },
    update(g, e, dt) {
      e.vx = 0; e.vy = 0;
      if (!e.parent || e.parent.dead || e.parent.id !== e.parentId) {
        e.orphanT = (e.orphanT || 0) + dt;
        if (e.orphanT > 1.5) g.kill(e, 'chain');
      }
    },
  };

  AI.blinker = {
    init(g, e) { e.state = 0; e.st = g.rng.range(0.5, 1.5); },
    update(g, e, dt) {
      const p = g.player;
      e.st -= dt;
      e.vx = 0; e.vy = 0;
      e.rot += 1.2 * dt;
      if (e.state === 0 && e.st <= 0) {
        const a = g.rng.angle(), d = g.rng.range(190, 270);
        e.tx = U.clamp(p.x + Math.cos(a) * d, 40, g.W - 40);
        e.ty = U.clamp(p.y + Math.sin(a) * d, 40, g.H - 40);
        e.state = 1; e.st = 0.65;
      } else if (e.state === 1 && e.st <= 0) {
        g.fx.sparks(e.x, e.y, 10, e.col, 80, 260, 0.3, 6);
        e.x = e.tx; e.y = e.ty;
        g.fx.glow(e.x, e.y, e.col, 90, 0.2, 1, 0.8);
        g.ring(e.x, e.y, g.wave >= 16 ? 14 : 10, 165, g.rng.angle(), { col: C.violet });
        g.audio.play('eshoot');
        e.state = 0; e.st = e.elite ? 1.6 : 2.4;
      }
    },
    render(g, e, r) {
      if (e.state !== 1) return;
      const k = 1 - e.st / 0.65, s = r.S.warn.unit * 2 * (22 + 10 * (1 - k));
      r.spr(r.S.warn, e.tx, e.ty, s, s, k * 3, e.col[0], e.col[1], e.col[2], 0.4 + 0.6 * k, 0.4, 0);
    },
  };

  const Qm = [];
  AI.mender = {
    init(g, e) { e.fireT = 2.5; e.a = g.rng.sign(); },
    update(g, e, dt) {
      const d = g.distTo(e), ang = g.angleTo(e);
      const mv = d > 520 ? 1 : d < 380 ? -1 : 0;
      const sa = ang + (Math.PI / 2) * e.a;
      e.vx = (Math.cos(ang) * mv + Math.cos(sa) * 0.4) * e.speed;
      e.vy = (Math.sin(ang) * mv + Math.sin(sa) * 0.4) * e.speed;
      e.rot += dt;
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = 3.2;
        const k = g.queryEnemies(e.x, e.y, 240, Qm);
        let healed = 0;
        for (let i = 0; i < k; i++) {
          const o = Qm[i];
          if (o === e || o.dead || o.boss || o.hp >= o.maxHp) continue;
          if (U.dist2(o.x, o.y, e.x, e.y) > 240 * 240) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.25);
          g.addFx('heal', { x: e.x, y: e.y, x2: o.x, y2: o.y, life: 0.35, col: e.col });
          if (++healed >= 8) break;
        }
        if (healed) g.fx.ring(e.x, e.y, e.col, 10, 240, 0.4, 0.6, true);
      }
    },
  };

  AI.voidling = {
    init(g, e) { e.knockRes = 0.2; },
    update(g, e, dt) {
      const p = g.player, d = g.distTo(e), ang = g.angleTo(e);
      e.vx = Math.cos(ang) * e.speed;
      e.vy = Math.sin(ang) * e.speed;
      if (d < 360 && d > 1) {
        const f = 250 * (1 - d / 360);
        p.pullX += ((e.x - p.x) / d) * f;
        p.pullY += ((e.y - p.y) / d) * f;
      }
      g.voids.push(e);
      g.grid.pull(e.x, e.y, 220, 1.1);
      e.rot -= 1.5 * dt;
      if (Math.random() < 0.5) {
        const a = Math.random() * TAU, rr = R.range(60, 120);
        const px = e.x + Math.cos(a) * rr, py = e.y + Math.sin(a) * rr;
        g.particles.emit(g.r.S.spark, px, py, (e.x - px) * 2.5, (e.y - py) * 2.5, 0.35, 6, 2, e.col, 0.8, 1, 1, 0.2);
      }
    },
    draw(g, e, r) {
      const dk = e.r * 0.8 * 2 * r.S.disc.unit;
      r.spr(r.S.soft, e.x, e.y, e.r * 7, e.r * 7, 0, e.col[0], e.col[1], e.col[2], 0.3, 0, 0);
      r.spr(r.S.disc, e.x, e.y, dk, dk, 0, 0, 0, 0, 1, 0, 1);
    },
    onDeath(g, e) {
      g.aoe(e.x, e.y, 200, 120 + g.wave * 10, 'chain', { knock: 320, exclude: e });
      g.fx.explosion(e.x, e.y, e.col, 2.4, 1.5);
      g.shock(e.x, e.y, 0.02, 200, 0.5);
      g.audio.play('explode');
      g.shake(0.2);
    },
  };

  NR.AI = AI;
})();
