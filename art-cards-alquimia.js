'use strict';
// Arte das cartas da linha de alquimia: uma ilustração 24x24 por carta (ferramentas dos geradores e cartas da linha).
(() => {
  // materiais próprios das cartas
  const GLASS = ramp('#3a4a56', '#5a6e78', '#8aa2aa', '#bcd2d4', '#e2f2f0', '#ffffff');
  const COPPER = ramp('#3a160c', '#6a2c16', '#9c4824', '#c86a34', '#e8965a', '#fcc898');
  const MARBLE = ramp('#4e4a56', '#7c7882', '#aaa6ac', '#d2cecc', '#ece8e2', '#fdfbf6');
  const CRYSTAL = ramp('#18284a', '#22507a', '#2e84a8', '#4ab8c8', '#8ee2de', '#e4fff8');
  const SLATE = ramp('#161a20', '#20262e', '#2c343e', '#3a4450');
  const INK = ramp('#0e1018', '#1a1e2c', '#2c3246', '#465068');
  const WAX = ramp('#3a0a10', '#6e1420', '#a8242c', '#d84a40', '#f48a70');
  const TOME = ramp('#1c1028', '#2e1a40', '#46285c', '#603a78', '#7e5294');
  const PARCH = ramp('#6a4e30', '#9a7a50', '#c4a676', '#e2cc9c', '#f4e6c0', '#fff8e0');
  const CHALK = C('#e8ecef');
  const WHITE = C('#ffffff');

  // sombreados prontos
  const ball = (r, cx, cy, rx, ry, base = 0.15, k = 0.85) => (x, y) =>
    pick(r, base + sphereLight((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) * k, x, y);
  const tube = (r, cx, rx, base = 0.2, k = 0.8) => (x, y) => pick(r, base + cylLight((x + 0.5 - cx) / rx) * k, x, y);

  // Traço grosso ao longo de uma polilinha; raio pode variar com t (0..1).
  // col: rampa (sombreado de tubo) ou função (x, y, t, ox, oy).
  function stroke(p, pts, rad, col, bias = 0) {
    const rf = typeof rad === 'function' ? rad : () => rad;
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay);
      segs.push([ax, ay, bx, by, len, total]);
      total += len;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const near = (x, y) => {
      let best = null;
      for (const [ax, ay, bx, by, len, off] of segs) {
        const dx = bx - ax, dy = by - ay;
        const u = len ? clamp01(((x - ax) * dx + (y - ay) * dy) / (len * len)) : 0;
        const ox = x - ax - u * dx, oy = y - ay - u * dy;
        const d = Math.hypot(ox, oy);
        if (!best || d < best.d) best = { d, ox, oy, t: total ? (off + u * len) / total : 0 };
      }
      return best;
    };
    p.fill(x0 - 4, y0 - 4, x1 + 4, y1 + 4, (x, y) => { const n = near(x, y); return n.d <= rf(n.t); }, (x, y) => {
      const n = near(x + 0.5, y + 0.5);
      const r = Math.max(0.6, rf(n.t));
      if (typeof col === 'function') return col(x, y, n.t, n.ox / r, n.oy / r);
      return pick(col, 0.15 + sphereLight(n.ox / r * 0.9, n.oy / r * 0.9) * 0.85 + bias, x, y);
    });
  }

  // Curva de Bézier quadrática amostrada em n pontos.
  const bez = (a, b, c, n = 12) => Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, s = 1 - t;
    return [s * s * a[0] + 2 * s * t * b[0] + t * t * c[0], s * s * a[1] + 2 * s * t * b[1] + t * t * c[1]];
  });

  function ring(p, cx, cy, r0, r1, col) {
    p.fill(cx - r1, cy - r1, cx + r1, cy + r1, (x, y) => { const d = Math.hypot(x - cx, y - cy); return d >= r0 && d <= r1; }, col);
  }

  // Brilho em cruz (vira estrelinha com o contorno).
  function twinkle(p, x, y, c = PAL.gold[5], core = WHITE) {
    p.set(x, y - 1, c); p.set(x - 1, y, c); p.set(x + 1, y, c); p.set(x, y + 1, c);
    p.set(x, y, core);
  }

  // ---------------------------------------------------------------------------
  // Ferramentas dos geradores

  // Tesoura de poda aberta: lâmina curva de corte e contra-lâmina em gancho.
  function shears() {
    const p = new Pix(24, 24);
    // cabos com capa de couro vermelho
    stroke(p, [[12, 11], [8, 14], [3, 17.5]], (t) => 1.2 + t * 0.6, PAL.steel);
    stroke(p, [[12, 11], [10.5, 15.5], [8.5, 21]], (t) => 1.2 + t * 0.6, PAL.steel, -0.1);
    stroke(p, [[7.6, 14.4], [3, 17.5]], (t) => 1.7 + t * 0.2, PAL.banner, 0.1);
    stroke(p, [[10, 16.8], [8.5, 21]], (t) => 1.7 + t * 0.2, PAL.banner, -0.05);
    // mola entre os cabos
    for (const [x, y, k] of [[9, 14, 4], [9, 15, 2], [10, 14, 3]]) p.set(x, y, PAL.gold[k]);
    // contra-lâmina em gancho, mais escura, apontando para a direita
    p.poly([[11.5, 10], [16, 8.5], [20, 8], [22, 9], [21.5, 10.5], [19, 10.5], [15, 12.5], [12.5, 13]], (x, y) =>
      pick(PAL.iron, 0.6 - (y - 8) * 0.1, x, y));
    p.line(16, 9, 20, 9, PAL.iron[3]);
    // lâmina de corte: crescente fino com fio claro, apontando para cima
    p.poly([[10.5, 11], [10.5, 7], [12, 3.5], [14.5, 1.2], [16.5, 1], [14.5, 4], [13.5, 7.5], [13.5, 10.5]], (x, y) =>
      pick(PAL.steel, 0.95 - (x - 10.5) * 0.08, x, y));
    p.line(13, 9, 13, 7, PAL.steel[5]);
    p.line(14, 5, 15, 3, PAL.steel[5]);
    // eixo
    p.sphere(12.5, 11, 1.6, 1.6, PAL.gold, 0.1);
    p.set(12, 10, PAL.gold[5]);
    // folhinha cortada
    p.fill(17, 2, 22, 6, (x, y) => Math.abs(y - 4.2 + (x - 19.5) * 0.35) <= 1.3 - Math.abs(x - 19.5) * 0.45, (x, y) => PAL.herb[y < 4 ? 5 : 3]);
    p.set(17, 5, PAL.herb[2]);
    p.outline(PAL.out);
    return p;
  }

  // Almofariz de mármore com a mão do pilão e pó verde.
  function mortar() {
    const p = new Pix(24, 24);
    const cx = 11, top = 11;
    const vein = (x, y) => Math.abs(y - (14.5 + 1.6 * Math.sin(x * 0.55))) < 0.55 || Math.abs(x - (7 + (y - 12) * 0.9)) < 0.5;
    // corpo
    p.fill(cx - 9, top, cx + 9, 20, (x, y) => ((x - cx) / 8.6) ** 2 + ((y - top) / 8.4) ** 2 <= 1, (x, y) =>
      pick(MARBLE, 0.1 + cylLight((x + 0.5 - cx) / 8.6) * 0.75 - (y - top) * 0.025 - (vein(x, y) ? 0.2 : 0), x, y));
    // pé
    p.rect(5, 19, 13, 3, (x, y) => pick(MARBLE, y === 19 ? 0.25 : 0.15 + cylLight((x + 0.5 - cx) / 6.5) * 0.6, x, y));
    p.rect(6, 19, 11, 1, MARBLE[1]);
    // borda e interior
    p.ellipse(cx, top, 8.6, 2.8, (x, y) => pick(MARBLE, 0.75 + (x < cx ? 0.2 : 0) - (y > top ? 0.15 : 0), x, y));
    p.ellipse(cx, top - 0.3, 6.8, 1.9, (x, y) => (y >= top ? pick(PAL.herb, 0.55 + (x < cx ? 0.25 : 0), x, y) : MARBLE[1]));
    p.set(cx - 3, top, PAL.herb[5]);
    // mão do pilão
    stroke(p, [[12.5, 10.5], [19.5, 2.5]], (t) => 1.9 - t * 0.5, MARBLE, 0.1);
    for (const [x, y] of [[13, 10], [14, 10], [12, 11]]) p.set(x, y, PAL.herb[3]);
    // folhas soltas
    p.ellipse(19.5, 12.5, 1.8, 1.1, (x, y) => PAL.herb[y < 12 ? 5 : 3]);
    p.set(21, 13, PAL.herb[2]);
    p.outline(PAL.out);
    return p;
  }

  // Arcada de pedra do claustro com o canteiro de ervas à frente.
  function cloisterGarden() {
    const p = new Pix(24, 24);
    const ARCH = [7.5, 16.5], AY = 7, AR = 3.6;
    const open = (x, y) => ARCH.some((c) => (y >= AY && Math.abs(x - c) < AR) || Math.hypot(x - c, y - AY) < AR);
    const voussoir = (x, y) => ARCH.some((c) => y < AY + 0.5 && Math.hypot(x - c, y - AY) < AR + 1.2);
    // parede e colunas
    p.fill(1, 1, 22, 16, (x, y) => !open(x, y), (x, y) => {
      if (y < 3) return PAL.stone[y === 1 ? 5 : 2];
      if (voussoir(x, y)) return pick(PAL.stone, 0.85 - (x - 1) * 0.01 - ((Math.round(Math.atan2(y - AY, x - (x < 12 ? 7.5 : 16.5)) * 3) % 2) ? 0.15 : 0), x, y);
      const brick = (y % 3 === 0) || ((x + (Math.floor(y / 3) % 2) * 2) % 4 === 0);
      return pick(PAL.stone, 0.55 - (x - 1) * 0.01 - (brick ? 0.2 : 0), x, y);
    });
    // colunas lisas com capitel
    for (const [x0, w] of [[1, 3], [11, 2], [20, 3]]) {
      p.rect(x0, AY + 1, w, 9, (x, y) => PAL.stone[x === x0 ? 5 : x === x0 + w - 1 ? 2 : 4]);
      p.rect(x0 - (x0 > 1 ? 1 : 0), AY, w + (x0 > 1 && x0 < 20 ? 2 : 1), 1, PAL.stone[5]);
    }
    // corredor em sombra atrás das arcadas
    p.fill(1, 3, 22, 16, open, (x, y) => pick(PAL.night, 0.9 - (y - 3) * 0.05, x, y));
    // canteiro elevado de madeira
    p.rect(1, 17, 22, 5, (x, y) => pick(PAL.wood, 0.55 - (y - 17) * 0.06 - (y === 19 ? 0.25 : 0) - (x % 7 === 3 ? 0.25 : 0), x, y));
    p.rect(1, 17, 22, 1, PAL.wood[4]);
    p.rect(1, 15, 22, 2, (x, y) => pick(PAL.dirt, 0.25 + hash(x, y, 3) * 0.4, x, y));
    // lavanda
    for (const lx of [8, 16]) {
      for (let y = 11; y <= 15; y++) p.set(lx, y, PAL.herb[2]);
      for (let y = 10; y <= 13; y++) { p.set(lx - 1, y + 1, PAL.lavender[y < 12 ? 4 : 3]); p.set(lx + 1, y, PAL.lavender[y < 12 ? 5 : 3]); }
      p.set(lx, 9, PAL.lavender[5]);
    }
    // repolhos
    for (const [cx, cy] of [[4.5, 14.3], [12, 14.5], [19.5, 14.3]]) {
      p.sphere(cx, cy, 2.7, 2, PAL.herb, 0.05);
      p.set(Math.floor(cx), Math.floor(cy) + 1, PAL.herb[1]);
      p.set(Math.floor(cx) - 1, Math.floor(cy) - 1, PAL.herb[5]);
    }
    p.outline(PAL.out);
    return p;
  }

  // Serpentina de cobre em espiral, pingando o destilado.
  function coil() {
    const p = new Pix(24, 24);
    const turns = 2.5, th0 = -Math.PI / 2;
    const pts = [];
    for (let i = 0; i <= 260; i++) {
      const th = th0 + (i / 260) * turns * Math.PI * 2;
      pts.push([12 + 6.8 * Math.sin(th), 5.5 + ((th - th0) / (Math.PI * 2)) * 4.6 + 2.9 * Math.cos(th), Math.cos(th)]);
    }
    const disc = (x0, y0, r, c) => p.fill(x0 - r, y0 - r, x0 + r, y0 + r, (x, y) => Math.hypot(x - x0, y - y0) <= r, c);
    const shade = (x0, y0, r, bias) => (x, y) => pick(COPPER, 0.15 + bias + sphereLight((x + 0.5 - x0) / r * 0.9, (y + 0.5 - y0) / r * 0.9) * 0.8, x, y);
    // entrada e saída
    stroke(p, [[1.5, pts[0][1]], [6, pts[0][1]]], 1.2, COPPER);
    const end = pts[pts.length - 1];
    stroke(p, [[end[0], end[1]], [end[0], 19]], 1.2, COPPER);
    p.rect(Math.floor(end[0]) - 1, 18, 3, 1, PAL.gold[3]);
    // metade de trás, escura
    for (const [x, y, z] of pts) if (z < 0) disc(x, y, 1.1, shade(x, y, 1.1, -0.2));
    // metade da frente com contorno próprio
    for (const [x, y, z] of pts) if (z >= 0) disc(x, y, 1.9, PAL.out);
    for (const [x, y, z] of pts) if (z >= 0) disc(x, y, 1.25, shade(x, y, 1.25, 0.1));
    p.rect(1, Math.floor(pts[0][1]) - 1, 1, 3, PAL.gold[2]);
    // gota
    p.fill(17, 20, 20, 23, (x, y) => Math.hypot(x - end[0], y - 21.3) <= 1.2 || (Math.abs(x - end[0]) < 0.6 && y < 21), (x, y) => PAL.water[y < 21 ? 5 : x < end[0] ? 4 : 2]);
    p.outline(PAL.out);
    return p;
  }

  // Balança de precisão em latão, com peso e pó nos pratos.
  function precisionScale() {
    const p = new Pix(24, 24);
    // base de madeira
    p.rect(5, 19, 14, 3, (x, y) => pick(PAL.wood, y === 19 ? 0.9 : 0.35 + cylLight((x + 0.5 - 12) / 7) * 0.4, x, y));
    p.rect(8, 18, 8, 1, PAL.gold[2]);
    // coluna
    p.rect(11, 6, 2, 12, tube(PAL.gold, 12, 1.2, 0.2, 0.75));
    p.rect(10, 15, 4, 3, (x, y) => pick(PAL.gold, 0.3 + (x === 10 ? 0.4 : 0) + (y === 15 ? 0.2 : 0), x, y));
    // ponteiro e escala no topo
    ring(p, 12, 7, 4.2, 5.1, (x, y) => (y <= 4 ? PAL.gold[x < 12 ? 4 : 3] : 0));
    p.line(12, 2, 12, 6, PAL.steel[4]);
    p.set(12, 2, PAL.banner[3]);
    // travessão
    p.rect(2, 6, 20, 1, PAL.gold[4]);
    p.rect(3, 7, 18, 1, PAL.gold[2]);
    p.sphere(12, 6.5, 1.7, 1.7, PAL.gold, 0.15);
    for (const ex of [2, 21]) p.set(ex, 7, PAL.gold[3]);
    // correntes e pratos
    for (const cx of [4.5, 19.5]) {
      for (let i = 0; i < 6; i++) {
        p.set(cx - 2.5 + i * 0.25 - 0.5, 8 + i, PAL.iron[i % 2 ? 2 : 3]);
        p.set(cx + 2.5 - i * 0.25 - 0.5, 8 + i, PAL.iron[i % 2 ? 2 : 3]);
      }
      p.fill(cx - 4, 13, cx + 4, 16, (x, y) => ((x - cx) / 3.6) ** 2 + ((y - 13) / 2.4) ** 2 <= 1 && y >= 13,
        (x, y) => pick(PAL.gold, y === 13 ? 0.95 : 0.25 + cylLight((x + 0.5 - cx) / 3.6) * 0.6, x, y));
    }
    // peso de ferro e montinho de pó
    p.rect(3, 10, 3, 3, (x, y) => PAL.iron[y === 10 ? 4 : x === 3 ? 3 : 2]);
    p.set(4, 9, PAL.iron[3]);
    p.fill(16, 10, 23, 13, (x, y) => ((x - 19.5) / 2.6) ** 2 + ((y - 13) / 2) ** 2 <= 1 && y < 13, (x, y) => PAL.lavender[y < 12 ? 5 : x < 19 ? 4 : 3]);
    p.outline(PAL.out);
    return p;
  }

  // Retorta de vidro fervendo sobre a chama.
  function retort() {
    const p = new Pix(24, 24);
    // chama
    p.fill(4, 16, 12, 22, (x, y) => {
      const t = (y - 16) / 6;
      return Math.abs(x - 8) <= 0.5 + t * 3.2 - (y > 20.5 ? (y - 20.5) * 1.5 : 0) && hash(Math.floor(x), Math.floor(y), 9) > (1 - t) * 0.4;
    }, (x, y) => pick(PAL.fire, 1 - Math.abs(x + 0.5 - 8) / 4 - (y - 16) * 0.05, x, y));
    // pescoço
    stroke(p, bez([10, 9], [15, 1], [21.5, 13], 14), (t) => 2.2 - t * 1.3, (x, y, t, ox, oy) =>
      pick(GLASS, 0.35 + sphereLight(ox * 0.9, oy * 0.9) * 0.6 + (ox < -0.2 && oy < 0.3 ? 0.25 : 0), x, y));
    // bulbo
    p.sphere(8, 12, 6, 6, GLASS, 0);
    // líquido lilás
    p.fill(2, 12, 14, 18, (x, y) => Math.hypot(x - 8, y - 12) <= 5.1 && y >= 12.5,
      (x, y) => pick(PAL.lavender, 0.85 - (y - 12) * 0.08 - (x - 4) * 0.03, x, y));
    p.rect(4, 12, 9, 1, PAL.lavender[5]);
    for (const [x, y] of [[6, 15], [9, 14], [8, 16], [10, 13]]) p.set(x, y, PAL.lavender[5]);
    // reflexos
    p.set(5, 8, WHITE); p.set(4, 9, WHITE); p.set(6, 7, GLASS[4]);
    // gota caindo do bico
    p.sphere(21.5, 15.8, 1, 1.2, PAL.lavender, 0.2);
    p.outline(PAL.out);
    return p;
  }

  // Lupa com aro de latão e letras ampliadas na lente.
  function magnifier() {
    const p = new Pix(24, 24);
    const cx = 9.5, cy = 9.5;
    // cabo de madeira
    stroke(p, [[14.5, 14.5], [21, 21]], (t) => 1.4 + t * 0.4, PAL.wood, 0.1);
    stroke(p, [[14, 14], [16, 16]], 1.6, PAL.gold, 0.1);
    p.set(21, 21, PAL.wood[1]);
    // lente
    p.fill(cx - 7, cy - 7, cx + 7, cy + 7, (x, y) => Math.hypot(x - cx, y - cy) <= 5.8,
      (x, y) => pick(CRYSTAL, 0.95 - Math.hypot(x + 0.5 - cx + 2, y + 0.5 - cy + 2) * 0.07, x, y));
    // letras grandes: um R e traços de texto
    const glyph = ['###.', '#..#', '###.', '#.#.', '#..#'];
    glyph.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') p.set(6 + i, 6 + j, INK[1]); }));
    for (const [x0, x1, y] of [[11, 13, 7], [11, 13, 9], [6, 12, 12], [7, 11, 14]]) for (let x = x0; x <= x1; x++) p.set(x, y, INK[2]);
    // reflexo
    for (const [x, y] of [[6, 5], [5, 6], [7, 4], [5, 7]]) p.set(x, y, WHITE);
    // aro
    ring(p, cx, cy, 5.8, 7.4, (x, y) => pick(PAL.gold, 0.15 + sphereLight((x + 0.5 - cx) / 7.4, (y + 0.5 - cy) / 7.4) * 0.9, x, y));
    p.outline(PAL.out);
    return p;
  }

  // Pena de coruja listrada, com a ponta molhada de tinta.
  function owlQuill() {
    const p = new Pix(24, 24);
    const N = [3, 21.5], T = [20.5, 1.8];
    const L = Math.hypot(T[0] - N[0], T[1] - N[1]);
    const dx = (T[0] - N[0]) / L, dy = (T[1] - N[1]) / L;
    const nx = dy, ny = -dx; // normal para cima-esquerda
    const local = (x, y) => {
      const rx = x - N[0], ry = y - N[1];
      const t = (rx * dx + ry * dy) / L;
      const s = rx * nx + ry * ny - Math.sin(Math.PI * clamp01(t)) * 1.3;
      return [t, s];
    };
    const width = (t, s) => {
      if (t < 0.3 || t > 1) return 0;
      const u = (t - 0.3) / 0.7;
      return (s > 0 ? 4.4 : 3.6) * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.55);
    };
    p.fill(0, 0, 23, 23, (x, y) => {
      const [t, s] = local(x, y);
      const w = width(t, s);
      if (w > 0 && Math.abs(s) <= w) return !(Math.abs(s) > w - 0.9 && hash(Math.floor(x * 1), Math.floor(y), 4) < 0.25);
      return t >= 0 && t <= 1.02 && Math.abs(s) <= (t < 0.3 ? 0.75 : 0.55);
    }, (x, y) => {
      const [t, s] = local(x + 0.5, y + 0.5);
      if (Math.abs(s) <= 0.6 || t < 0.3) {
        if (t < 0.07) return INK[t < 0.04 ? 1 : 2];
        return PAL.linen[s > 0 ? 4 : 3];
      }
      const q = t * L * 0.95 - Math.abs(s) * 0.7;
      const bar = ((q % 3.4) + 3.4) % 3.4 < 1.15;
      const light = s > 0 ? 0.25 : 0;
      const edge = Math.abs(s) / Math.max(0.1, width(t, s));
      if (t > 0.9) return PAL.straw[bar ? 2 : 4];
      return bar ? pick(PAL.leather, 0.3 + light - edge * 0.2, x, y) : pick(PAL.straw, 0.45 + light - edge * 0.25, x, y);
    });
    // pinga tinta
    p.set(2, 22, INK[2]);
    p.outline(PAL.out);
    return p;
  }

  // Astrolábio de latão: anel graduado, rete com estrelas e alidade.
  function astrolabe() {
    const p = new Pix(24, 24);
    const cx = 12, cy = 13.2;
    // argola de suspensão
    ring(p, cx, 2.4, 0.8, 2, (x, y) => PAL.gold[y < 2 ? 4 : 2]);
    p.rect(10, 3, 4, 2, (x, y) => PAL.gold[y === 3 ? 4 : 2]);
    // anel graduado
    p.fill(cx - 9, cy - 9, cx + 9, cy + 9, (x, y) => Math.hypot(x - cx, y - cy) <= 8.8,
      (x, y) => pick(PAL.gold, 0.3 + sphereLight((x + 0.5 - cx) / 8.8, (y + 0.5 - cy) / 8.8) * 0.75, x, y, 4));
    for (let a = 0; a < 32; a++) {
      const ang = (a / 32) * Math.PI * 2;
      p.set(cx + Math.cos(ang) * 7.9 - 0.5, cy + Math.sin(ang) * 7.9 - 0.5, a % 4 === 0 ? PAL.gold[0] : PAL.gold[2]);
    }
    // placa interna, rebaixada
    p.fill(cx - 7, cy - 7, cx + 7, cy + 7, (x, y) => Math.hypot(x - cx, y - cy) <= 6.7,
      (x, y) => pick(PAL.gold, 0.32 + ((x + 0.5 - cx) + (y + 0.5 - cy)) * 0.03, x, y, 4));
    ring(p, cx, cy, 6.3, 6.9, (x, y) => PAL.gold[x + y > 2 * cx ? 4 : 1]);
    // círculo do zodíaco da rete
    ring(p, cx + 0.8, cy - 1.4, 3.2, 3.9, () => PAL.gold[4]);
    // estrelas
    for (const [x, y] of [[8, 10], [16, 9], [9, 17], [15, 16]]) p.set(x, y, WHITE);
    // alidade de aço com as miras
    stroke(p, [[cx - 7.4, cy + 4.6], [cx + 7.4, cy - 4.6]], (t) => 0.7 + Math.abs(t - 0.5) * 0.9, PAL.steel, 0.25);
    p.sphere(cx, cy, 1.4, 1.4, PAL.gold, 0.25);
    p.outline(PAL.out);
    return p;
  }

  // Lousa nova na moldura, com letras de giz e um toco de giz.
  function slate() {
    const p = new Pix(24, 24);
    // cordão de pendurar
    p.line(6, 4, 11, 1, PAL.straw[3]);
    p.line(17, 4, 12, 1, PAL.straw[2]);
    p.set(11, 1, PAL.iron[3]); p.set(12, 1, PAL.iron[2]);
    // moldura
    p.rect(2, 4, 20, 17, (x, y) => {
      const lt = x <= 3 || y <= 5;
      return pick(PAL.wood, (lt ? 0.75 : 0.4) - ((x + y * 3) % 5 === 0 ? 0.15 : 0), x, y);
    });
    p.rect(2, 4, 20, 1, PAL.wood[4]);
    // pedra da lousa
    p.rect(4, 6, 16, 13, (x, y) => pick(SLATE, 0.75 - (x - 4) * 0.02 - (y - 6) * 0.02 + (hash(x, y, 7) - 0.5) * 0.2, x, y));
    p.rect(4, 6, 16, 1, SLATE[0]);
    // letras de giz
    const font = {
      A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
      1: ['.#', '##', '.#', '.#', '.#'], 2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
    };
    const write = (str, x0, y0, c) => {
      let x = x0;
      for (const ch of str) {
        const g = font[ch];
        g.forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') p.set(x + i, y0 + j, c); }));
        x += g[0].length + 1;
      }
    };
    write('ABC', 6, 8, CHALK);
    write('123', 7, 14, C('#bcc6cc'));
    p.set(17, 8, CHALK); p.set(16, 9, CHALK); p.set(17, 10, CHALK); // risquinho
    // apoio com toco de giz
    p.rect(2, 20, 20, 2, (x, y) => PAL.wood[y === 20 ? 3 : 1]);
    p.rect(14, 19, 4, 1, (x) => (x === 14 ? WHITE : CHALK));
    // brilho de novo
    twinkle(p, 20, 3);
    p.outline(PAL.out);
    return p;
  }

  // Cajado de madeira com runas acesas e um orbe preso nas garras.
  function runeStaff() {
    const p = new Pix(24, 24);
    stroke(p, [[3.5, 22], [10, 13.5], [15.5, 7.5]], (t) => 1.25 + (t > 0.85 ? 0.35 : 0), PAL.wood, 0.1);
    // nós da madeira
    p.set(7, 18, PAL.wood[1]); p.set(12, 11, PAL.wood[1]);
    // runas acesas ao longo do cabo
    for (const [x, y] of [[5, 19], [6, 18], [8, 16], [9, 15], [11, 13], [12, 12]]) p.set(x, y, CRYSTAL[(x + y) % 2 ? 4 : 5]);
    // garras que seguram o orbe
    stroke(p, [[15, 8], [14, 4.5], [15.5, 1.8]], 0.8, PAL.wood);
    stroke(p, [[15.5, 8], [19.5, 8.5], [21.5, 6.5]], 0.8, PAL.wood);
    // orbe
    p.sphere(18, 4.7, 3.3, 3.3, PAL.lavender, 0.25);
    p.ellipse(18, 4.7, 1.4, 1.4, (x, y) => PAL.lavender[5]);
    p.set(16, 3, WHITE);
    // brilhos em volta
    for (const [x, y] of [[22, 2], [13, 2], [22, 11]]) p.set(x, y, PAL.lavender[5]);
    p.outline(PAL.out);
    return p;
  }

  // Cristal facetado num pedestal, irradiando luz.
  function focusCrystal() {
    const p = new Pix(24, 24);
    // raios
    for (const [x0, y0, x1, y1] of [[3, 4, 5, 6], [20, 4, 18, 6], [2, 12, 4, 12], [21, 12, 19, 12]]) p.line(x0, y0, x1, y1, PAL.gold[5]);
    // pedestal
    p.poly([[6, 17], [18, 17], [20, 22], [4, 22]], (x, y) => pick(PAL.stone, 0.3 + cylLight((x + 0.5 - 11) / 8) * 0.6 - (y > 20 ? 0.1 : 0), x, y));
    p.rect(6, 17, 12, 1, PAL.gold[3]);
    p.rect(5, 19, 14, 1, PAL.gold[2]);
    // cristal: faces da esquerda, do meio e da direita
    const facet = (x, y) => {
      if (y < 6) return x < 12 ? 0.95 : 0.6;
      if (x < 10) return 0.8;
      if (x < 14) return 0.62;
      return 0.35;
    };
    p.poly([[12, 1], [17, 6], [16.5, 15], [12, 18], [7.5, 15], [7, 6]], (x, y) => pick(CRYSTAL, facet(x, y) + (y > 14 ? -0.15 : 0), x, y));
    // arestas claras e núcleo brilhante
    p.line(10, 6, 10, 15, CRYSTAL[5]);
    p.line(7, 6, 12, 1, CRYSTAL[5]);
    p.line(10, 6, 12, 2, CRYSTAL[4]);
    p.line(14, 6, 14, 15, CRYSTAL[2]);
    p.rect(11, 8, 2, 4, (x, y) => (y === 8 || y === 11 ? CRYSTAL[5] : WHITE));
    p.outline(PAL.out);
    return p;
  }

  // Bolsinha de couro aberta, transbordando pó de ouro num montinho.
  function goldDust() {
    const p = new Pix(24, 24);
    // montinho
    p.fill(9, 15, 23, 21, (x, y) => ((x - 16.5) / 6) ** 2 + ((y - 21) / 4.6) ** 2 <= 1 && y <= 21,
      (x, y) => (hash(x, y, 11) < 0.12 ? PAL.gold[5] : pick(PAL.gold, 0.85 - (y - 16) * 0.1 - (x - 12) * 0.025, x, y)));
    // corpo da bolsa
    p.sphere(8, 15.5, 5.6, 5.6, PAL.leather, 0.15);
    for (const [x, y] of [[5, 14], [5, 15], [10, 13], [10, 14], [7, 19]]) p.set(x, y, PAL.leather[1]);
    // boca franzida aberta e o ouro dentro
    p.poly([[5, 10], [11, 10], [13, 6], [3, 6]], (x, y) => pick(PAL.leather, 0.65 - (x - 4) * 0.03 + (x % 2 ? 0.1 : 0), x, y));
    p.ellipse(8, 6, 4.6, 1.6, (x, y) => (y < 6 ? PAL.gold[5] : PAL.gold[3]));
    p.sphere(8, 5, 3.2, 1.8, PAL.gold, 0.3);
    // cordão amarrado no pescoço
    p.rect(5, 9, 7, 1, PAL.banner[2]);
    p.line(5, 10, 3, 13, PAL.banner[3]);
    p.set(3, 14, PAL.gold[3]);
    // pó escorrendo pela borda
    for (const [x, y, k] of [[12, 6, 5], [13, 7, 4], [14, 9, 5], [14, 11, 3], [15, 12, 4], [15, 14, 5]]) p.set(x, y, PAL.gold[k]);
    // cintilas
    twinkle(p, 20, 11);
    twinkle(p, 3, 2);
    p.set(14, 18, WHITE);
    p.outline(PAL.out);
    return p;
  }

  // Frasco de elixir verde lacrado com cera vermelha.
  function sealedFlask() {
    const p = new Pix(24, 24);
    // corpo de vidro
    p.sphere(12, 15.5, 6.6, 6, GLASS, 0.15);
    // líquido
    p.fill(5, 13, 19, 22, (x, y) => ((x - 12) / 5.6) ** 2 + ((y - 15.5) / 5) ** 2 <= 1 && y >= 13,
      (x, y) => pick(PAL.herb, 0.95 - (y - 13) * 0.08 - (x - 8) * 0.03, x, y));
    p.rect(7, 13, 10, 1, PAL.herb[5]);
    for (const [x, y] of [[10, 17], [13, 15], [11, 19]]) p.set(x, y, PAL.herb[5]);
    // gargalo
    p.rect(10, 5, 4, 5, (x, y) => GLASS[x === 10 ? 4 : x === 13 ? 2 : 3]);
    // cordão amarrado
    p.rect(9, 8, 6, 1, PAL.straw[3]);
    p.line(14, 9, 16, 11, PAL.straw[2]);
    p.set(15, 9, PAL.straw[4]);
    // lacre de cera com pingos
    p.sphere(12, 4, 3.4, 2.4, WAX, 0.2);
    p.rect(10, 5, 1, 2, WAX[2]);
    p.rect(13, 5, 1, 3, WAX[1]);
    p.set(11, 3, WAX[4]);
    p.set(12, 4, WAX[1]);
    // reflexo
    p.set(8, 12, WHITE); p.set(7, 13, GLASS[4]);
    p.outline(PAL.out);
    return p;
  }

  // Tomo antigo e grosso, cantos de ouro e um selo rúnico aceso.
  function lostTome() {
    const p = new Pix(24, 24);
    // bloco de páginas (lado e baixo)
    p.poly([[19, 3], [21, 5], [21, 22], [5, 22], [3, 20], [19, 20]], (x, y) => PAL.linen[(x + y) % 2 ? 3 : 4]);
    p.rect(19, 4, 2, 17, (x, y) => PAL.linen[y % 2 ? 2 : 4]);
    p.rect(4, 20, 16, 2, (x, y) => PAL.linen[x % 2 ? 3 : 2]);
    // contracapa
    p.poly([[21, 5], [21.6, 5], [21.6, 22.6], [5, 22.6], [5, 22]], TOME[1]);
    // capa
    p.rect(2, 2, 18, 19, (x, y) => pick(TOME, 0.2 + sphereLight((x + 0.5 - 9) / 12, (y + 0.5 - 8) / 14) * 0.7 + (hash(x, y, 5) - 0.5) * 0.12, x, y));
    // lombada
    p.rect(2, 2, 2, 19, (x) => TOME[x === 2 ? 3 : 1]);
    for (const y of [5, 17]) p.rect(2, y, 2, 1, PAL.gold[3]);
    // cantoneiras de ouro
    for (const [x0, y0, sx, sy] of [[19, 2, -1, 1], [19, 20, -1, -1], [4, 2, 1, 1], [4, 20, 1, -1]]) {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) p.set(x0 + sx * i, y0 + sy * j, PAL.gold[i + j === 0 ? 5 : 3]);
    }
    // selo rúnico no centro
    ring(p, 11.5, 11, 3.2, 4.2, (x, y) => PAL.gold[y < 10 ? 4 : 2]);
    p.fill(8, 7, 15, 14, (x, y) => Math.abs(x - 11.5) + Math.abs(y - 11) <= 2.6, (x, y) => (Math.abs(x + 0.5 - 11.5) + Math.abs(y + 0.5 - 11) <= 1 ? WHITE : PAL.lavender[x + y < 21 ? 4 : 2]));
    // fecho
    p.rect(18, 9, 4, 4, (x, y) => PAL.gold[y === 9 ? 4 : x === 21 ? 1 : 3]);
    p.set(19, 11, PAL.out);
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Cartas da linha

  // Ampulheta de latão e madeira com areia dourada.
  function hourglass() {
    const p = new Pix(24, 24);
    const half = (y) => 0.7 + 4.8 * Math.pow(Math.min(1, Math.abs(y - 12) / 7.5), 0.75);
    // vidro
    p.fill(5, 4, 18, 20, (x, y) => Math.abs(x - 12) <= half(y), (x, y) => pick(GLASS, 0.75 - Math.abs(x + 0.5 - 10.5) * 0.08, x, y));
    // areia de cima (afundando no meio) e de baixo (monte)
    p.fill(5, 8, 18, 12, (x, y) => Math.abs(x - 12) <= half(y) - 0.4 && y >= 8 + Math.max(0, 2 - Math.abs(x - 12)) * 0.8,
      (x, y) => pick(PAL.straw, 0.85 - (x - 8) * 0.04, x, y));
    p.fill(5, 15, 18, 20, (x, y) => Math.abs(x - 12) <= half(y) - 0.4 && y >= 15 + Math.abs(x - 12) * 0.75,
      (x, y) => pick(PAL.straw, 0.85 - (x - 8) * 0.05 - (y - 16) * 0.04, x, y));
    for (let y = 12; y <= 16; y++) p.set(12, y, PAL.straw[5]);
    // reflexo
    p.set(8, 5, WHITE); p.set(7, 6, WHITE);
    // tampas
    for (const [y0, h] of [[1, 3], [20, 3]]) p.rect(3, y0, 18, h, (x, y) => pick(PAL.gold, (y === y0 ? 0.95 : 0.5) - (x - 3) * 0.02, x, y));
    p.rect(3, 3, 18, 1, PAL.wood[2]);
    p.rect(3, 20, 18, 1, PAL.wood[3]);
    // colunas torneadas
    for (const cx of [4, 19]) p.rect(cx, 4, 1, 16, (x, y) => PAL.wood[(y % 4 === 0) ? 1 : x === 4 ? 4 : 2]);
    p.outline(PAL.out);
    return p;
  }

  // Trevo de quatro folhas em coração, com a marca clara em cada folha.
  function clover() {
    const p = new Pix(24, 24);
    const cx = 12, cy = 10;
    // haste
    stroke(p, bez([12, 11], [13, 18], [17, 22], 8), 0.9, PAL.herb, 0.05);
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI * 3 / 4 + k * Math.PI / 2;
      const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
      const lx = cx + ux * 5, ly = cy + uy * 5;
      const inLeaf = (x, y) => {
        const u = (x - cx) * ux + (y - cy) * uy, v = (x - cx) * vx + (y - cy) * vy;
        const lobe = Math.min(Math.hypot(u - 5.6, v - 2), Math.hypot(u - 5.6, v + 2)) <= 2.9;
        const tip = u >= 0.6 && u <= 5.6 && Math.abs(v) <= (u - 0.6) * 0.95;
        return lobe || tip;
      };
      p.fill(cx - 10, cy - 10, cx + 10, cy + 10, inLeaf, (x, y) => {
        const u = (x + 0.5 - cx) * ux + (y + 0.5 - cy) * uy, v = (x + 0.5 - cx) * vx + (y + 0.5 - cy) * vy;
        const mark = Math.abs(Math.abs(v) - (u - 2.5) * 0.7) < 0.5 && u > 3 && u < 5.5;
        if (mark) return PAL.herb[5];
        if (Math.abs(v) < 0.45 && u > 1 && u < 6.5) return PAL.herb[2];
        return pick(PAL.herb, 0.2 + sphereLight((x + 0.5 - lx) / 5, (y + 0.5 - ly) / 5) * 0.8, x, y);
      });
    }
    p.rect(11, 9, 2, 2, PAL.herb[1]);
    // gota de orvalho
    p.set(7, 5, WHITE); p.set(8, 5, PAL.water[4]); p.set(7, 6, PAL.water[3]);
    p.outline(PAL.out);
    return p;
  }

  // Aprendiz de capuz verde, sorridente, segurando um frasquinho.
  function apprentice() {
    const p = new Pix(24, 24);
    // ombros e túnica
    p.fill(1, 15, 23, 23, (x, y) => ((x - 12) / 10.5) ** 2 + ((y - 24) / 8.5) ** 2 <= 1,
      ball(PAL.hood, 10, 17, 10, 7, 0.1, 0.8));
    // avental
    p.poly([[8, 17], [16, 17], [17, 23], [7, 23]], (x, y) => pick(PAL.linen, 0.75 - (x - 8) * 0.04, x, y));
    // capuz
    p.fill(4, 1, 20, 17, (x, y) => ((x - 12) / 7.2) ** 2 + ((y - 9.5) / 7.8) ** 2 <= 1, ball(PAL.hood, 10, 6, 7.2, 7.8, 0.15, 0.85));
    p.ellipse(12, 11, 5, 5.6, PAL.hood[0]);
    // rosto
    p.fill(7, 6, 17, 17, (x, y) => ((x - 12) / 4.2) ** 2 + ((y - 11.5) / 4.6) ** 2 <= 1, ball(PAL.skin, 11, 10, 4.2, 4.6, 0.3, 0.75));
    // franja ruiva
    p.fill(7, 6, 17, 10, (x, y) => ((x - 12) / 4.5) ** 2 + ((y - 7.6) / 2.4) ** 2 <= 1 && y < 9 + (x % 3 === 0 ? 1 : 0),
      (x, y) => pick(PAL.auburn, 0.6 - (x - 8) * 0.05, x, y));
    // olhos, bochechas e sorriso
    for (const ex of [10, 14]) { p.set(ex, 11, PAL.iris); p.set(ex, 12, PAL.iris); p.set(ex, 10, PAL.skin[2]); }
    p.set(10, 11, PAL.irisHi);
    p.set(9, 13, PAL.blush); p.set(15, 13, PAL.blush);
    p.rect(11, 14, 3, 1, PAL.lip); p.set(10, 13, PAL.skin[2]); p.set(14, 13, PAL.skin[2]);
    // frasquinho na mão
    p.sphere(18.5, 19.5, 2.8, 2.6, GLASS, 0.2);
    p.fill(15, 19, 22, 22, (x, y) => ((x - 18.5) / 2.2) ** 2 + ((y - 19.5) / 2) ** 2 <= 1 && y >= 19, (x, y) => PAL.lavender[y === 19 ? 5 : 3]);
    p.rect(18, 15, 2, 2, (x) => GLASS[x === 18 ? 4 : 2]);
    p.rect(18, 14, 2, 1, PAL.wood[3]);
    p.rect(15, 19, 2, 3, (x, y) => PAL.skin[x === 15 ? 4 : 3]);
    p.set(17, 20, PAL.skin[3]);
    p.outline(PAL.out);
    return p;
  }

  // Pergaminho enrolado com texto, balança desenhada e lacre.
  function treatise() {
    const p = new Pix(24, 24);
    // folha
    p.rect(5, 4, 14, 16, (x, y) => pick(PARCH, 0.75 - (x - 5) * 0.015 + (hash(x, y, 2) - 0.5) * 0.15, x, y));
    p.rect(18, 4, 1, 16, PARCH[2]);
    // linhas de texto
    for (const [x0, x1, y] of [[7, 16, 6], [7, 14, 8], [7, 16, 10]]) for (let x = x0; x <= x1; x++) if (hash(x, y, 8) > 0.2) p.set(x, y, INK[2]);
    // balancinha a tinta
    p.line(12, 12, 12, 17, INK[1]);
    p.line(8, 13, 16, 13, INK[1]);
    p.line(10, 17, 14, 17, INK[1]);
    for (const bx of [9, 15]) { p.set(bx - 1, 14, INK[2]); p.set(bx + 1, 14, INK[2]); p.rect(bx - 1, 15, 3, 1, INK[1]); }
    // rolos
    for (const y0 of [2, 19]) {
      p.rect(3, y0, 18, 3, (x, y) => pick(PARCH, y === y0 ? 0.95 : y === y0 + 1 ? 0.6 : 0.3, x, y));
      p.rect(2, y0, 1, 3, (x, y) => PAL.wood[y === y0 ? 4 : 2]);
      p.rect(21, y0, 1, 3, (x, y) => PAL.wood[y === y0 ? 3 : 1]);
    }
    // fitas e lacre
    p.poly([[15, 18], [17, 18], [16.5, 23], [15.5, 22]], WAX[2]);
    p.poly([[17, 18], [19, 18], [19.5, 22.5], [18.4, 21.6]], WAX[1]);
    p.sphere(17, 17, 2.6, 2.6, WAX, 0.15);
    p.set(17, 17, PAL.gold[4]); p.set(16, 17, PAL.gold[3]); p.set(17, 16, PAL.gold[3]);
    p.outline(PAL.out);
    return p;
  }

  // Caldeirão de ouro borbulhando poção verde.
  function goldenCauldron() {
    const p = new Pix(24, 24);
    // pés
    for (const fx of [5, 17]) p.rect(fx, 19, 2, 3, (x) => PAL.gold[x === fx ? 3 : 1]);
    // alças
    ring(p, 3, 12.5, 1, 2.1, (x, y) => PAL.gold[y < 12 ? 4 : 2]);
    ring(p, 21, 12.5, 1, 2.1, (x, y) => PAL.gold[y < 12 ? 3 : 1]);
    // bojo
    p.fill(2, 9, 22, 21, (x, y) => ((x - 12) / 8.8) ** 2 + ((y - 13.8) / 6.8) ** 2 <= 1 && y >= 9.5,
      (x, y) => pick(PAL.gold, 0.2 + sphereLight((x + 0.5 - 10) / 8.8, (y + 0.5 - 12) / 7) * 0.85, x, y, 4));
    p.rect(4, 15, 16, 1, PAL.gold[1]);
    p.rect(5, 16, 14, 1, (x, y) => PAL.gold[x < 9 ? 4 : 3]);
    // boca e poção
    p.ellipse(12, 9.5, 8.2, 2.3, (x, y) => PAL.gold[y < 9 ? 5 : 4]);
    p.ellipse(12, 9.7, 6.6, 1.5, (x, y) => pick(PAL.herb, 0.8 + (x < 11 ? 0.2 : 0) - (y > 9 ? 0.15 : 0), x, y));
    // bolhas subindo
    p.sphere(9, 6.5, 1.5, 1.5, PAL.herb, 0.3);
    p.sphere(14.5, 4.5, 1.2, 1.2, PAL.herb, 0.35);
    p.sphere(11.5, 1.8, 0.9, 0.9, PAL.herb, 0.4);
    p.set(15, 9, PAL.herb[5]); p.set(8, 10, PAL.herb[5]);
    // reflexo
    p.set(6, 12, WHITE); p.set(6, 13, PAL.gold[5]); p.set(7, 12, PAL.gold[5]);
    p.outline(PAL.out);
    return p;
  }

  Object.assign(ART.icons, {
    'c-fart:herborista': shears,
    'c-fart:botica': mortar,
    'c-fart:mosteiro': cloisterGarden,
    'c-fart:destilaria': coil,
    'c-fart:alquimista': precisionScale,
    'c-fart:laboratorio': retort,
    'c-fart:biblioteca': magnifier,
    'c-fart:sabio': owlQuill,
    'c-fart:observatorio': astrolabe,
    'c-fart:academia': slate,
    'c-fart:arquimago': runeStaff,
    'c-fart:torrearcana': focusCrystal,
    'c-fart:pedra': goldDust,
    'c-fart:elixir': sealedFlask,
    'c-fart:grandeobra': lostTome,
    'c-ritmo:alquimia': hourglass,
    'c-sorte:alquimia': clover,
    'c-recruta:alquimia': apprentice,
    'c-desconto:alquimia': treatise,
    'c-bonanca:alquimia': goldenCauldron,
  });
})();
