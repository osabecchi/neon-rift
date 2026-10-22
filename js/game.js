'use strict';
/* NEON RIFT — ゲーム本体(1回の出撃の状態・更新・当たり判定・描画) */
(function () {
  const NR = window.NR;
  const { U, R, TAU } = NR;
  const D = NR.DATA, UP = D.UP;
  const C = {};
  for (const k in NR.COL) C[k] = U.hex(NR.COL[k]);
  const WHITE = [1, 1, 1];
  const HIT_KEYS = ['orbit', 'saturn', 'glaive', 'eclipse', 'flare', 'phoenix', 'void', 'horizon', 'annihilator', 'phantom', 'lance', 'nova', 'supernova', 'mjolnir'];
  const TYPE_COL = {};
  for (const k in D.enemies) TYPE_COL[k] = U.hex(D.enemies[k].color);

  const THEMES = [
    { bg: [0.010, 0.012, 0.035], base: [0.16, 0.24, 0.85], hi: [0.55, 0.85, 1.0], a: 0.17, neb: [[0.35, 0.18, 0.95], [0.08, 0.45, 0.95]] },
    { bg: [0.006, 0.022, 0.03], base: [0.06, 0.55, 0.62], hi: [0.5, 1.0, 0.92], a: 0.16, neb: [[0.05, 0.6, 0.6], [0.2, 0.25, 0.9]] },
    { bg: [0.03, 0.008, 0.03], base: [0.7, 0.12, 0.62], hi: [1.0, 0.55, 0.9], a: 0.16, neb: [[0.85, 0.15, 0.6], [0.4, 0.1, 0.8]] },
    { bg: [0.03, 0.016, 0.006], base: [0.75, 0.42, 0.08], hi: [1.0, 0.85, 0.45], a: 0.16, neb: [[0.95, 0.5, 0.1], [0.8, 0.2, 0.25]] },
    { bg: [0.016, 0.004, 0.035], base: [0.45, 0.1, 0.85], hi: [0.85, 0.6, 1.0], a: 0.18, neb: [[0.6, 0.1, 0.95], [0.9, 0.2, 0.6]] },
  ];

  function makeEnemy() {
    return {
      id: 0, type: '', def: null, ai: null, x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, r: 10, hp: 1, maxHp: 1,
      speed: 0, dir: 0, rot: 0, t: 0, st: 0, state: 0, fireT: 0, spawnT: 0, flash: 0, dead: false,
      elite: false, boss: 0, part: false, parent: null, parentId: -1, idx: 0, invuln: 0, col: null, sprite: null,
      xp: 1, score: 0, knockRes: 1, noSep: false, contact: 1, slowT: 0, burnT: 0, burnD: 0, burnAcc: 0, burnSrc: '',
      xpBonus: 0, a: 0, b: 0, tx: 0, ty: 0, charge: 0, segs: null, segIds: null, parts: null, partIds: null,
      trail: null, script: null, wait: 0, phase: 1, mode: '', hpScale: 1, ang: 0, spin: 0, orb: 0, bt: 0, burst: 0,
      coilA: 0, bounces: 0, orphanT: 0, spawnCd: 0, _qs: 0, hitT: {},
    };
  }
  const RESET = makeEnemy();
  function resetEnemy(e) {
    const hit = e.hitT;
    for (const k in RESET) if (k !== 'hitT') e[k] = RESET[k];
    for (const k of HIT_KEYS) hit[k] = 0;
    e.hitT = hit;
  }
  const makePB = () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 0, life: 0, pierce: 0, bounce: 0, homing: 0, src: '', kind: 0, h0: 0, h1: 0, h2: 0, h3: 0, hi: 0, tgt: null, tgtId: -1, rt: 0, col: null });
  const makeEB = () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 6, life: 0, t: 0, ang: 0, spd: 0, accel: 0, angVel: 0, minSpd: 0, maxSpd: 0, homing: 0, homingT: 0, stopAt: 0, goAt: 0, speed2: 0, went: false, dyn: false, grazed: false, kind: 0, col: null, dmg: 1 });
  const makeProj = () => ({ kind: '', x: 0, y: 0, vx: 0, vy: 0, ang: 0, spd: 0, t: 0, life: 0, dmg: 0, r: 0, a: 0, b: 0, c: 0, state: 0, tgt: null, tgtId: -1, src: '', col: null, erase: false });
  const makeNum = () => ({ x: 0, y: 0, vy: 0, t: 0, life: 0, text: '', crit: false });

  class Game {
    constructor(app, opts) {
      this.app = app;
      this.r = app.renderer;
      this.audio = app.audio;
      this.input = app.input;
      this.ui = app.ui;
      this.save = app.save;
      this.settings = app.save.data.settings;
      this.particles = app.particles;
      this.grid = app.grid;
      this.fx = app.fx;
      this.stars = app.stars;
      this.particles.clear();
      this.grid.reset();

      this.mode = opts.mode || 'campaign';
      this.risk = opts.risk | 0;
      this.mods = opts.mods || [];
      this.seed = opts.seed >>> 0 || (Math.random() * 4294967296) >>> 0;
      this.rng = NR.RNG(this.seed);
      // キャンペーンとデイリーは10ウェーブで終わる。5ウェーブ目の中ボスは出撃ごとに変わる
      this.finalWave = this.mode === 'endless' ? Infinity : D.CAMPAIGN_WAVES;
      this.midBoss = this.rng.pick(D.MID_BOSSES);
      this.W = D.ARENA.w;
      this.H = D.ARENA.h;

      this.time = 0; this.real = 0; this.ts = 1; this.slowT = 0; this.stop = 0;
      this.enemies = []; this.efree = []; this.nextId = 1;
      this.hash = new NR.SpatialHash(this.W, this.H, 80);
      this.pbs = new NR.Pool(makePB, 400, 3000);
      this.ebs = new NR.Pool(makeEB, 600, 3200);
      this.projs = new NR.Pool(makeProj, 60, 600);
      this.nums = new NR.Pool(makeNum, 60, 140);
      this.effects = []; this.lasers = []; this.spawnQ = []; this.timers = []; this.pickups = []; this.pfree = [];
      this.voids = [];
      this.castId = 0;
      this.aoeStack = []; this.aoeDepth = 0;
      this.qa = []; this.qb = []; this.qn = []; this.qs = [];
      this.cam = { x: this.W / 2, y: this.H / 2, zoom: 1, trauma: 0, sx: 0, sy: 0, rot: 0, punch: 0 };
      this.camL = 0; this.camR = 0; this.camT = 0; this.camB = 0;
      this.post = { bloom: 1.0, threshold: 0.12, ca: 0.0012, vignette: 0.45, flash: 0, flashColor: [1, 1, 1], desat: 0, waves: new Float32Array(16), time: 0, grain: 0.028, exposure: 1.35, tint: [1, 1, 1] };
      this.shocks = []; this.flashA = 0; this.flashC = [1, 1, 1]; this.caKick = 0;
      this.theme = JSON.parse(JSON.stringify(THEMES[0]));
      this.flashCol = [1, 1, 1];

      this.score = 0; this.kills = 0; this.combo = 0; this.comboT = 0; this.maxCombo = 0;
      this.grazes = 0; this.perfects = 0; this.dmgBy = {}; this.hits = 0; this.coresRun = 0; this.bossKills = 0; this.evolved = [];
      this.level = 1; this.xp = 0; this.xpNext = D.xpFor(1); this.pendingLevels = 0; this.chestQueue = 0;
      this.inv = { main: {}, weapons: [], passives: {}, perks: {} };
      this.banned = new Set();
      this.od = 0; this.odT = 0;
      this.wave = 0; this.waveState = 'pre'; this.waveT = 1.4; this.cfg = null; this.spawnAcc = 0; this.formT = 8; this.waveHits = 0;
      this.boss = null; this.bossHit = false; this.trickle = 0;
      this.over = false; this.won = false; this.endT = 0; this.ended = false;
      this.bloodCount = 0; this.secondWindUsed = false;
      this.moveDist = 0;

      const M = (id) => this.save.metaLv(id);
      this.rerolls = 1 + M('reroll');
      this.banishes = 1 + M('banish');
      this.revives = M('revive');
      this.player = this.makePlayer(opts.ship || 'vanguard');
      this.od = Math.min(100, M('od') * 25);
      for (const [id, lv] of this.player.def.start) this.addUpgrade(id, lv, true);
      if (this.hasMod('arsenal')) {
        const pool = ['orbit', 'missile', 'arc', 'drone', 'lance', 'nova'].filter((id) => !this.hasWeapon(id));
        for (let i = 0; i < 2 && pool.length; i++) this.addUpgrade(pool.splice(this.rng.int(0, pool.length - 1), 1)[0], 1, true);
      }
      if (this.hasMod('glassall')) this.addUpgrade('glass', 1, true);
      this.recompute();
      this.player.hp = this.player.stats.maxHp;
      this.scoreMult = (1 + 0.3 * this.risk) * (this.hasMod('onehp') ? 2.5 : 1);
      this.coreMult = 1 + 0.25 * this.risk;
      this.audio.playMusic('game');
      this.audio.setIntensity(1);
      this.audio.setOverdrive(false);
    }

    hasMod(id) { return this.mods.indexOf(id) >= 0; }

    makePlayer(shipId) {
      const def = D.ships[shipId];
      return {
        ship: shipId, def, x: this.W / 2, y: this.H / 2, vx: 0, vy: 0, r: 7, hp: def.hp, aim: -Math.PI / 2,
        firing: false, fireCd: 0, inv: 1.5, dashT: 0, dashCd: 0, dashDir: 0, perfectDone: true, pullX: 0, pullY: 0,
        barrier: false, barrierT: 0, regenT: 0, col: U.hex(def.color), sprite: def.sprite, stats: {}, dead: false,
        afterT: 0, exT: 0, warpPending: false, tx: 0, ty: 0, moveAng: 0, moveT: -9,
      };
    }

    // ── 強化と能力値 ──
    lv(id) {
      const u = UP[id];
      if (!u) return 0;
      if (u.cat === 'main') return this.inv.main[id] | 0;
      if (u.cat === 'passive') return this.inv.passives[id] | 0;
      if (u.cat === 'perk') return this.inv.perks[id] ? 1 : 0;
      for (const w of this.inv.weapons) {
        if (w.id === id) return u.cat === 'evo' ? 1 : w.lv;
        if (w.from === id) return u.max;
      }
      return 0;
    }
    hasWeapon(id) { return this.inv.weapons.some((w) => w.id === id || w.from === id); }
    recompute() {
      const p = this.player, ship = p.def, gun = ship.gun, s = p.stats;
      const M = (id) => this.save.metaLv(id), L = (id) => this.lv(id), perk = (id) => !!this.inv.perks[id];
      const od = this.odT > 0;
      s.dmg = (1 + 0.1 * L('power')) * (1 + 0.05 * M('power')) * (perk('glass') ? 1.6 : 1) * (od ? 1.5 : 1);
      s.cd = ship.cd / (1 + 0.08 * L('overclock'));
      s.area = 1 + 0.1 * L('area');
      s.dur = 1 + 0.12 * L('duration');
      s.critC = 0.05 + 0.05 * L('crit');
      s.critM = 2 + 0.15 * L('crit');
      s.speed = 330 * ship.speed * (1 + 0.08 * L('thruster')) * (1 + 0.04 * M('speed'));
      s.maxHp = Math.max(1, ship.hp + L('hull') + M('hull') - (perk('glass') ? 2 : 0) - (this.risk >= 5 ? 1 : 0));
      if (this.hasMod('onehp')) s.maxHp = 1;
      s.magnet = 95 * (1 + 0.3 * L('magnet')) * (1 + 0.2 * M('magnet'));
      s.xp = (1 + 0.08 * L('growth')) * (1 + 0.06 * M('growth')) * (perk('goldrush') ? 1.4 : 1) * (this.hasMod('xpboost') ? 1.5 : 1) * (this.risk >= 9 ? 0.85 : 1);
      s.luck = L('luck') + M('luck') + (this.hasMod('lucky') ? 3 : 0);
      s.rate = gun.rate * (1 + 0.12 * L('rapid')) * (1 + 0.04 * M('rate')) * (od ? 1.4 : 1);
      s.count = gun.count + L('multi');
      s.spread = gun.spread;
      s.pierce = gun.pierce + L('pierce');
      s.bounce = L('ricochet');
      s.homing = [0, 2.2, 4.2, 7][L('homing')];
      s.bdmg = gun.dmg * (1 + 0.16 * L('caliber')) * (1 - 0.06 * L('multi')) * s.dmg;
      s.br = gun.r * (1 + 0.12 * L('caliber'));
      s.bspeed = gun.speed;
      s.blife = gun.life * (1 + 0.06 * L('duration'));
      s.jitter = gun.jitter;
      s.speedVar = gun.speedVar || 0;
      s.tail = L('tail');
      s.regen = L('regen') ? [45, 40, 35, 30, 25][L('regen') - 1] : 0;
      s.barrierCd = L('barrier') ? [30, 26, 22, 18, 14][L('barrier') - 1] : 0;
      s.dashCd = 1.1 * ship.dash * (1 - 0.1 * M('dash')) * (perk('timewarp') ? 0.7 : 1) / (1 + 0.04 * L('overclock'));
      s.iframes = 1.3 + (perk('phantom') ? 0.5 : 0);
      s.odGain = perk('odplus') ? 2 : 1;
      s.odDur = 6 + (perk('odplus') ? 3 : 0);
      if (p.hp > s.maxHp) p.hp = s.maxHp;
      if (s.barrierCd && !p.barrierInit) { p.barrierInit = true; p.barrier = true; }
    }
    addUpgrade(id, n = 1, silent) {
      const u = UP[id];
      if (!u) return;
      const p = this.player;
      if (u.cat === 'main') this.inv.main[id] = Math.min(u.max, (this.inv.main[id] | 0) + n);
      else if (u.cat === 'passive') {
        const was = this.inv.passives[id] | 0;
        this.inv.passives[id] = Math.min(u.max, was + n);
        if (id === 'hull') p.hp += this.inv.passives[id] - was;
      } else if (u.cat === 'weapon') {
        let w = this.inv.weapons.find((x) => x.id === id);
        if (!w) { w = { id, lv: 0, t: 0.6, pts: [] }; this.inv.weapons.push(w); }
        w.lv = Math.min(u.max, w.lv + n);
      } else if (u.cat === 'evo') {
        const i = this.inv.weapons.findIndex((x) => x.id === u.from);
        if (i >= 0) this.inv.weapons[i] = { id, from: u.from, lv: 5, t: 0.3, pts: [] };
        this.evolved.push(id);
        if (!silent) {
          this.audio.play('evolve');
          this.flash([1, 0.85, 0.4], 0.5);
          this.shock(p.x, p.y, 0.025, 420, 0.6);
          this.fx.shockwave(p.x, p.y, U.hex(u.color), 260, 0.5);
          this.app.achieve('evolve');
          const ev = this.save.data.stats.evolved;
          ev[id] = (ev[id] | 0) + 1;
          if (Object.keys(ev).length >= 5) this.app.achieve('evolve5');
        }
      } else if (u.cat === 'perk') this.inv.perks[id] = 1;
      this.recompute();
      if (u.cat === 'passive' || u.cat === 'perk') p.hp = Math.min(p.hp, p.stats.maxHp);
    }
    candidates(forChest) {
      const s = this.player.stats;
      const evos = [], cands = [];
      for (const w of this.inv.weapons) {
        const u = UP[w.id];
        if (u.cat === 'weapon' && w.lv >= u.max && u.evo && this.lv(UP[u.evo].need) > 0 && !this.banned.has(u.evo)) evos.push(u.evo);
      }
      const wFull = this.inv.weapons.length >= 4, pFull = Object.keys(this.inv.passives).length >= 5;
      for (const id in UP) {
        const u = UP[id];
        if (u.cat === 'evo' || this.banned.has(id)) continue;
        if (u.locked && !this.save.data.weapons[id]) continue;
        const lv = this.lv(id);
        if (lv >= u.max) continue;
        let w = 0;
        if (u.cat === 'main') w = lv ? 9 : 7;
        else if (u.cat === 'weapon') { if (!lv && wFull) continue; w = lv ? 10 : 7; }
        else if (u.cat === 'passive') {
          if (!lv && pFull) continue;
          w = lv ? 9 : 6;
          for (const wp of this.inv.weapons) { const wu = UP[wp.id]; if (wu.evo && UP[wu.evo].need === id) w += 5; }
        } else if (u.cat === 'perk') {
          if (forChest || Object.keys(this.inv.perks).length >= 3) continue;
          w = 0.9 + s.luck * 0.45;
        }
        cands.push({ id, w });
      }
      return { evos, cands };
    }
    makeOffers() {
      const s = this.player.stats, count = s.luck >= 3 ? 4 : 3;
      const { evos, cands } = this.candidates(false);
      const offers = evos.slice(0, count).map((id) => ({ id, rarity: 'evo' }));
      while (offers.length < count && cands.length) {
        const c = this.rng.weighted(cands);
        cands.splice(cands.indexOf(c), 1);
        const u = UP[c.id];
        let rarity = u.cat === 'perk' ? 'legend' : 'common';
        if (rarity === 'common' && u.max - this.lv(c.id) >= 2 && this.rng.chance(0.05 + s.luck * 0.025)) rarity = 'epic';
        offers.push({ id: c.id, rarity });
      }
      if (!offers.length) offers.push({ id: '_heal', rarity: 'common' }, { id: '_score', rarity: 'common' });
      return offers;
    }
    applyOffer(o) {
      const p = this.player;
      if (o.id === '_heal') this.heal(1);
      else if (o.id === '_score') this.addScore(2000 * this.wave, true);
      else this.addUpgrade(o.id, o.rarity === 'epic' ? 2 : 1);
      p.inv = Math.max(p.inv, 0.5);
    }
    makeChest() {
      const s = this.player.stats;
      const roll = this.rng();
      const n = roll < 0.05 + s.luck * 0.012 ? 5 : roll < 0.3 + s.luck * 0.02 ? 3 : 1;
      const out = [];
      for (let i = 0; i < n; i++) {
        const { evos, cands } = this.candidates(true);
        let id;
        if (evos.length) id = evos[0];
        else if (cands.length) id = this.rng.weighted(cands).id;
        else id = '_heal';
        out.push(id);
        if (id[0] !== '_') this.addUpgrade(id, 1);
        else this.applyOffer({ id });
      }
      const cores = 5 + this.rng.int(0, 5);
      this.coresRun += cores;
      return { items: out, cores };
    }
    heal(n) {
      const p = this.player;
      const before = p.hp;
      p.hp = Math.min(p.stats.maxHp, p.hp + n);
      if (p.hp > before) {
        this.audio.play('heal');
        this.fx.ring(p.x, p.y, C.green, 10, 60, 0.4, 0.8);
      } else this.addScore(1000, true);
    }

    // ── スコア ──
    mult() {
      const c = this.combo;
      return c >= 800 ? 8 : c >= 500 ? 6 : c >= 300 ? 5 : c >= 150 ? 4 : c >= 80 ? 3 : c >= 40 ? 2 : c >= 15 ? 1.5 : 1;
    }
    addScore(v, raw) {
      this.score += raw ? v : v * this.mult() * (this.odT > 0 ? 2 : 1) * this.scoreMult;
    }

    // ── 敵の生成 ──
    spawnEnemy(type, x, y, o = {}) {
      const def = D.enemies[type];
      if (!def) return null;
      if (this.enemies.length >= 650 && !def.boss && !def.part) return null;
      const e = this.efree.pop() || makeEnemy();
      resetEnemy(e);
      e.id = this.nextId++;
      e.type = type; e.def = def; e.ai = NR.AI[type] || null;
      e.x = x; e.y = y;
      const w = Math.max(1, this.wave), cyc = this.cfg ? this.cfg.cycle : 0;
      let hpM;
      if (def.boss) {
        hpM = (this.risk >= 5 ? 1.4 : 1) * (this.risk >= 10 ? 1.4 : 1) * (this.risk >= 1 ? 1.25 : 1) * (this.risk >= 6 ? 1.3 : 1);
        // キャンペーンではエンドレスより早いウェーブに出るので、その時点の強さに合わせて体力を下げる
        if (this.mode !== 'endless') hpM *= D.CAMPAIGN_BOSS_HP[type] || 1;
        else if (cyc > 0) hpM *= 1.3 * D.hpMult(w) / D.hpMult(w - 20 * cyc);
        e.hpScale = hpM;
      } else if (def.part) hpM = o.hpMult || 1;
      else hpM = D.hpMult(w) * (this.risk >= 1 ? 1.25 : 1) * (this.risk >= 6 ? 1.3 : 1);
      e.elite = !!o.elite && !def.boss && !def.part;
      e.r = def.r * (e.elite ? 1.35 : 1);
      e.maxHp = e.hp = def.hp * hpM * (e.elite ? 5 : 1);
      e.speed = def.speed * (1 + Math.min(0.012 * w, 0.3)) * (this.risk >= 2 ? 1.12 : 1) * (this.risk >= 8 ? 1.1 : 1) * (e.elite ? 1.08 : 1);
      e.xp = def.xp * (1 + 0.035 * (w - 1)) * (e.elite ? 6 : 1);
      e.score = def.score * (e.elite ? 5 : 1);
      e.col = TYPE_COL[type];
      e.sprite = this.r.S[def.sprite];
      e.boss = def.boss || 0;
      e.part = !!def.part;
      if (e.boss) { e.knockRes = 0; e.noSep = true; e.invuln = 2.2; }
      if (e.part) { e.knockRes = 0; e.noSep = true; }
      e.parent = o.parent || null;
      e.parentId = o.parent ? o.parent.id : -1;
      e.idx = o.idx || 0;
      e.spawnT = o.instant ? 0 : 0.3;
      e.rot = this.rng.angle();
      if (e.ai && e.ai.init) e.ai.init(this, e, o);
      this.enemies.push(e);
      return e;
    }
    queueSpawn(type, x, y, o = {}) {
      const t = o.delay || 0.8;
      this.spawnQ.push({ type, x: U.clamp(x, 40, this.W - 40), y: U.clamp(y, 40, this.H - 40), t, max: t, elite: !!o.elite });
    }
    spawnPos(minD) {
      const p = this.player;
      for (let i = 0; i < 16; i++) {
        const x = this.rng.range(60, this.W - 60), y = this.rng.range(60, this.H - 60);
        if (U.dist2(x, y, p.x, p.y) < minD * minD) continue;
        const off = x < this.camL - 30 || x > this.camR + 30 || y < this.camT - 30 || y > this.camB + 30;
        if (off || i > 9) return [x, y];
      }
      return [p.x < this.W / 2 ? this.W - 80 : 80, p.y < this.H / 2 ? this.H - 80 : 80];
    }
    formation() {
      const p = this.player, w = this.wave;
      const kind = this.rng.int(0, w >= 6 ? 3 : w >= 3 ? 2 : 1);
      if (kind === 0) {
        const n = Math.min(8 + Math.floor(w / 2), 18), rad = 440;
        for (let i = 0; i < n; i++) {
          const a = (i * TAU) / n;
          this.queueSpawn(w >= 8 && i % 3 === 0 ? 'dasher' : 'chaser', p.x + Math.cos(a) * rad, p.y + Math.sin(a) * rad, { delay: 1.1 });
        }
      } else if (kind === 1) {
        const pos = this.spawnPos(600), n = 10 + Math.min(w, 12);
        for (let i = 0; i < n; i++) this.queueSpawn('swarmer', pos[0] + R.range(-70, 70), pos[1] + R.range(-70, 70), { delay: 0.9 });
      } else if (kind === 2) {
        const a = this.rng.angle(), cx = p.x + Math.cos(a) * 470, cy = p.y + Math.sin(a) * 470;
        for (let i = -2; i <= 2; i++) this.queueSpawn('dasher', cx + Math.cos(a + Math.PI / 2) * i * 70, cy + Math.sin(a + Math.PI / 2) * i * 70, { delay: 1 });
      } else {
        const a = this.rng.angle();
        for (const s of [1, -1]) {
          for (let i = -1; i <= 1; i++) this.queueSpawn('gunner', p.x + Math.cos(a) * 460 * s + Math.cos(a + 1.57) * i * 80, p.y + Math.sin(a) * 460 * s + Math.sin(a + 1.57) * i * 80, { delay: 1 });
        }
      }
      this.audio.play('spawn');
    }
    spawnBoss(type) {
      const p = this.player;
      let a = this.rng.angle(), x = 0, y = 0;
      for (let i = 0; i < 12; i++) {
        x = U.clamp(p.x + Math.cos(a) * 480, 160, this.W - 160);
        y = U.clamp(p.y + Math.sin(a) * 480, 160, this.H - 160);
        if (U.dist2(x, y, p.x, p.y) > 300 * 300) break;
        a += 0.6;
      }
      const e = this.spawnEnemy(type, x, y, { instant: true });
      this.boss = e;
      this.bossHit = false;
      this.fx.explosion(x, y, e.col, 3, 2);
      this.shock(x, y, 0.03, 600, 0.8);
      this.shake(0.5);
      this.audio.play('roar');
      this.ui.bossIntro(e);
    }

    // ── ウェーブ ──
    startWave(n) {
      this.wave = n;
      this.cfg = D.waveConfig(n, this.risk, this.mode, this.midBoss);
      if (this.hasMod('swarm')) this.cfg.rate *= 1.4;
      if (this.hasMod('elite')) this.cfg.elite *= 3;
      this.waveState = 'intro';
      this.waveT = 2.2;
      this.waveHits = 0;
      this.spawnAcc = 0;
      this.formT = this.rng.range(7, 11);
      const camp = this.mode !== 'endless';
      if (camp) this.themeTarget = THEMES[[0, 0, 0, 1, 1, 2, 2, 3, 3, 4][Math.min(n, 10) - 1]];
      else {
        this.themeTarget = THEMES[Math.floor((n - 1) / 5) % THEMES.length];
        if (n === 20) this.themeTarget = THEMES[4];
      }
      const bossSub = n === this.finalWave ? '最終ボスの反応を検知' : 'ボスの反応を検知';
      this.ui.banner('WAVE ' + n, this.cfg.boss ? 'boss' : 'wave', this.cfg.boss ? bossSub : this.waveSub(n));
      this.audio.play('wave');
      this.audio.setIntensity(camp ? (n <= 2 ? 1 : n <= 5 ? 2 : 3) : n <= 2 ? 1 : n <= 9 ? 2 : 3);
      const st = this.save.data.stats;
      if (n >= 5) this.app.achieve('wave5');
      if (n >= 10) this.app.achieve('wave10');
      if (n >= 15) this.app.achieve('wave15');
      if (this.mode === 'endless' && n >= 30) this.app.achieve('endless30');
      if (n > st.bestWave && this.mode !== 'endless') st.bestWave = n;
    }
    waveSub(n) {
      if (this.continued && n <= 13) return '';
      const intro = this.mode !== 'endless'
        ? { 2: 'スウォーマー出現', 3: 'ダッシャーとガンナーが出現', 4: 'スプリッター出現', 6: 'スピナーとシールド兵が出現 — シールド兵は側面を狙え', 7: 'ボマーとサーペントが出現 — ボマーは群れの中で倒せ', 8: 'ブリンカーとメンダーが出現 — メンダーを最優先で倒せ', 9: 'ヴォイドリング出現 — 引力に注意' }
        : { 2: 'スウォーマー出現', 3: 'ダッシャーとガンナーが出現', 4: 'スプリッター出現', 6: 'スピナー出現', 7: 'シールド兵出現 — 側面を狙え', 8: 'ボマー出現 — 群れの中で倒せ', 9: 'サーペント出現', 11: 'ブリンカー出現', 12: 'メンダー出現 — 最優先で倒せ', 13: 'ヴォイドリング出現 — 引力に注意' };
      return intro[n] || (n > 20 ? 'ENDLESS' : '');
    }
    updateWaves(dt) {
      switch (this.waveState) {
        case 'pre':
          this.waveT -= dt;
          if (this.waveT <= 0) this.startWave(this.wave + 1);
          break;
        case 'intro':
          this.waveT -= dt;
          if (this.waveT <= 0) {
            if (this.cfg.boss) {
              this.waveState = 'warn';
              this.waveT = 3.4;
              this.ui.warning(D.enemies[this.cfg.boss]);
              this.audio.stopMusic(0.5);
              this.audio.play('warning');
            } else {
              this.waveState = 'active';
              this.waveT = this.cfg.duration;
            }
          }
          break;
        case 'warn':
          this.waveT -= dt;
          if (this.waveT <= 0) {
            this.spawnBoss(this.cfg.boss);
            this.waveState = 'boss';
            this.audio.playMusic('boss');
          }
          break;
        case 'active':
          this.waveT -= dt;
          this.spawnTick(dt);
          if (this.waveT <= 0) { this.waveState = 'clearing'; this.waveT = 6; }
          break;
        case 'clearing':
          this.waveT -= dt;
          if (this.liveCount() === 0 || this.waveT <= 0) this.waveCleared();
          break;
        case 'boss':
          this.trickle -= dt;
          if (this.trickle <= 0) {
            this.trickle = 2.6;
            if (this.enemies.length < 40) {
              for (let i = 0; i < 2; i++) {
                const pos = this.spawnPos(500);
                this.queueSpawn(this.wave >= 10 ? 'swarmer' : 'chaser', pos[0], pos[1]);
              }
            }
          }
          break;
        case 'cleared':
          this.waveT -= dt;
          if (this.waveT <= 0) {
            if (this.wave >= this.finalWave && !this.won) {
              this.won = true;
              this.cleared = true;
              this.endT = 1.2;
            } else if (!this.won) this.startWave(this.wave + 1);
          }
          break;
      }
    }
    liveCount() {
      let n = this.spawnQ.length;
      for (const e of this.enemies) if (!e.dead && !e.part) n++;
      return n;
    }
    spawnTick(dt) {
      const cfg = this.cfg;
      this.spawnAcc += cfg.rate * dt;
      const alive = this.enemies.length + this.spawnQ.length;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        if (alive >= cfg.maxAlive) { this.spawnAcc = 0; break; }
        const t = this.rng.weighted(cfg.pool).type;
        const pos = this.spawnPos(520);
        this.queueSpawn(t, pos[0], pos[1], { elite: this.rng.chance(cfg.elite) });
      }
      if (cfg.formations) {
        this.formT -= dt;
        if (this.formT <= 0) { this.formT = this.rng.range(9, 14); this.formation(); }
      }
    }
    waveCleared() {
      const noHit = this.waveHits === 0;
      const bonus = 500 * this.wave * (noHit ? 2 : 1);
      this.addScore(bonus, true);
      this.ui.banner('WAVE CLEAR', 'clear', '+' + U.fmt(bonus) + (noHit ? '  ノーダメージ ×2' : ''));
      this.audio.play('clear');
      this.waveState = 'cleared';
      this.waveT = 2.4;
      for (const o of this.pickups) if (o.type === 'xp' || o.type === 'core') o.mag = true;
    }
    bossDefeated(e) {
      this.bossKills++;
      this.boss = null;
      this.lasers.length = 0;
      this.clearEnemyBullets(true);
      this.slowmo(0.2, 1.6);
      this.flash([1, 1, 1], 0.8);
      this.shake(1);
      this.hitstop(0.12);
      this.shock(e.x, e.y, 0.04, 900, 1.1);
      this.audio.play('bigexplode');
      this.audio.stopMusic(1.6);
      for (let i = 0; i < 7; i++) this.timer(i * 0.12, () => this.fx.explosion(e.x + R.range(-90, 90), e.y + R.range(-90, 90), e.col, 2.8, 1.5));
      this.dropItem('chest', e.x, e.y);
      this.dropItem('heart', e.x - 30, e.y);
      this.dropItem('heart', e.x + 30, e.y);
      for (let i = 0; i < 25; i++) this.dropItem('core', e.x + R.range(-80, 80), e.y + R.range(-80, 80));
      this.app.achieve('boss_' + e.type);
      if (!this.bossHit) this.app.achieve('nohitboss');
      const bk = this.save.data.stats.bossKills;
      bk[e.type] = (bk[e.type] | 0) + 1;
      for (const o of this.enemies) {
        if (!o.dead && o !== e && !o.part) { const id = o.id; this.timer(R.range(0.2, 1.0), () => { if (!o.dead && o.id === id) this.kill(o, 'chain'); }); }
      }
      this.waveState = 'cleared';
      this.waveT = 3.6;
      this.timer(1.6, () => {
        this.ui.banner('BOSS DEFEATED', 'clear', '+' + U.fmt(e.score * this.scoreMult));
        this.audio.play('clear');
        if (this.wave < this.finalWave) this.audio.playMusic('game');
      });
      for (const o of this.pickups) if (o.type === 'xp' || o.type === 'core') o.mag = true;
    }

    // ── 弾・投射物 ──
    spawnPB(x, y, ang, speed, dmg, r, life, pierce, bounce, homing, src, kind) {
      const b = this.pbs.get();
      if (!b) return null;
      b.x = x; b.y = y; b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed;
      b.dmg = dmg; b.r = r; b.life = life; b.pierce = pierce; b.bounce = bounce; b.homing = homing;
      b.src = src; b.kind = kind; b.h0 = b.h1 = b.h2 = b.h3 = 0; b.hi = 0; b.tgt = null; b.tgtId = -1; b.rt = 0;
      b.col = kind === 1 ? C.green : kind === 2 ? C.amber : this.odT > 0 ? C.amber : this.player.col;
      return b;
    }
    eb(x, y, ang, speed, o) {
      const b = this.ebs.get();
      if (!b) return null;
      const sm = (this.risk >= 2 ? 1.12 : 1) * (this.risk >= 8 ? 1.1 : 1) * (this.hasMod('fastbullets') ? 1.3 : 1);
      speed *= sm;
      b.x = x; b.y = y; b.ang = ang; b.spd = speed; b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed;
      b.t = 0; b.life = 9; b.grazed = false; b.went = false;
      b.accel = 0; b.angVel = 0; b.homing = 0; b.homingT = 0; b.stopAt = 0; b.goAt = 0; b.speed2 = 0; b.minSpd = 0; b.maxSpd = 2000;
      b.r = 6.5; b.kind = 0; b.col = C.magenta; b.dmg = 1;
      if (o) {
        if (o.r) b.r = o.r;
        if (o.col) b.col = o.col;
        if (o.kind === 'rice') { b.kind = 1; if (!o.r) b.r = 5.5; }
        else if (o.kind === 'big') { b.kind = 0; if (!o.r) b.r = 12; }
        if (o.life) b.life = o.life;
        if (o.accel) b.accel = o.accel;
        if (o.angVel) b.angVel = o.angVel;
        if (o.homing) { b.homing = o.homing; b.homingT = o.homingT || 1.5; }
        if (o.stopAt) { b.stopAt = o.stopAt; b.goAt = o.goAt; b.speed2 = (o.speed2 || speed) * sm; }
        if (o.minSpd) b.minSpd = o.minSpd;
        if (o.maxSpd) b.maxSpd = o.maxSpd;
      }
      b.dyn = !!(b.accel || b.angVel || b.homing || b.stopAt);
      return b;
    }
    ring(x, y, n, speed, offset, o) { for (let i = 0; i < n; i++) this.eb(x, y, offset + (i * TAU) / n, speed, o); }
    fan(x, y, ang, n, spread, speed, o) {
      for (let i = 0; i < n; i++) this.eb(x, y, ang + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0), speed, o);
    }
    proj(kind) {
      const o = this.projs.get();
      if (!o) return null;
      o.kind = kind; o.x = 0; o.y = 0; o.vx = 0; o.vy = 0; o.ang = 0; o.spd = 0; o.t = 0; o.life = 5; o.dmg = 0; o.r = 8;
      o.a = 0; o.b = 0; o.c = 0; o.state = 0; o.tgt = null; o.tgtId = -1; o.src = kind; o.col = C.cyan; o.erase = false;
      return o;
    }
    addFx(kind, f) { f.kind = kind; if (f.t === undefined) f.t = 0; this.effects.push(f); return f; }
    addLaser(o) {
      const L = Object.assign({ x: 0, y: 0, t: 0, len: 1300, width: 30, warn: 1, active: 2, rot: 0, ang: 0, col: C.amber, fired: false }, o);
      L.ownerId = o.owner ? o.owner.id : -1;
      if (L.owner) { L.x = L.owner.x; L.y = L.owner.y; }
      this.lasers.push(L);
      this.audio.play('charge');
      return L;
    }
    timer(delay, fn) { this.timers.push({ t: delay, fn }); }
    eraseBullets(x, y, r) {
      const items = this.ebs.items, r2 = r * r;
      let n = 0;
      for (let i = 0; i < this.ebs.count; i++) {
        const b = items[i];
        if (b.t >= b.life) continue;
        if (U.dist2(x, y, b.x, b.y) < r2) {
          b.life = 0;
          n++;
          if (n < 40) this.particles.emit(this.r.S.dot, b.x, b.y, R.range(-60, 60), R.range(-60, 60), 0.4, 14, 3, b.col, 0.9, 2, 0, 0.5);
        }
      }
      if (n) this.addScore(n * 10);
      return n;
    }
    clearEnemyBullets(fx) {
      const items = this.ebs.items;
      for (let i = 0; i < this.ebs.count; i++) {
        const b = items[i];
        if (fx && i % 3 === 0) this.particles.emit(this.r.S.dot, b.x, b.y, 0, -40, 0.5, 14, 3, b.col, 0.8, 1, 0, 0.5);
        b.life = 0;
      }
      this.lasers = this.lasers.filter((L) => !L.owner || !L.owner.boss);
    }

    // ── 照会 ──
    queryEnemies(x, y, r, out) { return this.hash.query(x, y, r, out); }
    nearestEnemy(x, y, maxR, filter) {
      const k = this.hash.query(x, y, maxR, this.qn);
      let best = null, bd = maxR * maxR;
      for (let i = 0; i < k; i++) {
        const e = this.qn[i];
        if (e.dead || e.spawnT > 0 || (filter && !filter(e))) continue;
        const d = U.dist2(x, y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
    // 自動照準: 近さに加えてボスと精鋭を優先する
    autoTarget(x, y, maxR) {
      const k = this.hash.query(x, y, maxR, this.qn);
      let best = null, bs = Infinity;
      for (let i = 0; i < k; i++) {
        const e = this.qn[i];
        if (e.dead || e.spawnT > 0 || e.invuln > 0) continue;
        const d = Math.sqrt(U.dist2(x, y, e.x, e.y));
        if (d > maxR) continue;
        const sc = d - (e.boss ? 320 : e.elite ? 120 : e.part ? -60 : 0);
        if (sc < bs) { bs = sc; best = e; }
      }
      return best;
    }
    countEnemies(x, y, r) {
      const k = this.hash.query(x, y, r, this.qs);
      let n = 0;
      for (let i = 0; i < k; i++) if (!this.qs[i].dead && U.dist2(x, y, this.qs[i].x, this.qs[i].y) < r * r) n++;
      return n;
    }
    toScreen(x, y) {
      return [(x - this.cam.x) * this.cam.zoom + this.r.cssW / 2, (y - this.cam.y) * this.cam.zoom + this.r.cssH / 2];
    }
    angleTo(e) { return Math.atan2(this.player.y - e.y, this.player.x - e.x); }
    distTo(e) { return Math.hypot(this.player.x - e.x, this.player.y - e.y); }

    // ── ダメージ ──
    damage(e, amount, src, o) {
      if (e.dead || e.invuln > 0 || e.spawnT > 0) return false;
      const s = this.player.stats;
      let crit = false;
      if (!(o && o.noCrit) && Math.random() < s.critC) { amount *= s.critM; crit = true; }
      e.hp -= amount;
      e.flash = 0.07;
      this.dmgBy[src] = (this.dmgBy[src] || 0) + amount;
      if (o && o.knock && e.knockRes > 0) {
        const kx = o.kx || 0, ky = o.ky || 0, l = Math.hypot(kx, ky) || 1;
        const k = o.knock * e.knockRes * (e.elite ? 0.35 : 1);
        e.kx += (kx / l) * k;
        e.ky += (ky / l) * k;
      }
      if (this.settings.dmgNums && (crit || !(o && o.quiet))) this.addNum(e.x, e.y - e.r, amount, crit);
      if (e.hp <= 0) this.kill(e, src);
      else if (!(o && o.quiet)) this.audio.play(crit ? 'crit' : 'hit');
      return true;
    }
    aoe(x, y, rad, dmg, src, o) {
      const arr = this.aoeStack[this.aoeDepth] || (this.aoeStack[this.aoeDepth] = []);
      this.aoeDepth++;
      const k = this.hash.query(x, y, rad + 80, arr);
      let hits = 0;
      for (let i = 0; i < k; i++) {
        const e = arr[i];
        if (e.dead || (o && o.exclude === e)) continue;
        const rr = rad + e.r;
        if (U.dist2(x, y, e.x, e.y) < rr * rr) {
          this.damage(e, dmg, src, { knock: o && o.knock, kx: e.x - x, ky: e.y - y, quiet: true });
          hits++;
        }
      }
      this.aoeDepth--;
      return hits;
    }
    addNum(x, y, amount, crit) {
      const n = this.nums.get();
      if (!n) return;
      n.x = x + R.range(-8, 8); n.y = y; n.vy = -70; n.t = 0; n.life = crit ? 0.8 : 0.55;
      n.text = Math.max(1, Math.round(amount)) + (crit ? '!' : '');
      n.crit = crit;
    }
    kill(e, src, noReward) {
      if (e.dead) return;
      e.dead = true;
      const p = this.player, s = p.stats;
      if (!noReward) {
        this.kills++;
        this.combo++;
        this.comboT = 2.6;
        if (this.combo > this.maxCombo) {
          this.maxCombo = this.combo;
          if (this.combo === 100) this.app.achieve('combo100');
          if (this.combo === 500) this.app.achieve('combo500');
        }
        if (this.kills === 1000) this.app.achieve('kills1000');
        this.addScore(e.score);
        this.od = Math.min(100, this.od + (e.elite ? 6 : e.boss || e.part ? 2 : 0.35) * s.odGain);
        this.dropXp(e.x, e.y, e.xp * (e.xpBonus || 1));
        if (!e.part && !e.boss) {
          const L = s.luck;
          if (this.rng.chance((0.006 + L * 0.002) * (this.risk >= 4 ? 0.5 : 1) * (this.risk >= 10 ? 0.5 : 1))) this.dropItem('heart', e.x, e.y);
          else if (this.rng.chance(0.0028 + L * 0.001)) this.dropItem('magnet', e.x, e.y);
          else if (this.rng.chance(0.0012)) this.dropItem('nuke', e.x, e.y);
        }
        if (e.elite) {
          this.dropItem('chest', e.x, e.y);
          for (let i = 0; i < 3; i++) this.dropItem('core', e.x + R.range(-20, 20), e.y + R.range(-20, 20));
        }
        if (this.inv.perks.fragment && !e.part) {
          const a0 = Math.random() * TAU;
          for (let i = 0; i < 4; i++) this.spawnPB(e.x, e.y, a0 + (i * TAU) / 4, 620, s.bdmg * 0.6, 4, 0.45, 0, 0, 0, 'fragment', 2);
        }
        if (this.inv.perks.bloodlust && ++this.bloodCount >= 150) { this.bloodCount = 0; this.heal(1); }
        if (e.burnT > 0 && e.burnSrc === 'phoenix') {
          this.aoe(e.x, e.y, 70 * s.area, 30 * s.dmg, 'phoenix', { knock: 120, exclude: e });
          this.fx.glow(e.x, e.y, C.orange, 120, 0.25, 0.9, 0.6);
        }
      }
      const big = e.boss ? 3 : e.elite ? 1.8 : e.part ? 1.3 : 0.65 + e.r / 30;
      this.fx.explosion(e.x, e.y, e.col, big, e.boss ? 2 : 1);
      this.audio.play('kill');
      if (e.elite) { this.hitstop(0.035); this.shake(0.18); }
      if (e.ai && e.ai.onDeath) e.ai.onDeath(this, e);
      if (e.boss && e === this.boss) this.bossDefeated(e);
    }
    dropXp(x, y, v) {
      let n = 0;
      while (v > 0.01 && n < 5) {
        const gv = n === 4 ? v : v >= 25 ? 25 : v;
        this.spawnPickup('xp', x + R.range(-8, 8), y + R.range(-8, 8), gv);
        v -= gv;
        n++;
      }
    }
    dropItem(type, x, y) { this.spawnPickup(type, x, y, 1); }
    spawnPickup(type, x, y, v) {
      const o = this.pfree.pop() || {};
      o.type = type; o.x = x; o.y = y; o.v = v; o.t = 0; o.mag = false; o.ms = 0;
      const a = Math.random() * TAU, sp = type === 'xp' ? R.range(30, 120) : R.range(60, 160);
      o.vx = Math.cos(a) * sp; o.vy = Math.sin(a) * sp;
      this.pickups.push(o);
    }

    // ── プレイヤー ──
    hurtPlayer(amount, sx, sy) {
      const p = this.player;
      if (p.inv > 0 || p.dashT > 0 || this.over || p.dead) return;
      if (p.barrier) {
        p.barrier = false;
        p.barrierT = p.stats.barrierCd;
        p.inv = 0.9;
        this.audio.play('shieldbreak');
        this.fx.ring(p.x, p.y, C.ice, 20, 90, 0.35, 1);
        this.eraseBullets(p.x, p.y, 120);
        this.shake(0.3);
        return;
      }
      p.hp -= amount;
      this.hits++;
      this.waveHits++;
      this.bossHit = true;
      this.combo = 0;
      p.inv = p.stats.iframes;
      this.od = Math.min(100, this.od + 8 * p.stats.odGain);
      this.shake(0.6);
      this.flash([1, 0.12, 0.22], 0.45);
      this.caKick = 0.014;
      this.hitstop(0.08);
      this.slowmo(0.4, 0.35);
      this.audio.play('hurt');
      this.eraseBullets(p.x, p.y, 150);
      this.fx.explosion(p.x, p.y, C.red, 1.1, 1);
      const qh = this.qh || (this.qh = []);
      const k = this.hash.query(p.x, p.y, 160, qh);
      for (let i = 0; i < k; i++) {
        const e = qh[i];
        if (e.dead || e.knockRes <= 0) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
        e.kx += (dx / d) * 500 * e.knockRes;
        e.ky += (dy / d) * 500 * e.knockRes;
      }
      if (p.hp <= 0) {
        if (this.inv.perks.secondwind && !this.secondWindUsed) {
          this.secondWindUsed = true;
          p.hp = 1;
          p.inv = 2.5;
          NR.WeaponUtil.novaBlast(this, 380, 200 * p.stats.dmg, 'nova', true, false, C.amber);
          this.ui.banner('SECOND WIND', 'clear', '致命傷を耐えた');
        } else if (this.revives > 0) {
          this.revives--;
          p.hp = Math.max(1, Math.ceil(p.stats.maxHp / 2));
          p.inv = 3;
          this.clearEnemyBullets(true);
          NR.WeaponUtil.novaBlast(this, 420, 150 * p.stats.dmg, 'nova', true, false, C.pink);
          this.ui.banner('EMERGENCY REBOOT', 'clear', '緊急再起動');
        } else this.die();
      }
    }
    die() {
      const p = this.player;
      this.over = true;
      p.dead = true;
      this.endT = 2.6;
      this.slowmo(0.25, 1.6);
      this.flash([1, 1, 1], 0.7);
      this.shake(1);
      this.fx.explosion(p.x, p.y, p.col, 3.5, 2.5);
      this.fx.explosion(p.x, p.y, C.white, 2, 0);
      this.shock(p.x, p.y, 0.035, 700, 1);
      this.audio.play('bigexplode');
      this.audio.stopMusic(1.2);
    }
    graze(b) {
      this.grazes++;
      this.od = Math.min(100, this.od + 1.6 * this.player.stats.odGain);
      this.addScore(20);
      this.particles.emit(this.r.S.spark, b.x, b.y, R.range(-120, 120), R.range(-120, 120), 0.25, 9, 3, WHITE, 0.9, 3, 1, 0.8);
      this.audio.play('graze');
      if (this.grazes === 300) this.app.achieve('graze300');
    }
    perfectDodge() {
      const p = this.player;
      if (p.perfectDone) return;
      p.perfectDone = true;
      this.perfects++;
      this.od = Math.min(100, this.od + 14 * p.stats.odGain);
      this.addScore(500);
      this.slowmo(0.3, 0.55);
      this.audio.play('perfect');
      this.fx.ring(p.x, p.y, WHITE, 10, 120, 0.45, 1);
      this.fx.glow(p.x, p.y, C.cyan, 160, 0.3, 0.8, 0.8);
      const sp = this.toScreen(p.x, p.y);
      this.ui.popText(sp[0], sp[1] - 40, 'JUST!');
      if (this.perfects === 30) this.app.achieve('perfect30');
    }
    activateOD() {
      const p = this.player;
      this.od = 0;
      this.odT = p.stats.odDur;
      this.recompute();
      this.eraseBullets(p.x, p.y, 300);
      this.aoe(p.x, p.y, 260, 60 * p.stats.dmg, 'overdrive', { knock: 400 });
      this.flash([1, 0.75, 0.25], 0.5);
      this.shock(p.x, p.y, 0.03, 520, 0.6);
      this.fx.shockwave(p.x, p.y, C.amber, 280, 0.5);
      this.shake(0.4);
      this.audio.play('overdrive');
      this.audio.setOverdrive(true);
      this.ui.banner('OVERDRIVE', 'od', '火力 ×1.5・スコア ×2・敵が減速');
    }
    updatePlayer(dt) {
      const p = this.player, s = p.stats, inp = this.input;
      if (p.dead) return;
      const mv = inp.move();
      const sx = (p.x - this.cam.x) * this.cam.zoom + this.r.cssW / 2, sy = (p.y - this.cam.y) * this.cam.zoom + this.r.cssH / 2;
      const aim = inp.aim(sx, sy);
      if (aim === null) {
        const e = this.autoTarget(p.x, p.y, 620);
        const moving = Math.abs(p.vx) + Math.abs(p.vy) > 40;
        const want = e ? Math.atan2(e.y - p.y, e.x - p.x) : mv.x || mv.y ? Math.atan2(mv.y, mv.x) : moving ? Math.atan2(p.vy, p.vx) : p.aim;
        p.aim = U.turnTo(p.aim, want, 14 * dt);
      } else p.aim = aim;
      p.firing = inp.firing() || this.settings.autofire || inp.device === 'touch' || (inp.device === 'pad' && (Math.abs(inp.pad.rx) > 0.2 || Math.abs(inp.pad.ry) > 0.2));

      // ドラッグ操作: 指を動かした量を「これから進む距離」として貯め、速度上限つきで追従する
      const dragMode = inp.device === 'touch' && inp.touchMode !== 'stick';
      if (dragMode) {
        const d = inp.drag;
        if (p.dashT > 0) { p.tx = 0; p.ty = 0; }
        else {
          const k = inp.touchSens / this.cam.zoom;
          p.tx += d.dx * k;
          p.ty += d.dy * k;
          const bl = Math.hypot(p.tx, p.ty);
          if (bl > 180) { p.tx *= 180 / bl; p.ty *= 180 / bl; }
        }
        d.dx = 0;
        d.dy = 0;
      }

      p.dashCd -= dt;
      if (inp.take('dash')) {
        if (p.dashCd <= 0 && p.dashT <= 0) {
          const dir = mv.x || mv.y ? Math.atan2(mv.y, mv.x) : this.time - p.moveT < 0.25 ? p.moveAng : p.aim;
          p.tx = 0; p.ty = 0;
          p.dashDir = dir; p.dashT = 0.17; p.dashCd = s.dashCd; p.perfectDone = false;
          p.vx = Math.cos(dir) * 1150; p.vy = Math.sin(dir) * 1150;
          this.audio.play('dash');
          this.grid.impulse(p.x, p.y, 120, 4);
          this.fx.sparks(p.x, p.y, 8, p.col, 100, 300, 0.3, 6, dir + Math.PI, 1.2);
        }
      }
      if (p.dashT > 0) {
        p.dashT -= dt;
        p.afterT -= dt;
        if (p.afterT <= 0) {
          p.afterT = 0.022;
          const S = this.r.S[p.sprite];
          this.particles.emit(S, p.x, p.y, 0, 0, 0.22, 44 * S.unit, 40 * S.unit, p.col, 0.55, 0, 0, 0.2, p.aim, 0);
        }
        if (this.inv.perks.phantom) {
          const k = this.hash.query(p.x, p.y, 60, this.qa);
          for (let i = 0; i < k; i++) {
            const e = this.qa[i];
            if (e.dead || e.hitT.phantom > this.time) continue;
            if (U.dist2(p.x, p.y, e.x, e.y) < (e.r + 24) * (e.r + 24)) { e.hitT.phantom = this.time + 0.4; this.damage(e, 45 * s.dmg, 'phantom', { knock: 200, kx: e.x - p.x, ky: e.y - p.y }); }
          }
        }
        if (p.dashT <= 0) {
          p.vx = Math.cos(p.dashDir) * s.speed;
          p.vy = Math.sin(p.dashDir) * s.speed;
          p.inv = Math.max(p.inv, 0.08);
          if (this.inv.perks.timewarp) this.slowmo(0.45, 0.6);
        }
      } else if (dragMode) {
        const dd = Math.hypot(p.tx, p.ty), maxStep = s.speed * 1.8 * dt;
        let mx = 0, my = 0;
        if (dd > 0.01) {
          const st = Math.min(dd, maxStep);
          mx = (p.tx / dd) * st;
          my = (p.ty / dd) * st;
          p.tx -= mx;
          p.ty -= my;
        }
        p.vx = dt > 0 ? mx / dt : 0;
        p.vy = dt > 0 ? my / dt : 0;
      } else {
        p.vx = U.damp(p.vx, mv.x * s.speed, 16, dt);
        p.vy = U.damp(p.vy, mv.y * s.speed, 16, dt);
      }
      const ox = p.x, oy = p.y;
      const nx = p.x + (p.vx + p.pullX) * dt, ny = p.y + (p.vy + p.pullY) * dt;
      p.pullX = 0; p.pullY = 0;
      p.x = U.clamp(nx, 12, this.W - 12);
      p.y = U.clamp(ny, 12, this.H - 12);
      // 壁に当たった方向の貯めは捨てる(指を戻したときに引っかからないように)
      if (p.x !== nx) p.tx = 0;
      if (p.y !== ny) p.ty = 0;
      const moved = Math.hypot(p.x - ox, p.y - oy);
      this.moveDist += moved;
      if (dt > 0 && moved / dt > 40) { p.moveAng = Math.atan2(p.y - oy, p.x - ox); p.moveT = this.time; }
      p.inv -= dt;

      p.exT -= dt;
      const sp2 = p.vx * p.vx + p.vy * p.vy;
      if (sp2 > 900 && p.exT <= 0) {
        p.exT = 0.03;
        const a = Math.atan2(p.vy, p.vx) + Math.PI;
        const c = this.odT > 0 ? C.amber : p.col;
        this.particles.emit(this.r.S.glow, p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12, Math.cos(a) * 80 + R.range(-30, 30), Math.sin(a) * 80 + R.range(-30, 30), 0.3, 16, 4, c, 0.5, 2, 0, 0.3);
      }
      if (s.regen) {
        p.regenT += dt;
        if (p.regenT >= s.regen) { p.regenT = 0; if (p.hp < s.maxHp) this.heal(1); }
      }
      if (s.barrierCd && !p.barrier) {
        p.barrierT -= dt;
        if (p.barrierT <= 0) { p.barrier = true; this.audio.play('core'); }
      }
      if (inp.take('od')) {
        if (this.odT <= 0 && this.od >= 100) this.activateOD();
        else if (this.odT <= 0) this.audio.play('deny');
      }
    }

    // ── 1フレームの更新 ──
    update(dtReal) {
      this.real += dtReal;
      this.post.time = this.real;
      if (this.stop > 0) {
        this.stop -= dtReal;
        this.updateCamera(dtReal);
        this.updatePost(dtReal);
        return;
      }
      if (this.slowT > 0) { this.slowT -= dtReal; if (this.slowT <= 0) this.slowT = 0; }
      else this.ts = U.damp(this.ts, 1, 6, dtReal);
      const dt = dtReal * this.ts;
      this.time += dt;

      if (!this.over) this.updatePlayer(dt);
      if (!this.over && !this.won) this.updateWaves(dt);
      this.updateSpawnQ(dt);
      this.updateTimers(dt);

      const edt = dt * (this.odT > 0 ? 0.65 : 1);
      this.voids.length = 0;
      this.updateEnemies(edt);
      this.buildHash();
      this.separate(dt);
      if (!this.over) {
        NR.MainGun.update(this, dt);
        for (const w of this.inv.weapons) { const def = NR.Weapons[w.id]; if (def) def.update(this, w, dt); }
      }
      this.updatePB(dt);
      this.updateProjs(dt);
      this.updateEB(edt);
      this.updateLasers(edt);
      this.updateEffects(dt);
      this.updatePickups(dt);
      if (!this.over) this.contact();
      if (this.combo > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
      if (this.odT > 0) {
        this.odT -= dt;
        if (this.odT <= 0) { this.odT = 0; this.recompute(); this.audio.setOverdrive(false); }
      }
      this.cleanup();
      this.particles.update(dt);
      this.grid.update(dt);
      this.updateNums(dt);
      this.updateCamera(dtReal);
      this.updatePost(dtReal);
      this.updateTheme(dtReal);

      if (this.over || this.won) {
        this.endT -= dtReal;
        if (this.endT <= 0 && !this.ended) { this.ended = true; this.app.endRun(this, this.won); }
        return;
      }
      if (this.pendingLevels > 0) this.app.openLevelUp(this);
      else if (this.chestQueue > 0) this.app.openChest(this);
    }
    updateSpawnQ(dt) {
      for (let i = this.spawnQ.length - 1; i >= 0; i--) {
        const q = this.spawnQ[i];
        q.t -= dt;
        if (q.t <= 0) {
          this.spawnQ.splice(i, 1);
          const e = this.spawnEnemy(q.type, q.x, q.y, { elite: q.elite });
          if (e) {
            this.fx.glow(q.x, q.y, e.col, 80, 0.25, 0.9, 0.6);
            this.fx.sparks(q.x, q.y, 5, e.col, 60, 200, 0.3, 6);
          }
        }
      }
    }
    updateTimers(dt) {
      for (let i = this.timers.length - 1; i >= 0; i--) {
        const tm = this.timers[i];
        tm.t -= dt;
        if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
      }
    }
    updateEnemies(dt) {
      const list = this.enemies, n = list.length;
      for (let i = 0; i < n; i++) {
        const e = list[i];
        if (e.dead) continue;
        e.t += dt;
        if (e.flash > 0) e.flash -= dt;
        if (e.invuln > 0) e.invuln -= dt;
        if (e.spawnT > 0) { e.spawnT -= dt; continue; }
        const slow = e.slowT > 0 ? 0.5 : 1;
        if (e.slowT > 0) e.slowT -= dt;
        if (e.ai) e.ai.update(this, e, dt * slow);
        if (e.dead) continue;
        e.x += (e.vx * slow + e.kx) * dt;
        e.y += (e.vy * slow + e.ky) * dt;
        const kd = Math.exp(-7 * dt);
        e.kx *= kd; e.ky *= kd;
        if (!e.part) {
          if (e.x < e.r) { e.x = e.r; if (e.vx < 0) e.dir = Math.PI - e.dir; }
          else if (e.x > this.W - e.r) { e.x = this.W - e.r; if (e.vx > 0) e.dir = Math.PI - e.dir; }
          if (e.y < e.r) { e.y = e.r; if (e.vy < 0) e.dir = -e.dir; }
          else if (e.y > this.H - e.r) { e.y = this.H - e.r; if (e.vy > 0) e.dir = -e.dir; }
        }
        if (e.burnT > 0) {
          e.burnT -= dt;
          e.burnAcc += e.burnD * dt;
          if (e.burnAcc >= 3) { const v = e.burnAcc; e.burnAcc = 0; this.damage(e, v, e.burnSrc, { quiet: true, noCrit: true }); }
          if (Math.random() < 0.25) this.particles.emit(this.r.S.glow, e.x + R.range(-e.r, e.r), e.y + R.range(-e.r, e.r), 0, -60, 0.35, 16, 4, C.orange, 0.6, 1, 0, 0.3);
        }
      }
    }
    buildHash() {
      const h = this.hash;
      h.clear();
      for (const e of this.enemies) if (!e.dead) h.insert(e, e.x, e.y, e.r);
    }
    separate(dt) {
      const list = this.enemies, Q = this.qa;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.dead || e.noSep || e.spawnT > 0) continue;
        const k = this.hash.query(e.x, e.y, e.r + 26, Q);
        for (let j = 0; j < k; j++) {
          const o = Q[j];
          if (o === e || o.dead || o.noSep) continue;
          const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r, d2 = dx * dx + dy * dy;
          if (d2 < rr * rr && d2 > 0.01) {
            const d = Math.sqrt(d2), push = (rr - d) * 0.5 * Math.min(1, dt * 12);
            e.x += (dx / d) * push; e.y += (dy / d) * push;
          }
        }
      }
    }
    updatePB(dt) {
      const pool = this.pbs, items = pool.items, Q = this.qb, voids = this.voids, W = this.W, H = this.H;
      for (let i = pool.count - 1; i >= 0; i--) {
        const b = items[i];
        b.life -= dt;
        if (b.life <= 0) { pool.free(i); continue; }
        if (b.homing > 0) {
          b.rt -= dt;
          if (b.rt <= 0) {
            b.rt = 0.15;
            if (!b.tgt || b.tgt.dead || b.tgt.id !== b.tgtId) { const t = this.nearestEnemy(b.x, b.y, 380); b.tgt = t; b.tgtId = t ? t.id : -1; }
          }
          if (b.tgt && !b.tgt.dead && b.tgt.id === b.tgtId) {
            const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx);
            const na = U.turnTo(a, Math.atan2(b.tgt.y - b.y, b.tgt.x - b.x), b.homing * dt);
            b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
          }
        }
        for (let v = 0; v < voids.length; v++) {
          const e = voids[v], dx = e.x - b.x, dy = e.y - b.y, d2 = dx * dx + dy * dy, RR = 160 + e.r * 4;
          if (d2 < RR * RR && d2 > 100) {
            const d = Math.sqrt(d2), f = (700 * (1 - d / RR)) / d;
            b.vx += dx * f * dt; b.vy += dy * f * dt;
          }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
          if (b.bounce > 0) {
            if (b.x < 0 || b.x > W) { b.vx = -b.vx; b.x = U.clamp(b.x, 0, W); }
            if (b.y < 0 || b.y > H) { b.vy = -b.vy; b.y = U.clamp(b.y, 0, H); }
            b.bounce--;
          } else {
            this.particles.emit(this.r.S.spark, U.clamp(b.x, 0, W), U.clamp(b.y, 0, H), -b.vx * 0.2, -b.vy * 0.2, 0.2, 8, 2, b.col, 0.8, 4, 1, 0.4);
            pool.free(i);
            continue;
          }
        }
        const k = this.hash.query(b.x, b.y, b.r + 34, Q);
        let dead = false;
        for (let j = 0; j < k; j++) {
          const e = Q[j];
          if (e.dead || e.spawnT > 0) continue;
          const rr = e.r + b.r;
          if (U.dist2(b.x, b.y, e.x, e.y) >= rr * rr) continue;
          const id = e.id;
          if (b.h0 === id || b.h1 === id || b.h2 === id || b.h3 === id) continue;
          if (e.ai && e.ai.blocks && e.ai.blocks(this, e, b.x - b.vx * dt, b.y - b.vy * dt)) {
            this.fx.sparks(b.x, b.y, 3, WHITE, 80, 260, 0.2, 5);
            this.audio.play('block');
            dead = true;
            break;
          }
          if (e.invuln > 0) {
            this.particles.emit(this.r.S.spark, b.x, b.y, -b.vx * 0.3, -b.vy * 0.3, 0.2, 8, 2, WHITE, 0.8, 4, 1, 0.4);
            dead = true;
            break;
          }
          this.damage(e, b.dmg, b.src, { knock: 36, kx: b.vx, ky: b.vy });
          switch (b.hi++ & 3) { case 0: b.h0 = id; break; case 1: b.h1 = id; break; case 2: b.h2 = id; break; default: b.h3 = id; }
          if (b.pierce > 0) { b.pierce--; continue; }
          if (b.bounce > 0) {
            b.bounce--;
            const t = this.nearestEnemy(b.x, b.y, 330, (en) => en.id !== b.h0 && en.id !== b.h1 && en.id !== b.h2 && en.id !== b.h3);
            if (t) {
              const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(t.y - b.y, t.x - b.x);
              b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
              b.life = Math.max(b.life, 0.45);
              break;
            }
          }
          dead = true;
          break;
        }
        if (dead) {
          this.particles.emit(this.r.S.glow, b.x, b.y, 0, 0, 0.1, 22, 8, b.col, 0.7, 0, 0, 0.5);
          pool.free(i);
        }
      }
    }
    updateProjs(dt) {
      const pool = this.projs, items = pool.items;
      for (let i = pool.count - 1; i >= 0; i--) {
        const o = items[i];
        const def = NR.Proj[o.kind];
        if (!def || !def.update(this, o, dt)) pool.free(i);
      }
    }
    updateEB(dt) {
      const pool = this.ebs, items = pool.items, p = this.player, W = this.W, H = this.H;
      const canHit = p.inv <= 0 && p.dashT <= 0 && !this.over && !p.dead;
      const gr = p.r + 22;
      for (let i = pool.count - 1; i >= 0; i--) {
        const b = items[i];
        b.t += dt;
        if (b.t >= b.life) { pool.free(i); continue; }
        if (b.dyn) {
          if (b.stopAt > 0 && b.t >= b.stopAt && b.t < b.goAt) b.spd = U.damp(b.spd, 0, 9, dt);
          else if (b.goAt > 0 && b.t >= b.goAt && !b.went) { b.went = true; b.ang = Math.atan2(p.y - b.y, p.x - b.x); b.spd = b.speed2; }
          else if (b.accel) b.spd = U.clamp(b.spd + b.accel * dt, b.minSpd, b.maxSpd);
          if (b.angVel) b.ang += b.angVel * dt;
          if (b.homing > 0 && b.t < b.homingT) b.ang = U.turnTo(b.ang, Math.atan2(p.y - b.y, p.x - b.x), b.homing * dt);
          b.vx = Math.cos(b.ang) * b.spd;
          b.vy = Math.sin(b.ang) * b.spd;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < -80 || b.x > W + 80 || b.y < -80 || b.y > H + 80) { pool.free(i); continue; }
        const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy;
        const hr = p.r + b.r * 0.7;
        if (d2 < hr * hr) {
          if (canHit) { this.hurtPlayer(b.dmg, b.x, b.y); pool.free(i); continue; }
          if (p.dashT > 0) this.perfectDodge();
        }
        if (!b.grazed && !p.dead && d2 < (gr + b.r) * (gr + b.r)) { b.grazed = true; this.graze(b); }
      }
    }
    updateLasers(dt) {
      const p = this.player;
      for (let i = this.lasers.length - 1; i >= 0; i--) {
        const L = this.lasers[i];
        if (L.owner) {
          if (L.owner.dead || L.owner.id !== L.ownerId) { this.lasers.splice(i, 1); continue; }
          L.x = L.owner.x; L.y = L.owner.y;
        }
        L.t += dt;
        if (L.t > L.warn) {
          if (!L.fired) { L.fired = true; this.audio.play('laser'); this.shake(0.15); }
          L.ang += L.rot * dt;
          const x2 = L.x + Math.cos(L.ang) * L.len, y2 = L.y + Math.sin(L.ang) * L.len;
          const hr = L.width * 0.38 + p.r;
          if (!p.dead && U.segDist2(p.x, p.y, L.x, L.y, x2, y2) < hr * hr) {
            if (p.dashT > 0) this.perfectDodge();
            else this.hurtPlayer(1, p.x, p.y);
          }
          if (Math.random() < 0.5) this.particles.emit(this.r.S.spark, x2, y2, R.range(-200, 200), R.range(-200, 200), 0.3, 10, 3, L.col, 0.9, 3, 1, 0.4);
        }
        if (L.t > L.warn + L.active) this.lasers.splice(i, 1);
      }
    }
    updateEffects(dt) {
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const f = this.effects[i];
        const def = NR.FxKinds[f.kind];
        if (!def || !def.update(this, f, dt)) this.effects.splice(i, 1);
      }
    }
    updatePickups(dt) {
      const p = this.player, mr = p.stats.magnet * (this.odT > 0 ? 1.6 : 1), mr2 = mr * mr;
      const list = this.pickups;
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        o.t += dt;
        const dx = p.x - o.x, dy = p.y - o.y, d2 = dx * dx + dy * dy;
        if (!o.mag && !p.dead) {
          if (o.type === 'xp' || o.type === 'core') { if (d2 < mr2) o.mag = true; }
          else if (d2 < 70 * 70) o.mag = true;
        }
        if (o.mag && !p.dead) {
          const d = Math.sqrt(d2) + 0.01;
          o.ms = Math.max(o.ms, 260) + 2400 * dt;
          const sp = Math.min(o.ms, 1500);
          o.vx = (dx / d) * sp; o.vy = (dy / d) * sp;
        } else {
          const k = Math.exp(-4 * dt);
          o.vx *= k; o.vy *= k;
        }
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (!p.dead && d2 < 26 * 26) {
          this.collect(o);
          list[i] = list[list.length - 1];
          list.pop();
          this.pfree.push(o);
        }
      }
      if (list.length > 420) this.mergeGems();
    }
    mergeGems() {
      const p = this.player, list = this.pickups;
      let bank = 0, bx = 0, by = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        if (o.type !== 'xp' || o.mag) continue;
        if (U.dist2(o.x, o.y, p.x, p.y) > 700 * 700) {
          bank += o.v; bx = o.x; by = o.y;
          list[i] = list[list.length - 1];
          list.pop();
          this.pfree.push(o);
        }
      }
      if (bank > 0) { this.spawnPickup('xp', bx, by, bank); list[list.length - 1].vx = 0; list[list.length - 1].vy = 0; }
    }
    collect(o) {
      const p = this.player;
      switch (o.type) {
        case 'xp':
          this.gainXp(o.v);
          this.audio.play('pickup');
          break;
        case 'heart':
          this.heal(1);
          break;
        case 'magnet':
          for (const q of this.pickups) if (q.type === 'xp' || q.type === 'core') q.mag = true;
          this.audio.play('chest');
          this.fx.ring(p.x, p.y, C.blue, 20, 200, 0.5, 0.8);
          break;
        case 'nuke': {
          this.flash([1, 1, 1], 0.6);
          this.shake(0.6);
          this.shock(p.x, p.y, 0.04, 900, 0.9);
          this.audio.play('bigexplode');
          this.clearEnemyBullets(true);
          for (const e of this.enemies) {
            if (e.dead || e.boss || e.part) continue;
            if (e.x > this.camL - 50 && e.x < this.camR + 50 && e.y > this.camT - 50 && e.y < this.camB + 50) this.kill(e, 'nuke');
          }
          break;
        }
        case 'chest':
          this.chestQueue++;
          break;
        case 'core':
          this.coresRun += 1;
          this.audio.play('core');
          break;
      }
    }
    gainXp(v) {
      this.xp += v * this.player.stats.xp;
      while (this.xp >= this.xpNext) {
        this.xp -= this.xpNext;
        this.level++;
        this.xpNext = D.xpFor(this.level);
        this.pendingLevels++;
        if (this.level >= 30) this.app.achieve('level30');
      }
    }
    contact() {
      const p = this.player;
      if (p.dead) return;
      const k = this.hash.query(p.x, p.y, p.r + 50, this.qa);
      for (let i = 0; i < k; i++) {
        const e = this.qa[i];
        if (e.dead || e.spawnT > 0 || e.contact === 0) continue;
        const rr = e.r * 0.8 + p.r;
        if (U.dist2(p.x, p.y, e.x, e.y) < rr * rr) {
          if (p.dashT > 0) { this.perfectDodge(); continue; }
          if (p.inv > 0) continue;
          this.hurtPlayer(1, e.x, e.y);
          break;
        }
      }
    }
    cleanup() {
      const list = this.enemies;
      let j = 0;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.dead) { this.efree.push(e); continue; }
        list[j++] = e;
      }
      list.length = j;
    }
    updateNums(dt) {
      const pool = this.nums, items = pool.items;
      for (let i = pool.count - 1; i >= 0; i--) {
        const n = items[i];
        n.t += dt;
        n.y += n.vy * dt;
        n.vy *= Math.exp(-3 * dt);
        if (n.t >= n.life) pool.free(i);
      }
    }

    // ── カメラと後処理 ──
    shake(a) { this.cam.trauma = Math.min(1, this.cam.trauma + a); }
    flash(c, a) { this.flashC = c; this.flashA = Math.max(this.flashA, a); }
    shock(x, y, str, rad, dur) {
      if (!this.app.quality.distort) return;
      this.shocks.push({ x, y, str, rad, dur, t: 0 });
      if (this.shocks.length > 4) this.shocks.shift();
    }
    slowmo(scale, dur) { this.ts = Math.min(this.ts, scale); this.slowT = Math.max(this.slowT, dur); }
    hitstop(d) { this.stop = Math.max(this.stop, d); }
    updateCamera(dt) {
      const p = this.player, cam = this.cam, r = this.r;
      cam.zoom = this.app.zoom * (1 + cam.punch);
      const look = this.input.device === 'kb' ? 70 : 40;
      const tx = p.x + Math.cos(p.aim) * look + p.vx * 0.1, ty = p.y + Math.sin(p.aim) * look + p.vy * 0.1;
      cam.x = U.damp(cam.x, tx, 5, dt);
      cam.y = U.damp(cam.y, ty, 5, dt);
      const hw = r.cssW / (2 * cam.zoom), hh = r.cssH / (2 * cam.zoom), m = 150;
      cam.x = hw * 2 > this.W + 2 * m ? this.W / 2 : U.clamp(cam.x, hw - m, this.W - hw + m);
      cam.y = hh * 2 > this.H + 2 * m ? this.H / 2 : U.clamp(cam.y, hh - m, this.H - hh + m);
      cam.trauma = Math.max(0, cam.trauma - dt * 1.5);
      const sh = cam.trauma * cam.trauma * this.settings.shake, t = this.real;
      cam.sx = (Math.sin(t * 41.3) + Math.sin(t * 27.1) * 0.6) * 18 * sh;
      cam.sy = (Math.sin(t * 37.7 + 1.3) + Math.sin(t * 23.9) * 0.6) * 18 * sh;
      cam.rot = Math.sin(t * 29.3) * 0.025 * sh;
      cam.punch = U.damp(cam.punch, 0, 6, dt);
      this.camL = cam.x - hw; this.camR = cam.x + hw; this.camT = cam.y - hh; this.camB = cam.y + hh;
    }
    updateTheme(dt) {
      const T = this.themeTarget;
      if (!T) return;
      const th = this.theme, k = 1 - Math.exp(-1.5 * dt);
      for (const key of ['bg', 'base', 'hi']) for (let i = 0; i < 3; i++) th[key][i] += (T[key][i] - th[key][i]) * k;
      for (let n = 0; n < 2; n++) for (let i = 0; i < 3; i++) th.neb[n][i] += (T.neb[n][i] - th.neb[n][i]) * k;
      th.a += (T.a - th.a) * k;
    }
    updatePost(dt) {
      const P = this.post, st = this.settings, p = this.player;
      this.flashA = Math.max(0, this.flashA - dt * 2.4);
      P.flash = this.flashA * 0.6 * st.flashes;
      P.flashColor = this.flashC;
      this.caKick = U.damp(this.caKick, 0, 5, dt);
      P.ca = 0.0012 + this.caKick;
      P.bloom = this.app.quality.bloom;
      P.vignette = 0.45;
      P.tint[0] = 1; P.tint[1] = 1; P.tint[2] = 1;
      P.desat = U.damp(P.desat, this.over ? 0.75 : 0, 2, dt);
      if (this.odT > 0) { P.tint[0] = 1.12; P.tint[1] = 1.04; P.tint[2] = 0.86; P.bloom *= 1.25; }
      if (!this.over && p.hp === 1 && p.stats.maxHp > 1) {
        const pulse = 0.5 + 0.5 * Math.sin(this.real * 6);
        P.vignette = 0.6 + pulse * 0.25;
        P.tint[0] *= 1 + pulse * 0.12;
        P.tint[1] *= 1 - pulse * 0.06;
        P.tint[2] *= 1 - pulse * 0.06;
      }
      const wv = P.waves;
      wv.fill(0);
      for (let i = this.shocks.length - 1; i >= 0; i--) {
        const s = this.shocks[i];
        s.t += dt;
        if (s.t >= s.dur) { this.shocks.splice(i, 1); continue; }
      }
      const r = this.r;
      for (let i = 0; i < this.shocks.length && i < 4; i++) {
        const s = this.shocks[i], k = s.t / s.dur;
        const uv = r.toUV(s.x, s.y);
        wv[i * 4] = uv[0];
        wv[i * 4 + 1] = uv[1];
        wv[i * 4 + 2] = (s.rad * U.easeOutCubic(k) * this.cam.zoom) / r.cssH;
        wv[i * 4 + 3] = s.str * (1 - k);
      }
    }

    // ── 描画 ──
    render() {
      const r = this.r, cam = this.cam, th = this.theme;
      r.begin(cam.x + cam.sx, cam.y + cam.sy, cam.zoom, cam.rot, th.bg);
      this.stars.render(r, cam.x, cam.y, this.real);
      NR.drawNebula(r, cam.x, cam.y, th);
      this.grid.render(r, th);
      r.flushLines();
      this.renderBorder(r, th);
      this.renderPickups(r);
      this.renderSpawnQ(r);
      this.particles.render(r);
      for (const f of this.effects) { const def = NR.FxKinds[f.kind]; if (def && f.t >= 0) def.render(this, f, r); }
      this.renderEnemies(r);
      for (let i = 0; i < this.projs.count; i++) { const o = this.projs.items[i]; const def = NR.Proj[o.kind]; if (def) def.render(this, o, r); }
      this.renderPB(r);
      for (const w of this.inv.weapons) { const def = NR.Weapons[w.id]; if (def && def.render) def.render(this, w, r); }
      this.renderPlayer(r);
      this.renderLasers(r);
      this.renderEB(r);
      this.renderNums(r);
      this.renderReticle(r);
      r.end(this.post);
    }
    renderBorder(r, th) {
      const W = this.W, H = this.H, h = th.hi, a = 0.3 + 0.1 * Math.sin(this.real * 2);
      const S = r.S.beam;
      r.beam(S, 0, 0, W, 0, 6, h[0], h[1], h[2], a, 0.15);
      r.beam(S, W, 0, W, H, 6, h[0], h[1], h[2], a, 0.15);
      r.beam(S, W, H, 0, H, 6, h[0], h[1], h[2], a, 0.15);
      r.beam(S, 0, H, 0, 0, 6, h[0], h[1], h[2], a, 0.15);
      for (const [x, y] of [[0, 0], [W, 0], [W, H], [0, H]]) r.spr(r.S.glow, x, y, 80, 80, 0, h[0], h[1], h[2], 0.4, 0.2, 0);
    }
    renderPickups(r) {
      const S = r.S, t = this.real;
      for (const o of this.pickups) {
        switch (o.type) {
          case 'xp': {
            const big = o.v >= 25, mid = o.v >= 5;
            const c = big ? C.pink : mid ? C.blue : C.green;
            const s = big ? 30 : mid ? 22 : 15;
            r.spr(S.gem, o.x, o.y, s * 1.6, s * 1.6, t * 2 + o.x, c[0], c[1], c[2], 1, 0.5, 0);
            break;
          }
          case 'heart': {
            const s = 34 * (1 + Math.sin(t * 6) * 0.1);
            r.spr(S.glow, o.x, o.y, 70, 70, 0, C.pink[0], C.pink[1], C.pink[2], 0.4, 0, 0);
            r.spr(S.heart, o.x, o.y, s * 1.6, s * 1.6, 0, C.pink[0], C.pink[1], C.pink[2], 1, 0.6, 0);
            break;
          }
          case 'chest': {
            r.spr(S.soft, o.x, o.y, 170, 170, 0, C.amber[0], C.amber[1], C.amber[2], 0.5 + 0.2 * Math.sin(t * 4), 0, 0);
            r.beam(S.beam, o.x, o.y, o.x, o.y - 160, 26, C.amber[0], C.amber[1], C.amber[2], 0.35, 0);
            r.spr(S.chest, o.x, o.y + Math.sin(t * 3) * 3, 64, 64, 0, C.amber[0], C.amber[1], C.amber[2], 1, 0.6, 0);
            break;
          }
          case 'magnet':
            r.spr(S.glow, o.x, o.y, 64, 64, 0, C.blue[0], C.blue[1], C.blue[2], 0.4, 0, 0);
            r.spr(S.magnetP, o.x, o.y, 48, 48, Math.sin(t * 4) * 0.3, C.blue[0], C.blue[1], C.blue[2], 1, 0.6, 0);
            break;
          case 'nuke':
            r.spr(S.glow, o.x, o.y, 70, 70, 0, C.red[0], C.red[1], C.red[2], 0.5, 0, 0);
            r.spr(S.nukeP, o.x, o.y, 50, 50, t * 2, C.red[0], C.red[1], C.red[2], 1, 0.6, 0);
            break;
          case 'core':
            r.spr(S.coreP, o.x, o.y, 30, 30, t * 3, C.amber[0], C.amber[1], C.amber[2], 1, 0.6, 0);
            break;
        }
      }
    }
    renderSpawnQ(r) {
      const S = r.S.warn;
      for (const q of this.spawnQ) {
        const k = 1 - q.t / q.max, c = q.elite ? C.amber : TYPE_COL[q.type] || C.white;
        const s = S.unit * 2 * (30 - 14 * k);
        r.spr(S, q.x, q.y, s, s, k * 4, c[0], c[1], c[2], 0.25 + 0.6 * k, 0.3, 0);
      }
    }
    renderEnemies(r) {
      const t = this.real;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const sc = e.spawnT > 0 ? 1 - e.spawnT / 0.3 : 1;
        const fl = e.flash > 0;
        // 被弾フラッシュは白へ寄せるだけにする(ボスは常に被弾するので控えめ)
        const fk = fl ? (e.boss ? 0.3 : 0.6) : 0;
        const ec = e.col, c = this.flashCol;
        c[0] = ec[0] + (1 - ec[0]) * fk; c[1] = ec[1] + (1 - ec[1]) * fk; c[2] = ec[2] + (1 - ec[2]) * fk;
        if (e.elite) {
          const ks = r.S.ringDash.unit * 2 * (e.r + 12);
          r.spr(r.S.ringDash, e.x, e.y, ks, ks, t * 1.5, C.amber[0], C.amber[1], C.amber[2], 0.85, 0.3, 0);
          r.spr(r.S.glow, e.x, e.y, e.r * 6, e.r * 6, 0, C.amber[0], C.amber[1], C.amber[2], 0.25, 0, 0);
        }
        if (e.ai && e.ai.draw) e.ai.draw(this, e, r);
        if (!(e.ai && e.ai.draw) || e.type === 'voidling') {
          const pulse = e.boss ? 1 : 1 + Math.sin(e.t * 6 + e.id) * 0.04;
          const s = e.r * 2 * e.sprite.unit * sc * pulse;
          r.spr(e.sprite, e.x, e.y, s, s, e.rot, c[0], c[1], c[2], 1, 0.28 + fk * 0.7, 0);
        }
        if (e.charge > 0) r.spr(r.S.glow, e.x, e.y, e.r * 5 * e.charge, e.r * 5 * e.charge, 0, c[0], c[1], c[2], 0.7 * e.charge, 0.5, 0);
        if (e.invuln > 0 && e.boss) {
          const ks = r.S.ringThin.unit * 2 * (e.r + 18);
          r.spr(r.S.ringThin, e.x, e.y, ks, ks, 0, 1, 1, 1, 0.3 + 0.3 * Math.sin(t * 20), 0, 0);
        }
        if (e.slowT > 0) r.spr(r.S.glow, e.x, e.y, e.r * 4, e.r * 4, 0, 0.5, 0.8, 1, 0.3, 0, 0);
        if (e.ai && e.ai.render) e.ai.render(this, e, r);
        if ((e.elite || e.part) && e.hp < e.maxHp) {
          const w = Math.max(30, e.r * 2.2), y = e.y - e.r - 14, k = Math.max(0, e.hp / e.maxHp);
          r.beam(r.S.beam, e.x - w / 2, y, e.x + w / 2, y, 6, 0.3, 0.3, 0.4, 0.6, 0);
          r.beam(r.S.beam, e.x - w / 2, y, e.x - w / 2 + w * k, y, 6, c[0], c[1], c[2], 1, 0.3);
        }
      }
    }
    renderPB(r) {
      const A = this.settings.pbAlpha, S = r.S.needle, items = this.pbs.items;
      for (let i = 0; i < this.pbs.count; i++) {
        const b = items[i], c = b.col;
        r.spr(S, b.x, b.y, b.r * 6, b.r * 2.4, Math.atan2(b.vy, b.vx), c[0], c[1], c[2], A, 0.45, 0);
      }
    }
    renderPlayer(r) {
      const p = this.player;
      if (p.dead) return;
      const blink = p.inv > 0 && p.dashT <= 0 && Math.floor(this.real * 18) % 2 === 0;
      const a = blink ? 0.35 : 1;
      const c = this.odT > 0 ? C.amber : p.col;
      const S = r.S[p.sprite];
      r.spr(r.S.glow, p.x, p.y, 80, 80, 0, c[0], c[1], c[2], 0.2 * a, 0, 0);
      const s = 44 * S.unit;
      r.spr(S, p.x, p.y, s, s, p.aim, c[0], c[1], c[2], a, 0.45, 0);
      r.spr(r.S.dot, p.x, p.y, 16, 16, 0, 1, 1, 1, 0.95, 1, 0);
      if (p.barrier) {
        const bs = r.S.bubble.unit * 2 * 30;
        r.spr(r.S.bubble, p.x, p.y, bs, bs, 0, C.ice[0], C.ice[1], C.ice[2], 0.75 + 0.15 * Math.sin(this.real * 5), 0.2, 0);
      }
      if (this.odT > 0) {
        const ks = r.S.ringDash.unit * 2 * 34;
        r.spr(r.S.ringDash, p.x, p.y, ks, ks, -this.real * 3, C.amber[0], C.amber[1], C.amber[2], 0.8, 0.3, 0);
      }
    }
    renderLasers(r) {
      const S = r.S.beam;
      for (const L of this.lasers) {
        const x2 = L.x + Math.cos(L.ang) * L.len, y2 = L.y + Math.sin(L.ang) * L.len, c = L.col;
        if (L.t < L.warn) {
          const a = 0.25 + 0.4 * Math.abs(Math.sin(L.t * 16));
          r.beam(S, L.x, L.y, x2, y2, 5, c[0], c[1], c[2], a, 0.2);
        } else {
          const k = Math.min(1, (L.t - L.warn) / 0.1);
          const end = L.warn + L.active, fade = L.t > end - 0.2 ? Math.max(0, (end - L.t) / 0.2) : 1;
          const fl = 0.9 + Math.random() * 0.2;
          r.beam(S, L.x, L.y, x2, y2, L.width * 2.4 * k * fl, c[0], c[1], c[2], 0.55 * fade, 0);
          r.beam(S, L.x, L.y, x2, y2, L.width * 0.75 * k, 1, 1, 1, fade, 1);
        }
      }
    }
    renderEB(r) {
      const items = this.ebs.items, So = r.S.orb, Sr = r.S.rice, Sd = r.S.disc;
      for (let i = 0; i < this.ebs.count; i++) {
        const b = items[i];
        if (b.t >= b.life) continue;
        const c = b.col;
        const ds = b.r * 2.9;
        r.spr(Sd, b.x, b.y, ds * Sd.unit * 0.66, ds * Sd.unit * 0.66, 0, 0, 0, 0, 0.6, 0, 1);
        if (b.kind === 1) r.spr(Sr, b.x, b.y, b.r * 4.4, b.r * 2.9, Math.atan2(b.vy, b.vx), c[0], c[1], c[2], 1, 0.75, 0);
        else { const s = b.r * 2 * So.unit; r.spr(So, b.x, b.y, s, s, 0, c[0], c[1], c[2], 1, 0.75, 0); }
      }
    }
    renderNums(r) {
      const items = this.nums.items;
      for (let i = 0; i < this.nums.count; i++) {
        const n = items[i], k = n.t / n.life;
        const a = k > 0.6 ? (1 - k) / 0.4 : 1;
        const pop = n.crit ? 1 + Math.max(0, 0.5 - n.t * 3) : 1;
        if (n.crit) r.text(n.text, n.x, n.y, 24 * pop, 1, 0.85, 0.3, a, 0.4);
        else r.text(n.text, n.x, n.y, 15, 0.9, 0.95, 1, a * 0.85, 0.2);
      }
    }
    renderReticle(r) {
      if (this.input.device !== 'kb' || this.player.dead) return;
      const m = this.input.mouse, cam = this.cam;
      const wx = cam.x + cam.sx + (m.x - r.cssW / 2) / cam.zoom, wy = cam.y + cam.sy + (m.y - r.cssH / 2) / cam.zoom;
      const s = r.S.reticle.unit * 2 * 15;
      const c = this.odT > 0 ? C.amber : this.player.col;
      r.spr(r.S.reticle, wx, wy, s, s, this.real * 0.8, c[0], c[1], c[2], 0.9, 0.5, 0);
    }

    continueEndless() {
      this.mode = 'endless';
      this.finalWave = Infinity;
      this.won = false;
      this.ended = false;
      this.continued = true;
      this.waveState = 'cleared';
      this.waveT = 1.5;
      this.audio.playMusic('game');
    }
    results() {
      const coreMult = this.coreMult * (this.inv.perks.goldrush ? 1.5 : 1);
      const base = this.wave * 4 + this.kills / 25 + this.bossKills * 40 + this.score / 2500 + (this.cleared ? 100 : 0);
      const cores = Math.floor(base * coreMult + this.coresRun * coreMult);
      return {
        mode: this.mode, ship: this.player.ship, wave: this.wave, time: this.time, score: Math.floor(this.score),
        kills: this.kills, level: this.level, maxCombo: this.maxCombo, grazes: this.grazes, perfects: this.perfects,
        dmgBy: this.dmgBy, cores, won: this.won, evolved: this.evolved, risk: this.risk, continued: !!this.continued, retired: !!this.retired,
      };
    }
  }

  // 背景の星雲。カメラから少し遅れて動き、画面の端にかかる位置に置く
  NR.drawNebula = function (r, cx, cy, th) {
    const S = r.S.soft;
    r.spr(S, cx - 760 - cx * 0.12 + Math.sin(cy * 0.0007) * 200, cy - 430 - cy * 0.12, 1700, 1700, 0, th.neb[0][0], th.neb[0][1], th.neb[0][2], 0.1, 0, 0);
    r.spr(S, cx + 820 - cx * 0.1, cy + 480 - cy * 0.1 + Math.cos(cx * 0.0006) * 160, 1900, 1900, 0, th.neb[1][0], th.neb[1][1], th.neb[1][2], 0.08, 0, 0);
  };

  NR.Game = Game;
  NR.THEMES = THEMES;
})();
