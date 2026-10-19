'use strict';
/* NEON RIFT — 強化アイコン(Canvas2Dで描いてdata URLとして使い回す) */
(function () {
  const NR = window.NR;
  const TAU = Math.PI * 2;
  const cache = new Map();

  function L(c, pts, close) {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    if (close) c.closePath();
    c.stroke();
  }
  function O(c, x, y, r, fill) {
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    if (fill) c.fill(); else c.stroke();
  }
  function A(c, x, y, r, a0, a1) { c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); }
  function F(c, pts) {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
    c.fill();
  }
  function arrowHead(c, x, y, ang, s = 7) {
    F(c, [x + Math.cos(ang) * s, y + Math.sin(ang) * s, x + Math.cos(ang + 2.5) * s, y + Math.sin(ang + 2.5) * s, x + Math.cos(ang - 2.5) * s, y + Math.sin(ang - 2.5) * s]);
  }
  function ngon(n, r, rot = 0) {
    const a = [];
    for (let i = 0; i < n; i++) { const t = rot + (i * TAU) / n; a.push(Math.cos(t) * r, Math.sin(t) * r); }
    return a;
  }
  function star(n, r1, r2, rot = -Math.PI / 2) {
    const a = [];
    for (let i = 0; i < n * 2; i++) { const t = rot + (i * Math.PI) / n, r = i % 2 ? r2 : r1; a.push(Math.cos(t) * r, Math.sin(t) * r); }
    return a;
  }

  const DRAW = {
    rapid(c) { for (let i = -1; i <= 1; i++) { L(c, [-16 + i * 4, i * 11, 10 + i * 4, i * 11]); arrowHead(c, 16 + i * 4, i * 11, 0, 6); } },
    multi(c) { for (const a of [-0.5, 0, 0.5]) { const x = Math.sin(a) * 26, y = 16 - Math.cos(a) * 34; L(c, [0, 16, x, y]); O(c, x, y, 3.5, true); } },
    pierce(c) { O(c, 2, 0, 10); L(c, [-24, 0, 20, 0]); arrowHead(c, 25, 0, 0, 8); },
    caliber(c) { L(c, [-18, -9, 6, -9, 20, 0, 6, 9, -18, 9], true); L(c, [-10, -9, -10, 9]); },
    ricochet(c) { L(c, [-22, -14, -8, 14, 6, -12, 18, 8]); arrowHead(c, 21, 13, 1.0, 7); },
    homing(c) { O(c, 14, -12, 7); A(c, -4, 6, 18, Math.PI * 0.95, Math.PI * 1.75); arrowHead(c, 9, -9, -0.6, 7); },
    tail(c) { L(c, [-6, 0, 22, 0]); arrowHead(c, 24, 0, 0, 7); L(c, [6, 8, -18, 8]); arrowHead(c, -20, 8, Math.PI, 6); L(c, [6, -8, -18, -8]); arrowHead(c, -20, -8, Math.PI, 6); },
    orbit(c) { c.globalAlpha = 0.5; O(c, 0, 0, 18); c.globalAlpha = 1; O(c, 0, 0, 4, true); F(c, [18, -8, 23, 0, 18, 8, 13, 0]); F(c, [-18, -8, -13, 0, -18, 8, -23, 0]); },
    missile(c) { c.save(); c.rotate(-0.7); L(c, [-14, -5, 8, -5, 18, 0, 8, 5, -14, 5], true); L(c, [-14, -5, -20, -10]); L(c, [-14, 5, -20, 10]); c.globalAlpha = 0.6; L(c, [-22, 0, -30, 0]); c.restore(); },
    arc(c) { L(c, [6, -24, -8, -2, 4, -2, -6, 24]); },
    drone(c) { c.globalAlpha = 0.45; O(c, 0, 0, 20); c.globalAlpha = 1; L(c, [12, 0, -8, -9, -4, 0, -8, 9], true); O(c, 0, -20, 3, true); O(c, 0, 20, 3, true); },
    lance(c) { O(c, -18, 0, 6); c.lineWidth = 6; c.globalAlpha = 0.35; L(c, [-12, 0, 24, 0]); c.globalAlpha = 1; c.lineWidth = 2.4; L(c, [-12, 0, 24, 0]); },
    nova(c) { O(c, 0, 0, 5, true); c.globalAlpha = 0.85; O(c, 0, 0, 13); c.globalAlpha = 0.5; O(c, 0, 0, 21); c.globalAlpha = 1; },
    mine(c) { O(c, 0, 0, 11); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; L(c, [Math.cos(a) * 11, Math.sin(a) * 11, Math.cos(a) * 18, Math.sin(a) * 18]); } O(c, 0, 0, 3, true); },
    glaive(c) { L(c, star(4, 22, 7, 0.3), true); O(c, 0, 0, 4); },
    void(c) { O(c, 0, 0, 6, true); for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3; A(c, 0, 0, 14 + i * 2, a, a + 1.8); } c.globalAlpha = 0.5; O(c, 0, 0, 23); c.globalAlpha = 1; },
    flare(c) { c.beginPath(); c.moveTo(0, 22); c.bezierCurveTo(-18, 10, -10, -6, -2, -22); c.bezierCurveTo(2, -10, 18, -4, 14, 10); c.bezierCurveTo(12, 18, 6, 22, 0, 22); c.stroke(); c.beginPath(); c.moveTo(0, 18); c.bezierCurveTo(-8, 10, -4, 2, 0, -6); c.bezierCurveTo(4, 2, 8, 10, 0, 18); c.stroke(); },
    power(c) { L(c, ngon(6, 21, Math.PI / 6), true); L(c, [3, -13, -6, 2, 2, 2, -3, 14]); },
    clock(c) { O(c, 0, 0, 19); L(c, [0, 0, 0, -12]); L(c, [0, 0, 9, 4]); for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4; L(c, [Math.cos(a) * 15, Math.sin(a) * 15, Math.cos(a) * 19, Math.sin(a) * 19]); } },
    thruster(c) { L(c, [-12, -14, 0, 0, -12, 14]); L(c, [2, -14, 14, 0, 2, 14]); c.globalAlpha = 0.5; L(c, [-24, -6, -16, -6]); L(c, [-24, 6, -16, 6]); c.globalAlpha = 1; },
    hull(c) { L(c, [0, -21, 17, -14, 15, 6, 0, 21, -15, 6, -17, -14], true); L(c, [0, -9, 0, 9]); L(c, [-8, 0, 8, 0]); },
    magnet(c) { c.lineWidth = 5; c.beginPath(); c.arc(0, -2, 13, Math.PI, 0); c.lineTo(13, 16); c.moveTo(-13, -2); c.lineTo(-13, 16); c.stroke(); },
    area(c) { L(c, [-8, -8, 8, -8, 8, 8, -8, 8], true); for (const [x, y, a] of [[-14, -14, -2.36], [14, -14, -0.79], [14, 14, 0.79], [-14, 14, 2.36]]) { L(c, [x * 0.6, y * 0.6, x, y]); arrowHead(c, x + Math.cos(a) * 3, y + Math.sin(a) * 3, a, 6); } },
    duration(c) { L(c, [-12, -20, 12, -20, -12, 20, 12, 20], true); c.globalAlpha = 0.6; F(c, [-6, 14, 6, 14, 0, 6]); c.globalAlpha = 1; },
    crit(c) { O(c, 0, 0, 15); for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4; L(c, [Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a) * 22, Math.sin(a) * 22]); } O(c, 0, 0, 3.5, true); },
    luck(c) { L(c, star(4, 20, 6), true); c.globalAlpha = 0.7; L(c, star(4, 8, 2.5, -Math.PI / 2).map((v, i) => v + (i % 2 ? -14 : 15)), true); c.globalAlpha = 1; },
    growth(c) { L(c, [-18, 18, -18, 8]); L(c, [-6, 18, -6, 0]); L(c, [6, 18, 6, -6]); L(c, [-20, -2, 2, -16, 18, -20]); arrowHead(c, 20, -20, -0.2, 7); },
    regen(c) { c.beginPath(); c.moveTo(0, 18); c.bezierCurveTo(-24, 2, -16, -20, 0, -8); c.bezierCurveTo(16, -20, 24, 2, 0, 18); c.stroke(); L(c, [0, -4, 0, 8]); L(c, [-6, 2, 6, 2]); },
    barrier(c) { O(c, 0, 0, 20); c.globalAlpha = 0.6; A(c, 0, 0, 14, -2.6, -1.2); c.globalAlpha = 1; O(c, 0, 0, 4, true); },
    glass(c) { L(c, [0, -22, 16, 0, 0, 22, -16, 0], true); L(c, [-4, -12, 2, -2, -3, 6, 4, 14]); },
    wind(c) { A(c, -4, 0, 12, Math.PI * 1.1, Math.PI * 2.1); L(c, [8, 0, 22, 0]); A(c, 6, -12, 6, Math.PI * 0.9, Math.PI * 2.3); L(c, [-22, 10, 12, 10]); A(c, 12, 16, 6, -Math.PI * 0.5, Math.PI * 0.6); },
    blood(c) { c.beginPath(); c.moveTo(0, -22); c.bezierCurveTo(10, -8, 16, 2, 14, 10); c.bezierCurveTo(12, 20, -12, 20, -14, 10); c.bezierCurveTo(-16, 2, -10, -8, 0, -22); c.stroke(); },
    warp(c) { O(c, 0, 0, 16); L(c, [0, 0, 0, -10]); L(c, [0, 0, 7, 0]); c.globalAlpha = 0.5; A(c, 0, 0, 22, -0.4, 1.2); A(c, 0, 0, 22, 2.7, 4.3); c.globalAlpha = 1; },
    twin(c) { O(c, -7, 0, 13); O(c, 7, 0, 13); L(c, [3, -10, -3, 1, 3, 1, -3, 12]); },
    fragment(c) { O(c, 0, 0, 5, true); for (let i = 0; i < 4; i++) { c.save(); c.rotate((i * TAU) / 4 + 0.4); F(c, [20, 0, 12, -4, 12, 4]); c.restore(); } },
    gold(c) { O(c, 0, 0, 18); O(c, 0, 0, 12); L(c, [0, -7, 0, 7]); },
    phantom(c) { c.beginPath(); c.moveTo(-14, 18); c.lineTo(-14, -2); c.arc(0, -2, 14, Math.PI, 0); c.lineTo(14, 18); c.lineTo(7, 12); c.lineTo(0, 18); c.lineTo(-7, 12); c.closePath(); c.stroke(); O(c, -5, -3, 2.5, true); O(c, 5, -3, 2.5, true); },
    reroll(c) { A(c, 0, 0, 16, -2.6, 0.2); arrowHead(c, 15, 4, 1.8, 7); A(c, 0, 0, 16, 0.55, 3.35); arrowHead(c, -15, -4, -1.35, 7); },
    banish(c) { O(c, 0, 0, 18); L(c, [-13, 13, 13, -13]); },
    heal(c) { c.lineWidth = 7; L(c, [0, -16, 0, 16]); L(c, [-16, 0, 16, 0]); },
    score(c) { L(c, star(5, 21, 9), true); },
    core(c) { L(c, ngon(6, 18, Math.PI / 6), true); L(c, [0, -18, 0, 18]); c.globalAlpha = 0.5; L(c, [-15, -9, 15, 9]); L(c, [-15, 9, 15, -9]); c.globalAlpha = 1; },
    chest(c) { L(c, [-18, -10, 18, -10, 18, 14, -18, 14], true); L(c, [-18, -1, 18, -1]); O(c, 0, 3, 3, true); },
    ship_vanguard(c) { L(c, [26, 0, -16, -19, -8, 0, -16, 19], true); },
    ship_specter(c) { L(c, [28, 0, -4, -6, -18, -21, -11, 0, -18, 21, -4, 6], true); },
    ship_bastion(c) { L(c, [23, 0, 12, -19, -14, -19, -23, 0, -14, 19, 12, 19], true); L(c, [10, 0, 2, -8, -9, -8, -9, 8, 2, 8], true); },
    ship_oracle(c) { O(c, 0, 0, 14); L(c, [26, 0, 13, -7, 13, 7], true); for (let i = 0; i < 3; i++) { const a = Math.PI * 0.5 + (i * TAU) / 3; O(c, Math.cos(a) * 21, Math.sin(a) * 21, 3.5, true); } },
    lock(c) { L(c, [-12, -2, 12, -2, 12, 18, -12, 18], true); A(c, 0, -6, 9, Math.PI, 0); L(c, [-9, -6, -9, -2]); L(c, [9, -6, 9, -2]); },
  };

  function get(key, color, size = 72) {
    const id = key + color + size;
    if (cache.has(id)) return cache.get(id);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    c.translate(size / 2, size / 2);
    c.scale(size / 72, size / 72);
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.shadowColor = color;
    c.shadowBlur = 10;
    const fn = DRAW[key] || DRAW.score;
    fn(c);
    c.shadowBlur = 0;
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 1.2;
    fn(c);
    const url = cv.toDataURL();
    cache.set(id, url);
    return url;
  }

  NR.Icons = { get };
})();
