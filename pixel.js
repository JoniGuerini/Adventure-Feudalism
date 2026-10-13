'use strict';
// Motor de pixel art do jogo.
// Desenha em buffers de baixa resolução (um inteiro por pixel) com formas simples,
// sombreamento por rampas de cor e pontilhado ordenado. O canvas recebe o buffer
// pronto via putImageData e o CSS amplia com image-rendering: pixelated.

const PixelArt = (() => {
  const cache = new Map();

  // '#rrggbb' -> inteiro no formato do ImageData (little-endian: 0xAABBGGRR).
  function C(hex) {
    let v = cache.get(hex);
    if (v === undefined) {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
      cache.set(hex, v);
    }
    return v;
  }

  // Rampa de cores, da mais escura para a mais clara.
  function ramp(...hexes) {
    return hexes.map(C);
  }

  // Matriz de Bayer 4x4, normalizada para 0..1.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  function bayer(x, y) {
    return BAYER[((y & 3) << 2) | (x & 3)];
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  // Escolhe a cor da rampa para um valor 0..1. O pontilhado só aparece numa faixa
  // estreita entre dois tons (crisp maior = faixa mais estreita), como se faz à mão.
  function pick(r, v, x, y, crisp = 2.2) {
    const t = clamp01(v) * (r.length - 1);
    const base = Math.floor(t);
    const f = clamp01((t - base - 0.5) * crisp + 0.5);
    return r[f > bayer(x, y) ? Math.min(r.length - 1, base + 1) : base];
  }

  // Ruído determinístico 0..1 por coordenada (mesma entrada, mesmo valor).
  function hash(x, y, s = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // Luz vindo de cima à esquerda, um pouco de frente.
  const LIGHT = (() => {
    const v = [-0.55, -0.7, 0.6];
    const l = Math.hypot(...v);
    return v.map((c) => c / l);
  })();

  // Iluminação de uma esfera no ponto normalizado (nx, ny) dentro de -1..1.
  function sphereLight(nx, ny) {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    return Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
  }

  // Iluminação de um cilindro vertical (nx em -1..1).
  function cylLight(nx) {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
    return Math.max(0, nx * LIGHT[0] + nz * (LIGHT[2] + 0.25));
  }

  class Pix {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.d = new Uint32Array(w * h);
      this.img = null;
    }

    clear(c = 0) {
      this.d.fill(c);
      return this;
    }

    copyFrom(src) {
      this.d.set(src.d);
      return this;
    }

    get(x, y) {
      return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0;
    }

    set(x, y, c) {
      x = Math.floor(x);
      y = Math.floor(y);
      if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
    }

    // Preenche cada pixel cujo centro passa no teste; c é uma cor ou função (x, y) -> cor.
    fill(x0, y0, x1, y1, test, c) {
      const fn = typeof c === 'function';
      x0 = Math.max(0, Math.floor(x0));
      y0 = Math.max(0, Math.floor(y0));
      x1 = Math.min(this.w - 1, Math.ceil(x1));
      y1 = Math.min(this.h - 1, Math.ceil(y1));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (!test(x + 0.5, y + 0.5)) continue;
          const v = fn ? c(x, y) : c;
          if (v) this.d[y * this.w + x] = v;
        }
      }
      return this;
    }

    rect(x, y, w, h, c) {
      return this.fill(x, y, x + w - 1, y + h - 1, () => true, c);
    }

    ellipse(cx, cy, rx, ry, c) {
      return this.fill(cx - rx, cy - ry, cx + rx, cy + ry,
        (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, c);
    }

    // Esfera/elipse sombreada com uma rampa. bias clareia ou escurece o todo.
    sphere(cx, cy, rx, ry, r, bias = 0, crisp = 2.2) {
      return this.ellipse(cx, cy, rx, ry, (x, y) =>
        pick(r, 0.1 + sphereLight((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + bias, x, y, crisp));
    }

    poly(pts, c) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of pts) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y);
        x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      const n = pts.length;
      return this.fill(x0, y0, x1, y1, (x, y) => {
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      }, c);
    }

    // Linha de Bresenham entre pixels inteiros.
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.set(x0, y0, typeof c === 'function' ? c(x0, y0) : c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      return this;
    }

    // Copia os pixels não transparentes de outro buffer.
    blit(src, ox, oy) {
      ox = Math.round(ox); oy = Math.round(oy);
      for (let y = 0; y < src.h; y++) {
        const ty = y + oy;
        if (ty < 0 || ty >= this.h) continue;
        for (let x = 0; x < src.w; x++) {
          const c = src.d[y * src.w + x];
          const tx = x + ox;
          if (c && tx >= 0 && tx < this.w) this.d[ty * this.w + tx] = c;
        }
      }
      return this;
    }

    // Contorno de 1 pixel em volta de tudo que é opaco.
    outline(c, diagonals = false) {
      const { w, h, d } = this;
      const add = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (d[i]) continue;
          const hit = (x > 0 && d[i - 1]) || (x < w - 1 && d[i + 1]) || (y > 0 && d[i - w]) || (y < h - 1 && d[i + w]) ||
            (diagonals && ((x > 0 && y > 0 && d[i - w - 1]) || (x < w - 1 && y > 0 && d[i - w + 1]) ||
              (x > 0 && y < h - 1 && d[i + w - 1]) || (x < w - 1 && y < h - 1 && d[i + w + 1])));
          if (hit) add.push(i);
        }
      }
      for (const i of add) d[i] = c;
      return this;
    }

    draw(ctx, x = 0, y = 0) {
      if (!this.img) this.img = new ImageData(new Uint8ClampedArray(this.d.buffer), this.w, this.h);
      ctx.putImageData(this.img, x, y);
    }

    // Canvas já ampliado (vizinho mais próximo), útil para virar imagem de CSS.
    toCanvas(scale = 1) {
      const small = document.createElement('canvas');
      small.width = this.w;
      small.height = this.h;
      this.draw(small.getContext('2d'));
      if (scale === 1) return small;
      const big = document.createElement('canvas');
      big.width = this.w * scale;
      big.height = this.h * scale;
      const g = big.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(small, 0, 0, big.width, big.height);
      return big;
    }
  }

  return { C, ramp, bayer, pick, hash, clamp01, sphereLight, cylLight, Pix };
})();
