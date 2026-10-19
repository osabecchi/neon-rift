'use strict';
/* NEON RIFT — ボス4体(ジェネレーター関数で弾幕を台本化) */
(function () {
  const NR = window.NR;
  const { U, R, TAU } = NR;
  const AI = NR.AI;
  const C = {};
  for (const k in NR.COL) C[k] = U.hex(NR.COL[k]);

  // 台本を進める。yield した値が次の行動までの待ち時間
  function run(g, e, dt) {
    if (!e.script) return;
    e.wait -= dt;
    let guard = 0;
    while (e.wait <= 0 && guard++ < 60) {
      const r = e.script.next();
      if (r.done) { e.script = null; break; }
      e.wait += r.value || 0;
    }
  }
  function alive(list, ids) {
    const out = [];
    for (let i = 0; i < list.length; i++) if (!list[i].dead && list[i].id === ids[i]) out.push(list[i]);
    return out;
  }
  function spawnParts(g, e, type, n) {
    e.parts = []; e.partIds = [];
    for (let i = 0; i < n; i++) {
      const p = g.spawnEnemy(type, e.x, e.y, { instant: true, parent: e, idx: i, hpMult: e.hpScale });
      if (p) { e.parts.push(p); e.partIds.push(p.id); }
    }
  }
  function moveToward(e, tx, ty, speed, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) { e.vx = 0; e.vy = 0; return; }
    const sp = Math.min(speed, d * 3);
    e.vx = U.damp(e.vx, (dx / d) * sp, 4, dt);
    e.vy = U.damp(e.vy, (dy / d) * sp, 4, dt);
  }
  function shift(g, e, phase, gen) {
    e.phase = phase;
    e.invuln = 1.6;
    e.script = gen;
    e.wait = 1.6;
    g.clearEnemyBullets(true);
    g.shake(0.55);
    g.flash([1, 1, 1], 0.35);
    g.shock(e.x, e.y, 0.03, 520, 0.7);
    g.fx.explosion(e.x, e.y, e.col, 2.5, 2);
    g.audio.play('roar');
    g.ui.banner('PHASE ' + phase, 'boss');
  }
  const rest = (s) => s;

  // ───────── イージス・コア ─────────
  function* aegisP1(g, e) {
    for (;;) {
      for (let i = 0; i < 40; i++) {
        for (let k = 0; k < 3; k++) g.eb(e.x, e.y, e.spin + (k * TAU) / 3, 200, { col: C.pink });
        e.spin += 0.12;
        if (i % 4 === 0) g.audio.play('eshoot');
        yield 0.07;
      }
      yield 0.7;
      for (let j = 0; j < 4; j++) {
        g.fan(e.x, e.y, g.angleTo(e), 7, 0.9, 250, { col: C.white, kind: 'rice' });
        g.audio.play('eshoot');
        yield 0.45;
      }
      yield 0.6;
      for (const p of alive(e.parts, e.partIds)) {
        p.state = 1; p.st = 0; p.tx = g.player.x; p.ty = g.player.y;
        g.audio.play('dash');
        yield 0.22;
      }
      yield 1.8;
      for (let j = 0; j < 3; j++) {
        g.ring(e.x, e.y, 24, 175, j * 0.13, { col: C.pink });
        g.audio.play('eshoot');
        yield 0.5;
      }
      yield 1.0;
    }
  }
  function* aegisP2(g, e) {
    for (;;) {
      for (let i = 0; i < 50; i++) {
        const dir = Math.floor(i / 10) % 2 ? -1 : 1;
        for (let k = 0; k < 5; k++) g.eb(e.x, e.y, e.spin * dir + (k * TAU) / 5, 215, { col: C.pink });
        e.spin += 0.1;
        if (i % 4 === 0) g.audio.play('eshoot');
        yield 0.065;
      }
      yield 0.8;
      for (let j = 0; j < 3; j++) {
        g.ring(e.x, e.y, 20, 230, j * 0.15, { col: C.violet, stopAt: 0.55, goAt: 0.95 + j * 0.05, speed2: 300 });
        g.audio.play('eshoot');
        yield 0.8;
      }
      yield 1.0;
      for (let j = 0; j < 12; j++) {
        g.eb(e.x, e.y, g.angleTo(e), 390, { col: C.white, kind: 'rice' });
        g.audio.play('eshoot');
        yield 0.11;
      }
      yield 0.8;
      g.ring(e.x, e.y, 36, 145, 0, { col: C.pink });
      g.ring(e.x, e.y, 36, 100, TAU / 72, { col: C.magenta });
      g.audio.play('eshoot');
      yield 1.6;
    }
  }
  AI.aegis = {
    init(g, e) {
      e.ang = 0; e.spin = 0; e.orb = g.rng.angle();
      spawnParts(g, e, 'plate', 6);
      e.script = aegisP1(g, e); e.wait = 2.2;
    },
    update(g, e, dt) {
      const p = g.player;
      e.orb += 0.3 * dt;
      const tx = U.clamp(p.x + Math.cos(e.orb) * 340, 120, g.W - 120), ty = U.clamp(p.y + Math.sin(e.orb) * 300, 120, g.H - 120);
      moveToward(e, tx, ty, e.phase === 1 ? 90 : 135, dt);
      e.ang += (e.phase === 1 ? 0.9 : 1.6) * dt;
      e.rot = e.ang * 0.5;
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
        for (const pl of alive(e.parts, e.partIds)) {
          g.ring(pl.x, pl.y, 12, 160, g.rng.angle(), { col: C.magenta });
          g.kill(pl, 'chain');
        }
        shift(g, e, 2, aegisP2(g, e));
      }
      run(g, e, dt);
    },
    onDeath(g, e) {
      for (const pl of alive(e.parts, e.partIds)) g.kill(pl, 'chain');
    },
  };
  AI.plate = {
    init(g, e) { e.noSep = true; e.knockRes = 0; e.state = 0; },
    update(g, e, dt) {
      const b = e.parent;
      e.vx = 0; e.vy = 0;
      if (!b || b.dead || b.id !== e.parentId) { g.kill(e, 'chain'); return; }
      const a = b.ang + (e.idx * TAU) / 6;
      const sx = b.x + Math.cos(a) * 92, sy = b.y + Math.sin(a) * 92;
      if (e.state === 0) { e.x = sx; e.y = sy; e.rot = a; return; }
      const tx = e.state === 1 ? e.tx : sx, ty = e.state === 1 ? e.ty : sy;
      const dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy);
      const sp = (e.state === 1 ? 620 : 720) * dt;
      if (d > sp) { e.x += (dx / d) * sp; e.y += (dy / d) * sp; } else { e.x = tx; e.y = ty; }
      e.rot += 10 * dt;
      e.st += dt;
      if (e.state === 1 && (e.st > 0.65 || d < 4)) e.state = 2;
      else if (e.state === 2 && d < 6) e.state = 0;
    },
  };

  // ───────── リヴァイアサン ─────────
  function* leviP1(g, e) {
    for (;;) {
      e.mode = 'swim'; yield 2.0;
      for (const s of alive(e.parts, e.partIds)) {
        g.eb(s.x, s.y, s.rot + Math.PI / 2, 165, { col: C.pink });
        g.eb(s.x, s.y, s.rot - Math.PI / 2, 165, { col: C.pink });
        g.audio.play('eshoot');
        yield 0.05;
      }
      yield 1.0;
      e.mode = 'aim'; e.st = 0; g.audio.play('charge'); yield 1.0;
      e.mode = 'charge'; e.bounces = 2; e.st = 0; g.audio.play('roar'); yield 2.2;
      e.mode = 'swim'; yield 1.0;
      for (let i = 0; i < 6; i++) {
        g.eb(e.x, e.y, g.angleTo(e) + R.range(-0.5, 0.5), 170, { col: C.magenta, kind: 'big', r: 13, homing: 1.6, homingT: 2.2, life: 7 });
        g.audio.play('eshoot');
        yield 0.25;
      }
      yield 1.4;
      if (e.phase >= 2) {
        e.mode = 'coil'; e.coilA = Math.atan2(e.y - g.player.y, e.x - g.player.x); e.st = 0;
        for (let k = 0; k < 5; k++) {
          yield 0.8;
          for (const s of alive(e.parts, e.partIds)) g.eb(s.x, s.y, Math.atan2(g.player.y - s.y, g.player.x - s.x), 150, { col: C.pink, kind: 'rice' });
          g.audio.play('eshoot');
        }
        e.mode = 'swim';
        yield 1.0;
      }
    }
  }
  AI.leviathan = {
    init(g, e) {
      e.dir = g.angleTo(e); e.mode = 'swim'; e.trail = []; e.orb = g.rng.angle(); e.spawnCd = 6;
      spawnParts(g, e, 'leviseg', 24);
      e.script = leviP1(g, e); e.wait = 2.2;
    },
    update(g, e, dt) {
      const p = g.player, fast = e.phase >= 2 ? 1.25 : 1;
      e.st = (e.st || 0) + dt;
      if (e.mode === 'swim') {
        e.orb += 0.6 * dt;
        const tx = p.x + Math.cos(e.orb) * 380, ty = p.y + Math.sin(e.orb) * 380;
        e.dir = U.turnTo(e.dir, Math.atan2(ty - e.y, tx - e.x), 2.2 * dt);
        e.vx = Math.cos(e.dir) * 240 * fast; e.vy = Math.sin(e.dir) * 240 * fast;
      } else if (e.mode === 'aim') {
        e.dir = U.turnTo(e.dir, g.angleTo(e), 4 * dt);
        e.vx *= Math.exp(-5 * dt); e.vy *= Math.exp(-5 * dt);
      } else if (e.mode === 'charge') {
        e.vx = Math.cos(e.dir) * 960 * fast; e.vy = Math.sin(e.dir) * 960 * fast;
        if ((e.x < 60 && e.vx < 0) || (e.x > g.W - 60 && e.vx > 0)) { e.dir = Math.PI - e.dir; e.bounces--; g.shake(0.25); g.grid.impulse(e.x, e.y, 200, 8); }
        if ((e.y < 60 && e.vy < 0) || (e.y > g.H - 60 && e.vy > 0)) { e.dir = -e.dir; e.bounces--; g.shake(0.25); g.grid.impulse(e.x, e.y, 200, 8); }
        if (e.bounces < 0) e.mode = 'swim';
        if (Math.random() < 0.8) g.particles.emit(g.r.S.spark, e.x, e.y, -e.vx * 0.2 + R.range(-80, 80), -e.vy * 0.2 + R.range(-80, 80), 0.4, 14, 4, e.col, 0.9, 2, 1, 0.3);
      } else if (e.mode === 'coil') {
        e.coilA += 1.25 * dt;
        const rad = U.lerp(330, 240, Math.min(1, e.st / 4));
        const tx = p.x + Math.cos(e.coilA) * rad, ty = p.y + Math.sin(e.coilA) * rad;
        e.dir = U.turnTo(e.dir, Math.atan2(ty - e.y, tx - e.x), 4 * dt);
        e.vx = Math.cos(e.dir) * 420; e.vy = Math.sin(e.dir) * 420;
      }
      e.rot = e.dir;
      e.x = U.clamp(e.x, 30, g.W - 30); e.y = U.clamp(e.y, 30, g.H - 30);
      const tr = e.trail;
      if (tr.length < 2 || U.dist2(tr[0], tr[1], e.x, e.y) >= 36) {
        tr.unshift(e.x, e.y);
        const max = (e.parts.length + 2) * 7 * 2 + 2;
        if (tr.length > max) tr.length = max;
      }
      for (let i = 0; i < e.parts.length; i++) {
        const s = e.parts[i];
        if (s.dead || s.id !== e.partIds[i]) continue;
        const k = (i + 1) * 7 * 2;
        if (k + 3 < tr.length) {
          s.x = tr[k]; s.y = tr[k + 1];
          s.rot = Math.atan2(tr[k - 1] - tr[k + 1], tr[k - 2] - tr[k]);
        } else { s.x = e.x; s.y = e.y; }
      }
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) shift(g, e, 2, leviP1(g, e));
      if (e.phase >= 2) {
        e.spawnCd -= dt;
        if (e.spawnCd <= 0) {
          e.spawnCd = 6;
          const tail = alive(e.parts, e.partIds).pop() || e;
          for (let i = 0; i < 4; i++) g.spawnEnemy('swarmer', tail.x + R.range(-20, 20), tail.y + R.range(-20, 20), { instant: true });
        }
      }
      run(g, e, dt);
    },
    render(g, e, r) {
      if (e.mode !== 'aim') return;
      const a = 0.3 + 0.5 * Math.abs(Math.sin(e.st * 20));
      r.beam(r.S.beam, e.x, e.y, e.x + Math.cos(e.dir) * 1400, e.y + Math.sin(e.dir) * 1400, 14, 1, 0.3, 0.8, a, 0.3);
    },
    onDeath(g, e) {
      const segs = e.parts.slice(), ids = e.partIds.slice();
      for (let i = segs.length - 1, n = 0; i >= 0; i--, n++) {
        const s = segs[i], id = ids[i];
        g.timer(0.05 * n, () => { if (!s.dead && s.id === id) g.kill(s, 'chain'); });
      }
    },
  };
  AI.leviseg = {
    init(g, e) { e.noSep = true; e.knockRes = 0; },
    update(g, e, dt) {
      e.vx = 0; e.vy = 0;
      if (!e.parent || e.parent.dead || e.parent.id !== e.parentId) {
        e.orphanT = (e.orphanT || 0) + dt;
        if (e.orphanT > 2) g.kill(e, 'chain');
      }
    },
    onDeath(g, e) {
      const b = e.parent;
      if (b && !b.dead && b.id === e.parentId && b.invuln <= 0) {
        b.hp -= b.maxHp * 0.02;
        b.flash = 0.1;
        if (b.hp <= 0) g.kill(b, 'chain');
      }
    },
  };

  // ───────── ハイヴ・クイーン ─────────
  function spawnBrood(g, e) {
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      const m = g.spawnEnemy(i % 6 === 0 ? 'bomber' : 'swarmer', e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, { instant: true });
      if (m) { m.kx = Math.cos(a) * 320; m.ky = Math.sin(a) * 320; }
    }
    g.fx.ring(e.x, e.y, e.col, e.r, e.r * 2.2, 0.4, 0.8);
    g.audio.play('spawn');
  }
  function* hiveP1(g, e) {
    for (;;) {
      spawnBrood(g, e);
      yield 1.5;
      const base = g.angleTo(e);
      g.addLaser({ owner: e, ang: base + 1.3, len: 1500, width: 34, warn: 1.0, active: 2.6, rot: -0.6, col: C.amber });
      g.addLaser({ owner: e, ang: base + 1.3 + Math.PI, len: 1500, width: 34, warn: 1.0, active: 2.6, rot: -0.6, col: C.amber });
      yield 4.0;
      for (let k = 0; k < 4; k++) {
        for (const t of alive(e.parts, e.partIds)) g.fan(t.x, t.y, Math.atan2(g.player.y - t.y, g.player.x - t.x), 3, 0.3, 260, { col: C.yellow });
        g.audio.play('eshoot');
        yield 0.35;
      }
      yield 1.0;
      for (let i = 0; i < 8; i++) {
        const a = g.rng.angle(), d = g.rng.range(80, 380);
        g.spawnEnemy('hmine', U.clamp(g.player.x + Math.cos(a) * d, 40, g.W - 40), U.clamp(g.player.y + Math.sin(a) * d, 40, g.H - 40), { instant: true });
        yield 0.08;
      }
      yield 2.2;
    }
  }
  function* hiveP2(g, e) {
    for (;;) {
      const base = g.rng.angle();
      for (let k = 0; k < 4; k++) g.addLaser({ owner: e, ang: base + (k * Math.PI) / 2, len: 1600, width: 30, warn: 1.2, active: 6, rot: 0.42, col: C.amber });
      yield 1.2;
      for (let i = 0; i < 55; i++) {
        for (let k = 0; k < 2; k++) g.eb(e.x, e.y, e.spin + k * Math.PI, 130, { col: C.yellow });
        e.spin += 0.21;
        if (i % 5 === 0) g.audio.play('eshoot');
        yield 0.11;
      }
      yield 0.6;
      spawnBrood(g, e);
      yield 1.2;
      for (let k = 0; k < 5; k++) {
        for (const t of alive(e.parts, e.partIds)) g.fan(t.x, t.y, Math.atan2(g.player.y - t.y, g.player.x - t.x), 5, 0.5, 280, { col: C.yellow });
        g.audio.play('eshoot');
        yield 0.32;
      }
      for (let i = 0; i < 10; i++) {
        const a = g.rng.angle(), d = g.rng.range(60, 360);
        g.spawnEnemy('hmine', U.clamp(g.player.x + Math.cos(a) * d, 40, g.W - 40), U.clamp(g.player.y + Math.sin(a) * d, 40, g.H - 40), { instant: true });
        yield 0.06;
      }
      yield 2.0;
    }
  }
  AI.hive = {
    init(g, e) {
      e.ang = 0; e.spin = 0; e.st = 0; e.tx = e.x; e.ty = e.y;
      spawnParts(g, e, 'turret', 4);
      e.script = hiveP1(g, e); e.wait = 2.2;
    },
    update(g, e, dt) {
      const p = g.player;
      e.ang += 0.4 * dt;
      e.rot = -e.ang * 0.3;
      if (e.phase === 1) {
        e.st -= dt;
        if (e.st <= 0) {
          e.st = 4;
          const a = g.rng.angle();
          e.tx = U.clamp(p.x + Math.cos(a) * 340, 150, g.W - 150);
          e.ty = U.clamp(p.y + Math.sin(a) * 300, 150, g.H - 150);
        }
        moveToward(e, e.tx, e.ty, 70, dt);
      } else {
        const d = g.distTo(e);
        if (d > 260) moveToward(e, p.x, p.y, 80, dt); else { e.vx *= 0.95; e.vy *= 0.95; }
      }
      if (e.phase === 1 && e.hp < e.maxHp * 0.45) shift(g, e, 2, hiveP2(g, e));
      run(g, e, dt);
    },
    onDeath(g, e) {
      for (const t of alive(e.parts, e.partIds)) g.kill(t, 'chain');
      for (let i = 1; i <= 3; i++) g.timer(i * 0.25, () => g.fx.explosion(e.x + R.range(-60, 60), e.y + R.range(-60, 60), e.col, 2));
    },
  };
  AI.turret = {
    init(g, e) { e.noSep = true; e.knockRes = 0; },
    update(g, e, dt) {
      const b = e.parent;
      e.vx = 0; e.vy = 0;
      if (!b || b.dead || b.id !== e.parentId) { g.kill(e, 'chain'); return; }
      const a = b.ang + (e.idx * TAU) / 4;
      e.x = b.x + Math.cos(a) * 104;
      e.y = b.y + Math.sin(a) * 104;
      e.rot = Math.atan2(g.player.y - e.y, g.player.x - e.x);
    },
  };
  AI.hmine = {
    init(g, e) { e.noSep = true; e.knockRes = 0; e.st = 1.5; e.contact = 0; },
    update(g, e, dt) {
      e.vx = 0; e.vy = 0;
      e.st -= dt;
      e.rot += 4 * dt;
      if (e.st <= 0) {
        g.ring(e.x, e.y, 10, 150, g.rng.angle(), { col: C.amber });
        const p = g.player;
        if (U.dist2(e.x, e.y, p.x, p.y) < 62 * 62) g.hurtPlayer(1, e.x, e.y);
        g.fx.explosion(e.x, e.y, e.col, 0.9, 0.6);
        g.audio.play('explode');
        g.kill(e, 'self', true);
      }
    },
    render(g, e, r) {
      const k = 1 - Math.max(0, e.st) / 1.5, s = r.S.ringThin.unit * 2 * 62;
      r.spr(r.S.ringThin, e.x, e.y, s, s, 0, e.col[0], e.col[1], e.col[2], 0.25 + 0.6 * k * Math.abs(Math.sin(e.st * 14)), 0, 0);
    },
  };

  // ───────── ヌル・シンギュラリティ ─────────
  function horizonRing(g, e, gaps) {
    const p = g.player, n = 54, rad = 640;
    const gapAt = [];
    for (let i = 0; i < gaps; i++) gapAt.push(g.rng.int(0, n - 1));
    for (let i = 0; i < n; i++) {
      let skip = false;
      for (const gi of gapAt) { const d = Math.min(Math.abs(i - gi), n - Math.abs(i - gi)); if (d <= 1) skip = true; }
      if (skip) continue;
      const a = (i * TAU) / n;
      g.eb(p.x + Math.cos(a) * rad, p.y + Math.sin(a) * rad, a + Math.PI, 112, { col: C.violet, life: 6.5 });
    }
    g.audio.play('charge');
  }
  function* nullP1(g, e) {
    for (;;) {
      for (let i = 0; i < 60; i++) {
        for (let k = 0; k < 2; k++) {
          g.eb(e.x, e.y, e.spin + k * Math.PI, 180, { col: C.violet });
          g.eb(e.x, e.y, -e.spin + k * Math.PI + 0.5, 180, { col: C.pink });
        }
        e.spin += 0.11;
        if (i % 5 === 0) g.audio.play('eshoot');
        yield 0.06;
      }
      yield 0.6;
      for (let k = 0; k < 2; k++) {
        for (const s of alive(e.parts, e.partIds)) {
          g.fan(s.x, s.y, Math.atan2(g.player.y - s.y, g.player.x - s.x), 3, 0.25, 260, { col: C.pink, kind: 'rice' });
          g.audio.play('eshoot');
          yield 0.1;
        }
        yield 0.5;
      }
      horizonRing(g, e, 2);
      yield 3.4;
    }
  }
  function* nullFreeze(g, e, n) {
    for (let i = 0; i < n; i++) g.eb(e.x, e.y, g.rng.angle(), g.rng.range(200, 320), { col: C.white, stopAt: 0.7, goAt: 1.6 + i * 0.015, speed2: 250 });
    g.audio.play('laser');
    yield 2.6;
  }
  function* nullP2(g, e) {
    for (;;) {
      yield* nullFreeze(g, e, 48);
      for (let i = 0; i < 2; i++) {
        const a = g.rng.angle();
        g.queueSpawn('voidling', U.clamp(e.x + Math.cos(a) * 380, 80, g.W - 80), U.clamp(e.y + Math.sin(a) * 380, 80, g.H - 80));
      }
      yield 0.8;
      for (let i = 0; i < 50; i++) {
        for (let k = 0; k < 6; k++) g.eb(e.x, e.y, e.spin + (k * TAU) / 6, 170, { col: k % 2 ? C.violet : C.pink, angVel: k % 2 ? 0.55 : -0.55 });
        e.spin += 0.07;
        if (i % 5 === 0) g.audio.play('eshoot');
        yield 0.1;
      }
      yield 0.6;
      horizonRing(g, e, 2);
      yield 3.2;
    }
  }
  function* nullP3(g, e) {
    for (;;) {
      const base = g.rng.angle();
      for (let k = 0; k < 4; k++) g.addLaser({ owner: e, ang: base + (k * Math.PI) / 2, len: 1700, width: 32, warn: 1.2, active: 7, rot: k % 2 ? 0.5 : 0.5, col: C.violet });
      yield 1.2;
      for (let i = 0; i < 70; i++) {
        for (let k = 0; k < 3; k++) g.eb(e.x, e.y, e.spin + (k * TAU) / 3, 160, { col: C.pink });
        e.spin -= 0.13;
        if (i % 5 === 0) g.audio.play('eshoot');
        yield 0.09;
      }
      yield 0.8;
      horizonRing(g, e, 2);
      yield 0.9;
      horizonRing(g, e, 2);
      yield 2.6;
      yield* nullFreeze(g, e, 60);
    }
  }
  AI.null = {
    init(g, e) {
      e.ang = 0; e.spin = 0;
      spawnParts(g, e, 'sat', 8);
      e.script = nullP1(g, e); e.wait = 2.4;
    },
    update(g, e, dt) {
      const p = g.player;
      e.ang += 0.7 * dt;
      e.rot = e.ang * -0.4;
      moveToward(e, U.lerp(g.W / 2, p.x, 0.5), U.lerp(g.H / 2, p.y, 0.5), 40, dt);
      const d = g.distTo(e);
      if (d > 60) {
        const f = [100, 150, 200][e.phase - 1];
        p.pullX += ((e.x - p.x) / d) * f;
        p.pullY += ((e.y - p.y) / d) * f;
      }
      g.voids.push(e);
      g.grid.pull(e.x, e.y, 420, 1.6);
      if (Math.random() < 0.8) {
        const a = Math.random() * TAU, rr = R.range(120, 260);
        const px = e.x + Math.cos(a) * rr, py = e.y + Math.sin(a) * rr;
        g.particles.emit(g.r.S.spark, px, py, (e.x - px) * 2, (e.y - py) * 2, 0.5, 8, 2, e.col, 0.8, 1, 1, 0.3);
      }
      if (e.phase === 1 && e.hp < e.maxHp * 0.66) shift(g, e, 2, nullP2(g, e));
      else if (e.phase === 2 && e.hp < e.maxHp * 0.33) shift(g, e, 3, nullP3(g, e));
      run(g, e, dt);
    },
    draw(g, e, r) {
      const c = e.col, pulse = 1 + Math.sin(g.time * 3) * 0.04;
      r.spr(r.S.soft, e.x, e.y, e.r * 9, e.r * 9, 0, c[0], c[1], c[2], 0.45, 0, 0);
      const dk = e.r * 0.62 * 2 * r.S.disc.unit;
      r.spr(r.S.disc, e.x, e.y, dk, dk, 0, 0, 0, 0, 1, 0, 1);
      const s = e.r * 2 * r.S.nullCore.unit * pulse;
      const k = e.flash > 0 ? 0.3 : 0;
      r.spr(r.S.nullCore, e.x, e.y, s, s, e.rot, c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k, 1, 0.35 + k, 0);
    },
    onDeath(g, e) {
      for (const s of alive(e.parts, e.partIds)) g.kill(s, 'chain');
    },
  };
  AI.sat = {
    init(g, e) { e.noSep = true; e.knockRes = 0; },
    update(g, e, dt) {
      const b = e.parent;
      e.vx = 0; e.vy = 0;
      if (!b || b.dead || b.id !== e.parentId) { g.kill(e, 'chain'); return; }
      const a = b.ang + (e.idx * TAU) / 8, rad = b.phase >= 3 ? 190 : 150;
      e.x = b.x + Math.cos(a) * rad;
      e.y = b.y + Math.sin(a) * rad;
      e.rot = a;
    },
  };

  NR.BossUtil = { run, alive, rest };
})();
