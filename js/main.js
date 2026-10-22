'use strict';
/* NEON RIFT — 起動とメインループ(画面状態・画質の自動調整・出撃の開始と終了) */
(function () {
  const NR = window.NR;
  const { U, R } = NR;
  const D = NR.DATA;

  const QUALITY = {
    high: { dpr: 2, scale: 1, bloom: 3.4, levels: 5, particles: 9000, grid: 40, stars: 170, distort: true, fxq: 1 },
    medium: { dpr: 1.5, scale: 1, bloom: 3.0, levels: 4, particles: 5000, grid: 48, stars: 120, distort: true, fxq: 0.75 },
    low: { dpr: 1, scale: 0.85, bloom: 0, levels: 3, particles: 2200, grid: 64, stars: 70, distort: false, fxq: 0.5 },
  };
  const ATTRACT_TYPES = ['wanderer', 'chaser', 'swarmer', 'dasher', 'gunner', 'splitter', 'spinner', 'shield', 'bomber', 'blinker', 'mender'];

  // タイトル画面の背景で動くデモ
  class Attract {
    constructor(app) { this.app = app; this.reset(); }
    reset() {
      this.t = 0;
      this.cam = { x: D.ARENA.w / 2, y: D.ARENA.h / 2 };
      this.ents = [];
      for (let i = 0; i < 46; i++) this.ents.push(this.makeEnt(ATTRACT_TYPES[i % ATTRACT_TYPES.length]));
      this.boomT = 1;
      this.shocks = [];
      this.post = { bloom: 1, threshold: 0.12, ca: 0.0012, vignette: 0.6, flash: 0, flashColor: [1, 1, 1], desat: 0, waves: new Float32Array(16), time: 0, grain: 0.03, exposure: 1.35, tint: [1, 1, 1] };
    }
    makeEnt(type) {
      const d = D.enemies[type];
      return { type, x: R.range(100, D.ARENA.w - 100), y: R.range(100, D.ARENA.h - 100), dir: R.angle(), sp: R.range(40, 110), rot: R.angle(), vr: R.range(-2, 2), r: d.r, col: U.hex(d.color), spr: d.sprite, t: R.range(0, 10) };
    }
    update(dt) {
      const app = this.app, W = D.ARENA.w, H = D.ARENA.h, cam = this.cam;
      this.t += dt;
      cam.x = W / 2 + Math.cos(this.t * 0.07) * 520;
      cam.y = H / 2 + Math.sin(this.t * 0.11) * 300;
      for (const e of this.ents) {
        e.t += dt;
        e.dir += Math.sin(e.t * 0.7) * 0.6 * dt;
        e.x += Math.cos(e.dir) * e.sp * dt;
        e.y += Math.sin(e.dir) * e.sp * dt;
        if (e.x < 40 || e.x > W - 40) e.dir = Math.PI - e.dir;
        if (e.y < 40 || e.y > H - 40) e.dir = -e.dir;
        e.x = U.clamp(e.x, 40, W - 40);
        e.y = U.clamp(e.y, 40, H - 40);
        e.rot += e.vr * dt;
      }
      this.boomT -= dt;
      if (this.boomT <= 0) {
        this.boomT = R.range(0.45, 1.3);
        const r = app.renderer;
        const vis = this.ents.filter((e) => e.x > r.vl && e.x < r.vr && e.y > r.vt && e.y < r.vb);
        const e = vis.length ? R.pick(vis) : R.pick(this.ents);
        app.fx.explosion(e.x, e.y, e.col, 1.5, 1.6);
        if (Math.random() < 0.35 && app.quality.distort) this.shocks.push({ x: e.x, y: e.y, t: 0, dur: 0.6, str: 0.02, rad: 300 });
        Object.assign(e, this.makeEnt(e.type));
      }
      for (let i = this.shocks.length - 1; i >= 0; i--) { this.shocks[i].t += dt; if (this.shocks[i].t >= this.shocks[i].dur) this.shocks.splice(i, 1); }
      app.particles.update(dt);
      app.grid.update(dt);
    }
    render() {
      const app = this.app, r = app.renderer, cam = this.cam, th = NR.THEMES[0];
      const zoom = app.zoom * 0.9;
      r.begin(cam.x, cam.y, zoom, 0, th.bg);
      app.stars.render(r, cam.x, cam.y, this.t);
      NR.drawNebula(r, cam.x, cam.y, th);
      app.grid.render(r, th);
      r.flushLines();
      for (const e of this.ents) {
        const S = r.S[e.spr], s = e.r * 2 * S.unit;
        r.spr(S, e.x, e.y, s, s, e.rot, e.col[0], e.col[1], e.col[2], 0.9, 0.5, 0);
      }
      app.particles.render(r);
      const P = this.post;
      P.time = this.t;
      P.bloom = app.quality.bloom;
      P.waves.fill(0);
      this.shocks.slice(0, 4).forEach((s, i) => {
        const k = s.t / s.dur, uv = r.toUV(s.x, s.y);
        P.waves[i * 4] = uv[0]; P.waves[i * 4 + 1] = uv[1];
        P.waves[i * 4 + 2] = (s.rad * U.easeOutCubic(k) * zoom) / r.cssH;
        P.waves[i * 4 + 3] = s.str * (1 - k);
      });
      r.end(P);
    }
  }

  const app = {
    state: 'boot', game: null, fps: 60, zoom: 1, quality: QUALITY.high, qKey: '', dynScale: 1,
    lastMode: 'campaign', lastOpts: null, runAchs: [], frames: 0, fpsT: 0, ft: 16, qTimer: 0, booted: false,

    init() {
      if (this.booted) return;
      this.booted = true;
      this.save = NR.Save;
      this.save.load();
      this.canvas = document.getElementById('gl');
      try {
        this.renderer = new NR.Renderer(this.canvas, NR.buildAtlas());
      } catch (e) {
        this.fatal(e);
        return;
      }
      this.mobile = matchMedia('(pointer: coarse)').matches;
      this.audio = new NR.AudioEngine();
      this.input = new NR.Input(this.canvas);
      if (this.mobile) this.input.device = 'touch';
      this.particles = new NR.Particles(QUALITY.high.particles);
      this.grid = new NR.Grid(D.ARENA.w, D.ARENA.h, QUALITY.high.grid);
      this.stars = new NR.Stars(QUALITY.high.stars);
      this.fx = new NR.FX(this.particles, this.grid, this.renderer.S);
      this.ui = new NR.UI(this);
      this.attract = new Attract(this);
      this.applySettings(true);
      this.input.onDevice = (d) => {
        document.body.classList.toggle('touchmode', d === 'touch');
        this.ui.setTouch(d === 'touch' && !this.ui.hud.hidden);
        this.resize();
      };
      document.body.classList.toggle('touchmode', this.input.device === 'touch');
      addEventListener('resize', () => this.resize());
      // 音はユーザー操作の中でしか鳴らし始められない。スマホでは指が触れた瞬間(pointerdown)は対象外で、
      // 指を離した瞬間(touchend / pointerup)だけが許可されるので、そちらでも起動する
      const unlock = () => this.audio.init();
      for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock, true);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') this.pause();
        // 別のアプリから戻ったとき、止められた音を再開する(できなければ次のタップで再開)
        if (!document.hidden) this.audio.unlock();
      });
      this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.fatal(new Error('WebGL context lost')); });
      this.toTitle();
      this.last = performance.now();
      const frame = (t) => { this.tick(t); requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    },
    fatal(e) {
      const el = document.getElementById('app');
      el.insertAdjacentHTML('beforeend', `<div class="fatal"><h2>起動できませんでした</h2><p>このゲームは WebGL2 に対応したブラウザー(Chrome / Edge / Firefox / Safari の最新版)で動きます。ハードウェアアクセラレーションが無効になっていないか確認してください。</p><code>${String(e && e.message || e)}</code></div>`);
      this.state = 'dead';
    },
    resize() {
      const w = innerWidth, h = innerHeight, q = this.quality;
      const dpr = Math.min(window.devicePixelRatio || 1, q.dpr);
      this.renderer.opt.scale = q.scale * this.dynScale;
      this.renderer.resize(w, h, dpr);
      const touch = this.input.device === 'touch';
      this.zoom = Math.sqrt(w * h) / (touch ? 880 : 1000);
    },
    applySettings(rebuild) {
      const st = this.save.data.settings;
      this.audio.setVolume({ master: st.master, music: st.music, sfx: st.sfx });
      const tm = st.touchMode === 'stick' ? 'stick' : 'drag';
      if (this.input.touchMode !== tm) this.input.releaseTouches();
      this.input.touchMode = tm;
      this.input.touchSens = st.touchSens || 1.2;
      const qk = st.quality === 'auto' ? this.autoQ || (this.mobile ? 'medium' : 'high') : st.quality;
      const q = QUALITY[qk];
      if (this.qKey !== qk || rebuild) {
        this.qKey = qk;
        this.quality = q;
        this.dynScale = 1;
        const r = this.renderer;
        r.opt.bloom = q.bloom > 0;
        if (r.opt.levels !== q.levels) { r.opt.levels = q.levels; if (r.rt) r.alloc(); }
        if (this.particles.max !== q.particles) this.particles.setMax(q.particles);
        if (this.grid.sp !== q.grid) this.grid.build(D.ARENA.w, D.ARENA.h, q.grid);
        this.stars.build(q.stars);
        this.fx.quality = q.fxq;
        this.resize();
      }
      this.save.save();
    },
    // 自動画質: 重いときは描画解像度→画質プリセットの順に下げる
    adapt(dt) {
      if (this.save.data.settings.quality !== 'auto') return;
      this.ft = this.ft * 0.94 + dt * 1000 * 0.06;
      this.qTimer += dt;
      if (this.qTimer < 2) return;
      this.qTimer = 0;
      if (this.ft > 21) {
        if (this.dynScale > 0.65) { this.dynScale = Math.max(0.6, this.dynScale - 0.1); this.resize(); }
        else if (this.qKey === 'high') { this.autoQ = 'medium'; this.applySettings(); }
        else if (this.qKey === 'medium') { this.autoQ = 'low'; this.applySettings(); }
      } else if (this.ft < 14.5 && this.dynScale < 1) {
        this.dynScale = Math.min(1, this.dynScale + 0.05);
        this.resize();
      }
    },
    // 1フレーム分の処理(requestAnimationFrame から毎フレーム呼ばれる)
    tick(now) {
      if (this.state === 'dead') return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1;
      if (dt <= 0) dt = 0.001;
      this.frames++;
      this.fpsT += dt;
      if (this.fpsT >= 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }
      const inp = this.input;
      inp.poll();
      const st = this.state;
      if (st === 'playing') {
        if (inp.take('pause')) this.pause();
        else {
          const step = Math.min(dt, 0.05), n = step > 0.021 ? 2 : 1;
          for (let i = 0; i < n && this.state === 'playing'; i++) this.game.update(step / n);
          this.adapt(dt);
        }
        if (this.game) { this.game.render(); this.ui.hudUpdate(this.game, dt); }
      } else if (st === 'levelup' || st === 'chest' || st === 'pause' || st === 'result') {
        if (st === 'pause' && inp.take('pause')) this.resume();
        const g = this.game;
        if (g) {
          if (st === 'result') { g.particles.update(dt * 0.5); g.grid.update(dt); g.updatePost(dt); }
          g.render();
          if (st !== 'result') this.ui.hudUpdate(g, dt);
        }
      } else {
        this.attract.update(dt);
        this.attract.render();
      }
      this.ui.update(dt);
      inp.endFrame();
    },

    // ── 出撃の流れ ──
    dailyInfo() {
      const seed = U.todaySeed();
      const rng = NR.RNG(seed * 7 + 13);
      const ships = Object.keys(D.ships);
      const ship = ships[rng.int(0, ships.length - 1)];
      const pool = D.dailyMods.slice(), mods = [];
      for (let i = 0; i < 2; i++) mods.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
      return { seed, ship, mods };
    },
    launch(mode) {
      const s = this.save.data;
      this.lastMode = mode;
      let opts;
      if (mode === 'daily') {
        const d = this.dailyInfo();
        opts = { mode: 'daily', ship: d.ship, risk: 0, seed: d.seed, mods: d.mods.map((m) => m.id) };
      } else opts = { mode, ship: s.ships[s.ship] ? s.ship : 'vanguard', risk: Math.min(s.risk, s.riskMax) };
      this.lastOpts = opts;
      this.startRun(opts);
    },
    startRun(opts) {
      this.audio.init();
      this.runAchs = [];
      this.particles.clear();
      this.game = new NR.Game(this, opts);
      this.state = 'playing';
      this.ui.clear();
      this.ui.hc = {};
      this.ui.setHud(true);
      if (!this.save.data.tutorial) {
        this.save.data.tutorial = true;
        this.save.save();
        if (this.input.device === 'touch') this.ui.toast('操作', '画面をなぞって移動(照準と射撃は自動)', 'DASHで無敵ダッシュ・ゲージが満タンならOD');
        else this.ui.toast('操作', 'WASDで移動・マウスで照準(射撃は自動)', 'Spaceでダッシュ(無敵)・満タンのドライブはEで発動');
      }
    },
    retry() { if (this.lastOpts) this.startRun(Object.assign({}, this.lastOpts)); },
    openLevelUp(g) {
      if (this.state !== 'playing') return;
      this.state = 'levelup';
      g.flash([1, 0.9, 0.5], 0.25);
      this.ui.levelUp(g);
    },
    openChest(g) {
      if (this.state !== 'playing') return;
      this.state = 'chest';
      g.chestQueue--;
      this.ui.chest(g.makeChest(), g);
    },
    closeOverlay() {
      if (this.state === 'levelup' || this.state === 'chest') { this.state = 'playing'; this.ui.clear(); }
    },
    pause() {
      if (this.state !== 'playing') return;
      this.state = 'pause';
      this.audio.setPaused(true);
      this.ui.pause(this.game);
    },
    resume() {
      if (this.state !== 'pause') return;
      this.state = 'playing';
      this.audio.setPaused(false);
      this.ui.clear();
    },
    retire() {
      if (!this.game) return;
      this.audio.setPaused(false);
      this.ui.clear();
      this.game.retired = true;
      this.endRun(this.game, false);
    },
    continueEndless() {
      const g = this.game;
      if (!g) return;
      this.runAchs = [];
      g.continueEndless();
      this.state = 'playing';
      this.ui.clear();
      this.ui.hc = {};
      this.ui.setHud(true);
    },
    endRun(g, won) {
      const s = this.save.data, st = s.stats;
      const res = g.results();
      const first = !g.paid;
      const paid = g.paid || { cores: 0, kills: 0, grazes: 0, perfects: 0, time: 0 };
      const dCores = Math.max(0, res.cores - paid.cores);
      s.cores += dCores;
      st.kills += res.kills - paid.kills;
      st.grazes = (st.grazes || 0) + res.grazes - paid.grazes;
      st.perfects = (st.perfects || 0) + res.perfects - paid.perfects;
      st.playTime += res.time - paid.time;
      g.paid = { cores: res.cores, kills: res.kills, grazes: res.grazes, perfects: res.perfects, time: res.time };
      if (first) st.runs++;
      if (won && first) st.wins++;
      st.maxCombo = Math.max(st.maxCombo, res.maxCombo);
      st.maxLevel = Math.max(st.maxLevel, res.level);
      if (res.mode === 'endless') st.bestEndless = Math.max(st.bestEndless || 0, res.wave);
      else st.bestWave = Math.max(st.bestWave, res.wave);
      let newBest = false;
      if (res.score > st.bestScore) { st.bestScore = res.score; newBest = true; }
      if (res.mode === 'daily') {
        const k = U.todayKey();
        if (s.daily.key !== k) { s.daily.key = k; s.daily.best = 0; }
        if (res.score > s.daily.best) s.daily.best = res.score;
      }
      this.achieve('firstrun');
      if (st.kills >= 10000) this.achieve('kills10000');
      if (res.score >= 1e6) this.achieve('score1m');
      let unlock = '';
      if (won && res.mode === 'campaign') {
        this.achieve('clear');
        if (g.risk >= 5) this.achieve('risk5');
        if (g.risk >= 10) this.achieve('risk10');
        if (g.risk >= s.riskMax && s.riskMax < D.risks.length - 1) { s.riskMax = g.risk + 1; unlock = `RISK ${s.riskMax} が解放されました`; }
      }
      this.save.save();
      res.cores = dCores;
      this.state = 'result';
      this.ui.setHud(false);
      this.ui.result(res, { newBest, achs: this.runAchs.slice(), unlock });
      this.audio.play(won ? 'victory' : 'gameover');
      if (won) this.audio.playMusic('menu');
    },
    toTitle() {
      this.game = null;
      this.state = 'title';
      this.ui.setHud(false);
      this.ui.title();
      this.audio.setPaused(false);
      this.audio.setOverdrive(false);
      this.audio.playMusic('menu');
      this.particles.clear();
      this.grid.reset();
      this.attract.reset();
    },
    achieve(id) {
      const s = this.save.data;
      if (s.ach[id]) return;
      const a = D.achievements.find((x) => x.id === id);
      if (!a) return;
      s.ach[id] = Date.now();
      s.cores += a.reward;
      this.runAchs.push(a);
      this.ui.toast('実績解除', a.name, `+${a.reward} CORE`, NR.Icons.get('score', '#ffc23f', 48));
      this.audio.play('achieve');
      this.save.save();
    },
    toggleFullscreen() {
      try {
        if (!document.fullscreenElement) { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); }
        else { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); }
      } catch (e) { /* 全画面に対応していない環境では何もしない */ }
    },
  };

  NR.app = app;
  // ホーム画面に追加したアプリとしてオフラインでも起動できるようにする(https か localhost で、埋め込み表示でないときだけ)
  try {
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && window.self === window.top && (location.protocol === 'https:' || local)) {
      addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
    }
  } catch (e) { /* 対応していない環境では何もしない */ }
  const start = () => app.init();
  try {
    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) hot.snapshot(() => ({ v: 1 }));
    if (hot && hot.ready) hot.ready(start);
    else start();
  } catch (e) {
    start();
  }
})();
