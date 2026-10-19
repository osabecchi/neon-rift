'use strict';
/* NEON RIFT — WebGL2 レンダラー(インスタンス描画・グリッド線・ブルーム・歪み後処理) */
(function () {
  const NR = window.NR;
  const FLOATS = 16;
  const MAX_INST = 16384;
  const MAX_LINE_VERTS = 60000;

  const SPRITE_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aPos;
layout(location=2) in vec4 aUV;
layout(location=3) in vec4 aCol;
layout(location=4) in vec4 aExt;
uniform vec2 uCam;
uniform vec2 uScale;
uniform vec2 uRot;
out vec2 vUV;
out vec4 vCol;
out vec2 vExt;
void main() {
  float c = cos(aExt.x), s = sin(aExt.x);
  vec2 p = aCorner * aPos.zw;
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + aPos.xy - uCam;
  p = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  gl_Position = vec4(p * uScale, 0.0, 1.0);
  vUV = mix(aUV.xy, aUV.zw, aCorner + 0.5);
  vCol = aCol;
  vExt = aExt.yz;
}`;

  const SPRITE_FS = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
in vec2 vUV;
in vec4 vCol;
in vec2 vExt;
out vec4 o;
void main() {
  vec4 t = texture(uTex, vUV);
  vec3 c = vCol.rgb * t.rgb + vec3(t.a * t.a * t.a * vExt.x);
  o = vec4(c * vCol.a, t.a * vCol.a * vExt.y);
}`;

  const LINE_VS = `#version 300 es
layout(location=0) in vec2 aP;
layout(location=1) in vec4 aC;
uniform vec2 uCam;
uniform vec2 uScale;
uniform vec2 uRot;
out vec4 vC;
void main() {
  vec2 p = aP - uCam;
  p = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  gl_Position = vec4(p * uScale, 0.0, 1.0);
  vC = aC;
}`;

  const LINE_FS = `#version 300 es
precision mediump float;
in vec4 vC;
out vec4 o;
void main() { o = vec4(vC.rgb * vC.a, 0.0); }`;

  const FS_VS = `#version 300 es
out vec2 vUV;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const DOWN_FS = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThreshold;
in vec2 vUV;
out vec4 o;
void main() {
  vec3 s = texture(uTex, vUV).rgb * 4.0;
  s += texture(uTex, vUV + vec2(-uTexel.x, -uTexel.y)).rgb;
  s += texture(uTex, vUV + vec2(uTexel.x, -uTexel.y)).rgb;
  s += texture(uTex, vUV + vec2(-uTexel.x, uTexel.y)).rgb;
  s += texture(uTex, vUV + vec2(uTexel.x, uTexel.y)).rgb;
  vec3 c = s * 0.125;
  c = max(c - vec3(uThreshold), vec3(0.0));
  o = vec4(c, 1.0);
}`;

  const UP_FS = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uScatter;
in vec2 vUV;
out vec4 o;
void main() {
  vec2 t = uTexel;
  vec3 s = texture(uTex, vUV).rgb * 4.0;
  s += texture(uTex, vUV + vec2(-t.x, 0.0)).rgb * 2.0;
  s += texture(uTex, vUV + vec2(t.x, 0.0)).rgb * 2.0;
  s += texture(uTex, vUV + vec2(0.0, -t.y)).rgb * 2.0;
  s += texture(uTex, vUV + vec2(0.0, t.y)).rgb * 2.0;
  s += texture(uTex, vUV + vec2(-t.x, -t.y)).rgb;
  s += texture(uTex, vUV + vec2(t.x, -t.y)).rgb;
  s += texture(uTex, vUV + vec2(-t.x, t.y)).rgb;
  s += texture(uTex, vUV + vec2(t.x, t.y)).rgb;
  o = vec4(s * (uScatter / 16.0), 1.0);
}`;

  const COMP_FS = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStr;
uniform float uCA;
uniform float uVig;
uniform vec4 uFlash;
uniform float uDesat;
uniform vec4 uWaves[4];
uniform float uAspect;
uniform float uTime;
uniform float uGrain;
uniform float uExposure;
uniform vec3 uTint;
in vec2 vUV;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUV;
  for (int i = 0; i < 4; i++) {
    vec4 w = uWaves[i];
    if (w.w != 0.0) {
      vec2 d = uv - w.xy;
      d.x *= uAspect;
      float len = length(d);
      float diff = len - w.z;
      float prof = exp(-diff * diff * 700.0) * w.w;
      vec2 dir = d / max(len, 0.0001);
      dir.x /= uAspect;
      uv -= dir * prof;
    }
  }
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  vec2 off = c * (uCA * (0.4 + r2 * 2.5));
  vec3 col;
  col.r = texture(uScene, uv - off).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv + off).b;
  col += texture(uBloom, uv).rgb * uBloomStr;
  col *= uTint;
  col = vec3(1.0) - exp(-col * uExposure);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l), uDesat);
  col += uFlash.rgb * uFlash.a;
  float v = 1.0 - smoothstep(0.3, 0.95, sqrt(r2) * 1.25);
  col *= mix(1.0, v, uVig);
  col += (hash(vUV * 917.0 + fract(uTime)) - 0.5) * uGrain;
  o = vec4(col, 1.0);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader compile: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  class Renderer {
    constructor(canvas, atlas) {
      const gl = canvas.getContext('webgl2', {
        antialias: false, alpha: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance',
      });
      if (!gl) throw new Error('WebGL2 is not available');
      this.gl = gl;
      this.canvas = canvas;
      this.floatRT = !!gl.getExtension('EXT_color_buffer_float');
      this.pSprite = program(gl, SPRITE_VS, SPRITE_FS);
      this.pLine = program(gl, LINE_VS, LINE_FS);
      this.pDown = program(gl, FS_VS, DOWN_FS);
      this.pUp = program(gl, FS_VS, UP_FS);
      this.pComp = program(gl, FS_VS, COMP_FS);

      // スプライト(インスタンス)
      this.inst = new Float32Array(MAX_INST * FLOATS);
      this.n = 0;
      this.vaoSprite = gl.createVertexArray();
      gl.bindVertexArray(this.vaoSprite);
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.instBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.inst.byteLength, gl.DYNAMIC_DRAW);
      for (let i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(1 + i);
        gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, FLOATS * 4, i * 16);
        gl.vertexAttribDivisor(1 + i, 1);
      }
      // 線
      this.lineData = new Float32Array(MAX_LINE_VERTS * 6);
      this.ln = 0;
      this.vaoLine = gl.createVertexArray();
      gl.bindVertexArray(this.vaoLine);
      this.lineBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.lineData.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
      this.vaoFS = gl.createVertexArray();
      gl.bindVertexArray(null);

      // アトラス
      this.S = atlas.sprites;
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.rt = null;
      this.mips = [];
      this.W = 1; this.H = 1; this.cssW = 1; this.cssH = 1;
      this.opt = { scale: 1, bloom: true, levels: 5 };
      this.waves = new Float32Array(16);
      this.camX = 0; this.camY = 0; this.zoom = 1;
      this.drawCalls = 0;
    }

    resize(cssW, cssH, dpr) {
      const w = Math.max(2, Math.round(cssW * dpr * this.opt.scale));
      const h = Math.max(2, Math.round(cssH * dpr * this.opt.scale));
      this.cssW = cssW;
      this.cssH = cssH;
      if (w !== this.W || h !== this.H || !this.rt) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.W = w;
        this.H = h;
        this.alloc();
      }
    }
    alloc() {
      const gl = this.gl;
      const kill = (t) => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } };
      kill(this.rt);
      this.mips.forEach(kill);
      this.rt = this.target(this.W, this.H);
      this.mips = [];
      let w = this.W, h = this.H;
      for (let i = 0; i < this.opt.levels; i++) {
        w = Math.max(1, w >> 1);
        h = Math.max(1, h >> 1);
        this.mips.push(this.target(w, h));
      }
    }
    target(w, h) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (this.floatRT) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && this.floatRT) {
        gl.deleteTexture(tex);
        gl.deleteFramebuffer(fb);
        this.floatRT = false;
        return this.target(w, h);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex, fb, w, h };
    }

    begin(cx, cy, zoom, rot, bg) {
      const gl = this.gl;
      this.drawCalls = 0;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.rt.fb);
      gl.viewport(0, 0, this.W, this.H);
      gl.clearColor(bg[0], bg[1], bg[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      this.camX = cx; this.camY = cy; this.zoom = zoom;
      this.rc = Math.cos(rot); this.rs = Math.sin(rot);
      this.sx = (2 * zoom) / this.cssW;
      this.sy = (-2 * zoom) / this.cssH;
      const hw = this.cssW / (2 * zoom) * 1.08 + 40, hh = this.cssH / (2 * zoom) * 1.08 + 40;
      this.vl = cx - hw; this.vr = cx + hw; this.vt = cy - hh; this.vb = cy + hh;
      this.n = 0;
      this.ln = 0;
    }
    camUniforms(P) {
      const gl = this.gl;
      gl.uniform2f(P.u.uCam, this.camX, this.camY);
      gl.uniform2f(P.u.uScale, this.sx, this.sy);
      gl.uniform2f(P.u.uRot, this.rc, this.rs);
    }
    // スプライト1枚。mode: 0=加算 1=通常(暗い物体用)
    spr(s, x, y, w, h, rot, r, g, b, a, hot, mode) {
      const m = (w > h ? w : h) * 0.72;
      if (x + m < this.vl || x - m > this.vr || y + m < this.vt || y - m > this.vb) return;
      if (this.n >= MAX_INST) this.flush();
      const d = this.inst, o = this.n++ * FLOATS;
      d[o] = x; d[o + 1] = y; d[o + 2] = w; d[o + 3] = h;
      d[o + 4] = s.u0; d[o + 5] = s.v0; d[o + 6] = s.u1; d[o + 7] = s.v1;
      d[o + 8] = r; d[o + 9] = g; d[o + 10] = b; d[o + 11] = a;
      d[o + 12] = rot; d[o + 13] = hot || 0; d[o + 14] = mode || 0; d[o + 15] = 0;
    }
    // 色を配列で渡す簡易版(サイズは半径基準)
    sprC(s, x, y, rad, rot, c, a, hot) {
      const sz = rad * 2 * s.unit;
      this.spr(s, x, y, sz, sz, rot, c[0], c[1], c[2], a, hot, 0);
    }
    // 2点を結ぶ帯(ビーム・稲妻・軌跡)
    beam(s, x1, y1, x2, y2, width, r, g, b, a, hot) {
      const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.01) return;
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const m = len * 0.5 + width;
      if (cx + m < this.vl || cx - m > this.vr || cy + m < this.vt || cy - m > this.vb) return;
      if (this.n >= MAX_INST) this.flush();
      const d = this.inst, o = this.n++ * FLOATS;
      d[o] = cx; d[o + 1] = cy; d[o + 2] = len; d[o + 3] = width;
      d[o + 4] = s.u0; d[o + 5] = s.v0; d[o + 6] = s.u1; d[o + 7] = s.v1;
      d[o + 8] = r; d[o + 9] = g; d[o + 10] = b; d[o + 11] = a;
      d[o + 12] = Math.atan2(dy, dx); d[o + 13] = hot || 0; d[o + 14] = 0; d[o + 15] = 0;
    }
    line(x1, y1, x2, y2, r1, g1, b1, a1, r2, g2, b2, a2) {
      if (this.ln + 2 > MAX_LINE_VERTS) this.flushLines();
      const d = this.lineData, o = this.ln * 6;
      d[o] = x1; d[o + 1] = y1; d[o + 2] = r1; d[o + 3] = g1; d[o + 4] = b1; d[o + 5] = a1;
      d[o + 6] = x2; d[o + 7] = y2; d[o + 8] = r2; d[o + 9] = g2; d[o + 10] = b2; d[o + 11] = a2;
      this.ln += 2;
    }
    // ダメージ数字などの簡易テキスト(グリフはアトラス内)
    text(str, x, y, size, r, g, b, a, hot) {
      const S = this.S;
      let w = 0;
      for (let i = 0; i < str.length; i++) { const gl = S['g' + str[i]]; if (gl) w += gl.adv * size; }
      let px = x - w / 2;
      for (let i = 0; i < str.length; i++) {
        const gl = S['g' + str[i]];
        if (!gl) continue;
        const gw = gl.adv * size;
        this.spr(gl, px + gw / 2, y, gl.w / gl.h * size, size, 0, r, g, b, a, hot, 0);
        px += gw;
      }
    }
    flushLines() {
      if (!this.ln) return;
      const gl = this.gl;
      gl.useProgram(this.pLine.p);
      this.camUniforms(this.pLine);
      gl.bindVertexArray(this.vaoLine);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lineData, 0, this.ln * 6);
      gl.drawArrays(gl.LINES, 0, this.ln);
      this.drawCalls++;
      this.ln = 0;
    }
    flush() {
      if (!this.n) return;
      const gl = this.gl;
      gl.useProgram(this.pSprite.p);
      this.camUniforms(this.pSprite);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(this.pSprite.u.uTex, 0);
      gl.bindVertexArray(this.vaoSprite);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.inst, 0, this.n * FLOATS);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
      this.drawCalls++;
      this.n = 0;
    }
    // ワールド座標→画面UV(後処理の歪み用)
    toUV(x, y) {
      return [0.5 + ((x - this.camX) * this.zoom) / this.cssW, 0.5 - ((y - this.camY) * this.zoom) / this.cssH];
    }
    end(P) {
      this.flushLines();
      this.flush();
      const gl = this.gl;
      gl.bindVertexArray(this.vaoFS);
      gl.activeTexture(gl.TEXTURE0);
      const useBloom = this.opt.bloom && P.bloom > 0;
      if (useBloom) {
        gl.disable(gl.BLEND);
        gl.useProgram(this.pDown.p);
        gl.uniform1i(this.pDown.u.uTex, 0);
        let src = this.rt;
        for (let i = 0; i < this.mips.length; i++) {
          const dst = this.mips[i];
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
          gl.viewport(0, 0, dst.w, dst.h);
          gl.bindTexture(gl.TEXTURE_2D, src.tex);
          gl.uniform2f(this.pDown.u.uTexel, 1 / src.w, 1 / src.h);
          gl.uniform1f(this.pDown.u.uThreshold, i === 0 ? P.threshold : 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          src = dst;
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(this.pUp.p);
        gl.uniform1i(this.pUp.u.uTex, 0);
        gl.uniform1f(this.pUp.u.uScatter, 0.9);
        for (let i = this.mips.length - 1; i > 0; i--) {
          const s = this.mips[i], d = this.mips[i - 1];
          gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb);
          gl.viewport(0, 0, d.w, d.h);
          gl.bindTexture(gl.TEXTURE_2D, s.tex);
          gl.uniform2f(this.pUp.u.uTexel, 1 / s.w, 1 / s.h);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        this.drawCalls += this.mips.length * 2;
      }
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.W, this.H);
      const C = this.pComp;
      gl.useProgram(C.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.rt.tex);
      gl.uniform1i(C.u.uScene, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, useBloom ? this.mips[0].tex : this.rt.tex);
      gl.uniform1i(C.u.uBloom, 1);
      // 各段を足し合わせたぶんで割り、広い面が明るくなりすぎないようにする
      let norm = 0;
      for (let i = 0; i < this.mips.length; i++) norm += Math.pow(0.9, i);
      gl.uniform1f(C.u.uBloomStr, useBloom ? P.bloom / Math.max(1, norm) : 0);
      gl.uniform1f(C.u.uCA, P.ca);
      gl.uniform1f(C.u.uVig, P.vignette);
      gl.uniform4f(C.u.uFlash, P.flashColor[0], P.flashColor[1], P.flashColor[2], P.flash);
      gl.uniform1f(C.u.uDesat, P.desat);
      gl.uniform4fv(C.u.uWaves, P.waves || this.waves);
      gl.uniform1f(C.u.uAspect, this.cssW / this.cssH);
      gl.uniform1f(C.u.uTime, P.time % 1000);
      gl.uniform1f(C.u.uGrain, P.grain);
      gl.uniform1f(C.u.uExposure, P.exposure);
      gl.uniform3f(C.u.uTint, P.tint[0], P.tint[1], P.tint[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.drawCalls++;
      gl.activeTexture(gl.TEXTURE0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  NR.Renderer = Renderer;
})();
