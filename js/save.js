'use strict';
/* NEON RIFT — セーブデータ(localStorage。保存できない環境でもそのまま遊べる) */
(function () {
  const NR = window.NR;
  const KEY = 'neon-rift-save-v1';

  function defaults() {
    return {
      v: 1,
      cores: 0,
      meta: {},
      ships: { vanguard: true },
      weapons: {},
      ship: 'vanguard',
      risk: 0,
      riskMax: 0,
      settings: {
        master: 0.8, music: 0.55, sfx: 0.75, quality: 'auto', shake: 1, flashes: 1,
        dmgNums: true, autofire: true, showFps: false, pbAlpha: 0.75,
        touchMode: 'drag', touchSens: 1.2,
      },
      stats: {
        runs: 0, wins: 0, kills: 0, playTime: 0, bestWave: 0, bestEndless: 0, bestScore: 0,
        maxCombo: 0, maxLevel: 0, evolved: {}, bossKills: {}, grazes: 0, perfects: 0,
      },
      best: { campaign: 0, endless: 0 },
      daily: { key: '', best: 0 },
      ach: {},
      tutorial: false,
    };
  }
  function merge(base, src) {
    for (const k in src) {
      const v = src[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') merge(base[k], v);
      else base[k] = v;
    }
    return base;
  }

  const Save = {
    data: defaults(),
    ok: true,
    load() {
      try {
        const s = localStorage.getItem(KEY);
        if (s) merge(this.data, JSON.parse(s));
      } catch (e) {
        this.ok = false;
      }
      return this.data;
    },
    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) {
        this.ok = false;
      }
    },
    reset() {
      const keepSettings = this.data.settings;
      this.data = defaults();
      this.data.settings = keepSettings;
      this.save();
    },
    metaLv(id) { return this.data.meta[id] | 0; },
  };

  NR.Save = Save;
})();
