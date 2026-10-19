'use strict';
/* NEON RIFT — ゲームデータ(機体・強化・敵・ウェーブ・ラボ・実績) */
(function () {
  const NR = window.NR;

  const COL = {
    cyan: '#3ff0ff', blue: '#4d8dff', violet: '#a77bff', magenta: '#ff3fa4', pink: '#ff5fd2',
    red: '#ff4058', orange: '#ff9a3c', amber: '#ffc23f', yellow: '#ffe14d', lime: '#8dff6a',
    green: '#3dffa0', teal: '#2ef2d0', white: '#e8f0ff', ice: '#9fdcff',
  };

  const ships = {
    vanguard: {
      name: 'ヴァンガード', en: 'VANGUARD', color: COL.cyan, sprite: 'ship_vanguard', price: 0,
      desc: '癖のない標準機。どんな構成にも合わせられる。',
      hp: 5, speed: 1.0, dash: 1.0, cd: 1.0,
      gun: { rate: 7, dmg: 10, speed: 950, r: 5, life: 0.95, count: 1, spread: 0, pierce: 0, jitter: 0.02 },
      start: [], trait: '特性なし',
    },
    specter: {
      name: 'スペクター', en: 'SPECTER', color: COL.violet, sprite: 'ship_specter', price: 400,
      desc: '貫通する高速の針弾と短いダッシュ間隔。打たれ弱いが速い。',
      hp: 3, speed: 1.18, dash: 0.62, cd: 1.0,
      gun: { rate: 10, dmg: 7.5, speed: 1250, r: 4, life: 0.8, count: 1, spread: 0, pierce: 1, jitter: 0.015 },
      start: [], trait: '弾が1体貫通・ダッシュ間隔 -38%',
    },
    bastion: {
      name: 'バスティオン', en: 'BASTION', color: COL.amber, sprite: 'ship_bastion', price: 700,
      desc: '散弾と回転刃、バリアを備えた重装機。近距離で真価を発揮する。',
      hp: 7, speed: 0.88, dash: 1.2, cd: 1.0,
      gun: { rate: 2.7, dmg: 9, speed: 840, r: 5.5, life: 0.45, count: 5, spread: 0.55, pierce: 0, jitter: 0.05, speedVar: 0.18 },
      start: [['orbit', 1], ['barrier', 1]], trait: '散弾・オービタルとバリアで開始',
    },
    oracle: {
      name: 'オラクル', en: 'ORACLE', color: COL.green, sprite: 'ship_oracle', price: 1000,
      desc: 'ドローンと雷撃で戦う支援機。メイン武装は控えめ。',
      hp: 4, speed: 1.0, dash: 1.0, cd: 0.85,
      gun: { rate: 6, dmg: 7, speed: 900, r: 4.5, life: 0.9, count: 1, spread: 0, pierce: 0, jitter: 0.02 },
      start: [['drone', 1], ['arc', 1]], trait: 'サブ武装の間隔 -15%・2武装で開始',
    },
  };

  const UP = {};
  const def = (id, o) => { UP[id] = Object.assign({ id, max: 1, color: COL.cyan }, o); };
  const lvText = (arr) => (lv) => arr[Math.min(arr.length, lv) - 1];

  // ── メイン武装の改造 ──
  def('rapid', { cat: 'main', name: 'ラピッドファイア', en: 'RAPID FIRE', icon: 'rapid', max: 5, desc: () => '連射速度 +12%' });
  def('multi', { cat: 'main', name: 'マルチショット', en: 'MULTI SHOT', icon: 'multi', max: 4, desc: () => '同時に撃つ弾 +1(1発の威力 -6%)' });
  def('pierce', { cat: 'main', name: 'ピアシング', en: 'PIERCING', icon: 'pierce', max: 3, desc: () => '弾が敵を1体多く貫通' });
  def('caliber', { cat: 'main', name: 'ヘビーキャリバー', en: 'HEAVY CALIBER', icon: 'caliber', max: 5, desc: () => '弾のダメージ +16%・大きさ +12%' });
  def('ricochet', { cat: 'main', name: 'リコシェ', en: 'RICOCHET', icon: 'ricochet', max: 3, desc: () => '命中後に別の敵へ跳弾 +1回(壁でも跳ねる)' });
  def('homing', { cat: 'main', name: 'シーカー弾頭', en: 'HOMING ROUNDS', icon: 'homing', max: 3, desc: lvText(['弾がゆるやかに敵を追う', '追尾力アップ', '強力に追尾する']) });
  def('tail', { cat: 'main', name: 'テイルガン', en: 'TAIL GUN', icon: 'tail', max: 3, desc: lvText(['真後ろにも撃つ', '斜め後ろに2発追加', '真横に2発追加']) });

  // ── サブ武装 ──
  def('orbit', { cat: 'weapon', name: 'オービタル', en: 'ORBITAL', icon: 'orbit', color: COL.ice, max: 5, evo: 'saturn',
    desc: lvText(['回転する刃が周囲を守る(2枚)', '刃 +1枚', 'ダメージ・半径アップ', '刃 +1枚', '刃 +1枚・高速回転']) });
  def('missile', { cat: 'weapon', name: 'シーカー', en: 'SEEKER', icon: 'missile', color: COL.orange, max: 5, evo: 'barrage',
    desc: lvText(['追尾ミサイルを発射する', 'ミサイル +1', 'ダメージ・爆発範囲アップ', 'ミサイル +1・間隔短縮', 'ミサイル +1・ダメージアップ']) });
  def('arc', { cat: 'weapon', name: 'アークボルト', en: 'ARC BOLT', icon: 'arc', color: COL.blue, max: 5, evo: 'mjolnir',
    desc: lvText(['近くの敵に連鎖する雷撃(4体)', '連鎖 +1体', 'ダメージアップ・間隔短縮', '雷撃 +1本', '連鎖 +2体・ダメージアップ']) });
  def('drone', { cat: 'weapon', name: 'ウィングマン', en: 'WINGMAN', icon: 'drone', color: COL.green, max: 5, evo: 'hive',
    desc: lvText(['自動で撃つドローンが随伴する', 'ドローン +1機', '連射・ダメージアップ', 'ドローン +1機', 'ドローン +1機・弾が貫通']) });
  def('lance', { cat: 'weapon', name: 'ランス', en: 'LANCE', icon: 'lance', color: COL.pink, max: 5, evo: 'annihilator',
    desc: lvText(['照準方向へ貫通レーザーを放つ', 'ダメージアップ', '太さアップ・間隔短縮', 'レーザー +1本', 'ダメージ・太さアップ']) });
  def('nova', { cat: 'weapon', name: 'パルスノヴァ', en: 'PULSE NOVA', icon: 'nova', color: COL.teal, max: 5, evo: 'supernova',
    desc: lvText(['周囲に衝撃波を放ち敵を押し返す', '範囲・ダメージアップ', '衝撃波が敵弾を消す', '間隔短縮・ダメージアップ', '範囲・ダメージ大幅アップ']) });
  def('mine', { cat: 'weapon', name: 'グラビティマイン', en: 'GRAVITY MINE', icon: 'mine', color: COL.yellow, max: 5, evo: 'cluster', locked: true,
    desc: lvText(['足元に機雷を設置する', 'ダメージアップ', '2個ずつ設置', '範囲アップ・間隔短縮', '爆発前に敵を吸い寄せる']) });
  def('glaive', { cat: 'weapon', name: 'グレイブ', en: 'GLAIVE', icon: 'glaive', color: COL.lime, max: 5, evo: 'eclipse', locked: true,
    desc: lvText(['戻ってくる円盤を投げる', '円盤 +1枚', 'ダメージ・射程アップ', '円盤 +1枚', '円盤が大型化・ダメージアップ']) });
  def('void', { cat: 'weapon', name: 'シンギュラリティ', en: 'SINGULARITY', icon: 'void', color: COL.violet, max: 5, evo: 'horizon', locked: true,
    desc: lvText(['敵の密集地に小型ブラックホールを生む', '吸引範囲アップ', '持続・ダメージアップ', '間隔短縮', '消滅時に大爆発']) });
  def('flare', { cat: 'weapon', name: 'プラズマフレア', en: 'PLASMA FLARE', icon: 'flare', color: COL.orange, max: 5, evo: 'phoenix', locked: true,
    desc: lvText(['照準方向へ炎を噴射し燃焼させる', '射程アップ', 'ダメージ・燃焼アップ', '噴射角拡大・間隔短縮', '射程・ダメージ大幅アップ']) });

  // ── パッシブ ──
  const pas = (id, name, en, icon, color, desc) => def(id, { cat: 'passive', name, en, icon, color, max: 5, desc: typeof desc === 'string' ? () => desc : desc });
  pas('power', 'パワーコア', 'POWER CORE', 'power', COL.red, '全ダメージ +10%');
  pas('overclock', 'オーバークロック', 'OVERCLOCK', 'clock', COL.amber, 'サブ武装とダッシュの間隔 -8%');
  pas('thruster', 'スラスター', 'THRUSTER', 'thruster', COL.cyan, '移動速度 +8%');
  pas('hull', '装甲板', 'HULL PLATING', 'hull', COL.green, '最大HP +1(1回復)');
  pas('magnet', 'マグネット', 'MAGNET', 'magnet', COL.blue, '回収範囲 +30%');
  pas('area', 'エリア拡張', 'AREA', 'area', COL.teal, '効果範囲 +10%');
  pas('duration', '持続強化', 'DURATION', 'duration', COL.violet, '効果時間・射程 +12%');
  pas('crit', 'クリティカル', 'CRITICAL', 'crit', COL.yellow, '会心率 +5%・会心ダメージ +15%');
  pas('luck', 'ラッキー', 'LUCK', 'luck', COL.lime, 'レア強化とアイテムが出やすくなる');
  pas('growth', 'グロウス', 'GROWTH', 'growth', COL.green, '獲得経験値 +8%');
  pas('regen', 'リジェネ', 'REGEN', 'regen', COL.pink, (lv) => `${[45, 40, 35, 30, 25][lv - 1]}秒ごとにHPを1回復`);
  pas('barrier', 'バリア', 'BARRIER', 'barrier', COL.ice, (lv) => `被弾を1回防ぐバリア(再生 ${[30, 26, 22, 18, 14][lv - 1]}秒)`);

  // ── 進化 ──
  const evo = (id, from, need, name, en, desc, color) => def(id, { cat: 'evo', from, need, name, en, icon: UP[from].icon, color, desc: () => desc });
  evo('saturn', 'orbit', 'area', 'サターンリング', 'SATURN RING', '8枚の刃と逆回転の内輪。刃は敵弾も消す', COL.ice);
  evo('barrage', 'missile', 'power', 'ストームバラージュ', 'STORM BARRAGE', '12発のミサイルを一斉に放つ', COL.orange);
  evo('mjolnir', 'arc', 'crit', 'ミョルニル', 'MJOLNIR', '絶え間ない落雷が敵を焼き尽くす', COL.blue);
  evo('hive', 'drone', 'overclock', 'ハイヴフリート', 'HIVE FLEET', '6機の高速連射ドローン。弾は2体貫通', COL.green);
  evo('annihilator', 'lance', 'duration', 'アナイアレイター', 'ANNIHILATOR', '照準に追従する極太レーザーを照射し続ける', COL.pink);
  evo('supernova', 'nova', 'barrier', 'スーパーノヴァ', 'SUPERNOVA', '巨大な二重衝撃波。敵弾を消し、敵を鈍らせる', COL.teal);
  evo('cluster', 'mine', 'magnet', 'クラスターフィールド', 'CLUSTER FIELD', '機雷が爆発時に子爆弾をばら撒く', COL.yellow);
  evo('eclipse', 'glaive', 'thruster', 'エクリプス', 'ECLIPSE', '巨大な円盤4枚が螺旋を描き敵弾も切り裂く', COL.lime);
  evo('horizon', 'void', 'growth', 'イベントホライズン', 'EVENT HORIZON', '巨大ブラックホール2つ。吸い込んだ敵の経験値 +50%', COL.violet);
  evo('phoenix', 'flare', 'regen', 'フェニックス', 'PHOENIX', '3方向の炎が回転し、燃えた敵は爆発する', COL.orange);

  // ── レジェンダリー(1回限り) ──
  const perk = (id, name, en, icon, desc) => def(id, { cat: 'perk', name, en, icon, color: COL.amber, max: 1, desc: () => desc });
  perk('glass', 'ガラスの大砲', 'GLASS CANNON', 'glass', '全ダメージ ×1.6。ただし最大HP -2');
  perk('secondwind', 'セカンドウィンド', 'SECOND WIND', 'wind', '1度だけ致命傷を耐え、衝撃波を放つ');
  perk('bloodlust', 'ブラッドラスト', 'BLOODLUST', 'blood', '敵を150体倒すごとにHPを1回復');
  perk('timewarp', 'タイムワープ', 'TIME WARP', 'warp', 'ダッシュ間隔 -30%。ダッシュ直後に時間が遅くなる');
  perk('odplus', 'ツインドライブ', 'TWIN DRIVE', 'twin', 'オーバードライブの溜まりが2倍・効果 +3秒');
  perk('fragment', 'フラグメント', 'FRAGMENT', 'fragment', '倒した敵が4つの破片弾をまき散らす');
  perk('goldrush', 'ゴールドラッシュ', 'GOLD RUSH', 'gold', '経験値 ×1.4・コア獲得 +50%');
  perk('phantom', 'ファントム', 'PHANTOM', 'phantom', 'ダッシュの軌跡が敵を切り裂く・無敵時間 +0.5秒');

  // ── 敵 ──
  const enemies = {
    wanderer: { name: 'ワンダラー', hp: 10, r: 14, speed: 70, xp: 1, score: 50, color: '#b26bff', sprite: 'pinwheel' },
    chaser: { name: 'チェイサー', hp: 12, r: 13, speed: 125, xp: 1, score: 60, color: '#3fa9ff', sprite: 'diamond' },
    swarmer: { name: 'スウォーマー', hp: 5, r: 9, speed: 215, xp: 1, score: 40, color: '#ff9a3c', sprite: 'tri' },
    dasher: { name: 'ダッシャー', hp: 22, r: 15, speed: 95, xp: 2, score: 120, color: '#ff4058', sprite: 'arrow' },
    gunner: { name: 'ガンナー', hp: 26, r: 16, speed: 105, xp: 2, score: 150, color: '#ffd23f', sprite: 'hex' },
    splitter: { name: 'スプリッター', hp: 30, r: 18, speed: 85, xp: 2, score: 150, color: '#8dff6a', sprite: 'square' },
    mini: { name: 'ミニ', hp: 8, r: 10, speed: 165, xp: 1, score: 30, color: '#8dff6a', sprite: 'square' },
    spinner: { name: 'スピナー', hp: 42, r: 18, speed: 40, xp: 3, score: 200, color: '#2ef2d0', sprite: 'star' },
    shield: { name: 'シールド兵', hp: 52, r: 18, speed: 82, xp: 3, score: 220, color: '#d9e4ff', sprite: 'shieldship' },
    bomber: { name: 'ボマー', hp: 18, r: 15, speed: 150, xp: 2, score: 160, color: '#ff6a3a', sprite: 'spike' },
    serpent: { name: 'サーペント', hp: 80, r: 16, speed: 165, xp: 6, score: 400, color: '#ff4fd8', sprite: 'serpHead' },
    segment: { name: '体節', hp: 22, r: 12, speed: 0, xp: 1, score: 40, color: '#ff4fd8', sprite: 'seg' },
    blinker: { name: 'ブリンカー', hp: 36, r: 14, speed: 0, xp: 3, score: 240, color: '#9d7bff', sprite: 'tri2' },
    mender: { name: 'メンダー', hp: 46, r: 16, speed: 70, xp: 4, score: 300, color: '#6dffb3', sprite: 'cross' },
    voidling: { name: 'ヴォイドリング', hp: 130, r: 22, speed: 30, xp: 8, score: 500, color: '#c04bff', sprite: 'voidring' },
    // ボスと部位
    aegis: { name: 'イージス・コア', en: 'AEGIS CORE', hp: 7000, r: 48, speed: 0, xp: 120, score: 50000, color: '#3fd8ff', sprite: 'aegis', boss: 1 },
    plate: { name: '防壁', hp: 480, r: 20, speed: 0, xp: 4, score: 1000, color: '#9fdcff', sprite: 'plate', part: 1 },
    leviathan: { name: 'リヴァイアサン', en: 'LEVIATHAN', hp: 40000, r: 40, speed: 0, xp: 260, score: 100000, color: '#ff4fd8', sprite: 'leviHead', boss: 2 },
    leviseg: { name: '体節', hp: 1300, r: 24, speed: 0, xp: 3, score: 1500, color: '#ff7ae0', sprite: 'leviSeg', part: 1 },
    hive: { name: 'ハイヴ・クイーン', en: 'HIVE QUEEN', hp: 120000, r: 74, speed: 0, xp: 420, score: 150000, color: '#ffb23f', sprite: 'hive', boss: 3 },
    turret: { name: '砲台', hp: 7500, r: 22, speed: 0, xp: 10, score: 4000, color: '#ffd23f', sprite: 'turret', part: 1 },
    null: { name: 'ヌル・シンギュラリティ', en: 'NULL SINGULARITY', hp: 260000, r: 66, speed: 0, xp: 800, score: 300000, color: '#c04bff', sprite: 'nullCore', boss: 4 },
    sat: { name: '衛星', hp: 6500, r: 18, speed: 0, xp: 10, score: 5000, color: '#e08bff', sprite: 'sat', part: 1 },
    hmine: { name: '機雷', hp: 60, r: 12, speed: 0, xp: 1, score: 100, color: '#ffc23f', sprite: 'mine' },
  };

  const BOSS_ORDER = ['aegis', 'leviathan', 'hive', 'null'];
  // キャンペーンは10ウェーブ。5ウェーブ目は3体からランダムな中ボス、10ウェーブ目は最終ボス
  const CAMPAIGN_WAVES = 10;
  const MID_BOSSES = ['aegis', 'leviathan', 'hive'];
  // キャンペーンでのボス体力の倍率(エンドレスの体力に掛ける)。中ボス3体は同じくらいの長さで倒せるように揃える
  const CAMPAIGN_BOSS_HP = { aegis: 1, leviathan: 0.18, hive: 0.09, null: 0.28 };
  // [種類, エンドレスで出始めるウェーブ, キャンペーンで出始めるウェーブ, 出現の重み]
  const UNLOCK = [
    ['wanderer', 1, 1, (w) => (w <= 2 ? 5 : 1.6)],
    ['chaser', 1, 1, () => 5],
    ['swarmer', 2, 2, () => 3],
    ['dasher', 3, 3, () => 2.2],
    ['gunner', 3, 3, (w) => 1.4 + Math.min(w, 20) * 0.04],
    ['splitter', 4, 4, () => 2],
    ['spinner', 6, 6, () => 1.3],
    ['shield', 7, 6, () => 1.5],
    ['bomber', 8, 7, () => 1.8],
    ['serpent', 9, 7, () => 0.45],
    ['blinker', 11, 8, () => 1.3],
    ['mender', 12, 8, () => 0.55],
    ['voidling', 13, 9, () => 0.32],
  ];

  function waveConfig(w, risk, mode, midBoss) {
    const camp = mode !== 'endless';
    let boss = null;
    if (camp) boss = w === 5 ? midBoss || 'aegis' : w === CAMPAIGN_WAVES ? 'null' : null;
    else boss = w % 5 === 0 ? BOSS_ORDER[(w / 5 - 1) % 4] : null;
    const cycle = Math.floor((w - 1) / 20);
    const pool = [];
    for (const [type, fromE, fromC, wf] of UNLOCK) if (w >= (camp ? fromC : fromE)) pool.push({ type, w: wf(w) });
    const countMult = risk >= 3 ? 1.2 : 1;
    return {
      wave: w,
      boss,
      cycle,
      duration: boss ? 0 : w <= 3 ? 24 : 28,
      rate: Math.min(1.6 + 0.42 * w, 11) * countMult,
      maxAlive: Math.min(80 + 14 * w, 400),
      pool,
      elite: w < 3 ? 0 : Math.min(0.012 + 0.0035 * w, 0.08) * (risk >= 3 ? 2 : 1),
      formations: w >= 2,
    };
  }
  const hpMult = (w) => 1 + 0.25 * (w - 1) + 0.03 * (w - 1) * (w - 1);
  const xpFor = (lv) => Math.round(6 + 4.5 * (lv - 1) + 0.7 * (lv - 1) * (lv - 1));

  const meta = [
    { id: 'hull', name: '強化装甲', desc: '最大HP +1', max: 3, cost: [120, 300, 600], icon: 'hull', color: COL.green },
    { id: 'power', name: '火力増強', desc: '全ダメージ +5%', max: 5, cost: [60, 120, 200, 320, 480], icon: 'power', color: COL.red },
    { id: 'rate', name: '連射機構', desc: '連射速度 +4%', max: 5, cost: [60, 120, 200, 320, 480], icon: 'rapid', color: COL.cyan },
    { id: 'speed', name: '推進器', desc: '移動速度 +4%', max: 3, cost: [80, 180, 360], icon: 'thruster', color: COL.cyan },
    { id: 'magnet', name: '回収装置', desc: '回収範囲 +20%', max: 3, cost: [50, 120, 250], icon: 'magnet', color: COL.blue },
    { id: 'growth', name: '学習回路', desc: '獲得経験値 +6%', max: 5, cost: [80, 160, 280, 420, 600], icon: 'growth', color: COL.green },
    { id: 'luck', name: '幸運の護符', desc: 'ラッキー +1', max: 3, cost: [150, 350, 700], icon: 'luck', color: COL.lime },
    { id: 'reroll', name: 'リロール', desc: 'リロール回数 +1', max: 3, cost: [100, 250, 500], icon: 'reroll', color: COL.amber },
    { id: 'banish', name: '除外', desc: '除外回数 +1', max: 3, cost: [100, 250, 500], icon: 'banish', color: COL.magenta },
    { id: 'od', name: 'ドライブ炉', desc: 'オーバードライブ +25%で開始', max: 3, cost: [100, 220, 400], icon: 'twin', color: COL.amber },
    { id: 'dash', name: 'ブースター', desc: 'ダッシュ間隔 -10%', max: 2, cost: [150, 400], icon: 'warp', color: COL.violet },
    { id: 'revive', name: '緊急再起動', desc: '1度だけHP半分で復活', max: 1, cost: [1200], icon: 'wind', color: COL.pink },
  ];
  const weaponUnlocks = { mine: 250, glaive: 350, flare: 450, void: 500 };

  const risks = [
    { name: '標準', desc: '通常の難易度' },
    { name: 'RISK 1', desc: '敵のHP +25%' },
    { name: 'RISK 2', desc: '敵と敵弾の速度 +12%' },
    { name: 'RISK 3', desc: '敵の数 +20%・精鋭が2倍' },
    { name: 'RISK 4', desc: '回復アイテムが半減' },
    { name: 'RISK 5', desc: 'ボスHP +40%・最大HP -1' },
  ];

  const achievements = [
    { id: 'firstrun', name: '初陣', desc: '初めての出撃を終える', reward: 20 },
    { id: 'wave5', name: '防衛線', desc: 'ウェーブ5に到達', reward: 30 },
    { id: 'wave10', name: '深層', desc: 'ウェーブ10に到達', reward: 60 },
    { id: 'wave15', name: '臨界', desc: 'ウェーブ15に到達', reward: 100 },
    { id: 'clear', name: 'リフト封鎖', desc: 'キャンペーンをクリア', reward: 250 },
    { id: 'boss_aegis', name: '盾砕き', desc: 'イージス・コアを撃破', reward: 40 },
    { id: 'boss_leviathan', name: '竜殺し', desc: 'リヴァイアサンを撃破', reward: 70 },
    { id: 'boss_hive', name: '女王の最期', desc: 'ハイヴ・クイーンを撃破', reward: 100 },
    { id: 'boss_null', name: '特異点の向こう', desc: 'ヌル・シンギュラリティを撃破', reward: 150 },
    { id: 'evolve', name: '進化', desc: '武器を進化させる', reward: 60 },
    { id: 'evolve5', name: '進化の系譜', desc: '5種類の進化武器を手に入れる', reward: 150 },
    { id: 'combo100', name: '連鎖', desc: '100コンボを達成', reward: 30 },
    { id: 'combo500', name: '止まらない', desc: '500コンボを達成', reward: 100 },
    { id: 'kills1000', name: '殲滅者', desc: '1回の出撃で1000体撃破', reward: 60 },
    { id: 'kills10000', name: '伝説', desc: '累計10000体撃破', reward: 120 },
    { id: 'nohitboss', name: '無傷の勝利', desc: 'ボス戦をノーダメージで制する', reward: 100 },
    { id: 'graze300', name: '紙一重', desc: '1回の出撃で300回グレイズ', reward: 50 },
    { id: 'perfect30', name: '見切り', desc: '1回の出撃でジャスト回避30回', reward: 50 },
    { id: 'level30', name: '限界突破', desc: 'レベル30に到達', reward: 60 },
    { id: 'score1m', name: 'ミリオン', desc: 'スコア1,000,000を達成', reward: 150 },
    { id: 'endless30', name: '果てなき戦い', desc: 'エンドレスでウェーブ30に到達', reward: 200 },
    { id: 'risk5', name: '命知らず', desc: 'RISK 5でキャンペーンをクリア', reward: 500 },
    { id: 'allships', name: '艦隊司令', desc: '全機体を解放', reward: 100 },
  ];

  const dailyMods = [
    { id: 'fastbullets', name: '高速弾幕', desc: '敵弾の速度 +30%' },
    { id: 'xpboost', name: '学習加速', desc: '獲得経験値 +50%' },
    { id: 'onehp', name: '一撃必殺', desc: '最大HP 1・スコア ×2.5' },
    { id: 'swarm', name: '大群', desc: '敵の数 +40%' },
    { id: 'elite', name: '精鋭部隊', desc: '精鋭の出現率 3倍' },
    { id: 'arsenal', name: '武器庫', desc: 'ランダムなサブ武装2つで開始' },
    { id: 'glassall', name: '捨て身', desc: 'ガラスの大砲を所持して開始' },
    { id: 'lucky', name: '大吉', desc: 'ラッキー +3' },
  ];

  const tips = [
    'ダッシュ中は無敵。被弾の瞬間にダッシュすると「ジャスト回避」でスローになり、ドライブが大きく溜まる。',
    '敵弾をかすめる(グレイズ)とオーバードライブが溜まる。満タンになったら E キーかホイールクリックで発動。',
    'サブ武装をLv5にして、対応するパッシブを持っていると「進化」が選択肢に出る。',
    'シールド兵は正面の弾を防ぐ。回り込むか、範囲攻撃で倒そう。',
    'ボマーは倒すと周囲の敵を巻き込んで爆発する。群れの中で倒すと気持ちいい。',
    '金色に光る精鋭を倒すと宝箱を落とす。宝箱からは進化も出る。',
    'コンボを繋ぐとスコア倍率が上がる。被弾するとリセットされる。',
    'ラボで買った永久強化は次の出撃から有効になる。',
    'ヴォイドリングは自機と弾を引き寄せる。近づきすぎに注意。',
    'リロールで選択肢を引き直し、除外でその強化を今回の出撃から消せる。',
    'メンダーは周囲の敵を回復する。最優先で倒そう。',
    'オーバードライブ中は敵の動きが遅くなり、スコアが2倍になる。',
  ];

  NR.COL = COL;
  NR.DATA = {
    ARENA: { w: 2400, h: 1600 },
    ships, UP, enemies, BOSS_ORDER, CAMPAIGN_WAVES, MID_BOSSES, CAMPAIGN_BOSS_HP, waveConfig, hpMult, xpFor,
    meta, weaponUnlocks, risks, achievements, dailyMods, tips,
  };
})();
