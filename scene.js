'use strict';
// Base das cenas do topo: um panorama na largura toda da tela, desenhado em baixa
// resolução. Cada linha de produção tem a sua cena (no arquivo da linha); aqui ficam
// as peças comuns: nuvens, pássaros e fumaça. O fundo fixo é desenhado uma vez por
// largura de tela e cada quadro só pinta o que se mexe por cima.

const SCENES = (() => {
  const { C, bayer, hash, Pix } = PixelArt;
  const H = 112;

  class BaseScene {
    constructor() {
      this.w = 0;
      this.h = H;
      this.cloudRamp = ART.PAL.cloud;
      this.smokeRamp = ART.PAL.cloud;
      this.birdColor = C('#2b2a38');
    }

    resize(w) {
      w = Math.max(160, Math.round(w));
      if (w === this.w) return false;
      this.w = w;
      this.pix = new Pix(w, H);
      this.bg = new Pix(w, H);
      this.layout();
      this.buildBackground();
      this.buildClouds();
      return true;
    }

    layout() {}
    buildBackground() {}
    paintFrame() {}

    // dark: linha ainda bloqueada, a cena aparece só como silhueta noturna
    paint(ctx, t, info, dark = false) {
      const p = this.pix.copyFrom(this.bg);
      this.paintClouds(p, t);
      this.paintFrame(p, t, info);
      if (dark) this.darken(p);
      p.draw(ctx);
    }

    darken(p) {
      const d = p.d;
      const night = ART.PAL.night;
      const cache = this.darkCache || (this.darkCache = new Map());
      for (let i = 0; i < d.length; i++) {
        const c = d[i];
        let m = cache.get(c);
        if (m === undefined) {
          const l = (0.3 * (c & 255) + 0.55 * ((c >> 8) & 255) + 0.15 * ((c >> 16) & 255)) / 255;
          m = night[Math.min(night.length - 1, Math.floor(l * l * 7))];
          cache.set(c, m);
        }
        d[i] = m;
      }
    }

    buildClouds(maxY = 30) {
      this.clouds = [];
      const n = Math.ceil(this.w / 170) + 1;
      for (let i = 0; i < n; i++) {
        const cw = Math.round(30 + hash(i, 1, 77) * 34);
        const ch = Math.round(9 + hash(i, 2, 77) * 7);
        this.clouds.push({
          p: ART.makeCloud(cw, ch, i + 17, this.cloudRamp),
          y: Math.round(4 + hash(i, 3, 77) * maxY),
          speed: 1.4 + hash(i, 4, 77) * 2.6,
          x0: hash(i, 5, 77) * (this.w + cw),
        });
      }
    }

    paintClouds(p, t) {
      for (const c of this.clouds) {
        const span = this.w + c.p.w + 20;
        p.blit(c.p, Math.floor(((c.x0 + t * c.speed) % span) - c.p.w - 10), c.y);
      }
    }

    paintBirds(p, t, baseY = 30) {
      const span = this.w + 240;
      const lead = ((t * 13) % span) - 120;
      const c = this.birdColor;
      for (let i = 0; i < 3; i++) {
        const bx = Math.round(lead - i * 9);
        const by = Math.round(baseY + Math.sin(t * 0.6) * 4 + i * 3 + (i === 1 ? -2 : 0));
        const up = Math.floor(t * 5 + i * 1.7) % 2 === 0;
        p.set(bx - 1, by, c); p.set(bx, by, c); p.set(bx + 1, by, c);
        p.set(bx - 2, by + (up ? -1 : 1), c);
        p.set(bx + 2, by + (up ? -1 : 1), c);
      }
    }

    // Fumaça pontilhada subindo de (cx, cy) e se desfazendo.
    paintSmoke(p, t, cx, cy, seed = 0, size = 1) {
      const r0 = this.smokeRamp;
      for (let k = 0; k < 7; k++) {
        const a = (t * 0.32 + k / 7 + seed * 0.37) % 1;
        const sx = cx + a * 16 * size + Math.sin(a * 7 + k + seed) * 1.5;
        const sy = cy - a * 30 * size;
        const r = (1.3 + a * 4.2) * size;
        const density = (1 - a) * 1.25;
        for (let y = Math.floor(sy - r); y <= sy + r; y++) {
          for (let x = Math.floor(sx - r); x <= sx + r; x++) {
            const dd = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / r;
            if (dd <= 1 && bayer(x, y) < density * (1.1 - dd * 0.5)) p.set(x, y, r0[dd < 0.5 && y < sy ? 4 : 2]);
          }
        }
      }
    }
  }

  const kinds = {};
  return {
    H,
    BaseScene,
    register(name, cls) { kinds[name] = cls; },
    create(name) { return new kinds[name](); },
  };
})();
