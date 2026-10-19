'use strict';
/* NEON RIFT — 武装(メイン武装・サブ武装・進化武装・投射物・演出エフェクト) */
(function () {
  const NR = window.NR;
  const { U, R, TAU } = NR;
  const C = {};
  for (const k in NR.COL) C[k] = U.hex(NR.COL[k]);
  const WHITE = [1, 1, 1];

  const W = {}; // サブ武装
  const P = {}; // 投射物
  const E = {}; // エフェクト
  const Q = []; // 照会用の作業配列(武装専用)
  const Q2 = [];
  const pick = (arr, lv) => arr[Math.min(arr.length, lv) - 1];

  // ── メイン武装 ──
  const MainGun = {
    update(g, dt) {
      const p = g.player, s = p.stats;
      p.fireCd -= dt;
      if (!p.firing) { if (p.fireCd < 0) p.fireCd = 0; return; }
      let guard = 0;
      while (p.fireCd <= 0 && guard++ < 3) {
        p.fireCd += 1 / s.rate;
        this.volley(g, p, s);
      }
    },
    volley(g, p, s) {
      const n = s.count, aim = p.aim;
      const spread = s.spread + (n > 1 ? Math.min(0.1 * (n - 1), 0.7) : 0);
      const mx = p.x + Math.cos(aim) * 14, my = p.y + Math.sin(aim) * 14;
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) - 0.5 : 0;
        const a = aim + t * spread + (Math.random() - 0.5) * s.jitter * 2;
        const sp = s.bspeed * (1 + (Math.random() - 0.5) * s.speedVar);
        g.spawnPB(mx, my, a, sp, s.bdmg, s.br, s.blife, s.pierce, s.bounce, s.homing, 'main', 0);
      }
      if (s.tail >= 1) g.spawnPB(p.x, p.y, aim + Math.PI, s.bspeed * 0.9, s.bdmg * 0.7, s.br, s.blife * 0.8, s.pierce, 0, 0, 'tail', 0);
      if (s.tail >= 2) {
        g.spawnPB(p.x, p.y, aim + Math.PI - 0.45, s.bspeed * 0.9, s.bdmg * 0.7, s.br, s.blife * 0.8, s.pierce, 0, 0, 'tail', 0);
        g.spawnPB(p.x, p.y, aim + Math.PI + 0.45, s.bspeed * 0.9, s.bdmg * 0.7, s.br, s.blife * 0.8, s.pierce, 0, 0, 'tail', 0);
      }
      if (s.tail >= 3) {
        g.spawnPB(p.x, p.y, aim + Math.PI / 2, s.bspeed * 0.9, s.bdmg * 0.7, s.br, s.blife * 0.8, s.pierce, 0, 0, 'tail', 0);
        g.spawnPB(p.x, p.y, aim - Math.PI / 2, s.bspeed * 0.9, s.bdmg * 0.7, s.br, s.blife * 0.8, s.pierce, 0, 0, 'tail', 0);
      }
      g.fx.glow(mx, my, p.col, 26, 0.06, 0.7, 0.6);
      g.audio.play(s.spread > 0.3 ? 'shotgun' : 'shoot');
    },
  };

  // ── 共通処理 ──
  function bladeRing(g, w, ring, n, rad, ang, dmg, br, key, cd, erase) {
    const p = g.player;
    const pts = w.pts[ring] || (w.pts[ring] = []);
    pts.length = 0;
    for (let i = 0; i < n; i++) {
      const a = ang + (i * TAU) / n;
      const x = p.x + Math.cos(a) * rad, y = p.y + Math.sin(a) * rad;
      pts.push(x, y, a);
      const k = g.queryEnemies(x, y, br + 40, Q);
      for (let j = 0; j < k; j++) {
        const e = Q[j];
        if (e.dead) continue;
        const rr = e.r + br;
        if (U.dist2(x, y, e.x, e.y) < rr * rr && e.hitT[key] <= g.time) {
          e.hitT[key] = g.time + cd;
          g.damage(e, dmg, key, { knock: 150, kx: e.x - p.x, ky: e.y - p.y });
        }
      }
      if (erase) g.eraseBullets(x, y, br + 6);
    }
  }
  function renderBlades(g, w, r, ring, col, size) {
    const pts = w.pts[ring];
    if (!pts) return;
    const S = r.S.blade;
    for (let i = 0; i < pts.length; i += 3) {
      const x = pts[i], y = pts[i + 1], a = pts[i + 2];
      r.spr(S, x, y, size * 2.6, size * 2.6, a + Math.PI / 2, col[0], col[1], col[2], 1, 0.3, 0);
      r.spr(r.S.glow, x, y, size * 4, size * 4, 0, col[0], col[1], col[2], 0.18, 0, 0);
    }
  }
  function pickTargets(g, n, range) {
    const p = g.player;
    const k = g.queryEnemies(p.x, p.y, range, Q2);
    const list = [];
    for (let i = 0; i < k; i++) {
      const e = Q2[i];
      if (!e.dead && e.spawnT <= 0) list.push(e);
    }
    list.sort((a, b) => U.dist2(p.x, p.y, a.x, a.y) - U.dist2(p.x, p.y, b.x, b.y));
    if (list.length > n * 2) list.length = n * 2;
    for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = list[i]; list[i] = list[j]; list[j] = t; }
    return list;
  }
  function launchMissiles(g, n, dmg, blast, src, spread) {
    const p = g.player;
    const targets = pickTargets(g, n, 700);
    for (let i = 0; i < n; i++) {
      const o = g.proj('missile');
      if (!o) break;
      const t = n > 1 ? i / (n - 1) - 0.5 : 0;
      o.x = p.x; o.y = p.y;
      o.ang = p.aim + Math.PI + t * spread + R.range(-0.25, 0.25);
      o.spd = 240 + Math.random() * 60;
      o.life = 3.2; o.dmg = dmg; o.r = 9; o.a = blast; o.src = src;
      const e = targets.length ? targets[i % targets.length] : null;
      o.tgt = e; o.tgtId = e ? e.id : -1;
      o.col = C.orange;
    }
    g.audio.play('missile');
  }
  function explodeAt(g, x, y, rad, dmg, src, col, knock = 200) {
    g.aoe(x, y, rad, dmg, src, { knock });
    g.fx.explosion(x, y, col, rad / 75, 0.8);
    g.audio.play('explode');
    g.shake(0.06);
  }
  const chainHit = new Set();
  function chain(g, x, y, range, count, hop, dmg, src, randomStart, col) {
    chainHit.clear();
    let cx = x, cy = y;
    const pts = [x, y];
    for (let i = 0; i < count; i++) {
      let e = null;
      if (i === 0 && randomStart) {
        const k = g.queryEnemies(x, y, range, Q);
        const cand = [];
        for (let j = 0; j < k; j++) if (!Q[j].dead && Q[j].spawnT <= 0 && U.dist2(x, y, Q[j].x, Q[j].y) < range * range) cand.push(Q[j]);
        e = cand.length ? R.pick(cand) : null;
      } else {
        e = g.nearestEnemy(cx, cy, i === 0 ? range : hop, (en) => !chainHit.has(en.id));
      }
      if (!e) break;
      chainHit.add(e.id);
      pts.push(e.x, e.y);
      g.damage(e, dmg, src, { knock: 40, kx: e.x - cx, ky: e.y - cy });
      g.fx.glow(e.x, e.y, col, 40, 0.15, 0.9, 0.8);
      cx = e.x; cy = e.y;
    }
    if (pts.length > 2) {
      g.addFx('bolt', { pts, life: 0.2, col, w: 5 });
      g.audio.play('zap');
      return true;
    }
    return false;
  }
  function fireBeam(g, x, y, a, len, width, dmg, src, col, erase) {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    const cast = ++g.castId;
    const steps = Math.ceil(len / 80);
    const kx = Math.cos(a), ky = Math.sin(a);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, sx = x + (x2 - x) * t, sy = y + (y2 - y) * t;
      const k = g.queryEnemies(sx, sy, 50 + width, Q);
      for (let j = 0; j < k; j++) {
        const e = Q[j];
        if (e.dead || e.hitT[src] === cast) continue;
        const rr = e.r + width * 0.5;
        if (U.segDist2(e.x, e.y, x, y, x2, y2) < rr * rr) {
          e.hitT[src] = cast;
          g.damage(e, dmg, src, { knock: 70, kx, ky });
        }
      }
      if (erase) g.eraseBullets(sx, sy, width * 0.6 + 20);
    }
    return [x2, y2];
  }
  function novaBlast(g, rad, dmg, src, erase, slow, col, delay = 0) {
    const p = g.player;
    g.addFx('nova', { x: p.x, y: p.y, rad, dmg, src, erase, slow, t: -delay, dur: 0.38, cast: ++g.castId, col, fired: false });
  }
  function dropMine(g, x, y, dmg, rad, src, pull, cluster) {
    const o = g.proj('mine');
    if (!o) return;
    o.x = x; o.y = y; o.vx = 0; o.vy = 0; o.life = 7; o.dmg = dmg; o.a = rad; o.r = 10;
    o.src = src; o.state = pull ? 1 : 0; o.b = cluster ? 1 : 0; o.col = C.yellow;
  }
  function densest(g, range) {
    const p = g.player;
    const k = g.queryEnemies(p.x, p.y, range, Q2);
    let best = null, bestN = -1;
    const tries = Math.min(10, k);
    for (let t = 0; t < tries; t++) {
      const e = Q2[(Math.random() * k) | 0];
      if (!e || e.dead) continue;
      const n = g.countEnemies(e.x, e.y, 150);
      if (n > bestN) { bestN = n; best = e; }
    }
    if (best) return [best.x, best.y];
    return [p.x + Math.cos(p.aim) * 260, p.y + Math.sin(p.aim) * 260];
  }
  function spawnHole(g, x, y, rad, dmg, life, boom, src, xpBonus) {
    const o = g.proj('hole');
    if (!o) return;
    o.x = x; o.y = y; o.r = rad; o.dmg = dmg; o.life = life; o.a = boom; o.c = 0; o.src = src;
    o.b = xpBonus ? 1 : 0; o.col = C.violet;
    g.audio.play('charge');
  }
  function flameCone(g, x, y, ang, range, half, dmg, burn, src) {
    const k = g.queryEnemies(x, y, range + 30, Q);
    for (let j = 0; j < k; j++) {
      const e = Q[j];
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > range + e.r) continue;
      if (d > 8 && Math.abs(U.angleDiff(ang, Math.atan2(dy, dx))) > half + e.r / d) continue;
      g.damage(e, dmg, src, { quiet: true, knock: 20, kx: dx, ky: dy });
      e.burnT = 3;
      if (burn > e.burnD) e.burnD = burn;
      e.burnSrc = src;
    }
  }
  function flameFx(g, x, y, ang, range, half) {
    const n = Math.max(1, Math.round(3 * g.fx.quality));
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * half * 2;
      const sp = range * R.range(1.6, 2.4);
      const c = Math.random() < 0.5 ? C.orange : C.amber;
      g.particles.emit(g.r.S.glow, x + Math.cos(ang) * 14, y + Math.sin(ang) * 14, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.32, 0.45), 18, 46, c, 0.55, 2.2, 0, 0.3);
    }
  }
  function droneUpdate(g, w, dt, n, dmg, cd, pierce, rad, src, col) {
    const p = g.player, s = p.stats;
    w.ang = (w.ang || 0) + 1.6 * dt;
    if (!w.d) w.d = [];
    while (w.d.length < n) w.d.push({ x: p.x, y: p.y, cd: Math.random() * cd, a: 0 });
    for (let i = 0; i < n; i++) {
      const d = w.d[i];
      const a = w.ang + (i * TAU) / n;
      d.x = U.damp(d.x, p.x + Math.cos(a) * rad, 10, dt);
      d.y = U.damp(d.y, p.y + Math.sin(a) * rad, 10, dt);
      d.cd -= dt;
      if (d.cd <= 0) {
        const e = g.nearestEnemy(d.x, d.y, 480);
        if (e) {
          d.cd = cd * s.cd;
          d.a = Math.atan2(e.y - d.y, e.x - d.x);
          g.spawnPB(d.x, d.y, d.a, 840, dmg, 4.5, 0.75, pierce, 0, 0, src, 1);
        } else d.cd = 0.12;
      }
    }
    w.n = n;
    w.col = col;
  }
  function renderDrones(g, w, r) {
    if (!w.d) return;
    const col = w.col || C.green;
    for (let i = 0; i < w.n; i++) {
      const d = w.d[i];
      r.spr(r.S.drone, d.x, d.y, 40, 40, d.a, col[0], col[1], col[2], 1, 0.5, 0);
      r.spr(r.S.glow, d.x, d.y, 40, 40, 0, col[0], col[1], col[2], 0.3, 0, 0);
    }
  }

  // ── サブ武装 ──
  W.orbit = {
    update(g, w, dt) {
      const s = g.player.stats, lv = w.lv;
      w.ang = (w.ang || 0) + (lv >= 5 ? 4.3 : 3.3) * dt;
      w.pts = w.pts || [];
      bladeRing(g, w, 0, pick([2, 3, 3, 4, 5], lv), pick([70, 70, 86, 86, 96], lv) * s.area, w.ang, pick([14, 14, 20, 20, 26], lv) * s.dmg, 14 * s.area, 'orbit', 0.32, false);
    },
    render(g, w, r) { renderBlades(g, w, r, 0, C.ice, 14 * g.player.stats.area); },
  };
  W.saturn = {
    update(g, w, dt) {
      const s = g.player.stats;
      w.ang = (w.ang || 0) + 4.6 * dt;
      w.pts = w.pts || [];
      bladeRing(g, w, 0, 8, 118 * s.area, w.ang, 46 * s.dmg, 17 * s.area, 'saturn', 0.25, true);
      bladeRing(g, w, 1, 4, 64 * s.area, -w.ang * 1.3, 46 * s.dmg, 15 * s.area, 'saturn', 0.25, true);
      g.grid.pull(g.player.x, g.player.y, 160, 0.6);
    },
    render(g, w, r) {
      const s = g.player.stats;
      renderBlades(g, w, r, 0, C.ice, 17 * s.area);
      renderBlades(g, w, r, 1, C.cyan, 15 * s.area);
      const p = g.player, k = r.S.ringThin.unit * 2;
      r.spr(r.S.ringThin, p.x, p.y, 118 * s.area * k, 118 * s.area * k, 0, C.ice[0], C.ice[1], C.ice[2], 0.25, 0, 0);
    },
  };

  W.missile = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats, lv = w.lv;
      w.t = pick([1.6, 1.6, 1.6, 1.4, 1.4], lv) * s.cd;
      launchMissiles(g, pick([1, 2, 2, 3, 4], lv), pick([34, 34, 46, 46, 60], lv) * s.dmg, pick([55, 55, 66, 66, 74], lv) * s.area, 'missile', 1.1);
    },
  };
  W.barrage = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats;
      w.t = 1.25 * s.cd;
      launchMissiles(g, 12, 52 * s.dmg, 76 * s.area, 'barrage', 3.4);
    },
  };

  W.arc = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats, lv = w.lv, p = g.player;
      w.t = pick([1.3, 1.3, 1.1, 1.1, 1.0], lv) * s.cd;
      const chains = pick([4, 5, 5, 5, 7], lv), dmg = pick([26, 26, 38, 38, 50], lv) * s.dmg;
      chain(g, p.x, p.y, 400 * s.area, chains, 180 * s.area, dmg, 'arc', false, C.ice);
      if (lv >= 4) chain(g, p.x, p.y, 420 * s.area, chains, 180 * s.area, dmg, 'arc', true, C.ice);
    },
  };
  W.mjolnir = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats, p = g.player;
      w.t = 0.34 * s.cd;
      const k = g.queryEnemies(p.x, p.y, 650, Q2);
      const cand = [];
      for (let i = 0; i < k; i++) if (!Q2[i].dead && Q2[i].spawnT <= 0) cand.push(Q2[i]);
      if (!cand.length) { w.t = 0.15; return; }
      const e = R.pick(cand);
      const x = e.x, y = e.y;
      g.addFx('strike', { x, y, life: 0.3, col: C.ice });
      g.aoe(x, y, 78 * s.area, 80 * s.dmg, 'mjolnir', { knock: 160 });
      chain(g, x, y, 180, 3, 170 * s.area, 40 * s.dmg, 'mjolnir', false, C.blue);
      g.fx.glow(x, y, C.ice, 160 * s.area, 0.2, 0.9, 1);
      g.fx.sparks(x, y, 10, C.ice, 200, 520, 0.4, 7);
      g.grid.impulse(x, y, 140, 6);
      g.audio.play('zap');
      g.shake(0.04);
    },
  };

  W.drone = {
    update(g, w, dt) {
      const lv = w.lv, s = g.player.stats;
      droneUpdate(g, w, dt, pick([1, 2, 2, 3, 4], lv), pick([12, 12, 16, 16, 21], lv) * s.dmg, pick([0.5, 0.5, 0.4, 0.4, 0.4], lv), lv >= 5 ? 1 : 0, 58, 'drone', C.green);
    },
    render: renderDrones,
  };
  W.hive = {
    update(g, w, dt) {
      const s = g.player.stats;
      droneUpdate(g, w, dt, 6, 22 * s.dmg, 0.2, 2, 74, 'hive', C.lime);
    },
    render: renderDrones,
  };

  W.lance = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats, lv = w.lv, p = g.player;
      w.t = pick([3.0, 3.0, 2.6, 2.6, 2.4], lv) * s.cd;
      const len = 760 * s.dur, width = pick([14, 14, 20, 20, 26], lv) * s.area, dmg = pick([60, 82, 82, 104, 130], lv) * s.dmg;
      const n = lv >= 4 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = p.aim + (n > 1 ? (i ? 0.1 : -0.1) : 0);
        const end = fireBeam(g, p.x, p.y, a, len, width, dmg, 'lance', C.pink, false);
        g.addFx('beam', { x: p.x, y: p.y, x2: end[0], y2: end[1], w: width, life: 0.28, col: C.pink });
        g.fx.sparks(end[0], end[1], 6, C.pink, 100, 300, 0.3, 6);
      }
      g.audio.play('beam');
      g.shake(0.03);
    },
  };
  W.annihilator = {
    update(g, w, dt) {
      const s = g.player.stats, p = g.player;
      if (w.on === undefined) { w.on = 0; w.a = p.aim; w.t = 0.5; }
      if (w.on > 0) {
        w.on -= dt;
        w.a = U.turnTo(w.a, p.aim, 3.2 * dt);
        w.tick -= dt;
        w.snd -= dt;
        const len = 900 * s.dur, width = 36 * s.area;
        if (w.tick <= 0) {
          w.tick = 0.08;
          const end = fireBeam(g, p.x, p.y, w.a, len, width, 36 * s.dmg, 'annihilator', C.pink, true);
          w.x2 = end[0]; w.y2 = end[1];
          g.fx.sparks(w.x2, w.y2, 2, C.pink, 100, 400, 0.3, 6);
          g.grid.impulse(w.x2, w.y2, 90, 3);
        }
        if (w.snd <= 0) { w.snd = 0.3; g.audio.play('beam'); }
        if (w.on <= 0) w.t = 3.4 * s.cd;
      } else {
        w.t -= dt;
        if (w.t <= 0) { w.on = 2.4 * s.dur; w.tick = 0; w.snd = 0; w.a = p.aim; g.audio.play('laser'); }
      }
    },
    render(g, w, r) {
      if (!(w.on > 0) || w.x2 === undefined) return;
      const p = g.player, s = p.stats, width = 36 * s.area;
      const x2 = p.x + Math.cos(w.a) * 900 * s.dur, y2 = p.y + Math.sin(w.a) * 900 * s.dur;
      const fl = 0.85 + Math.random() * 0.3;
      r.beam(r.S.beam, p.x, p.y, x2, y2, width * 2.2 * fl, C.pink[0], C.pink[1], C.pink[2], 0.55, 0);
      r.beam(r.S.beam, p.x, p.y, x2, y2, width * fl, 1, 0.8, 0.95, 1, 1.2);
      r.spr(r.S.glow, p.x, p.y, width * 3, width * 3, 0, C.pink[0], C.pink[1], C.pink[2], 0.8, 0.8, 0);
    },
  };

  W.nova = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats, lv = w.lv;
      w.t = pick([3.2, 3.2, 3.2, 2.6, 2.6], lv) * s.cd;
      novaBlast(g, pick([150, 175, 175, 175, 225], lv) * s.area, pick([30, 40, 40, 52, 70], lv) * s.dmg, 'nova', lv >= 3, false, C.teal);
    },
  };
  W.supernova = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats;
      w.t = 2.2 * s.cd;
      novaBlast(g, 320 * s.area, 100 * s.dmg, 'supernova', true, true, C.teal);
      novaBlast(g, 230 * s.area, 56 * s.dmg, 'supernova', true, true, C.ice, 0.3);
    },
  };

  W.mine = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats, lv = w.lv, p = g.player;
      w.t = pick([1.4, 1.4, 1.4, 1.1, 1.1], lv) * s.cd;
      const n = lv >= 3 ? 2 : 1;
      for (let i = 0; i < n; i++) dropMine(g, p.x + R.range(-24, 24), p.y + R.range(-24, 24), pick([60, 78, 78, 90, 110], lv) * s.dmg, pick([80, 80, 80, 96, 96], lv) * s.area, 'mine', lv >= 5, false);
    },
  };
  W.cluster = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats, p = g.player;
      w.t = 0.9 * s.cd;
      for (let i = 0; i < 2; i++) dropMine(g, p.x + R.range(-30, 30), p.y + R.range(-30, 30), 75 * s.dmg, 92 * s.area, 'cluster', true, true);
    },
  };

  W.glaive = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats, lv = w.lv, p = g.player;
      w.t = 1.8 * s.cd;
      const n = pick([1, 2, 2, 3, 3], lv), range = pick([380, 380, 450, 450, 480], lv) * s.dur;
      const size = lv >= 5 ? 1.45 : 1;
      for (let i = 0; i < n; i++) {
        const o = g.proj('glaive');
        if (!o) break;
        const t = n > 1 ? i / (n - 1) - 0.5 : 0;
        o.x = p.x; o.y = p.y; o.ang = p.aim + t * 0.7;
        o.spd = 900; o.a = (900 * 900) / (2 * range); o.state = 0;
        o.dmg = pick([26, 26, 38, 38, 52], lv) * s.dmg; o.r = 16 * size * s.area; o.life = 6;
        o.src = 'glaive'; o.col = C.lime; o.erase = false;
      }
      g.audio.play('dash');
    },
  };
  W.eclipse = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats;
      w.t = 3.0 * s.cd;
      for (let i = 0; i < 4; i++) {
        const o = g.proj('eclipse');
        if (!o) break;
        o.ang = (i * TAU) / 4 + g.time; o.t = 0; o.life = 2.6 * s.dur;
        o.dmg = 68 * s.dmg; o.r = 30 * s.area; o.a = 330 * s.area; o.src = 'eclipse'; o.col = C.lime;
        o.x = g.player.x; o.y = g.player.y;
      }
      g.audio.play('dash');
    },
  };

  W.void = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats, lv = w.lv;
      w.t = pick([5, 5, 5, 4.2, 4.2], lv) * s.cd;
      const [x, y] = densest(g, 620);
      spawnHole(g, x, y, pick([160, 185, 185, 185, 225], lv) * s.area, pick([15, 15, 21, 21, 30], lv) * s.dmg, pick([2.5, 2.5, 3.2, 3.2, 3.2], lv) * s.dur, lv >= 5 ? 100 * s.dmg : 0, 'void', false);
    },
  };
  W.horizon = {
    update(g, w, dt) {
      w.t -= dt;
      if (w.t > 0) return;
      const s = g.player.stats;
      w.t = 4.6 * s.cd;
      for (let i = 0; i < 2; i++) {
        const [x, y] = densest(g, 700);
        spawnHole(g, x + R.range(-60, 60), y + R.range(-60, 60), 270 * s.area, 44 * s.dmg, 5 * s.dur, 240 * s.dmg, 'horizon', true);
      }
    },
  };

  W.flare = {
    update(g, w, dt) {
      const s = g.player.stats, lv = w.lv, p = g.player;
      const range = pick([170, 200, 200, 200, 245], lv) * s.dur, half = pick([0.52, 0.52, 0.52, 0.7, 0.7], lv) * Math.sqrt(s.area);
      if (w.active > 0) {
        w.active -= dt;
        w.tick -= dt;
        flameFx(g, p.x, p.y, p.aim, range, half);
        if (w.tick <= 0) {
          w.tick = 0.1;
          flameCone(g, p.x, p.y, p.aim, range, half, pick([9, 9, 12, 12, 16], lv) * s.dmg, pick([6, 6, 9, 9, 12], lv) * s.dmg, 'flare');
        }
      } else {
        w.t -= dt;
        if (w.t <= 0) {
          w.t = pick([2.0, 2.0, 2.0, 1.6, 1.6], lv) * s.cd;
          w.active = 0.9 * s.dur;
          w.tick = 0;
          g.audio.play('flame');
        }
      }
    },
  };
  W.phoenix = {
    update(g, w, dt) {
      const s = g.player.stats, p = g.player;
      w.ang = (w.ang || 0) + 2.3 * dt;
      w.tick = (w.tick || 0) - dt;
      const range = 215 * s.dur, half = 0.42 * Math.sqrt(s.area);
      for (let i = 0; i < 3; i++) flameFx(g, p.x, p.y, w.ang + (i * TAU) / 3, range, half);
      if (w.tick <= 0) {
        w.tick = 0.1;
        for (let i = 0; i < 3; i++) flameCone(g, p.x, p.y, w.ang + (i * TAU) / 3, range, half, 15 * s.dmg, 15 * s.dmg, 'phoenix');
      }
      w.snd = (w.snd || 0) - dt;
      if (w.snd <= 0) { w.snd = 0.5; g.audio.play('flame'); }
    },
  };

  // ── 投射物 ──
  P.missile = {
    update(g, o, dt) {
      o.t += dt;
      if (!o.tgt || o.tgt.dead || o.tgt.id !== o.tgtId) {
        const e = o.t > 0.15 ? g.nearestEnemy(o.x, o.y, 700) : null;
        o.tgt = e; o.tgtId = e ? e.id : -1;
      }
      o.spd = Math.min(o.spd + 1500 * dt, 980);
      if (o.tgt && o.t > 0.12) {
        const want = Math.atan2(o.tgt.y - o.y, o.tgt.x - o.x);
        o.ang = U.turnTo(o.ang, want, (4 + o.t * 8) * dt);
      }
      o.x += Math.cos(o.ang) * o.spd * dt;
      o.y += Math.sin(o.ang) * o.spd * dt;
      if (Math.random() < 0.7) g.particles.emit(g.r.S.glow, o.x, o.y, 0, 0, 0.25, 14, 4, o.col, 0.5, 0, 0, 0.2);
      let boom = o.t > o.life || o.x < 0 || o.y < 0 || o.x > g.W || o.y > g.H;
      if (!boom) {
        const k = g.queryEnemies(o.x, o.y, 40, Q);
        for (let i = 0; i < k; i++) {
          const e = Q[i];
          if (e.dead) continue;
          const rr = e.r + o.r;
          if (U.dist2(o.x, o.y, e.x, e.y) < rr * rr) { boom = true; break; }
        }
      }
      if (boom) {
        explodeAt(g, o.x, o.y, o.a, o.dmg, o.src, o.col, 160);
        return false;
      }
      return true;
    },
    render(g, o, r) {
      r.spr(r.S.missile, o.x, o.y, 26, 26, o.ang, o.col[0], o.col[1], o.col[2], 1, 0.6, 0);
    },
  };
  P.mine = {
    update(g, o, dt) {
      o.t += dt;
      if (o.t < 0.35) return true;
      let trig = o.t > o.life;
      const pullR = o.state ? 140 : 0;
      const k = g.queryEnemies(o.x, o.y, Math.max(50, pullR) + 30, Q);
      for (let i = 0; i < k; i++) {
        const e = Q[i];
        if (e.dead) continue;
        const d2 = U.dist2(o.x, o.y, e.x, e.y);
        if (d2 < (e.r + 30) * (e.r + 30)) trig = true;
        else if (pullR && d2 < pullR * pullR && !e.boss && !e.part) {
          const d = Math.sqrt(d2);
          e.x += ((o.x - e.x) / d) * 120 * dt;
          e.y += ((o.y - e.y) / d) * 120 * dt;
        }
      }
      if (trig) {
        explodeAt(g, o.x, o.y, o.a, o.dmg, o.src, o.col, 220);
        if (o.b) {
          for (let i = 0; i < 6; i++) {
            const b = g.proj('bomblet');
            if (!b) break;
            const a = (i * TAU) / 6 + Math.random() * 0.5;
            b.x = o.x; b.y = o.y; b.ang = a; b.spd = R.range(260, 420); b.life = R.range(0.35, 0.55);
            b.dmg = o.dmg * 0.65; b.a = o.a * 0.65; b.src = o.src; b.col = C.amber;
          }
        }
        return false;
      }
      return true;
    },
    render(g, o, r) {
      const blink = o.t < 0.35 ? 0.4 : 0.6 + 0.4 * Math.sin(o.t * 12);
      r.spr(r.S.mine, o.x, o.y, 34, 34, o.t * 2, o.col[0], o.col[1], o.col[2], blink, 0.5, 0);
      if (o.state) {
        const k = r.S.ringThin.unit * 2 * (40 + 20 * ((o.t * 2) % 1));
        r.spr(r.S.ringThin, o.x, o.y, k, k, 0, o.col[0], o.col[1], o.col[2], 0.25, 0, 0);
      }
    },
  };
  P.bomblet = {
    update(g, o, dt) {
      o.t += dt;
      o.spd *= Math.exp(-4 * dt);
      o.x += Math.cos(o.ang) * o.spd * dt;
      o.y += Math.sin(o.ang) * o.spd * dt;
      if (o.t >= o.life) { explodeAt(g, o.x, o.y, o.a, o.dmg, o.src, o.col, 120); return false; }
      return true;
    },
    render(g, o, r) {
      r.spr(r.S.dot, o.x, o.y, 22, 22, 0, o.col[0], o.col[1], o.col[2], 1, 0.6, 0);
    },
  };
  function contactHits(g, o, key, cd, knock) {
    const k = g.queryEnemies(o.x, o.y, o.r + 40, Q);
    for (let i = 0; i < k; i++) {
      const e = Q[i];
      if (e.dead) continue;
      const rr = e.r + o.r;
      if (U.dist2(o.x, o.y, e.x, e.y) < rr * rr && e.hitT[key] <= g.time) {
        e.hitT[key] = g.time + cd;
        g.damage(e, o.dmg, key, { knock, kx: e.x - o.x, ky: e.y - o.y });
      }
    }
  }
  P.glaive = {
    update(g, o, dt) {
      o.t += dt;
      const p = g.player;
      if (o.state === 0) {
        o.spd -= o.a * dt;
        if (o.spd <= 40) { o.state = 1; o.spd = 80; }
      } else {
        o.ang = Math.atan2(p.y - o.y, p.x - o.x);
        o.spd = Math.min(o.spd + 1800 * dt, 1150);
        if (U.dist2(o.x, o.y, p.x, p.y) < 28 * 28) return false;
      }
      o.x += Math.cos(o.ang) * o.spd * dt;
      o.y += Math.sin(o.ang) * o.spd * dt;
      contactHits(g, o, 'glaive', 0.3, 120);
      return o.t < o.life;
    },
    render(g, o, r) {
      const s = o.r * 2 * r.S.glaive.unit;
      r.spr(r.S.glaive, o.x, o.y, s, s, o.t * 16, o.col[0], o.col[1], o.col[2], 1, 0.6, 0);
    },
  };
  P.eclipse = {
    update(g, o, dt) {
      o.t += dt;
      const p = g.player, k = o.t / o.life;
      const rad = o.a * Math.sin(Math.min(1, k) * Math.PI);
      o.ang += 3.6 * dt;
      o.x = p.x + Math.cos(o.ang) * rad;
      o.y = p.y + Math.sin(o.ang) * rad;
      contactHits(g, o, 'eclipse', 0.25, 160);
      g.eraseBullets(o.x, o.y, o.r + 6);
      return o.t < o.life;
    },
    render(g, o, r) {
      const s = o.r * 2 * r.S.glaive.unit;
      r.spr(r.S.glaive, o.x, o.y, s, s, o.t * 18, o.col[0], o.col[1], o.col[2], 1, 0.7, 0);
      r.spr(r.S.glow, o.x, o.y, s * 1.2, s * 1.2, 0, o.col[0], o.col[1], o.col[2], 0.35, 0, 0);
    },
  };
  P.hole = {
    update(g, o, dt) {
      o.t += dt;
      const grow = Math.min(1, o.t / 0.3), rad = o.r * grow;
      const k = g.queryEnemies(o.x, o.y, rad + 30, Q);
      o.c -= dt;
      const tick = o.c <= 0;
      if (tick) o.c = 0.25;
      for (let i = 0; i < k; i++) {
        const e = Q[i];
        if (e.dead) continue;
        const dx = o.x - e.x, dy = o.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > rad + e.r) continue;
        if (!e.boss && !e.part && d > 6) {
          const f = 170 * (1 - d / (rad + e.r)) + 30;
          e.x += (dx / d) * f * dt;
          e.y += (dy / d) * f * dt;
        }
        if (o.b) e.xpBonus = 1.5;
        if (tick) g.damage(e, o.dmg, o.src, { quiet: true });
      }
      g.grid.pull(o.x, o.y, rad * 1.3, 1.6);
      if (Math.random() < 0.9) {
        const a = Math.random() * TAU, d = rad * R.range(0.6, 1);
        const px = o.x + Math.cos(a) * d, py = o.y + Math.sin(a) * d;
        g.particles.emit(g.r.S.spark, px, py, (o.x - px) * 2.2 + Math.cos(a + 1.6) * 120, (o.y - py) * 2.2 + Math.sin(a + 1.6) * 120, 0.4, 6, 2, o.col, 0.9, 1, 1, 0.3);
      }
      if (o.t >= o.life) {
        if (o.a > 0) {
          explodeAt(g, o.x, o.y, rad * 0.8, o.a, o.src, o.col, 260);
          g.shock(o.x, o.y, 0.015, rad, 0.45);
        } else g.fx.ring(o.x, o.y, o.col, rad, 4, 0.3, 0.8);
        return false;
      }
      return true;
    },
    render(g, o, r) {
      const grow = Math.min(1, o.t / 0.3), rad = o.r * grow;
      const fade = o.t > o.life - 0.3 ? (o.life - o.t) / 0.3 : 1;
      const c = o.col;
      const dk = 30 * grow * 2 * r.S.disc.unit;
      r.spr(r.S.soft, o.x, o.y, rad * 2.4, rad * 2.4, 0, c[0], c[1], c[2], 0.35 * fade, 0, 0);
      r.spr(r.S.disc, o.x, o.y, dk, dk, 0, 0, 0, 0, 0.95 * fade, 0, 1);
      const rk = r.S.voidring.unit * 2 * 34 * grow;
      r.spr(r.S.voidring, o.x, o.y, rk, rk, -o.t * 5, c[0], c[1], c[2], fade, 0.6, 0);
      const ok = r.S.ringThin.unit * 2 * rad;
      r.spr(r.S.ringThin, o.x, o.y, ok, ok, 0, c[0], c[1], c[2], 0.3 * fade, 0, 0);
    },
  };

  // ── エフェクト ──
  function jag(r, x1, y1, x2, y2, segs, amp, width, c, a) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len;
    let px = x1, py = y1;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const off = i === segs ? 0 : (Math.random() - 0.5) * amp;
      const qx = x1 + dx * t + nx * off, qy = y1 + dy * t + ny * off;
      r.beam(r.S.beam, px, py, qx, qy, width * 3, c[0], c[1], c[2], a * 0.4, 0);
      r.beam(r.S.beam, px, py, qx, qy, width, 1, 1, 1, a, 0.6);
      px = qx; py = qy;
    }
  }
  E.bolt = {
    update(g, f, dt) { f.t += dt; return f.t < f.life; },
    render(g, f, r) {
      const a = 1 - f.t / f.life, pts = f.pts;
      for (let i = 2; i < pts.length; i += 2) {
        const segs = Math.max(2, Math.round(Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]) / 26));
        jag(r, pts[i - 2], pts[i - 1], pts[i], pts[i + 1], segs, 22, f.w, f.col, a);
      }
    },
  };
  E.strike = {
    update(g, f, dt) { f.t += dt; return f.t < f.life; },
    render(g, f, r) {
      const a = 1 - f.t / f.life;
      jag(r, f.x + R.range(-40, 40), f.y - 520, f.x, f.y, 10, 40, 7, f.col, a);
      const k = r.S.ring.unit * 2 * (20 + 80 * (f.t / f.life));
      r.spr(r.S.ring, f.x, f.y, k, k, 0, f.col[0], f.col[1], f.col[2], a, 0.4, 0);
    },
  };
  E.beam = {
    update(g, f, dt) { f.t += dt; return f.t < f.life; },
    render(g, f, r) {
      const k = 1 - f.t / f.life, c = f.col;
      r.beam(r.S.beam, f.x, f.y, f.x2, f.y2, f.w * 2.4 * k, c[0], c[1], c[2], 0.6 * k, 0);
      r.beam(r.S.beam, f.x, f.y, f.x2, f.y2, f.w * k, 1, 1, 1, k, 1);
    },
  };
  E.nova = {
    update(g, f, dt) {
      f.t += dt;
      if (f.t < 0) return true;
      const p = g.player;
      if (!f.fired) {
        f.fired = true;
        f.x = p.x; f.y = p.y;
        g.audio.play('nova');
        g.grid.impulse(p.x, p.y, f.rad * 1.3, 9);
        g.shock(p.x, p.y, 0.012, f.rad, 0.4);
      }
      f.x = p.x; f.y = p.y;
      const cur = f.rad * U.easeOutCubic(Math.min(1, f.t / f.dur));
      const k = g.queryEnemies(f.x, f.y, cur + 40, Q);
      for (let i = 0; i < k; i++) {
        const e = Q[i];
        if (e.dead || e.hitT[f.src] === f.cast) continue;
        const rr = cur + e.r;
        if (U.dist2(f.x, f.y, e.x, e.y) < rr * rr) {
          e.hitT[f.src] = f.cast;
          g.damage(e, f.dmg, f.src, { knock: 300, kx: e.x - f.x, ky: e.y - f.y });
          if (f.slow) e.slowT = 2;
        }
      }
      if (f.erase) g.eraseBullets(f.x, f.y, cur);
      f.cur = cur;
      return f.t < f.dur + 0.18;
    },
    render(g, f, r) {
      if (f.t < 0 || !f.fired) return;
      const k = Math.min(1, f.t / f.dur), a = f.t > f.dur ? Math.max(0, 1 - (f.t - f.dur) / 0.18) : 1;
      const c = f.col, s = r.S.ring.unit * 2 * f.cur;
      r.spr(r.S.ring, f.x, f.y, s, s, 0, c[0], c[1], c[2], 0.75 * a, 0.25, 0);
      r.spr(r.S.soft, f.x, f.y, f.cur * 2.2, f.cur * 2.2, 0, c[0], c[1], c[2], 0.12 * a * (1 - k * 0.5), 0, 0);
    },
  };
  E.heal = {
    update(g, f, dt) { f.t += dt; return f.t < f.life; },
    render(g, f, r) {
      const a = 1 - f.t / f.life;
      r.beam(r.S.beam, f.x, f.y, f.x2, f.y2, 10, f.col[0], f.col[1], f.col[2], a, 0.4);
    },
  };

  NR.MainGun = MainGun;
  NR.Weapons = W;
  NR.Proj = P;
  NR.FxKinds = E;
  NR.WeaponUtil = { explodeAt, novaBlast, chain, fireBeam, jag };
})();
