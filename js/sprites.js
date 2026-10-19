'use strict';
/* NEON RIFT — スプライトアトラス生成(起動時にCanvas2Dで白いネオン図形を焼き込む) */
(function () {
  const NR = window.NR;
  const TAU = Math.PI * 2;
  const defs = [];

  function add(name, w, h, R, draw) { defs.push({ name, w, h, R, draw }); }

  function poly(c, pts) {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
  }
  function ngon(n, r, rot = 0) {
    const a = [];
    for (let i = 0; i < n; i++) { const t = rot + (i * TAU) / n; a.push(Math.cos(t) * r, Math.sin(t) * r); }
    return a;
  }
  function starPts(n, r1, r2, rot = -Math.PI / 2) {
    const a = [];
    for (let i = 0; i < n * 2; i++) {
      const t = rot + (i * Math.PI) / n, r = i % 2 ? r2 : r1;
      a.push(Math.cos(t) * r, Math.sin(t) * r);
    }
    return a;
  }
  function circle(c, r) { c.beginPath(); c.arc(0, 0, r, 0, TAU); }
  // 白い発光線を3回重ねて描く(外側ぼかし→中ぼかし→芯)
  function neon(c, build, lw = 3.2, blur = 10, fill = 0.16) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = '#fff';
    c.fillStyle = '#fff';
    if (fill > 0) { c.globalAlpha = fill; build(); c.fill(); }
    c.shadowColor = '#fff';
    c.globalAlpha = 0.42;
    c.shadowBlur = blur;
    c.lineWidth = lw;
    build(); c.stroke();
    c.globalAlpha = 0.6;
    c.shadowBlur = blur * 0.35;
    build(); c.stroke();
    c.globalAlpha = 1;
    c.shadowBlur = 0;
    c.lineWidth = Math.max(1, lw * 0.55);
    build(); c.stroke();
  }
  const P = (pts, lw, blur, fill) => (c) => neon(c, () => poly(c, pts), lw, blur, fill);

  function defineAll() {
    // ── 汎用の光 ──
    add('glow', 64, 64, 32, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.18, 'rgba(255,255,255,0.62)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.2)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(-32, -32, 64, 64);
    });
    add('soft', 128, 128, 64, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 64);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(-64, -64, 128, 128);
    });
    add('disc', 64, 64, 30, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 31);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.78, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(-32, -32, 64, 64);
    });
    add('dot', 32, 32, 4, (c) => {
      c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 7;
      circle(c, 4); c.fill(); c.fill();
    });
    add('star16', 16, 16, 2, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 8);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(-8, -8, 16, 16);
    });
    add('orb', 48, 48, 8, (c) => {
      c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 12;
      c.globalAlpha = 0.82; circle(c, 8); c.fill();
      c.globalAlpha = 1; c.shadowBlur = 3; circle(c, 4.6); c.fill();
    });
    add('rice', 48, 32, 8, (c) => {
      c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 10;
      c.globalAlpha = 0.85; c.beginPath(); c.ellipse(0, 0, 12, 6, 0, 0, TAU); c.fill();
      c.globalAlpha = 1; c.shadowBlur = 2; c.beginPath(); c.ellipse(0, 0, 7, 3, 0, 0, TAU); c.fill();
    });
    add('ring', 128, 128, 56, (c) => neon(c, () => circle(c, 56), 3, 8, 0));
    add('ringThin', 128, 128, 58, (c) => neon(c, () => circle(c, 58), 1.6, 4, 0));
    add('ringDash', 128, 128, 56, (c) => {
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        neon(c, () => { c.beginPath(); c.arc(0, 0, 56, a, a + TAU / 24); }, 3, 6, 0);
      }
    });
    add('spark', 64, 16, 8, (c) => {
      c.strokeStyle = '#fff'; c.lineCap = 'round'; c.shadowColor = '#fff';
      c.shadowBlur = 6; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-24, 0); c.lineTo(24, 0); c.stroke();
      c.shadowBlur = 0; c.lineWidth = 2; c.stroke();
    });
    add('beam', 32, 32, 16, (c) => {
      const g = c.createLinearGradient(0, -16, 0, 16);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.35)');
      g.addColorStop(0.46, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.5, 'rgba(255,255,255,1)');
      g.addColorStop(0.54, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(-16, -16, 32, 32);
    });
    add('needle', 48, 16, 8, (c) => {
      c.strokeStyle = '#fff'; c.lineCap = 'round'; c.shadowColor = '#fff';
      c.shadowBlur = 7; c.lineWidth = 5.5;
      c.beginPath(); c.moveTo(-16, 0); c.lineTo(16, 0); c.stroke();
      c.shadowBlur = 0; c.lineWidth = 2.5; c.stroke();
    });
    add('shard', 32, 32, 9, P([9, 0, -6, -6, -6, 6], 2, 5, 0.4));

    // ── 敵 ──
    add('tri', 96, 96, 26, P(ngon(3, 26), 3.4, 10, 0.16));
    add('diamond', 96, 96, 26, P([26, 0, 0, -17, -24, 0, 0, 17], 3.4, 10, 0.16));
    add('square', 96, 96, 24, (c) => {
      neon(c, () => poly(c, [-17, -17, 17, -17, 17, 17, -17, 17]), 3.4, 10, 0.14);
      neon(c, () => poly(c, [-7, -7, 7, -7, 7, 7, -7, 7]), 2, 4, 0.3);
    });
    add('hex', 96, 96, 26, (c) => {
      neon(c, () => poly(c, ngon(6, 25)), 3.4, 10, 0.14);
      neon(c, () => poly(c, ngon(6, 11, Math.PI / 6)), 2, 4, 0.35);
    });
    add('star', 96, 96, 28, P(starPts(5, 28, 12), 3.2, 10, 0.18));
    add('pinwheel', 96, 96, 26, (c) => {
      for (let k = 0; k < 4; k++) {
        const a = (k * TAU) / 4;
        neon(c, () => poly(c, [0, 0, Math.cos(a) * 26, Math.sin(a) * 26, Math.cos(a + 1.0) * 14, Math.sin(a + 1.0) * 14]), 2.8, 8, 0.2);
      }
    });
    add('arrow', 96, 96, 26, P([26, 0, -14, -20, -5, 0, -14, 20], 3.4, 10, 0.18));
    add('shieldship', 96, 96, 18, (c) => {
      neon(c, () => circle(c, 15), 3.2, 10, 0.16);
      neon(c, () => circle(c, 6), 2, 4, 0.6);
    });
    add('shieldArc', 96, 96, 30, (c) => neon(c, () => { c.beginPath(); c.arc(0, 0, 30, -1.05, 1.05); }, 6, 12, 0));
    add('spike', 96, 96, 25, (c) => {
      neon(c, () => poly(c, starPts(8, 25, 15)), 3, 10, 0.14);
      neon(c, () => circle(c, 7), 2, 4, 0.7);
    });
    add('cross', 96, 96, 24, P([-7, -24, 7, -24, 7, -7, 24, -7, 24, 7, 7, 7, 7, 24, -7, 24, -7, 7, -24, 7, -24, -7, -7, -7], 3, 10, 0.18));
    add('tri2', 96, 96, 24, (c) => {
      neon(c, () => poly(c, ngon(3, 24, -Math.PI / 2)), 3.2, 10, 0.12);
      neon(c, () => poly(c, ngon(3, 10, Math.PI / 2)), 2, 5, 0.5);
    });
    add('voidring', 96, 96, 30, (c) => {
      for (let i = 0; i < 3; i++) {
        const a = (i * TAU) / 3;
        neon(c, () => { c.beginPath(); c.arc(0, 0, 28, a, a + 1.5); }, 4, 10, 0);
      }
      neon(c, () => circle(c, 17), 1.6, 4, 0);
    });
    add('seg', 96, 96, 22, (c) => {
      neon(c, () => poly(c, ngon(6, 20)), 3, 9, 0.16);
      neon(c, () => circle(c, 6), 2, 4, 0.5);
    });
    add('serpHead', 96, 96, 24, (c) => {
      neon(c, () => poly(c, [24, 0, 6, -16, -16, -12, -9, 0, -16, 12, 6, 16]), 3.2, 10, 0.18);
      c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 6;
      for (const ey of [-6, 6]) { c.beginPath(); c.arc(4, ey, 2.6, 0, TAU); c.fill(); }
    });

    // ── 自機 ──
    add('ship_vanguard', 96, 96, 22, (c) => {
      neon(c, () => poly(c, [24, 0, -14, -17, -7, 0, -14, 17]), 3.2, 11, 0.2);
      neon(c, () => poly(c, [12, 0, 0, -4, 0, 4]), 2, 4, 0.8);
    });
    add('ship_specter', 96, 96, 22, (c) => {
      neon(c, () => poly(c, [26, 0, -4, -5, -16, -19, -10, 0, -16, 19, -4, 5]), 3, 11, 0.18);
      neon(c, () => { c.beginPath(); c.moveTo(16, 0); c.lineTo(-6, 0); }, 2, 4, 0);
    });
    add('ship_bastion', 96, 96, 22, (c) => {
      neon(c, () => poly(c, [21, 0, 11, -17, -13, -17, -21, 0, -13, 17, 11, 17]), 3.4, 11, 0.2);
      neon(c, () => poly(c, [9, 0, 2, -7, -8, -7, -8, 7, 2, 7]), 2, 4, 0.6);
    });
    add('ship_oracle', 96, 96, 22, (c) => {
      neon(c, () => circle(c, 13), 3, 10, 0.18);
      neon(c, () => poly(c, [24, 0, 12, -6, 12, 6]), 2.4, 6, 0.6);
      for (let i = 0; i < 3; i++) {
        const a = Math.PI * 0.5 + (i * TAU) / 3;
        neon(c, () => { c.beginPath(); c.arc(Math.cos(a) * 19, Math.sin(a) * 19, 3.5, 0, TAU); }, 2, 5, 0.8);
      }
    });

    // ── アイテム ──
    add('gem', 32, 32, 8, P([0, -9, 6, 0, 0, 9, -6, 0], 2, 6, 0.6));
    add('heart', 48, 48, 14, (c) => neon(c, () => {
      c.beginPath();
      c.moveTo(0, 12);
      c.bezierCurveTo(-16, 1, -13, -13, 0, -5);
      c.bezierCurveTo(13, -13, 16, 1, 0, 12);
      c.closePath();
    }, 2.6, 8, 0.5));
    add('chest', 64, 64, 20, (c) => {
      neon(c, () => poly(c, [-18, -12, 18, -12, 18, 13, -18, 13]), 2.8, 10, 0.25);
      neon(c, () => { c.beginPath(); c.moveTo(-18, -3); c.lineTo(18, -3); }, 2, 4, 0);
      neon(c, () => poly(c, [-3, -6, 3, -6, 3, 2, -3, 2]), 1.8, 4, 0.9);
    });
    add('magnetP', 48, 48, 14, (c) => neon(c, () => {
      c.beginPath(); c.arc(0, 0, 10, Math.PI, 0, false); c.lineTo(10, 11); c.moveTo(-10, 0); c.lineTo(-10, 11);
    }, 4, 8, 0));
    add('coreP', 40, 40, 10, P(ngon(6, 10, Math.PI / 6), 2, 6, 0.55));
    add('nukeP', 48, 48, 14, (c) => {
      neon(c, () => circle(c, 14), 2.4, 8, 0);
      c.fillStyle = '#fff';
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 3;
        c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 10, a - 0.5, a + 0.5); c.closePath(); c.fill();
      }
    });

    // ── 自機の武装 ──
    add('blade', 64, 64, 26, P([26, 0, 0, -7, -26, 0, 0, 7], 2.6, 9, 0.4));
    add('missile', 32, 32, 12, P([12, 0, 3, -5, -10, -5, -10, 5, 3, 5], 2, 6, 0.4));
    add('drone', 48, 48, 14, (c) => {
      neon(c, () => poly(c, [12, 0, -8, -9, -4, 0, -8, 9]), 2.4, 7, 0.3);
      neon(c, () => circle(c, 15), 1.2, 3, 0);
    });
    add('glaive', 64, 64, 26, (c) => {
      neon(c, () => poly(c, starPts(4, 26, 8, 0)), 2.6, 9, 0.25);
      neon(c, () => circle(c, 6), 2, 4, 0);
    });
    add('mine', 40, 40, 12, (c) => {
      neon(c, () => circle(c, 10), 2.4, 7, 0.2);
      neon(c, () => { c.beginPath(); c.moveTo(-6, -6); c.lineTo(6, 6); c.moveTo(6, -6); c.lineTo(-6, 6); }, 1.6, 3, 0);
    });
    add('reticle', 64, 64, 26, (c) => {
      neon(c, () => circle(c, 13), 2, 5, 0);
      for (let i = 0; i < 4; i++) {
        const a = (i * TAU) / 4;
        neon(c, () => { c.beginPath(); c.moveTo(Math.cos(a) * 18, Math.sin(a) * 18); c.lineTo(Math.cos(a) * 27, Math.sin(a) * 27); }, 2, 5, 0);
      }
    });
    add('warn', 96, 96, 30, (c) => {
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        neon(c, () => { c.beginPath(); c.arc(0, 0, 28, a, a + TAU / 16); }, 3, 6, 0);
      }
      neon(c, () => { c.beginPath(); c.moveTo(-9, -9); c.lineTo(9, 9); c.moveTo(9, -9); c.lineTo(-9, 9); }, 3, 6, 0);
    });
    add('bubble', 96, 96, 36, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 36);
      g.addColorStop(0, 'rgba(255,255,255,0.03)');
      g.addColorStop(0.75, 'rgba(255,255,255,0.14)');
      g.addColorStop(0.92, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(-48, -48, 96, 96);
    });

    // ── ボス ──
    add('aegis', 192, 192, 60, (c) => {
      neon(c, () => poly(c, ngon(6, 58)), 4.5, 14, 0.1);
      neon(c, () => poly(c, ngon(6, 40, Math.PI / 6)), 3, 9, 0.12);
      neon(c, () => circle(c, 16), 3, 8, 0.7);
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        neon(c, () => { c.beginPath(); c.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); c.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); }, 2, 5, 0);
      }
    });
    add('plate', 96, 96, 24, P([-9, -23, 12, -16, 12, 16, -9, 23], 3, 10, 0.3));
    add('leviHead', 160, 160, 44, (c) => {
      neon(c, () => poly(c, [46, 0, 16, -30, -26, -27, -16, 0, -26, 27, 16, 30]), 4.2, 13, 0.16);
      neon(c, () => poly(c, [26, 0, 8, -12, -8, 0, 8, 12]), 2.4, 6, 0.35);
      c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 10;
      for (const ey of [-17, 17]) { c.beginPath(); c.arc(10, ey, 4, 0, TAU); c.fill(); }
    });
    add('leviSeg', 96, 96, 26, (c) => {
      neon(c, () => poly(c, ngon(6, 22)), 3.2, 10, 0.14);
      neon(c, () => { c.beginPath(); c.moveTo(0, -22); c.lineTo(0, -30); c.moveTo(0, 22); c.lineTo(0, 30); }, 3, 6, 0);
      neon(c, () => circle(c, 7), 2, 4, 0.5);
    });
    add('hive', 256, 256, 82, (c) => {
      neon(c, () => poly(c, ngon(8, 80, Math.PI / 8)), 5, 16, 0.08);
      neon(c, () => poly(c, ngon(8, 58, Math.PI / 8)), 3, 9, 0.1);
      neon(c, () => circle(c, 28), 3.5, 10, 0.25);
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 + (i * TAU) / 8;
        neon(c, () => { c.beginPath(); c.moveTo(Math.cos(a) * 32, Math.sin(a) * 32); c.lineTo(Math.cos(a) * 56, Math.sin(a) * 56); }, 2, 5, 0);
      }
    });
    add('turret', 80, 80, 22, (c) => {
      neon(c, () => poly(c, [-14, -14, 14, -14, 14, 14, -14, 14]), 3, 9, 0.2);
      neon(c, () => { c.beginPath(); c.moveTo(6, 0); c.lineTo(28, 0); }, 4, 7, 0);
    });
    add('nullCore', 256, 256, 86, (c) => {
      neon(c, () => circle(c, 64), 5, 16, 0.06);
      neon(c, () => poly(c, starPts(16, 86, 70)), 2.4, 8, 0);
      neon(c, () => circle(c, 40), 2, 6, 0);
      neon(c, () => { c.beginPath(); c.ellipse(0, 0, 26, 12, 0, 0, TAU); }, 3, 8, 0.2);
      c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 12;
      circle(c, 7); c.fill();
    });
    add('sat', 80, 80, 18, (c) => {
      neon(c, () => poly(c, [18, 0, 0, -12, -18, 0, 0, 12]), 3, 9, 0.2);
      neon(c, () => circle(c, 4), 2, 4, 0.9);
    });

    // ── 数字グリフ ──
    const glyphs = '0123456789!+x';
    for (const ch of glyphs) {
      add('g' + ch, 40, 56, 20, (c, d) => {
        c.font = '800 46px "Segoe UI", "Arial Black", Arial, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = '#fff';
        c.shadowColor = '#fff';
        c.shadowBlur = 5;
        const t = ch === 'x' ? '×' : ch;
        c.fillText(t, 0, 2);
        c.shadowBlur = 0;
        c.fillText(t, 0, 2);
        d.adv = Math.min(40, c.measureText(t).width + 2) / 56;
      });
    }
  }

  function buildAtlas() {
    defs.length = 0;
    defineAll();
    const PAD = 4, W = 2048;
    const sorted = defs.slice().sort((a, b) => b.h - a.h || b.w - a.w);
    let x = PAD, y = PAD, rowH = 0;
    for (const d of sorted) {
      if (x + d.w + PAD > W) { x = PAD; y += rowH + PAD; rowH = 0; }
      d.x = x; d.y = y;
      x += d.w + PAD;
      rowH = Math.max(rowH, d.h);
    }
    const H = y + rowH + PAD;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const sprites = {};
    for (const d of defs) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(d.x, d.y, d.w, d.h);
      ctx.clip();
      ctx.translate(d.x + d.w / 2, d.y + d.h / 2);
      d.draw(ctx, d);
      ctx.restore();
      sprites[d.name] = {
        u0: (d.x + 0.5) / W, v0: (d.y + 0.5) / H, u1: (d.x + d.w - 0.5) / W, v1: (d.y + d.h - 0.5) / H,
        w: d.w, h: d.h, unit: d.w / (2 * d.R), adv: d.adv || 0,
      };
    }
    return { canvas, sprites };
  }

  NR.buildAtlas = buildAtlas;
})();
