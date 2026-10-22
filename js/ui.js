'use strict';
/* NEON RIFT — UI(メニュー・HUD・レベルアップ・宝箱・リザルト) */
(function () {
  const NR = window.NR;
  const { U } = NR;
  const D = NR.DATA, UP = D.UP;
  const $ = (sel, root = document) => root.querySelector(sel);
  const icon = (key, color, size) => NR.Icons.get(key, color, size);

  const CAT_LABEL = { main: 'メイン武装', weapon: 'サブ武装', passive: 'パッシブ', evo: '進化', perk: 'レジェンダリー' };
  const SRC_NAME = { main: 'メイン武装', tail: 'テイルガン', fragment: 'フラグメント', chain: '誘爆', nuke: 'ニューク', overdrive: 'オーバードライブ', phantom: 'ファントム', self: '自爆' };
  const QUALITY = [['auto', '自動'], ['high', '高'], ['medium', '中'], ['low', '低']];

  function pips(lv, max) {
    let s = '';
    for (let i = 1; i <= max; i++) s += `<i class="${i <= lv ? 'on' : ''}"></i>`;
    return `<span class="pips">${s}</span>`;
  }
  function key(k) { return `<kbd>${k}</kbd>`; }

  class UI {
    constructor(app) {
      this.app = app;
      this.root = document.getElementById('app');
      this.state = '';
      this.lockUntil = 0;
      this.hc = {};
      this.mode = 'campaign';
      this.lu = null;
      this.chestAnim = null;
      this.count = null;
      this.build();
      this.root.addEventListener('click', (e) => {
        const t = e.target.closest('[data-act]');
        if (!t || t.disabled || !this.root.contains(t)) return;
        this.act(t.dataset.act, t, e);
      });
      this.root.addEventListener('pointerover', (e) => {
        const b = e.target.closest('button:not([disabled])');
        if (b && b !== this.lastHover) { this.lastHover = b; this.app.audio.play('hover'); }
      });
      this.root.addEventListener('input', (e) => {
        const t = e.target;
        if (t.dataset && t.dataset.set) this.setSetting(t.dataset.set, parseFloat(t.value), t);
      });
    }

    build() {
      const r = this.root;
      r.insertAdjacentHTML('beforeend', `
<div id="hud" class="hud" hidden>
  <div class="xpbar"><i id="hud-xp"></i></div>
  <div class="hud-tl">
    <div class="hp" id="hud-hp"></div>
    <div class="lvrow"><span class="lbl">LV</span><b id="hud-lv">1</b><span class="bar-mini"><i id="hud-xp2"></i></span></div>
  </div>
  <div class="hud-tc">
    <div class="wave"><span class="lbl">WAVE</span><b id="hud-wave">1</b><span class="of" id="hud-waveof">/ 20</span></div>
    <div class="wavebar"><i id="hud-wavebar"></i></div>
    <div class="bossbar" id="hud-boss" hidden>
      <div class="bname"><span id="hud-bname"></span><em id="hud-bphase"></em></div>
      <div class="bbar"><i id="hud-bbar"></i></div>
    </div>
  </div>
  <div class="hud-tr">
    <div class="score" id="hud-score">0</div>
    <div class="combo" id="hud-combo"><b id="hud-cnum">0</b><span>COMBO</span><em id="hud-mult">×1</em></div>
  </div>
  <div class="hud-bl">
    <div class="slots" id="hud-weapons"></div>
    <div class="slots mini" id="hud-passives"></div>
  </div>
  <div class="hud-bc">
    <div class="od" id="hud-od">
      <div class="odlbl"><span>OVERDRIVE</span><span class="odkey" id="hud-odkey">E</span></div>
      <div class="odbar"><i id="hud-odbar"></i></div>
    </div>
    <div class="dash"><span class="lbl">DASH</span><span class="dashbar"><i id="hud-dash"></i></span></div>
  </div>
  <div class="hud-br"><span id="hud-kills">0</span> 撃破<span class="sep">/</span><span id="hud-time">0:00</span><span id="hud-fps"></span></div>
  <button class="hud-pause" data-act="pause" aria-label="一時停止"><span></span><span></span></button>
</div>
<div id="banner" class="banner" hidden><div class="b-title"></div><div class="b-sub"></div></div>
<div id="warning" class="warning" hidden><div class="w-strip"></div><div class="w-body"><div class="w-title">WARNING</div><div class="w-name"></div><div class="w-en"></div></div><div class="w-strip"></div></div>
<div id="pops"></div>
<div id="toasts"></div>
<div id="screen" class="screenwrap"></div>
<div id="touch" class="touch" hidden>
  <div class="touch-hint" id="t-hint" hidden><span class="th-demo"><i></i></span><b id="t-hint-title"></b><span id="t-hint-sub"></span></div>
  <div class="finger" id="t-finger"></div>
  <div class="stick" id="stick-l"><i></i></div>
  <div class="stick" id="stick-r"><i></i></div>
  <button class="tbtn tdash" id="t-dash" aria-label="ダッシュ">DASH</button>
  <button class="tbtn tod" id="t-od" aria-label="オーバードライブ">OD</button>
</div>`);
      this.hud = $('#hud');
      this.screenEl = $('#screen');
      this.bannerEl = $('#banner');
      this.warnEl = $('#warning');
      this.touchEl = $('#touch');
      const inp = this.app.input;
      const press = (id, code) => {
        const el = $(id);
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); inp.pressed.add(code); });
      };
      press('#t-dash', 'TouchDash');
      press('#t-od', 'TouchOd');
    }

    // ── 画面切り替え ──
    show(name, html) {
      this.state = name;
      this.screenEl.innerHTML = html || '';
      this.screenEl.className = 'screenwrap ' + (html ? 'on s-' + name : '');
      this.setTouch(!html && !this.hud.hidden && this.app.input.device === 'touch');
      const first = this.screenEl.querySelector('[data-focus]') || this.screenEl.querySelector('button:not([disabled])');
      if (first && this.app.input.device !== 'touch') setTimeout(() => first.focus({ preventScroll: true }), 30);
    }
    clear() { this.show('none', ''); }
    setHud(on) {
      this.hud.hidden = !on;
      document.body.classList.toggle('playing', on);
      this.setTouch(on && this.app.input.device === 'touch');
    }
    setTouch(on) { this.touchEl.hidden = !on; }

    title() {
      const s = this.app.save.data, st = s.stats;
      const achN = Object.keys(s.ach).length;
      const daily = this.app.dailyInfo();
      this.show('title', `
<div class="title">
  <div class="t-main">
    <div class="eyebrow">ARCADE ROGUELITE SHOOTER</div>
    <h1 class="logo" aria-label="NEON RIFT"><span class="l1">NEON</span><span class="l2">RIFT</span></h1>
    <p class="tagline">撃て。育てろ。裂け目を閉じろ。</p>
    <nav class="menu">
      <button data-act="play:campaign" data-focus><span class="mi">出撃</span><span class="me">CAMPAIGN</span><span class="md">全10ウェーブ。中ボスと最終ボスを倒して裂け目を閉じる</span></button>
      <button data-act="play:endless"><span class="mi">エンドレス</span><span class="me">ENDLESS</span><span class="md">終わりのない侵攻。どこまで耐えられるか</span></button>
      <button data-act="play:daily"><span class="mi">デイリー</span><span class="me">DAILY</span><span class="md">今日の機体と特殊ルール：${daily.mods.map((m) => m.name).join('・')}</span></button>
      <button data-act="nav:lab"><span class="mi">ラボ</span><span class="me">LAB</span><span class="md">コアで永久強化・機体と武装を解放</span></button>
      <div class="menu-row">
        <button data-act="nav:records">記録</button>
        <button data-act="nav:settings">設定</button>
        <button data-act="nav:howto">遊び方</button>
      </div>
    </nav>
  </div>
  <aside class="t-side">
    <div class="stat-tile core"><span class="lbl">CORE</span><b>${U.fmt(s.cores)}</b></div>
    <div class="stat-tile"><span class="lbl">BEST SCORE</span><b>${U.fmt(st.bestScore)}</b></div>
    <div class="stat-tile"><span class="lbl">最高到達</span><b>WAVE ${st.bestWave || 0}${st.bestEndless ? ` <small>/ ENDLESS ${st.bestEndless}</small>` : ''}</b></div>
    <div class="stat-tile"><span class="lbl">実績</span><b>${achN} <small>/ ${D.achievements.length}</small></b></div>
    ${s.daily.key === U.todayKey() ? `<div class="stat-tile"><span class="lbl">今日のデイリー</span><b>${U.fmt(s.daily.best)}</b></div>` : ''}
  </aside>
  <footer class="t-foot">
    <span>${key('WASD')} 移動</span><span>${key('マウス')} 照準</span><span>${key('Space')} ダッシュ</span><span>${key('E')} オーバードライブ</span><span>${key('Esc')} ポーズ</span>
    <span class="dim">ゲームパッド・タッチ操作にも対応</span>
  </footer>
</div>`);
    }

    shipSelect(mode) {
      this.mode = mode;
      const s = this.app.save.data;
      const daily = mode === 'daily' ? this.app.dailyInfo() : null;
      if (!daily && !s.ships[s.ship]) s.ship = 'vanguard';
      const sel = daily ? daily.ship : s.ship;
      const modeName = { campaign: '出撃 — CAMPAIGN', endless: 'エンドレス — ENDLESS', daily: 'デイリー — ' + U.todayKey() }[mode];
      const cards = Object.keys(D.ships).map((id) => {
        const sh = D.ships[id];
        const owned = !!s.ships[id] || !!daily;
        const lockedForDaily = daily && id !== daily.ship;
        const can = s.cores >= sh.price;
        const act = daily ? '' : owned ? `ship:${id}` : `buy-ship:${id}`;
        return `
<button class="ship ${id === sel ? 'sel' : ''} ${owned ? '' : 'locked'}" ${act ? `data-act="${act}"` : 'disabled'} ${lockedForDaily ? 'disabled' : ''} style="--c:${sh.color}">
  <span class="frame"><span class="in">
    <img class="sicon" src="${icon(owned ? sh.sprite : 'lock', owned ? sh.color : '#6b7699', 96)}" alt="">
    <span class="sname">${sh.name}</span><span class="sen">${sh.en}</span>
    <span class="sstats">
      <span><em>HP</em>${'▮'.repeat(sh.hp)}</span>
      <span><em>速度</em>${'▮'.repeat(Math.round(sh.speed * 5))}</span>
      <span><em>火力</em>${'▮'.repeat(Math.max(1, Math.round((sh.gun.dmg * sh.gun.rate * sh.gun.count) / 16)))}</span>
    </span>
    <span class="sdesc">${sh.desc}</span>
    <span class="strait">${sh.trait}</span>
    ${owned ? '' : `<span class="sprice ${can ? 'ok' : ''}">${can ? '解放する' : '必要'} · ${U.fmt(sh.price)} CORE</span>`}
  </span></span>
</button>`;
      }).join('');
      const riskRow = daily ? `
<div class="mods"><div class="lbl">本日の特殊ルール</div>${daily.mods.map((m) => `<div class="mod"><b>${m.name}</b><span>${m.desc}</span></div>`).join('')}</div>` : `
<div class="risk">
  <div class="lbl">RISK <span class="dim">— 難しいほどスコアとコアが増える</span></div>
  <div class="riskrow">${D.risks.map((r, i) => `<button data-act="risk:${i}" class="${i === s.risk ? 'sel' : ''}" ${i > s.riskMax ? 'disabled' : ''}>${i === 0 ? '標準' : i}</button>`).join('')}</div>
  <div class="riskdesc"><b>${D.risks[s.risk].name}</b> ${s.risk ? D.risks.slice(1, s.risk + 1).map((r) => r.desc).join(' / ') : '通常の難易度'}<span class="dim"> · スコア ×${(1 + 0.3 * s.risk).toFixed(1)} · コア ×${(1 + 0.25 * s.risk).toFixed(2)}</span></div>
  ${s.riskMax < D.risks.length - 1 ? `<div class="dim small">キャンペーンを RISK ${s.riskMax} でクリアすると RISK ${s.riskMax + 1} が解放されます</div>` : ''}
</div>`;
      this.show('ship', `
<div class="panel-screen">
  <header class="ph"><button class="back" data-act="nav:title">← 戻る</button><div><div class="eyebrow">LAUNCH PREP</div><h2>${modeName}</h2></div><div class="cores">CORE <b>${U.fmt(s.cores)}</b></div></header>
  <div class="ships">${cards}</div>
  ${riskRow}
  <div class="launch-row"><button class="primary big" data-act="launch" data-focus>出撃する <span class="arrow">▶</span></button><span class="dim">${key('Enter')}</span></div>
</div>`);
    }

    lab() {
      const s = this.app.save.data;
      const metas = D.meta.map((m) => {
        const lv = s.meta[m.id] | 0, maxed = lv >= m.max, cost = maxed ? 0 : m.cost[lv];
        return `
<button class="lab-item ${maxed ? 'max' : ''}" data-act="buy-meta:${m.id}" ${maxed ? 'disabled' : ''} style="--c:${m.color}">
  <img src="${icon(m.icon, m.color, 64)}" alt="">
  <span class="li-body"><span class="li-name">${m.name}</span><span class="li-desc">${m.desc}</span>${pips(lv, m.max)}</span>
  <span class="li-cost ${!maxed && s.cores >= cost ? 'ok' : ''}">${maxed ? 'MAX' : U.fmt(cost)}</span>
</button>`;
      }).join('');
      const weps = Object.keys(D.weaponUnlocks).map((id) => {
        const u = UP[id], cost = D.weaponUnlocks[id], own = !!s.weapons[id];
        return `
<button class="lab-item ${own ? 'max' : ''}" data-act="buy-weapon:${id}" ${own ? 'disabled' : ''} style="--c:${u.color}">
  <img src="${icon(u.icon, u.color, 64)}" alt="">
  <span class="li-body"><span class="li-name">${u.name}</span><span class="li-desc">${u.desc(1)} → 進化: ${UP[u.evo].name}</span></span>
  <span class="li-cost ${!own && s.cores >= cost ? 'ok' : ''}">${own ? '解放済み' : U.fmt(cost)}</span>
</button>`;
      }).join('');
      const ships = Object.keys(D.ships).filter((id) => D.ships[id].price).map((id) => {
        const sh = D.ships[id], own = !!s.ships[id];
        return `
<button class="lab-item ${own ? 'max' : ''}" data-act="buy-ship:${id}" ${own ? 'disabled' : ''} style="--c:${sh.color}">
  <img src="${icon(sh.sprite, sh.color, 64)}" alt="">
  <span class="li-body"><span class="li-name">${sh.name}</span><span class="li-desc">${sh.trait}</span></span>
  <span class="li-cost ${!own && s.cores >= sh.price ? 'ok' : ''}">${own ? '解放済み' : U.fmt(sh.price)}</span>
</button>`;
      }).join('');
      this.show('lab', `
<div class="panel-screen">
  <header class="ph"><button class="back" data-act="nav:title" data-focus>← 戻る</button><div><div class="eyebrow">LAB</div><h2>ラボ</h2></div><div class="cores">CORE <b>${U.fmt(s.cores)}</b></div></header>
  <p class="lead">出撃で集めたコアを使って、次の出撃から効く永久強化を購入できます。</p>
  <h3 class="sec">永久強化</h3><div class="lab-grid">${metas}</div>
  <h3 class="sec">武装の解放 <span class="dim">— レベルアップの候補に加わる</span></h3><div class="lab-grid">${weps}</div>
  <h3 class="sec">機体の解放</h3><div class="lab-grid">${ships}</div>
</div>`);
    }

    records() {
      const s = this.app.save.data, st = s.stats;
      const rows = [
        ['出撃回数', U.fmt(st.runs)], ['クリア回数', U.fmt(st.wins)], ['累計撃破', U.fmt(st.kills)],
        ['ベストスコア', U.fmt(st.bestScore)], ['最高到達ウェーブ', st.bestWave || 0], ['エンドレス最高', st.bestEndless || 0],
        ['最大コンボ', U.fmt(st.maxCombo)], ['最高レベル', st.maxLevel || 0], ['累計グレイズ', U.fmt(st.grazes || 0)],
        ['ジャスト回避', U.fmt(st.perfects || 0)], ['プレイ時間', U.fmtTime(st.playTime) + (st.playTime >= 3600 ? '' : '')], ['解放したリスク', st.riskMax || s.riskMax],
      ];
      const achs = D.achievements.map((a) => {
        const got = !!s.ach[a.id];
        return `<li class="${got ? 'got' : ''}"><span class="ach-mark">${got ? '◆' : '◇'}</span><span class="ach-body"><b>${a.name}</b><span>${a.desc}</span></span><span class="ach-rw">+${a.reward}</span></li>`;
      }).join('');
      this.show('records', `
<div class="panel-screen">
  <header class="ph"><button class="back" data-act="nav:title" data-focus>← 戻る</button><div><div class="eyebrow">RECORDS</div><h2>記録</h2></div><div class="cores">実績 <b>${Object.keys(s.ach).length} / ${D.achievements.length}</b></div></header>
  <div class="rec-grid">${rows.map(([k, v]) => `<div class="rec"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
  <h3 class="sec">実績 <span class="dim">— 達成するとコアがもらえる</span></h3>
  <ul class="achs">${achs}</ul>
  <div class="danger-zone">
    <button class="ghost" data-act="reset-save">セーブデータを消去</button>
    <span id="reset-confirm" hidden>本当に消去しますか？ <button class="danger" data-act="reset-confirm">消去する</button> <button class="ghost" data-act="reset-cancel">やめる</button></span>
    ${this.app.save.ok ? '' : '<span class="dim">この環境ではデータを保存できません。遊ぶことはできます。</span>'}
  </div>
</div>`);
    }

    settingsHtml() {
      const st = this.app.save.data.settings;
      const slider = (k, label, min, max, step, fmt) => `
<label class="set"><span class="set-l">${label}</span><input type="range" id="set-${k}" data-set="${k}" min="${min}" max="${max}" step="${step}" value="${st[k]}"><output id="out-${k}">${fmt(st[k])}</output></label>`;
      const toggle = (k, label, desc) => `
<div class="set"><span class="set-l">${label}${desc ? `<small>${desc}</small>` : ''}</span><button class="toggle ${st[k] ? 'on' : ''}" data-act="toggle:${k}" aria-pressed="${!!st[k]}">${st[k] ? 'ON' : 'OFF'}</button></div>`;
      const pct = (v) => Math.round(v * 100) + '%';
      return `
<div class="settings">
  <h3 class="sec">サウンド</h3>
  ${slider('master', 'マスター音量', 0, 1, 0.05, pct)}
  ${slider('music', 'BGM', 0, 1, 0.05, pct)}
  ${slider('sfx', '効果音', 0, 1, 0.05, pct)}
  <h3 class="sec">画面</h3>
  <div class="set"><span class="set-l">画質<small>自動は処理落ちに合わせて解像度を下げます</small></span><span class="seg">${QUALITY.map(([v, l]) => `<button data-act="quality:${v}" class="${st.quality === v ? 'sel' : ''}">${l}</button>`).join('')}</span></div>
  ${slider('shake', '画面の揺れ', 0, 1.5, 0.1, pct)}
  ${slider('flashes', '画面フラッシュ', 0, 1, 0.1, pct)}
  ${slider('pbAlpha', '自機の弾の濃さ', 0.2, 1, 0.05, pct)}
  ${toggle('dmgNums', 'ダメージ数値を表示')}
  ${toggle('showFps', 'FPSを表示')}
  <h3 class="sec">操作</h3>
  ${toggle('autofire', 'オート射撃', 'OFFにするとクリック中だけ撃つ')}
  <div class="set"><span class="set-l">スマホの操作<small>ドラッグ: 画面のどこでもなぞった分だけ動く / スティック: 左で移動・右で照準</small></span><span class="seg"><button data-act="touchmode:drag" class="${st.touchMode !== 'stick' ? 'sel' : ''}">ドラッグ</button><button data-act="touchmode:stick" class="${st.touchMode === 'stick' ? 'sel' : ''}">スティック</button></span></div>
  ${slider('touchSens', 'ドラッグの感度', 0.6, 2.2, 0.1, (v) => '×' + Number(v).toFixed(1))}
  <div class="set"><span class="set-l">フルスクリーン</span><button class="ghost" data-act="fullscreen">切り替え ${key('F')}</button></div>
</div>`;
    }
    settings(fromPause) {
      this.settingsFromPause = !!fromPause;
      this.show('settings', `
<div class="panel-screen narrow">
  <header class="ph"><button class="back" data-act="${fromPause ? 'pause-back' : 'nav:title'}" data-focus>← 戻る</button><div><div class="eyebrow">SETTINGS</div><h2>設定</h2></div><div></div></header>
  ${this.settingsHtml()}
</div>`);
    }

    howto() {
      const rows = (list) => list.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
      this.show('howto', `
<div class="panel-screen">
  <header class="ph"><button class="back" data-act="nav:title" data-focus>← 戻る</button><div><div class="eyebrow">HOW TO PLAY</div><h2>遊び方</h2></div><div></div></header>
  <div class="howto">
    <section>
      <h3 class="sec">操作</h3>
      <table class="keys">
        ${rows([
          ['移動', `${key('W')}${key('A')}${key('S')}${key('D')} / 矢印キー / 左スティック`],
          ['照準', 'マウス / 右スティック(離すと自動照準)'],
          ['射撃', 'オート(設定で切替) / 左クリック / RT'],
          ['ダッシュ', `${key('Space')} / ${key('Shift')} / 右クリック / A`],
          ['オーバードライブ', `${key('E')} / ${key('Q')} / ホイールクリック / X`],
          ['ポーズ', `${key('Esc')} / ${key('P')} / START`],
          ['スマホ', '画面のどこでもなぞると、指を動かした分だけ自機が動く(照準と射撃は自動)。右下の DASH で無敵ダッシュ、OD は外周のゲージが満タンになったら押す。設定でスティック操作(左で移動・右で照準)にも切り替えられる'],
        ])}
      </table>
    </section>
    <section>
      <h3 class="sec">ルール</h3>
      <dl class="rules">
        <dt>経験値と強化</dt><dd>敵が落とす結晶を集めるとレベルアップ。3枚のカードから1つを選んで機体を育てる。数字キー ${key('1')}〜${key('4')} でも選べる。</dd>
        <dt>進化</dt><dd>サブ武装をLv5にし、対応するパッシブを持っていると「進化」カードが出る。宝箱からも出る。</dd>
        <dt>ダッシュとジャスト回避</dt><dd>ダッシュ中は無敵。敵弾やレーザーに重なる瞬間にダッシュすると「JUST!」でスローになり、ドライブが大きく溜まる。</dd>
        <dt>グレイズとオーバードライブ</dt><dd>敵弾をかすめるとゲージが溜まる。満タンで発動すると6秒間、火力1.5倍・連射アップ・敵が減速・スコア2倍。</dd>
        <dt>コンボ</dt><dd>撃破を途切れさせずに続けるとスコア倍率が最大 ×8 まで上がる。被弾でリセット。</dd>
        <dt>精鋭と宝箱</dt><dd>金色の輪をまとった精鋭は宝箱を落とす。中身は1〜5個の強化。</dd>
        <dt>リロールと除外</dt><dd>選択肢を引き直したり、いらない強化をその出撃の候補から消したりできる。回数はラボで増やせる。</dd>
        <dt>ラボ</dt><dd>出撃のたびにコアがたまる。永久強化・新しい機体・新しい武装の解放に使う。</dd>
      </dl>
    </section>
    <section>
      <h3 class="sec">進化の組み合わせ</h3>
      <ul class="evos">${Object.keys(UP).filter((id) => UP[id].cat === 'evo').map((id) => {
        const e = UP[id], a = UP[e.from], b = UP[e.need];
        return `<li><img src="${icon(a.icon, a.color, 40)}" alt=""><span>${a.name}</span><b>＋</b><img src="${icon(b.icon, b.color, 40)}" alt=""><span>${b.name}</span><b>→</b><strong style="color:${e.color}">${e.name}</strong></li>`;
      }).join('')}</ul>
    </section>
  </div>
</div>`);
    }

    // ── HUD ──
    hudUpdate(g, dt) {
      const c = this.hc, p = g.player;
      const set = (id, v) => { if (c[id] !== v) { c[id] = v; const el = document.getElementById(id); if (el) el.textContent = v; } };
      const w = (id, v) => { v = Math.round(v * 1000) / 10; if (c[id] !== v) { c[id] = v; const el = document.getElementById(id); if (el) el.style.width = v + '%'; } };
      const hpKey = p.hp + '/' + p.stats.maxHp + (p.barrier ? 'b' : '');
      if (c.hp !== hpKey) {
        c.hp = hpKey;
        let h = '';
        for (let i = 0; i < p.stats.maxHp; i++) h += `<i class="${i < p.hp ? 'on' : ''}"></i>`;
        if (p.barrier) h += '<i class="shield"></i>';
        $('#hud-hp').innerHTML = h;
        $('#hud-hp').classList.toggle('low', p.hp <= 1);
      }
      set('hud-lv', String(g.level));
      w('hud-xp', g.xp / g.xpNext);
      w('hud-xp2', g.xp / g.xpNext);
      set('hud-wave', String(Math.max(1, g.wave)));
      set('hud-waveof', g.mode === 'endless' ? 'ENDLESS' : '/ ' + g.finalWave);
      let wp = 0;
      if (g.cfg) {
        if (g.waveState === 'active') wp = 1 - g.waveT / g.cfg.duration;
        else if (g.waveState === 'clearing' || g.waveState === 'cleared') wp = 1;
      }
      w('hud-wavebar', wp);
      const boss = g.boss && !g.boss.dead ? g.boss : null;
      if (c.boss !== !!boss) { c.boss = !!boss; $('#hud-boss').hidden = !boss; }
      if (boss) {
        set('hud-bname', boss.def.en + ' — ' + boss.def.name);
        set('hud-bphase', 'PHASE ' + boss.phase);
        w('hud-bbar', Math.max(0, boss.hp / boss.maxHp));
      }
      set('hud-score', U.fmt(g.score));
      set('hud-cnum', String(g.combo));
      const m = g.mult();
      set('hud-mult', '×' + m);
      const comboOn = g.combo >= 5;
      if (c.comboOn !== comboOn) { c.comboOn = comboOn; $('#hud-combo').classList.toggle('on', comboOn); }
      const tier = m >= 5 ? 3 : m >= 3 ? 2 : m >= 1.5 ? 1 : 0;
      if (c.tier !== tier) { c.tier = tier; $('#hud-combo').dataset.tier = tier; }
      w('hud-odbar', g.odT > 0 ? g.odT / p.stats.odDur : g.od / 100);
      const odState = g.odT > 0 ? 'active' : g.od >= 100 ? 'ready' : '';
      if (c.od !== odState) { c.od = odState; $('#hud-od').className = 'od ' + odState; }
      const odk = this.app.input.device === 'pad' ? 'X' : this.app.input.device === 'touch' ? 'OD' : 'E';
      set('hud-odkey', odk);
      w('hud-dash', p.dashCd > 0 ? 1 - p.dashCd / p.stats.dashCd : 1);
      set('hud-kills', U.fmt(g.kills));
      set('hud-time', U.fmtTime(g.time));
      set('hud-fps', this.app.save.data.settings.showFps ? '  ' + this.app.fps + ' FPS' : '');
      const sig = g.inv.weapons.map((x) => x.id + x.lv).join() + '|' + Object.entries(g.inv.passives).map(([k, v]) => k + v).join() + '|' + Object.keys(g.inv.perks).join() + '|' + Object.entries(g.inv.main).map(([k, v]) => k + v).join();
      if (c.sig !== sig) {
        c.sig = sig;
        let h = '';
        for (let i = 0; i < 4; i++) {
          const x = g.inv.weapons[i];
          if (x) { const u = UP[x.id]; h += `<span class="slot ${u.cat === 'evo' ? 'evo' : ''}" title="${u.name}" style="--c:${u.color}"><img src="${icon(u.icon, u.color, 48)}" alt="">${u.cat === 'evo' ? '<b>EVO</b>' : `<b>${x.lv}</b>`}</span>`; }
          else h += '<span class="slot empty"></span>';
        }
        $('#hud-weapons').innerHTML = h;
        h = '';
        const ps = Object.keys(g.inv.passives);
        for (let i = 0; i < 5; i++) {
          const id = ps[i];
          if (id) { const u = UP[id]; h += `<span class="slot" title="${u.name}" style="--c:${u.color}"><img src="${icon(u.icon, u.color, 40)}" alt=""><b>${g.inv.passives[id]}</b></span>`; }
          else h += '<span class="slot empty"></span>';
        }
        for (const id of Object.keys(g.inv.perks)) { const u = UP[id]; h += `<span class="slot perk" title="${u.name}" style="--c:${u.color}"><img src="${icon(u.icon, u.color, 40)}" alt=""></span>`; }
        $('#hud-passives').innerHTML = h;
      }
      if (!this.touchEl.hidden) this.touchUpdate();
    }
    touchUpdate() {
      const inp = this.app.input, g = this.app.game;
      const stickMode = inp.touchMode === 'stick';
      // スティックは触れている間はその位置に、触れていない間は左下の定位置に薄く表示する
      const place = (el, t, home) => {
        if (t.id === null) {
          if (!home) { el.classList.remove('on', 'idle'); return; }
          el.classList.add('on', 'idle');
          el.style.transform = `translate(${home[0]}px, ${home[1]}px)`;
          el.firstElementChild.style.transform = '';
          return;
        }
        el.classList.add('on');
        el.classList.remove('idle');
        el.style.transform = `translate(${t.ox}px, ${t.oy}px)`;
        const dx = t.x - t.ox, dy = t.y - t.oy, d = Math.hypot(dx, dy), m = inp.stickR;
        const k = d > m ? m / d : 1;
        el.firstElementChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      };
      const finger = $('#t-finger');
      if (stickMode) {
        finger.classList.remove('on');
        place($('#stick-l'), inp.tMove, [100, innerHeight - 200]);
        place($('#stick-r'), inp.tAim, null);
      } else {
        $('#stick-l').classList.remove('on', 'idle');
        $('#stick-r').classList.remove('on', 'idle');
        const d = inp.drag;
        finger.classList.toggle('on', d.id !== null);
        if (d.id !== null) finger.style.transform = `translate(${d.x}px, ${d.y}px)`;
      }
      // 動き出すまで操作のヒントを出す
      const hint = $('#t-hint');
      const showHint = !!g && g.moveDist < 160 && g.time < 40;
      if (hint.hidden === showHint) hint.hidden = !showHint;
      if (showHint && this.hintMode !== inp.touchMode) {
        this.hintMode = inp.touchMode;
        $('#t-hint-title').textContent = stickMode ? '画面の左側をドラッグして移動' : '画面のどこでも、なぞって移動';
        $('#t-hint-sub').textContent = stickMode ? '右側のドラッグで照準(離すと自動照準)・DASHで無敵回避' : '指を動かした分だけ自機が動く・照準と射撃は自動';
      }
      if (!g) return;
      const od = $('#t-od'), dash = $('#t-dash'), p = g.player;
      od.classList.toggle('ready', g.od >= 100 && g.odT <= 0);
      od.style.setProperty('--p', Math.round(g.odT > 0 ? (g.odT / p.stats.odDur) * 100 : g.od));
      dash.style.setProperty('--p', Math.round(p.dashCd > 0 ? (1 - p.dashCd / p.stats.dashCd) * 100 : 100));
    }

    banner(title, style, sub) {
      const b = this.bannerEl;
      b.hidden = false;
      b.className = 'banner ' + (style || 'wave');
      b.querySelector('.b-title').textContent = title;
      b.querySelector('.b-sub').textContent = sub || '';
      void b.offsetWidth;
      b.classList.add('show');
      clearTimeout(this.bannerT);
      this.bannerT = setTimeout(() => { b.classList.remove('show'); b.hidden = true; }, 2200);
    }
    warning(def) {
      const w = this.warnEl;
      w.querySelector('.w-name').textContent = def.name;
      w.querySelector('.w-en').textContent = def.en || '';
      w.hidden = false;
      w.classList.remove('show');
      void w.offsetWidth;
      w.classList.add('show');
      clearTimeout(this.warnT);
      this.warnT = setTimeout(() => { w.hidden = true; w.classList.remove('show'); }, 3300);
    }
    bossIntro(e) { this.banner(e.def.en, 'boss', e.def.name); }
    popText(x, y, text) {
      const el = document.createElement('div');
      el.className = 'pop';
      el.textContent = text;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      $('#pops').appendChild(el);
      setTimeout(() => el.remove(), 900);
    }
    toast(title, name, sub, ic) {
      const el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = `${ic ? `<img src="${ic}" alt="">` : ''}<div><b>${title}</b><span>${name}</span>${sub ? `<em>${sub}</em>` : ''}</div>`;
      $('#toasts').appendChild(el);
      setTimeout(() => el.classList.add('out'), 3400);
      setTimeout(() => el.remove(), 4000);
    }

    // ── レベルアップ ──
    cardHtml(g, o, i, banish) {
      let u = UP[o.id], name, en, desc, ic, color, tag = '', pipHtml = '', cat, hint = '';
      if (o.id === '_heal') { name = 'リペア'; en = 'REPAIR'; desc = 'HPを1回復する'; ic = 'heal'; color = '#3dffa0'; cat = '補給'; }
      else if (o.id === '_score') { name = 'ボーナス'; en = 'BONUS'; desc = `スコア +${U.fmt(2000 * g.wave)}`; ic = 'score'; color = '#ffc23f'; cat = '補給'; }
      else {
        const lv = g.lv(o.id), add = o.rarity === 'epic' ? 2 : 1, next = Math.min(u.max, lv + add);
        name = u.name; en = u.en; ic = u.icon; color = u.color; cat = CAT_LABEL[u.cat];
        if (u.cat === 'evo') { tag = '進化'; desc = u.desc(1); hint = `${UP[u.from].name} ＋ ${UP[u.need].name}`; }
        else if (u.cat === 'perk') { tag = 'LEGENDARY'; desc = u.desc(1); }
        else {
          tag = lv ? `Lv ${lv} → ${next}` : 'NEW';
          const parts = [];
          for (let k = lv + 1; k <= next; k++) parts.push(u.desc(k));
          desc = parts.join(' / ');
          pipHtml = pips(next, u.max);
          if (u.cat === 'weapon' && u.evo) hint = `進化: ＋${UP[UP[u.evo].need].name}`;
          for (const w of g.inv.weapons) { const wu = UP[w.id]; if (wu.evo && UP[wu.evo].need === o.id) hint = `${wu.name} の進化に必要`; }
        }
      }
      return `
<button class="card r-${o.rarity} ${banish ? 'banishing' : ''}" data-act="pick:${i}" style="--c:${color}">
  <span class="frame"><span class="in">
    <span class="cnum">${i + 1}</span>
    ${tag ? `<span class="ctag">${tag}</span>` : ''}
    ${o.rarity === 'epic' ? '<span class="crare">EPIC +2</span>' : ''}
    <img class="cic" src="${icon(ic, color, 96)}" alt="">
    <span class="cname">${name}</span><span class="cen">${en}</span>
    ${pipHtml}
    <span class="cdesc">${desc}</span>
    ${hint ? `<span class="chint">${hint}</span>` : ''}
    <span class="ccat">${cat}</span>
  </span></span>
</button>`;
    }
    levelUp(g) {
      if (!this.lu || this.lu.g !== g || !this.lu.offers) this.lu = { g, offers: g.makeOffers(), sel: 0, banish: false };
      this.lockUntil = performance.now() + 380;
      this.renderLevelUp();
      this.app.audio.play('levelup');
    }
    renderLevelUp() {
      const { g, offers, sel, banish } = this.lu;
      this.show('levelup', `
<div class="overlay lu">
  <div class="lu-head"><div class="eyebrow">LEVEL UP</div><h2>LV <b>${g.level - g.pendingLevels + 1}</b>${g.pendingLevels > 1 ? `<small>あと ${g.pendingLevels - 1} 回</small>` : ''}</h2><p>${banish ? '<span class="warn-text">除外するカードを選んでください</span>' : '強化を1つ選択'}</p></div>
  <div class="cards">${offers.map((o, i) => this.cardHtml(g, o, i, banish)).join('')}</div>
  <div class="lu-foot">
    <button data-act="reroll" ${g.rerolls > 0 ? '' : 'disabled'}>リロール ${key('R')} <b>×${g.rerolls}</b></button>
    <button data-act="banish" class="${banish ? 'sel' : ''}" ${g.banishes > 0 ? '' : 'disabled'}>除外 ${key('B')} <b>×${g.banishes}</b></button>
    <button data-act="skip" class="ghost">スキップ <small>(HP回復)</small></button>
  </div>
</div>`);
      const cards = this.screenEl.querySelectorAll('.card');
      if (cards[sel]) cards[sel].classList.add('focus');
    }
    pick(i) {
      if (!this.lu || performance.now() < this.lockUntil) return;
      const { g, offers } = this.lu;
      const o = offers[i];
      if (!o) return;
      if (this.lu.banish) {
        if (o.id[0] === '_' || UP[o.id].cat === 'evo') { this.app.audio.play('deny'); return; }
        g.banned.add(o.id);
        g.banishes--;
        this.lu.banish = false;
        const fresh = g.makeOffers().filter((x) => !offers.some((y) => y.id === x.id));
        if (fresh.length) offers[i] = fresh[0]; else offers.splice(i, 1);
        if (!offers.length) offers.push({ id: '_heal', rarity: 'common' });
        this.app.audio.play('back');
        this.lockUntil = performance.now() + 200;
        this.renderLevelUp();
        return;
      }
      g.applyOffer(o);
      g.pendingLevels--;
      this.app.audio.play('select');
      if (g.pendingLevels > 0) {
        this.lu = null;
        this.levelUp(g);
      } else {
        this.lu = null;
        this.app.closeOverlay();
      }
    }

    chest(res, g) {
      const items = res.items.map((id) => {
        if (id[0] === '_') return { name: 'リペア', ic: 'heal', color: '#3dffa0', sub: 'HP +1' };
        const u = UP[id];
        return { name: u.name, ic: u.icon, color: u.color, sub: u.cat === 'evo' ? '進化！' : CAT_LABEL[u.cat] + (u.cat === 'perk' ? '' : ` Lv ${g.lv(id)}`) };
      });
      this.show('chest', `
<div class="overlay chest">
  <div class="eyebrow">SUPPLY CRATE</div><h2>補給物資</h2>
  <div class="chest-items">${items.map((it, i) => `
    <div class="ci" id="ci-${i}" style="--c:${it.color}"><img src="${icon('chest', '#ffc23f', 96)}" alt=""><b>???</b><span></span></div>`).join('')}</div>
  <div class="chest-cores">CORE <b>+${res.cores}</b></div>
  <button class="primary" data-act="chest-ok" id="chest-ok" hidden>受け取る ${key('Enter')}</button>
</div>`);
      const pool = Object.keys(UP).filter((id) => UP[id].icon);
      this.chestAnim = { items, t: 0, done: items.map(() => false), pool, next: 0 };
      this.lockUntil = performance.now() + 300;
    }
    chestTick(dt) {
      const a = this.chestAnim;
      if (!a) return;
      a.t += dt;
      a.next -= dt;
      const spin = a.next <= 0;
      if (spin) a.next = 0.07;
      let all = true;
      a.items.forEach((it, i) => {
        if (a.done[i]) return;
        all = false;
        const el = document.getElementById('ci-' + i);
        if (!el) return;
        if (a.t >= 0.7 + i * 0.4) {
          a.done[i] = true;
          el.classList.add('land');
          el.querySelector('img').src = icon(it.ic, it.color, 96);
          el.querySelector('b').textContent = it.name;
          el.querySelector('span').textContent = it.sub;
          this.app.audio.play(it.sub === '進化！' ? 'evolve' : 'chest');
        } else if (spin) {
          const u = UP[a.pool[(Math.random() * a.pool.length) | 0]];
          el.querySelector('img').src = icon(u.icon, u.color, 96);
          this.app.audio.play('tick', i);
        }
      });
      if (all) {
        const b = document.getElementById('chest-ok');
        if (b && b.hidden) { b.hidden = false; b.focus({ preventScroll: true }); }
      }
    }

    pause(g) {
      const list = (ids, getLv) => ids.map((id) => { const u = UP[id]; return `<span class="bi" style="--c:${u.color}" title="${u.name}"><img src="${icon(u.icon, u.color, 40)}" alt=""><span>${u.name}</span><b>${getLv(id)}</b></span>`; }).join('');
      const s = g.player.stats;
      this.show('pause', `
<div class="overlay pause">
  <div class="eyebrow">PAUSED</div><h2>ポーズ</h2>
  <div class="pause-grid">
    <div class="pause-menu">
      <button class="primary" data-act="resume" data-focus>再開 ${key('Esc')}</button>
      <button data-act="pause-settings">設定</button>
      <button data-act="retire" class="ghost">撤退する</button>
      <span id="retire-confirm" hidden class="confirm">撤退して結果を確定しますか？ <button class="danger" data-act="retire-confirm">撤退</button></span>
    </div>
    <div class="build">
      <h3 class="sec">現在の構成</h3>
      <div class="build-row">${list(g.inv.weapons.map((w) => w.id), (id) => (UP[id].cat === 'evo' ? 'EVO' : 'Lv' + g.lv(id)))}</div>
      <div class="build-row">${list(Object.keys(g.inv.main), (id) => 'Lv' + g.inv.main[id])}</div>
      <div class="build-row">${list(Object.keys(g.inv.passives), (id) => 'Lv' + g.inv.passives[id])}${list(Object.keys(g.inv.perks), () => '★')}</div>
      <div class="stat-line">
        <span>火力 ×${s.dmg.toFixed(2)}</span><span>連射 ${s.rate.toFixed(1)}/秒</span><span>弾数 ${s.count}</span><span>会心 ${Math.round(s.critC * 100)}%</span><span>移動 ${Math.round(s.speed)}</span><span>範囲 ×${s.area.toFixed(1)}</span>
      </div>
      <div class="stat-line dim"><span>WAVE ${g.wave}</span><span>LV ${g.level}</span><span>撃破 ${U.fmt(g.kills)}</span><span>${U.fmtTime(g.time)}</span><span>シード ${g.seed.toString(16).toUpperCase()}</span></div>
    </div>
  </div>
</div>`);
    }

    result(res, info) {
      const won = res.won;
      const entries = Object.entries(res.dmgBy).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const max = entries.length ? entries[0][1] : 1;
      const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
      const bars = entries.map(([k, v]) => {
        const u = UP[k];
        const name = u ? u.name : SRC_NAME[k] || k;
        const color = u ? u.color : '#3ff0ff';
        return `<div class="dmg"><span class="dn">${name}</span><span class="db"><i style="width:${(v / max) * 100}%;background:${color}"></i></span><span class="dv">${Math.round((v / total) * 100)}%</span></div>`;
      }).join('');
      const achs = info.achs.map((a) => `<li>◆ ${a.name} <em>+${a.reward}</em></li>`).join('');
      this.show('result', `
<div class="overlay result ${won ? 'won' : 'lost'}">
  <div class="eyebrow">${won ? 'MISSION COMPLETE' : 'MISSION FAILED'}</div>
  <h2 class="res-title">${won ? 'RIFT SEALED' : 'SIGNAL LOST'}</h2>
  <p class="res-sub">${won ? '裂け目は閉じられた。' : res.retired ? `WAVE ${res.wave} で撤退した` : `WAVE ${res.wave} で撃墜された`}${info.newBest ? ' <span class="newbest">NEW RECORD</span>' : ''}</p>
  <div class="res-grid">
    <div class="res-main">
      <div class="res-score"><span class="lbl">SCORE</span><b id="res-score">0</b></div>
      <div class="res-stats">
        <div><span>到達</span><b>WAVE ${res.wave}</b></div>
        <div><span>時間</span><b>${U.fmtTime(res.time)}</b></div>
        <div><span>撃破</span><b>${U.fmt(res.kills)}</b></div>
        <div><span>レベル</span><b>${res.level}</b></div>
        <div><span>最大コンボ</span><b>${U.fmt(res.maxCombo)}</b></div>
        <div><span>グレイズ</span><b>${U.fmt(res.grazes)}</b></div>
        <div><span>JUST回避</span><b>${res.perfects}</b></div>
        <div><span>進化</span><b>${res.evolved.length}</b></div>
      </div>
      <div class="res-cores"><span class="lbl">獲得コア</span><b id="res-cores">+0</b><span class="dim">所持 ${U.fmt(this.app.save.data.cores)}</span></div>
      ${achs ? `<ul class="res-achs">${achs}</ul>` : ''}
      ${info.unlock ? `<div class="res-unlock">${info.unlock}</div>` : ''}
    </div>
    <div class="res-dmg"><h3 class="sec">ダメージ内訳</h3>${bars || '<p class="dim">記録なし</p>'}</div>
  </div>
  <div class="res-actions">
    ${won && res.mode !== 'endless' ? `<button class="primary" data-act="endless-continue" data-focus>エンドレスへ続行 ▶</button>` : ''}
    <button class="${won && res.mode !== 'endless' ? '' : 'primary'}" data-act="retry" ${won && res.mode !== 'endless' ? '' : 'data-focus'}>もう一度 ${key('R')}</button>
    <button data-act="result-ship">機体を変える</button>
    <button class="ghost" data-act="result-title">タイトルへ</button>
  </div>
  <p class="tip">TIP: ${D.tips[(Math.random() * D.tips.length) | 0]}</p>
</div>`);
      this.count = { score: res.score, cores: res.cores, t: 0 };
    }
    countTick(dt) {
      const c = this.count;
      if (!c) return;
      c.t += dt;
      const k = U.easeOutCubic(Math.min(1, c.t / 1.6));
      const s = document.getElementById('res-score'), co = document.getElementById('res-cores');
      if (s) s.textContent = U.fmt(c.score * k);
      if (co) co.textContent = '+' + U.fmt(c.cores * k);
      if (c.t < 1.6 && Math.random() < 0.5) this.app.audio.play('tick', Math.floor(k * 12));
      if (c.t >= 1.6) this.count = null;
    }

    // ── 操作 ──
    act(a, el) {
      const app = this.app, s = app.save.data;
      const [cmd, arg] = a.split(':');
      switch (cmd) {
        case 'play': app.audio.play('select'); this.shipSelect(arg); break;
        case 'nav':
          app.audio.play(arg === 'title' ? 'back' : 'select');
          if (arg === 'title') this.title();
          else if (arg === 'lab') this.lab();
          else if (arg === 'records') this.records();
          else if (arg === 'settings') this.settings(false);
          else if (arg === 'howto') this.howto();
          break;
        case 'ship': s.ship = arg; app.save.save(); app.audio.play('select'); this.shipSelect(this.mode); break;
        case 'risk': s.risk = +arg; app.save.save(); app.audio.play('select'); this.shipSelect(this.mode); break;
        case 'launch': app.audio.play('select'); app.launch(this.mode); break;
        case 'buy-ship': {
          const sh = D.ships[arg];
          if (s.ships[arg]) break;
          if (s.cores < sh.price) { app.audio.play('deny'); break; }
          s.cores -= sh.price; s.ships[arg] = true; s.ship = arg;
          app.save.save(); app.audio.play('buy');
          if (Object.keys(D.ships).every((id) => s.ships[id])) app.achieve('allships');
          if (this.state === 'lab') this.lab(); else this.shipSelect(this.mode);
          break;
        }
        case 'buy-meta': {
          const m = D.meta.find((x) => x.id === arg), lv = s.meta[arg] | 0;
          if (lv >= m.max) break;
          if (s.cores < m.cost[lv]) { app.audio.play('deny'); break; }
          s.cores -= m.cost[lv]; s.meta[arg] = lv + 1;
          app.save.save(); app.audio.play('buy'); this.lab();
          break;
        }
        case 'buy-weapon': {
          const cost = D.weaponUnlocks[arg];
          if (s.weapons[arg]) break;
          if (s.cores < cost) { app.audio.play('deny'); break; }
          s.cores -= cost; s.weapons[arg] = true;
          app.save.save(); app.audio.play('buy'); this.lab();
          break;
        }
        case 'pick': this.pick(+arg); break;
        case 'reroll': {
          const g = this.lu && this.lu.g;
          if (!g || g.rerolls <= 0 || performance.now() < this.lockUntil) break;
          g.rerolls--;
          this.lu.offers = g.makeOffers();
          this.lu.banish = false;
          app.audio.play('select');
          this.renderLevelUp();
          break;
        }
        case 'banish': {
          const g = this.lu && this.lu.g;
          if (!g || g.banishes <= 0) break;
          this.lu.banish = !this.lu.banish;
          app.audio.play('select');
          this.renderLevelUp();
          break;
        }
        case 'skip': {
          const g = this.lu && this.lu.g;
          if (!g || performance.now() < this.lockUntil) break;
          g.applyOffer({ id: '_heal' });
          g.pendingLevels--;
          this.lu = null;
          if (g.pendingLevels > 0) this.levelUp(g); else app.closeOverlay();
          break;
        }
        case 'chest-ok':
          if (performance.now() < this.lockUntil) break;
          this.chestAnim = null;
          app.audio.play('select');
          app.closeOverlay();
          break;
        case 'pause': app.pause(); break;
        case 'resume': app.resume(); break;
        case 'pause-settings': app.audio.play('select'); this.settings(true); break;
        case 'pause-back': app.audio.play('back'); this.pause(app.game); break;
        case 'retire': { const c = document.getElementById('retire-confirm'); if (c) c.hidden = false; break; }
        case 'retire-confirm': app.retire(); break;
        case 'retry': app.audio.play('select'); app.retry(); break;
        case 'result-ship': app.audio.play('select'); app.toTitle(); this.shipSelect(app.lastMode || 'campaign'); break;
        case 'result-title': app.audio.play('back'); app.toTitle(); break;
        case 'endless-continue': app.audio.play('select'); app.continueEndless(); break;
        case 'toggle': {
          s.settings[arg] = !s.settings[arg];
          app.applySettings();
          el.classList.toggle('on', !!s.settings[arg]);
          el.textContent = s.settings[arg] ? 'ON' : 'OFF';
          el.setAttribute('aria-pressed', String(!!s.settings[arg]));
          app.audio.play('select');
          break;
        }
        case 'touchmode':
          s.settings.touchMode = arg === 'stick' ? 'stick' : 'drag';
          app.applySettings();
          el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b === el));
          app.audio.play('select');
          break;
        case 'quality':
          s.settings.quality = arg;
          app.applySettings(true);
          el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b === el));
          app.audio.play('select');
          break;
        case 'fullscreen': app.toggleFullscreen(); break;
        case 'reset-save': { const c = document.getElementById('reset-confirm'); if (c) c.hidden = false; break; }
        case 'reset-cancel': { const c = document.getElementById('reset-confirm'); if (c) c.hidden = true; break; }
        case 'reset-confirm': app.save.reset(); app.applySettings(true); app.audio.play('back'); this.records(); break;
      }
    }
    setSetting(k, v, el) {
      const st = this.app.save.data.settings;
      st[k] = v;
      const out = document.getElementById('out-' + k);
      if (out) out.textContent = k === 'touchSens' ? '×' + v.toFixed(1) : Math.round(v * 100) + '%';
      this.app.applySettings();
    }

    // 毎フレーム: キーボード・パッドでのメニュー操作
    update(dt) {
      const app = this.app, inp = app.input;
      this.chestTick(dt);
      this.countTick(dt);
      if (app.state === 'playing') return;
      if (this.state === 'levelup' && this.lu) {
        const n = this.lu.offers.length;
        for (let i = 0; i < 4; i++) if (inp.hit('n' + (i + 1)) && i < n) { this.pick(i); return; }
        if (inp.hit('left') || inp.hit('right')) {
          this.lu.sel = (this.lu.sel + (inp.hit('left') ? n - 1 : 1)) % n;
          this.screenEl.querySelectorAll('.card').forEach((c, i) => c.classList.toggle('focus', i === this.lu.sel));
          app.audio.play('hover');
        }
        if (inp.hit('confirm') || inp.pressed.has('Space')) { this.pick(this.lu.sel); return; }
        if (inp.hit('reroll')) this.act('reroll');
        else if (inp.hit('banish')) this.act('banish');
        return;
      }
      if (this.state === 'chest') {
        if ((inp.hit('confirm') || inp.pressed.has('Space')) && this.chestAnim && this.chestAnim.done.every(Boolean)) this.act('chest-ok');
        return;
      }
      if (this.state === 'result' && inp.hit('retry')) { this.act('retry'); return; }
      if (inp.hit('fullscreen') && this.state !== 'levelup') app.toggleFullscreen();
      const scope = this.screenEl;
      const list = [...scope.querySelectorAll('button:not([disabled]):not([hidden]), input[type=range]')].filter((b) => b.offsetParent !== null);
      if (!list.length) return;
      const ae = document.activeElement;
      const onRange = ae && ae.type === 'range';
      let dir = 0;
      if (inp.hit('down') || (!onRange && inp.hit('right'))) dir = 1;
      if (inp.hit('up') || (!onRange && inp.hit('left'))) dir = -1;
      if (dir) {
        const i = list.indexOf(ae);
        const ni = i < 0 ? 0 : (i + dir + list.length) % list.length;
        list[ni].focus({ preventScroll: false });
        app.audio.play('hover');
      }
      if (inp.pressed.has('Pad0') && ae && scope.contains(ae) && ae.tagName === 'BUTTON') ae.click();
      if (inp.hit('back')) {
        if (this.state === 'pause') app.resume();
        else if (this.state === 'settings' && this.settingsFromPause) this.act('pause-back');
        else if (['ship', 'lab', 'records', 'settings', 'howto'].includes(this.state)) this.act('nav:title');
      }
    }
  }

  NR.UI = UI;
})();
