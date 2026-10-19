'use strict';
/* NEON RIFT — 音響エンジン(効果音とBGMをすべてWebAudioで合成) */
(function () {
  const NR = window.NR;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // BGMの曲データ。prog は小節ごとの和音(MIDIノート)
  const TRACKS = {
    menu: {
      bpm: 92,
      prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      kick: [], snare: [],
      bass: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      arp: 0.5,
    },
    game: {
      bpm: 124,
      prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      bass: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 2],
      arp: 1,
    },
    boss: {
      bpm: 142,
      prog: [[50, 53, 57], [46, 50, 53], [55, 58, 62], [57, 61, 64]],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      bass: [1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2],
      arp: 1,
    },
  };

  class Music {
    constructor(a) {
      this.a = a;
      const ctx = (this.ctx = a.ctx);
      this.out = ctx.createGain();
      this.out.gain.value = 0;
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 18000;
      this.filter.connect(this.out);
      this.out.connect(a.musicBus);
      // ディレイ(アルペジオの残響)
      this.delay = ctx.createDelay(1.5);
      this.fb = ctx.createGain();
      this.fb.gain.value = 0.34;
      this.wet = ctx.createGain();
      this.wet.gain.value = 0.28;
      this.delay.connect(this.fb);
      this.fb.connect(this.delay);
      this.delay.connect(this.wet);
      this.wet.connect(this.filter);
      this.track = 'menu';
      this.bpm = 92;
      this.step = 0;
      this.nextTime = 0;
      this.timer = null;
      this.intensity = 0;
      this.od = false;
    }
    start(track) {
      const ctx = this.ctx;
      if (this.track !== track || !this.timer) {
        this.track = track;
        this.bpm = TRACKS[track].bpm;
        this.delay.delayTime.setValueAtTime((60 / this.bpm) * 0.75, ctx.currentTime);
        this.step = 0;
      }
      this.out.gain.cancelScheduledValues(ctx.currentTime);
      this.out.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
      if (!this.timer) {
        this.nextTime = ctx.currentTime + 0.08;
        this.timer = setInterval(() => this.tick(), 25);
      }
    }
    stop(fade = 0.6) {
      const ctx = this.ctx;
      this.out.gain.cancelScheduledValues(ctx.currentTime);
      this.out.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }
    setPaused(p) {
      const ctx = this.ctx;
      this.filter.frequency.setTargetAtTime(p ? 700 : 18000, ctx.currentTime, 0.12);
    }
    tick() {
      const ctx = this.ctx;
      if (ctx.state !== 'running') { this.nextTime = ctx.currentTime + 0.05; return; }
      const stepDur = 60 / this.bpm / 4;
      if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.02;
      while (this.nextTime < ctx.currentTime + 0.14) {
        this.playStep(this.step, this.nextTime, stepDur);
        this.nextTime += stepDur;
        this.step++;
      }
    }
    playStep(s, t, sd) {
      const T = TRACKS[this.track];
      const bar = Math.floor(s / 16) % T.prog.length;
      const st = s % 16;
      const ch = T.prog[bar];
      const I = this.track === 'menu' ? 0 : this.track === 'boss' ? 3 : this.intensity;
      if (I >= 1 && T.kick[st]) this.kick(t);
      if (I >= 2 && T.snare[st]) this.snare(t);
      if (I >= 1 && st % 4 === 2) this.hat(t, 0.06, 0.09);
      if (I >= 3 && st % 2 === 1) this.hat(t, 0.025, 0.05);
      if (T.bass[st]) this.bass(t, ch[0] - 12 + (T.bass[st] === 2 ? 12 : 0), sd * 1.8, I);
      if (st === 0) this.pad(t, ch, sd * 16);
      if (I >= 2 || this.track === 'menu') {
        const seq = [0, 1, 2, 1, 0, 2, 1, 2];
        const oct = this.od ? 24 : 12;
        if (this.track === 'menu' ? st % 2 === 0 : true) {
          const n = ch[seq[(s >> (this.track === 'menu' ? 1 : 0)) % 8]] + oct + (st >= 12 && bar % 2 ? 12 : 0);
          this.arp(t, n, this.track === 'menu' ? 0.035 : 0.045);
        }
      }
      if (this.track === 'boss' && st % 8 === 0) this.lead(t, ch[(bar + (st >> 3)) % 3] + 24, sd * 6);
    }
    env(g, t, peak, a, d) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
    kick(t) {
      const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      this.env(g, t, 0.55, 0.002, 0.32);
      o.connect(g); g.connect(this.filter);
      o.start(t); o.stop(t + 0.4);
    }
    snare(t) {
      const ctx = this.ctx, a = this.a;
      const n = ctx.createBufferSource(); n.buffer = a.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
      const g = ctx.createGain(); this.env(g, t, 0.22, 0.002, 0.16);
      n.connect(f); f.connect(g); g.connect(this.filter);
      n.start(t, Math.random() * 0.5); n.stop(t + 0.2);
      const o = ctx.createOscillator(), g2 = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 185;
      this.env(g2, t, 0.12, 0.002, 0.07);
      o.connect(g2); g2.connect(this.filter);
      o.start(t); o.stop(t + 0.1);
    }
    hat(t, d, v) {
      const ctx = this.ctx;
      const n = ctx.createBufferSource(); n.buffer = this.a.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
      const g = ctx.createGain(); this.env(g, t, v, 0.001, d);
      n.connect(f); f.connect(g); g.connect(this.filter);
      n.start(t, Math.random() * 0.5); n.stop(t + d + 0.02);
    }
    bass(t, m, d, I) {
      const ctx = this.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = mtof(m);
      f.type = 'lowpass'; f.Q.value = 5;
      const peak = I >= 3 ? 1600 : 1000;
      f.frequency.setValueAtTime(peak, t);
      f.frequency.exponentialRampToValueAtTime(220, t + d);
      this.env(g, t, 0.17, 0.004, d);
      o.connect(f); f.connect(g); g.connect(this.filter);
      o.start(t); o.stop(t + d + 0.05);
    }
    pad(t, ch, d) {
      const ctx = this.ctx, f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = this.track === 'boss' ? 1500 : 1100; f.Q.value = 0.5;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.045, t + d * 0.25);
      g.gain.linearRampToValueAtTime(0.035, t + d * 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + d * 1.02);
      f.connect(g); g.connect(this.filter);
      for (const m of ch) {
        for (const det of [-8, 8]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
          o.connect(f); o.start(t); o.stop(t + d * 1.05);
        }
      }
    }
    arp(t, m, v) {
      const ctx = this.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = mtof(m);
      f.type = 'lowpass'; f.frequency.value = this.od ? 5200 : 2800;
      this.env(g, t, v, 0.003, 0.13);
      o.connect(f); f.connect(g); g.connect(this.filter); g.connect(this.delay);
      o.start(t); o.stop(t + 0.18);
    }
    lead(t, m, d) {
      const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'sawtooth';
      o.frequency.value = mtof(m); o2.frequency.value = mtof(m); o2.detune.value = 12;
      f.type = 'lowpass'; f.frequency.value = 2400;
      this.env(g, t, 0.05, 0.02, d);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.filter); g.connect(this.delay);
      o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
    }
  }

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.vol = { master: 0.8, music: 0.55, sfx: 0.75 };
      this.last = Object.create(null);
      this.voices = 0;
      this.music = null;
      this.pickStep = 0;
      this.pickLast = 0;
    }
    // ユーザー操作の中で呼ぶ
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      let ctx;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return; }
      this.ctx = ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.18;
      this.master.connect(comp);
      comp.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulse(2.2, 2.8);
      const rg = ctx.createGain();
      rg.gain.value = 0.32;
      this.reverb.connect(rg);
      rg.connect(this.master);
      this.music = new Music(this);
      this.applyVolume();
      if (this.pendingTrack) { this.music.start(this.pendingTrack); this.pendingTrack = null; }
    }
    impulse(sec, decay) {
      const ctx = this.ctx, rate = ctx.sampleRate, n = Math.floor(rate * sec);
      const b = ctx.createBuffer(2, n, rate);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
      }
      return b;
    }
    setVolume(v) {
      Object.assign(this.vol, v);
      this.applyVolume();
    }
    applyVolume() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.vol.master, t, 0.03);
      this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
      this.musicBus.gain.setTargetAtTime(this.vol.music * 0.7, t, 0.03);
    }
    playMusic(track) {
      if (!this.ctx) { this.pendingTrack = track; return; }
      this.music.start(track);
    }
    stopMusic(fade) { if (this.music) this.music.stop(fade); }
    setIntensity(i) { if (this.music) this.music.intensity = i; }
    setOverdrive(on) { if (this.music) this.music.od = on; }
    setPaused(p) { if (this.music) this.music.setPaused(p); }

    can(name, gap) {
      const now = this.ctx.currentTime;
      if (now - (this.last[name] || -1) < gap) return false;
      this.last[name] = now;
      return true;
    }
    track(node, endTime) {
      this.voices++;
      node.onended = () => { this.voices--; };
      node.stop(endTime);
    }
    tone(type, f0, f1, dur, vol, o = {}) {
      const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      if (o.detune) osc.detune.value = o.detune;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = osc;
      if (o.filter) {
        const f = ctx.createBiquadFilter();
        f.type = o.filter; f.frequency.value = o.ff || 1000; f.Q.value = o.q || 1;
        node.connect(f); node = f;
      }
      node.connect(g);
      g.connect(this.sfxBus);
      if (o.verb) g.connect(this.reverb);
      osc.start(t);
      this.track(osc, t + dur + 0.02);
    }
    noise(dur, vol, type, f0, f1, o = {}) {
      const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type; f.Q.value = o.q || 1;
      f.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + (o.attack || 0.003));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.sfxBus);
      if (o.verb) g.connect(this.reverb);
      src.start(t, Math.random() * 0.4);
      this.track(src, t + dur + 0.02);
    }

    play(name, p = 0) {
      if (!this.ctx || this.ctx.state !== 'running' || this.vol.sfx <= 0) return;
      const busy = this.voices > 48;
      const R = Math.random;
      switch (name) {
        case 'shoot':
          if (busy || !this.can(name, 0.05)) return;
          this.tone('square', 900 + R() * 120, 380, 0.06, 0.035, { filter: 'lowpass', ff: 3200 });
          break;
        case 'shotgun':
          if (busy || !this.can(name, 0.08)) return;
          this.noise(0.09, 0.08, 'lowpass', 2600, 500);
          this.tone('square', 300, 90, 0.08, 0.04);
          break;
        case 'hit':
          if (busy || !this.can(name, 0.03)) return;
          this.noise(0.035, 0.05, 'bandpass', 2400 + R() * 800, 1600, { q: 2 });
          break;
        case 'crit':
          if (busy || !this.can(name, 0.05)) return;
          this.tone('triangle', 1800, 900, 0.07, 0.05);
          break;
        case 'block':
          if (busy || !this.can(name, 0.06)) return;
          this.tone('triangle', 2400, 2200, 0.05, 0.04);
          break;
        case 'kill':
          if (busy || !this.can(name, 0.035)) return;
          this.noise(0.14, 0.09, 'lowpass', 2400, 200);
          this.tone('sine', 320 + R() * 60, 60, 0.14, 0.09);
          break;
        case 'explode':
          if (!this.can(name, 0.07)) return;
          this.noise(0.5, 0.22, 'lowpass', 1400, 90, { verb: true });
          this.tone('sine', 90, 32, 0.45, 0.25);
          break;
        case 'bigexplode':
          this.noise(1.4, 0.4, 'lowpass', 2200, 50, { verb: true });
          this.tone('sine', 70, 22, 1.2, 0.4);
          this.tone('sawtooth', 120, 30, 0.9, 0.08, { filter: 'lowpass', ff: 600 });
          break;
        case 'pickup': {
          if (!this.can(name, 0.028)) return;
          const now = this.ctx.currentTime;
          this.pickStep = now - this.pickLast < 0.35 ? Math.min(this.pickStep + 1, 14) : 0;
          this.pickLast = now;
          const scale = [0, 2, 4, 7, 9];
          const st = scale[this.pickStep % 5] + 12 * Math.floor(this.pickStep / 5);
          const f = 660 * Math.pow(2, st / 12);
          this.tone('sine', f, f * 1.01, 0.07, 0.05);
          break;
        }
        case 'heal':
          this.tone('sine', 520, 1040, 0.25, 0.1, { verb: true });
          this.tone('triangle', 780, 1560, 0.25, 0.05, { delay: 0.08 });
          break;
        case 'core':
          if (!this.can(name, 0.05)) return;
          this.tone('triangle', 1320, 1320, 0.12, 0.06);
          this.tone('triangle', 1760, 1760, 0.16, 0.05, { delay: 0.05 });
          break;
        case 'levelup': {
          const notes = [0, 4, 7, 12, 16];
          notes.forEach((n, i) => this.tone('triangle', 523 * Math.pow(2, n / 12), 523 * Math.pow(2, n / 12), 0.22, 0.09, { delay: i * 0.06, verb: true }));
          this.noise(0.6, 0.05, 'highpass', 6000, 9000, { delay: 0.1 });
          break;
        }
        case 'select':
          this.tone('square', 660, 660, 0.06, 0.05, { filter: 'lowpass', ff: 2500 });
          this.tone('square', 990, 990, 0.12, 0.05, { delay: 0.06, filter: 'lowpass', ff: 2500 });
          break;
        case 'hover':
          if (!this.can(name, 0.04)) return;
          this.tone('sine', 1500, 1500, 0.03, 0.025);
          break;
        case 'back':
          this.tone('square', 500, 330, 0.08, 0.04, { filter: 'lowpass', ff: 2000 });
          break;
        case 'deny':
          this.tone('square', 180, 150, 0.15, 0.06, { filter: 'lowpass', ff: 1200 });
          break;
        case 'dash':
          this.noise(0.2, 0.12, 'bandpass', 500, 3200, { q: 1.5 });
          break;
        case 'perfect':
          this.tone('sine', 2093, 2093, 0.5, 0.08, { verb: true });
          this.tone('sine', 3136, 3136, 0.4, 0.05, { delay: 0.03, verb: true });
          this.noise(0.25, 0.06, 'highpass', 5000, 8000);
          break;
        case 'graze':
          if (busy || !this.can(name, 0.045)) return;
          this.tone('sine', 2800 + R() * 400, 2600, 0.025, 0.02);
          break;
        case 'hurt':
          this.tone('sawtooth', 220, 50, 0.35, 0.18, { filter: 'lowpass', ff: 1200 });
          this.noise(0.3, 0.16, 'lowpass', 3000, 300);
          break;
        case 'shieldbreak':
          this.noise(0.3, 0.14, 'highpass', 3000, 1200);
          this.tone('triangle', 1400, 400, 0.3, 0.07);
          break;
        case 'overdrive':
          this.tone('sawtooth', 160, 1800, 0.7, 0.09, { filter: 'lowpass', ff: 4000, verb: true });
          this.tone('square', 320, 1200, 0.6, 0.04, { delay: 0.05 });
          this.noise(0.8, 0.1, 'bandpass', 400, 6000, { q: 1.2 });
          break;
        case 'warning':
          for (let i = 0; i < 3; i++) {
            this.tone('square', 880, 880, 0.22, 0.07, { delay: i * 0.55, filter: 'lowpass', ff: 2000 });
            this.tone('square', 660, 660, 0.22, 0.07, { delay: i * 0.55 + 0.25, filter: 'lowpass', ff: 2000 });
          }
          break;
        case 'roar':
          this.tone('sawtooth', 90, 45, 1.2, 0.18, { filter: 'lowpass', ff: 800, verb: true });
          this.noise(1.2, 0.18, 'lowpass', 800, 100, { verb: true });
          break;
        case 'laser':
          if (!this.can(name, 0.1)) return;
          this.tone('sawtooth', 1200, 200, 0.4, 0.06, { filter: 'lowpass', ff: 3500 });
          this.noise(0.3, 0.05, 'highpass', 3000, 1500);
          break;
        case 'charge':
          if (!this.can(name, 0.15)) return;
          this.tone('sine', 200, 900, 0.6, 0.05);
          break;
        case 'zap':
          if (busy || !this.can(name, 0.06)) return;
          this.noise(0.12, 0.08, 'bandpass', 3500, 1800, { q: 3 });
          this.tone('square', 1200 + R() * 600, 300, 0.08, 0.03);
          break;
        case 'missile':
          if (busy || !this.can(name, 0.08)) return;
          this.noise(0.18, 0.05, 'bandpass', 800, 2400, { q: 2 });
          break;
        case 'nova':
          this.tone('sine', 140, 50, 0.35, 0.16);
          this.noise(0.4, 0.09, 'bandpass', 300, 2500, { q: 0.8 });
          break;
        case 'beam':
          if (!this.can(name, 0.1)) return;
          this.tone('sawtooth', 500, 900, 0.3, 0.05, { filter: 'bandpass', ff: 1800, q: 2 });
          this.noise(0.3, 0.05, 'bandpass', 2000, 4000);
          break;
        case 'flame':
          if (busy || !this.can(name, 0.12)) return;
          this.noise(0.2, 0.05, 'lowpass', 1200, 600);
          break;
        case 'eshoot':
          if (busy || !this.can(name, 0.07)) return;
          this.tone('triangle', 520, 300, 0.07, 0.025);
          break;
        case 'spawn':
          if (busy || !this.can(name, 0.12)) return;
          this.tone('sine', 300, 700, 0.12, 0.02);
          break;
        case 'chest':
          for (let i = 0; i < 8; i++) this.tone('triangle', 784 * Math.pow(2, i / 7), 784 * Math.pow(2, i / 7), 0.15, 0.05, { delay: i * 0.05, verb: true });
          break;
        case 'evolve':
          [0, 7, 12, 19, 24].forEach((n, i) => this.tone('sawtooth', 262 * Math.pow(2, n / 12), 262 * Math.pow(2, n / 12), 0.5, 0.05, { delay: i * 0.09, filter: 'lowpass', ff: 3000, verb: true }));
          break;
        case 'wave':
          this.tone('triangle', 440, 440, 0.12, 0.06);
          this.tone('triangle', 660, 660, 0.18, 0.06, { delay: 0.1, verb: true });
          break;
        case 'clear':
          [0, 4, 7, 11, 14].forEach((n, i) => this.tone('sine', 587 * Math.pow(2, n / 12), 587 * Math.pow(2, n / 12), 0.3, 0.06, { delay: i * 0.07, verb: true }));
          break;
        case 'gameover':
          [0, -3, -7, -12].forEach((n, i) => this.tone('triangle', 330 * Math.pow(2, n / 12), 330 * Math.pow(2, n / 12), 0.5, 0.08, { delay: i * 0.22, verb: true }));
          break;
        case 'victory':
          [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((n, i) => this.tone('square', 392 * Math.pow(2, n / 12), 392 * Math.pow(2, n / 12), 0.3, 0.05, { delay: i * 0.11, filter: 'lowpass', ff: 3000, verb: true }));
          break;
        case 'achieve':
          this.tone('triangle', 988, 988, 0.12, 0.06);
          this.tone('triangle', 1319, 1319, 0.3, 0.06, { delay: 0.1, verb: true });
          break;
        case 'buy':
          this.tone('square', 784, 784, 0.07, 0.05, { filter: 'lowpass', ff: 3000 });
          this.tone('square', 1175, 1175, 0.15, 0.05, { delay: 0.07, filter: 'lowpass', ff: 3000 });
          break;
        case 'tick':
          if (!this.can(name, 0.03)) return;
          this.tone('sine', 1200 + p * 40, 1200 + p * 40, 0.03, 0.03);
          break;
      }
    }
  }

  NR.AudioEngine = AudioEngine;
})();
