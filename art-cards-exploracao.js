'use strict';
// Arte das cartas da linha de exploração: uma ilustração 24x24 por carta (ferramentas dos geradores e cartas da linha).
(() => {
  const BRASS = ramp('#3a240c', '#6a4616', '#9c6e22', '#c99a36', '#e8c35e', '#fbe79c');
  const PARCH = ramp('#5c3e22', '#8c683c', '#b8945c', '#dcc088', '#f0dcac', '#fcf2d6');
  const CANVAS = ramp('#3a3230', '#5c534c', '#83786a', '#ab9e86', '#cfc2a2', '#e9dfc0', '#faf5e2');
  const SUEDE = ramp('#3e2212', '#6a3e20', '#94602f', '#bc8448', '#dca868');
  const WAX = ramp('#40080c', '#741216', '#aa2622', '#d84a3a', '#f48466');
  const HORSE = ramp('#24120a', '#47220f', '#713816', '#9a5422', '#c07636', '#dc9c58');
  const GREY = ramp('#2e2a32', '#4e4a52', '#77727a', '#a19ca0', '#c9c4c2', '#ece8e0');
    const HAM = ramp('#3a160c', '#64281a', '#8e4228', '#b4623a', '#d48a58');
  const HAIR = ramp('#140c08', '#28160c', '#422614', '#5e3a1e', '#7c5028');
  const INK = C('#4a2c16');
  const TAR = C('#140f0c');
  const WHITE = C('#ffffff');

  // Desenha numa camada própria e a contorna antes de juntar: separa peças sobrepostas.
  function layer(p, draw) {
    const q = new Pix(p.w, p.h);
    draw(q);
    q.outline(PAL.out);
    p.blit(q, 0, 0);
  }

  // Eixo entre dois pontos: u ao longo, v de través (positivo para baixo/direita).
  function axis(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    let nx = -dy / L, ny = dx / L;
    if (nx + ny < 0) { nx = -nx; ny = -ny; }
    return { L, at: (x, y) => [((x - x0) * dx + (y - y0) * dy) / L, (x - x0) * nx + (y - y0) * ny] };
  }

  // Haste cilíndrica entre dois pontos, sombreada de través.
  function rod(p, x0, y0, x1, y1, r, rp, bias = 0.25, k = 0.65) {
    const a = axis(x0, y0, x1, y1);
    p.fill(Math.min(x0, x1) - r - 1, Math.min(y0, y1) - r - 1, Math.max(x0, x1) + r + 1, Math.max(y0, y1) + r + 1,
      (x, y) => { const [u, v] = a.at(x, y); return u >= -0.3 && u <= a.L + 0.3 && Math.abs(v) <= r; },
      (x, y) => { const [, v] = a.at(x + 0.5, y + 0.5); return pick(rp, bias + cylLight(Math.max(-1, Math.min(1, v / r))) * k, x, y); });
  }

  // Roda de carroça: aro de ferro, cambota de madeira, raios e cubo.
  function wheel(p, cx, cy, r, n = 8) {
    p.fill(cx - r, cy - r, cx + r, cy + r, (x, y) => Math.hypot(x - cx, y - cy) <= r, (x, y) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      const lit = sphereLight(dx / r * 0.9, dy / r * 0.9);
      if (d > r - 0.9) return pick(PAL.iron, 0.2 + lit * 0.7, x, y);
      if (d > r - 2) return pick(PAL.wood, 0.3 + lit * 0.7, x, y);
      if (d < 1.1) return PAL.iron[3];
      const f = (Math.atan2(dy, dx) / (2 * Math.PI)) * n;
      return Math.abs(f - Math.round(f)) * (2 * Math.PI / n) * d < 0.5 ? PAL.wood[3] : C('#2c1a10');
    });
  }

  // ---------------------------------------------------------------------------
  // Batedor: botas de couro, um par

  function paintBoot(p, ox, oy, bias, buckle) {
    const L = PAL.leather;
    p.poly([[ox + 4, oy + 4], [ox + 11, oy + 4], [ox + 11, oy + 11], [ox + 12.6, oy + 12.3], [ox + 15, oy + 13.2],
      [ox + 16.6, oy + 14.3], [ox + 17.4, oy + 16.2], [ox + 17.4, oy + 18], [ox + 4, oy + 18]], (x, y) => {
      const lx = x - ox, ly = y - oy;
      let v = ly < 12
        ? 0.28 + cylLight((lx + 0.5 - 7.3) / 4) * 0.62
        : 0.3 + (18 - ly) * 0.07 + cylLight(clamp01((lx + 0.5 - 4) / 13.4) * 2 - 1) * 0.35;
      if (lx < 6 && ly >= 12) v -= 0.12; // contraforte do calcanhar
      return pick(L, v + bias, x, y, 3);
    });
    // biqueira costurada e brilho do couro
    p.line(ox + 13, oy + 14, ox + 13, oy + 17, L[1]);
    p.set(ox + 15, oy + 15, L[4]); p.set(ox + 14, oy + 14, L[4]);
    p.set(ox + 6, oy + 7, L[4]); p.set(ox + 6, oy + 8, L[4]);
    // aba virada do cano
    p.rect(ox + 3, oy + 2, 9, 3, (x, y) => (y === oy + 2 ? L[4] : pick(L, 0.45 + bias + cylLight((x - ox + 0.5 - 7.2) / 4.6) * 0.5, x, y, 3)));
    p.rect(ox + 4, oy + 5, 7, 1, L[0]);
    // tira com fivela no tornozelo
    p.rect(ox + 4, oy + 11, 7, 1, L[0]);
    if (buckle) {
      p.rect(ox + 8, oy + 10, 3, 3, PAL.gold[3]);
      p.set(ox + 9, oy + 11, L[0]);
      p.set(ox + 8, oy + 10, PAL.gold[5]);
    }
    // sola, salto e ponta
    p.rect(ox + 4, oy + 18, 14, 1, (x) => PAL.wood[x < ox + 7 ? 3 : 2]);
    p.rect(ox + 4, oy + 19, 4, 1, PAL.wood[1]);
    p.rect(ox + 12, oy + 19, 5, 1, PAL.wood[1]);
  }

  function boots() {
    const p = new Pix(24, 24);
    layer(p, (q) => paintBoot(q, 5, 0, -0.02, false));
    layer(p, (q) => paintBoot(q, -2, 2, 0.06, true));
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Acampamento: barraca de lona

  function tent() {
    const p = new Pix(24, 24);
    // chão de capim
    p.fill(1, 18, 22, 22, (x, y) => ((x - 11.5) / 11) ** 2 + ((y - 19.5) / 2.6) ** 2 <= 1,
      (x, y) => pick(PAL.grass, 0.6 - (y - 18) * 0.14 + (hash(x, y, 3) - 0.5) * 0.25, x, y));
    // lado em sombra, com costuras
    p.poly([[8, 4], [17, 6], [21.5, 19], [14, 19]], (x, y) => pick(CANVAS, 0.42 - (x - 12) * 0.018, x, y, 4));
    for (const [x0, x1] of [[11, 16.5], [14, 19.5]]) p.line(x0, 5 + (x0 - 8) * 0.22, x1, 18, CANVAS[1]); // costuras
    p.line(8, 4, 17, 6, CANVAS[5]); // cumeeira
    // frente iluminada
    p.poly([[8, 4], [1.5, 19], [14.5, 19]], (x, y) => pick(CANVAS, 0.86 - (y - 4) * 0.012 - (x - 4) * 0.012, x, y, 4));
    // porta aberta: fundo escuro e abas presas dos lados
    p.poly([[8, 8], [4.5, 19], [11.5, 19]], (x, y) => pick(PAL.wood, 0.05 + (19 - y) * 0.012, x, y));
    p.poly([[8, 8], [4.5, 19], [3.6, 19]], CANVAS[4]);
    p.poly([[8, 8], [11.5, 19], [12.6, 19]], CANVAS[3]);
    p.set(5, 15, PAL.straw[3]);
    p.set(11, 15, PAL.straw[3]);
    p.rect(2, 19, 13, 1, CANVAS[2]); // barra da lona
    p.rect(14, 19, 8, 1, CANVAS[1]);
    for (const x of [6, 7, 8, 9, 10]) p.set(x, 19, PAL.wood[0]);
    // mastros e flâmula
    p.line(8, 1, 8, 4, PAL.wood[3]);
    p.line(17, 3, 17, 6, PAL.wood[2]);
    p.poly([[9, 1], [13, 2], [9, 3.2]], (x, y) => PAL.banner[y === 1 ? 3 : 2]);
    // estacas
    p.line(1, 18, 1, 20, PAL.wood[3]);
    p.line(22, 17, 22, 19, PAL.wood[2]);
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Cartógrafo: compasso de pontas, de latão, sobre o mapa

  function dividers() {
    const p = new Pix(24, 24);
    // pedaço de pergaminho
    p.poly([[1.5, 15], [21.5, 13], [22.5, 21.5], [2, 22.5]], (x, y) => pick(PARCH, 0.72 - (y - 13) * 0.03 + (hash(x, y, 9) - 0.5) * 0.1, x, y));
    for (const [x, y] of [[3, 18], [4, 17], [16, 15], [17, 15]]) p.set(x, y, PAL.water[3]); // mar
    // distância medida, tracejada
    for (let x = 7; x <= 16; x += 2) p.set(x, 20, INK);
    p.set(14, 17, C('#a8201c'));
    p.set(15, 17, C('#a8201c'));
    // pernas de latão com pontas de aço
    layer(p, (q) => {
      rod(q, 11.5, 5, 6.5, 17, 1.15, BRASS, 0.3);
      rod(q, 12.5, 5, 17.5, 17, 1.15, BRASS, 0.2);
      rod(q, 6.6, 16.5, 5.4, 20.5, 0.75, PAL.steel, 0.4);
      rod(q, 17.4, 16.5, 18.6, 20.5, 0.75, PAL.steel, 0.3);
      // arco de ajuste entre as pernas
      q.fill(7, 9, 17, 14, (x, y) => Math.abs(Math.hypot(x - 12, y - 3) - 9.4) < 0.6, (x) => BRASS[x < 12 ? 4 : 3]);
      q.rect(15, 11, 2, 2, PAL.steel[4]); // parafuso
      // dobradiça e cabo
      q.sphere(12, 5, 2.6, 2.6, BRASS, 0.05);
      q.set(12, 5, PAL.steel[2]);
      q.rect(11, 1, 2, 2, (x, y) => BRASS[x === 11 ? 5 : 3]);
    });
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Posto: paliçada de troncos apontados

  function palisade() {
    const p = new Pix(24, 24);
    const tops = [6, 3, 5, 2, 4];
    tops.forEach((ty, i) => layer(p, (q) => {
      const x0 = 1 + i * 4.3, cx = x0 + 2;
      q.fill(x0, ty + 3, x0 + 3.9, 20, () => true, (x, y) =>
        pick(PAL.wood, 0.22 + cylLight((x + 0.5 - cx) / 2.2) * 0.62 + (hash(x, y >> 1, i) - 0.5) * 0.18, x, y));
      // ponta talhada mostrando a madeira clara
      q.poly([[x0, ty + 3.6], [cx, ty - 0.2], [x0 + 4, ty + 3.6]], (x, y) =>
        pick(SUEDE, 0.55 + (x < cx ? 0.3 : -0.05) - (y - ty) * 0.06, x, y));
    }));
    // travessa amarrada
    layer(p, (q) => {
      q.rect(1, 12, 22, 2, (x, y) => pick(PAL.wood, y === 12 ? 0.75 : 0.45, x, y));
      for (const x of [3, 7, 12, 16, 20]) {
        q.set(x, 11, PAL.straw[3]); q.set(x + 1, 12, PAL.straw[4]); q.set(x, 13, PAL.straw[2]); q.set(x + 1, 14, PAL.straw[2]);
      }
    });
    // capim na base
    for (let x = 1; x < 23; x++) {
      const h = 1 + Math.floor(hash(x, 0, 7) * 2.6);
      for (let k = 0; k < h; k++) p.set(x, 21 - k, PAL.grass[k === h - 1 ? 5 : 3 - (k === 0 ? 1 : 0)]);
    }
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Caravana: carroça coberta, roda grossa

  function wagon() {
    const p = new Pix(24, 24);
    // lama
    p.ellipse(12, 21.6, 10.5, 1.5, (x, y) => pick(PAL.dirt, 0.25 + (y < 21 ? 0.2 : 0) + (hash(x, y, 4) - 0.5) * 0.3, x, y));
    // toldo de lona com arcos
    p.fill(3, 2, 19, 10, (x, y) => ((x - 11) / 8.5) ** 2 + ((y - 11) / 8.6) ** 2 <= 1 && y <= 10, (x, y) => {
      const rib = x === 7 || x === 11 || x === 15;
      return pick(CANVAS, 0.3 + sphereLight((x + 0.5 - 11) / 8.5, (y + 0.5 - 8) / 7) * 0.7 + (rib ? -0.16 : 0), x, y, 5);
    });
    // caixa de tábuas
    p.rect(2, 10, 19, 6, (x, y) => {
      let v = 0.62 - (y - 10) * 0.07;
      if (y === 12 || y === 14) v -= 0.25;
      if (x === 2 || x === 11 || x === 20) v -= 0.18;
      return pick(PAL.wood, v + (hash(x, y, 2) - 0.5) * 0.08, x, y);
    });
    p.rect(2, 10, 19, 1, PAL.wood[4]);
    for (const x of [3, 10, 19]) p.set(x, 11, PAL.iron[3]);
    for (const x of [5, 9, 13, 17]) p.set(x, 10, PAL.straw[3]); // amarras do toldo
    // lança
    p.line(20, 15, 22, 14, PAL.wood[3]);
    layer(p, (q) => wheel(q, 6.5, 17, 4.6, 8));
    layer(p, (q) => wheel(q, 17, 17.8, 3.9, 8));
    // respingos de lama nas rodas
    for (const [x, y] of [[3, 19], [4, 20], [9, 20], [14, 20], [19, 19]]) p.set(x, y, PAL.dirt[2]);
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Desbravador: facão de mato abrindo a folhagem

  function leaf(p, cx, cy, ang, len, wid, bias) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    p.fill(cx - len, cy - len, cx + len, cy + len, (x, y) => {
      const u = (x - cx) * ca + (y - cy) * sa, v = -(x - cx) * sa + (y - cy) * ca;
      const t = u / len;
      return Math.abs(t) <= 1 && Math.abs(v) <= wid * (1 - t * t);
    }, (x, y) => {
      const v = -(x + 0.5 - cx) * sa + (y + 0.5 - cy) * ca;
      return Math.abs(v) < 0.45 ? PAL.herb[4] : pick(PAL.herb, 0.3 + bias + (v < 0 ? 0.3 : 0), x, y);
    });
  }

  function machete() {
    const p = new Pix(24, 24);
    leaf(p, 6, 7, -0.6, 5, 2.2, 0.15);
    leaf(p, 17, 18.5, 0.5, 5, 2, 0);
    leaf(p, 3.5, 13, 0.9, 3.2, 1.5, -0.05);
    layer(p, (q) => {
      const a = axis(3, 21, 21.5, 2.5);
      const ends = 0.27 * a.L, guard = 0.31 * a.L;
      q.fill(1, 1, 22, 22, (x, y) => {
        const [u, v] = a.at(x, y);
        if (u < 0 || u > a.L) return false;
        if (u < ends) return Math.abs(v) <= 1.45;
        if (u < guard) return Math.abs(v) <= 2;
        const s = (u - guard) / (a.L - guard);
        const edge = 1.3 + Math.sin(Math.min(1, s * 1.15) * Math.PI * 0.62) * 2.3;
        const tip = (a.L - u) * 1.3;
        return v >= -1.3 && v <= Math.min(edge, tip - 1.3 + 1.6);
      }, (x, y) => {
        const [u, v] = a.at(x + 0.5, y + 0.5);
        if (u < ends) {
          const rivet = Math.abs(v) < 0.6 && (Math.abs(u - ends * 0.3) < 0.7 || Math.abs(u - ends * 0.75) < 0.7);
          return rivet ? PAL.gold[4] : pick(PAL.wood, 0.35 + (v < 0 ? 0.35 : 0) + (Math.floor(u) % 3 === 0 ? -0.12 : 0), x, y);
        }
        if (u < guard) return pick(PAL.iron, v < 0 ? 0.8 : 0.4, x, y);
        const s = (u - guard) / (a.L - guard);
        const edge = 1.3 + Math.sin(Math.min(1, s * 1.15) * Math.PI * 0.62) * 2.3;
        const e = Math.min(edge, (a.L - u) * 1.3 + 0.3);
        if (v > e - 1) return PAL.steel[5]; // fio
        if (v < -0.4) return PAL.steel[2]; // lombo
        return pick(PAL.steel, 0.5 + (v / e) * 0.25 + (s > 0.15 && s < 0.6 && Math.abs(v) < 0.5 ? -0.2 : 0), x, y);
      });
    });
    // folhas cortadas no ar
    p.set(20, 9, PAL.herb[4]); p.set(21, 10, PAL.herb[3]);
    p.set(12, 21, PAL.herb[3]);
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Estrada: trecho de calçamento de pedras

  function cobbles() {
    const p = new Pix(24, 24);
    const cx = 12, cy = 9.5, hw = 11, hh = 6;
    const iso = (x, y) => [(x - cx) / hw + (y - cy) / hh, (y - cy) / hh - (x - cx) / hw];
    // espessura: areia e terra sob as pedras
    p.fill(1, 9, 22, 21, (x, y) => {
      const t = cy + hh * (1 - Math.abs(x - cx) / hw);
      return Math.abs(x - cx) <= hw && y >= t - 0.5 && y <= t + 4.5;
    }, (x, y) => {
      const k = y + 0.5 - (cy + hh * (1 - Math.abs(x + 0.5 - cx) / hw));
      const lit = x < cx ? 0.2 : 0;
      if (k < 1.5) return pick(PAL.cobble, 0.3 + lit, x, y);
      if (k < 2.6) return pick(PAL.dirt, 0.55 + lit, x, y);
      return pick(PAL.dirt, 0.15 + lit + (hash(x, y, 3) - 0.5) * 0.2, x, y);
    });
    // tampo: pedras graúdas em fiadas desencontradas
    p.fill(1, 3, 22, 16, (x, y) => { const [a, b] = iso(x, y); return Math.abs(a) <= 1 && Math.abs(b) <= 1; }, (x, y) => {
      const [a, b] = iso(x + 0.5, y + 0.5);
      const fa = ((a + 1) / 2) * 3.4, row = Math.floor(fa);
      const fb = ((b + 1) / 2) * 3.4 + (row & 1) * 0.5, col = Math.floor(fb);
      const la = fa - row, lb = fb - col;
      const ea = Math.abs(la - 0.5) * 2, eb = Math.abs(lb - 0.5) * 2;
      if (ea ** 2.5 + eb ** 2.5 > 0.62) return PAL.cobble[0];
      const t = hash(col, row, 11);
      const rp = t < 0.4 ? PAL.stone : PAL.cobble;
      // luz de cima à esquerda: lado b baixo e a baixo são o alto da pedra
      return pick(rp, 0.4 + t * 0.2 + (la < 0.38 ? 0.3 : la > 0.7 ? -0.15 : 0) + (lb < 0.3 ? 0.08 : 0), x, y, 4);
    });
    // pedras soltas na frente
    p.sphere(4.5, 19.5, 1.9, 1.4, PAL.stone, 0.05);
    p.sphere(19.5, 19.8, 1.7, 1.3, PAL.cobble, 0.15);
    p.sphere(17.2, 21, 1.2, 0.9, PAL.stone, 0);
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Porto: guindaste de madeira içando um caixote

  function crane() {
    const p = new Pix(24, 24);
    layer(p, (q) => {
      // base em cruz
      q.rect(2, 19, 11, 2, (x, y) => pick(PAL.wood, y === 19 ? 0.7 : 0.35, x, y));
      q.rect(4, 21, 2, 1, PAL.wood[1]);
      q.rect(9, 21, 2, 1, PAL.wood[1]);
      // poste
      q.fill(6, 4, 8, 18, () => true, (x, y) => pick(PAL.wood, 0.25 + cylLight((x + 0.5 - 7.3) / 1.6) * 0.6 + ((y % 4) === 0 ? -0.1 : 0), x, y));
      // mão-francesa e lança
      rod(q, 8, 15, 12.5, 6.5, 0.75, PAL.wood, 0.25);
      rod(q, 6.5, 6, 20, 2.5, 1.05, PAL.wood, 0.3);
      // sarilho com manivela
      q.rect(5, 12, 5, 3, (x, y) => (x === 5 || x === 9 ? PAL.wood[y === 12 ? 4 : 2] : PAL.straw[y === 12 ? 4 : (x & 1) ? 2 : 3]));
      q.line(4, 13, 3, 11, PAL.iron[3]);
      q.set(3, 10, PAL.iron[4]);
      // roldana na ponta
      q.sphere(20, 3, 1.5, 1.5, PAL.iron, 0.1);
    });
    // corda e gancho
    for (let y = 5; y <= 12; y++) p.set(20, y, PAL.straw[y & 1 ? 2 : 3]);
    p.line(20, 12, 17, 15, PAL.straw[2]); // lingas até o caixote
    p.line(20, 12, 22, 14, PAL.straw[2]);
    p.set(20, 12, PAL.iron[3]);
    // caixote pendurado
    layer(p, (q) => {
      q.rect(16, 15, 7, 6, (x, y) => {
        if (x === 16 || x === 22 || y === 15 || y === 20) return PAL.wood[y === 15 ? 4 : 2];
        return x - 16 === y - 15 || 22 - x === y - 15 ? PAL.wood[3] : PAL.wood[1];
      });
      for (const [x, y] of [[16, 15], [22, 15], [16, 20], [22, 20]]) q.set(x, y, PAL.iron[3]);
    });
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Navio: casco calafetado na água

  // Valor de uma linha quebrada [[x, y], ...] em x.
  function along(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
    return pts[pts.length - 1][1];
  }

  function hull() {
    const p = new Pix(24, 24);
    const deck = [[1.5, 8], [9, 8.6], [15, 8.4], [18.5, 7], [20.5, 5], [22, 2.6]];
    const keel = [[22.4, 4.2], [21.4, 8], [19.6, 11.6], [16.6, 14.6], [11, 16.2], [6, 15.8], [3.2, 13.6], [1.8, 10.5]];
    // gurupés na proa
    p.line(20, 4, 22, 1, PAL.wood[3]);
    // castelo de popa
    p.rect(2, 5, 5, 4, (x, y) => (y === 5 ? PAL.wood[4] : x === 4 && y === 7 ? TAR : pick(PAL.wood, 0.5 - (x - 2) * 0.04, x, y)));
    // casco de tábuas com costuras de piche
    p.poly([...deck, ...keel], (x, y) => {
      const d = y + 0.5 - along(deck, x + 0.5);
      if (d < 1.1) return PAL.wood[4]; // amurada
      const k = (d - 1.1) / 2.6, strake = Math.floor(k), f = k - strake;
      if (f < 0.38) return hash(x, strake, 6) < 0.15 ? PAL.iron[3] : TAR;
      const butt = (x + strake * 5) % 9 === 0;
      return pick(PAL.wood, 0.68 - d * 0.045 + (f < 0.7 ? 0.08 : -0.04) + (butt ? -0.18 : 0), x, y, 3);
    });
    // escorridos de piche
    for (const [x, y] of [[8, 11], [14, 12]]) p.set(x, y + 1, TAR);
    // água com marolas e o reflexo do casco
    p.fill(0, 14, 23, 22, (x, y) => {
      const w = 15 + Math.sin(x * 0.9) * 0.6;
      return y >= w && y <= 19.5 && Math.abs(x - 11.5) <= 11.6 - Math.max(0, y - 17) * 1.4;
    }, (x, y) => {
      const w = 15 + Math.sin(x * 0.9) * 0.6;
      if (y < w + 1) return PAL.water[5];
      const under = x >= 3 && x <= 18 && y < 18;
      return pick(PAL.water, (under ? 0.3 : 0.62) - (y - 15) * 0.06, x, y, 3);
    });
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Navegador: sextante de latão

  function sextant() {
    const p = new Pix(24, 24);
    const px = 12, py = 2, R = 18.5, A = 0.52;
    const holes = [[12, 9.5, 2.3], [8.6, 14.6, 1.9], [15.4, 14.6, 1.9]];
    layer(p, (q) => {
      // setor de latão vazado, com o arco graduado embaixo
      q.fill(1, 1, 22, 21, (x, y) => {
        const d = Math.hypot(x - px, y - py), a = Math.atan2(x - px, y - py);
        if (d > R || Math.abs(a) > A) return false;
        if (d > R - 3.6) return true;
        if (holes.some(([hx, hy, hr]) => Math.hypot(x - hx, y - hy) <= hr)) return false;
        return d < 3 || Math.abs(Math.abs(a) - A) * d < 1.6 || holes.some(([hx, hy, hr]) => Math.hypot(x - hx, y - hy) <= hr + 1.1);
      }, (x, y) => {
        const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
        if (d > R - 1.1) return x % 2 ? PAL.steel[2] : PAL.steel[5]; // escala
        if (d > R - 1.8) return PAL.steel[3];
        return pick(BRASS, 0.3 + sphereLight((x + 0.5 - 9) / 13, (y + 0.5 - 6) / 16) * 0.7, x, y, 3);
      });
    });
    // luneta presa à armação
    layer(p, (q) => {
      rod(q, 13, 6.5, 20.5, 6.5, 1.1, PAL.steel, 0.3);
      q.rect(21, 5, 1, 3, PAL.iron[3]);
      q.rect(12, 5, 1, 3, BRASS[4]);
    });
    // alidade com espelho no pivô e o nônio no arco
    layer(p, (q) => {
      rod(q, px, py + 1, 14.4, 20.4, 0.65, PAL.iron, 0.5);
      q.rect(13, 19, 3, 3, (x, y) => (y === 19 ? PAL.iron[4] : PAL.iron[2]));
      q.rect(11, 1, 3, 3, (x, y) => (x === 12 && y === 2 ? PAL.water[4] : PAL.iron[x === 11 || y === 1 ? 4 : 2]));
    });
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Expedição: barril, peixe seco, presunto curado e sal grosso

  function provisions() {
    const p = new Pix(24, 24);
    layer(p, (q) => {
      const cx = 7.5;
      const hw = (y) => 4.9 - ((y - 14.5) / 7) ** 2 * 1.1;
      q.fill(1, 8, 14, 21, (x, y) => Math.abs(x - cx) <= hw(y), (x, y) => {
        const n = (x + 0.5 - cx) / hw(y + 0.5);
        const stave = Math.abs(((n * 2.5 + 10) % 1) - 0.5) < 0.12;
        return pick(PAL.wood, 0.22 + cylLight(n) * 0.68 + (stave ? -0.16 : 0), x, y);
      });
      for (const y of [10, 18]) q.fill(1, y, 14, y + 1, (x, yy) => Math.abs(x - cx) <= hw(yy),
        (x, yy) => pick(PAL.iron, 0.2 + cylLight((x + 0.5 - cx) / hw(yy)) * 0.75 + (yy === y ? 0.1 : -0.1), x, yy));
      q.ellipse(cx, 8, 3.9, 1.4, (x, y) => pick(PAL.wood, 0.55 + (y < 8 ? 0.2 : 0) + (x === 7 ? -0.2 : 0), x, y));
    });
    // bacalhau seco deitado na tampa
    layer(p, (q) => {
      q.fill(2, 2, 13, 8, (x, y) => { const t = (x - 8) / 4.6; return Math.abs(t) <= 1 && Math.abs(y - 5.6) <= 1.9 * (1 - t * t) ** 0.6; },
        (x, y) => (y < 5 ? GREY[3] : y < 6 ? GREY[5] : GREY[4]));
      q.poly([[1.4, 3.3], [3.9, 5.6], [1.4, 7.9]], (x, y) => GREY[y < 5 ? 3 : 2]);
      q.set(11, 5, PAL.out);
      q.set(6, 6, GREY[3]); q.set(8, 6, GREY[3]);
    });
    // presunto: osso em cima, coxa larga embaixo
    layer(p, (q) => {
      const ham = (x, y) => pick(HAM, 0.12 + sphereLight((x + 0.5 - 16) / 5.5, (y + 0.5 - 12.5) / 7) * 0.88, x, y, 3);
      q.poly([[13.4, 7.5], [15.8, 7.5], [20.8, 13.5], [14.2, 16.5]], ham);
      q.ellipse(17.6, 16.8, 4.4, 4.8, ham);
      q.line(20, 13, 21, 17, HAM[0]);
      q.rect(13, 5, 3, 3, (x) => PAL.linen[x === 13 ? 4 : x === 14 ? 3 : 2]);
      q.ellipse(14.5, 4, 2, 1.3, (x, y) => PAL.linen[y < 4 ? 4 : 3]);
      q.rect(13, 7, 3, 1, PAL.straw[3]); // barbante
      q.set(15, 10, HAM[4]); q.set(16, 11, HAM[4]);
    });
    // sal grosso
    for (const [x, y] of [[5, 4], [9, 4], [19, 20]]) p.set(x, y, PAL.linen[4]);
    p.ellipse(21, 21.2, 1.8, 1, (x, y) => (hash(x, y, 2) > 0.5 ? PAL.linen[4] : PAL.linen[2]));
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Farol: lente polida em anéis, lançando o facho de luz

  function lens() {
    const p = new Pix(24, 24);
    const cx = 9, cy = 10, rx = 6.4, ry = 8;
    // pé e haste
    p.ellipse(9.5, 20.8, 5.5, 1.5, (x, y) => pick(BRASS, y < 21 ? 0.7 : 0.35, x, y));
    p.rect(8, 17, 3, 4, (x) => BRASS[x === 8 ? 4 : x === 9 ? 3 : 1]);
    // espessura do aro (lado em sombra)
    p.ellipse(cx + 1.5, cy + 0.3, rx, ry, BRASS[1]);
    // aro
    p.ellipse(cx, cy, rx, ry, (x, y) => pick(BRASS, 0.3 + sphereLight((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) * 0.7, x, y));
    // vidro com anéis concêntricos e brilho quente no meio
    const gx = 4.7, gy = 6.2;
    p.fill(cx - gx, cy - gy, cx + gx, cy + gy, (x, y) => ((x - cx) / gx) ** 2 + ((y - cy) / gy) ** 2 <= 1, (x, y) => {
      const nx = (x + 0.5 - cx) / gx, ny = (y + 0.5 - cy) / gy, d = Math.hypot(nx, ny);
      if (d < 0.26) return PAL.gold[5];
      if (d < 0.42) return PAL.gold[4];
      const ring = Math.abs(d - 0.62) < 0.09 || Math.abs(d - 0.88) < 0.08;
      return pick(PAL.water, 0.82 - d * 0.5 + sphereLight(nx, ny) * 0.2 + (ring ? 0.28 : 0), x, y);
    });
    p.set(cx, cy, WHITE);
    // reflexos do polimento
    for (const [x, y] of [[6, 5], [5, 6], [5, 7], [7, 4]]) p.set(x, y, WHITE);
    for (const [x, y] of [[9, 2], [3, 10], [9, 18]]) p.set(x, y, BRASS[5]); // parafusos
    p.outline(PAL.out);
    // facho de luz saindo pela direita, sem contorno
    for (const [y0, y1] of [[8, 3], [10, 10], [12, 17]]) {
      p.line(16, y0, 22, y1, (x, y) => (p.get(x, y) ? 0 : x < 19 ? PAL.gold[5] : PAL.gold[4]));
    }
    return p;
  }

  // ---------------------------------------------------------------------------
  // Colônia: carta de foral com selo pendente

  function charter() {
    const p = new Pix(24, 24);
    // folha
    p.rect(4, 3, 16, 14, (x, y) => pick(PARCH, 0.82 - (y - 3) * 0.015 - (x - 4) * 0.008 + (hash(x, y, 3) - 0.5) * 0.08, x, y));
    // rolos de cima e de baixo
    p.rect(3, 2, 18, 2, (x, y) => PARCH[y === 2 ? 4 : 2]);
    p.rect(3, 16, 18, 2, (x, y) => PARCH[y === 16 ? 3 : 1]);
    p.set(3, 3, PARCH[1]); p.set(20, 2, PARCH[2]);
    // inicial iluminada e linhas de texto
    p.rect(6, 5, 3, 3, (x, y) => (x === 7 && y === 6 ? PAL.gold[5] : WAX[2]));
    p.rect(10, 5, 8, 1, WAX[2]);
    for (const y of [7, 9, 11, 13]) {
      for (let x = y === 7 ? 10 : 6; x <= 17; x++) if (hash(x, y, 8) > 0.18 && !(y === 13 && x > 13)) p.set(x, y, INK);
    }
    // fitas e selo de cera
    p.line(11, 17, 9, 22, PAL.banner[2]);
    p.line(12, 17, 14, 22, PAL.gold[3]);
    layer(p, (q) => {
      q.sphere(11.5, 19.2, 2.9, 2.6, WAX, 0.05);
      q.set(11, 19, WAX[0]); q.set(12, 19, WAX[0]); q.set(10, 18, WAX[1]); q.set(13, 18, WAX[1]); q.set(11, 18, WAX[1]);
    });
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Descobridor: diário de bordo aberto com pena

  function logbook() {
    const p = new Pix(24, 24);
    const mid = 11.5;
    const topY = (x) => 6 + (Math.abs(x - mid) < 1 ? 2 : 2 - Math.min(2, Math.abs(x - mid) / 4.5));
    // capa de couro por baixo
    p.fill(1, 6, 22, 20, (x, y) => y >= topY(x) + 1 && y <= 19 + Math.abs(x - mid) * 0.05 && x >= 1 && x <= 22,
      (x, y) => pick(PAL.leather, 0.35 + (y < 15 ? 0.15 : 0), x, y));
    // páginas
    p.fill(2, 5, 21, 18, (x, y) => y >= topY(x) && y <= 17.5 && x >= 2 && x <= 21, (x, y) => {
      const left = x < mid;
      const e = Math.abs(x + 0.5 - mid) / 9.5;
      let v = 0.78 - (1 - e) * 0.25 + (left ? 0.05 : -0.05);
      if (y === 17) v -= 0.25;
      return pick(PARCH, v, x, y);
    });
    p.line(11, 8, 11, 18, PARCH[1]); // lombada
    p.line(12, 8, 12, 18, PARCH[2]);
    // texto na página esquerda
    for (const y of [9, 11, 13, 15]) for (let x = 3; x <= 9; x++) if (hash(x, y, 4) > 0.25) p.set(x, y, PARCH[1]);
    // esboço de costa e rota na página direita
    for (const [x, y] of [[14, 9], [15, 9], [16, 10], [16, 11], [15, 12], [14, 12]]) p.set(x, y, PAL.herb[2]);
    for (const [x, y] of [[18, 10], [19, 12], [18, 14], [16, 15]]) p.set(x, y, INK);
    p.set(19, 15, C('#a8201c'));
    // fita marcadora
    p.line(12, 18, 12, 21, PAL.banner[2]);
    p.set(13, 21, PAL.banner[1]);
    // pena
    layer(p, (q) => {
      rod(q, 15.5, 11.5, 21.5, 1.5, 0.5, PAL.linen, 0.6);
      const a = axis(17, 9, 21.6, 1.2);
      q.fill(15, 0, 23, 11, (x, y) => {
        const [u, v] = a.at(x, y);
        const t = u / a.L;
        return t >= 0 && t <= 1 && Math.abs(v) <= 1.9 * Math.sin(t * Math.PI) ** 0.6;
      }, (x, y) => {
        const [, v] = a.at(x + 0.5, y + 0.5);
        return pick(PAL.linen, v < 0 ? 0.95 : 0.55, x, y);
      });
      q.line(16, 10, 21, 2, PAL.linen[2]);
      q.set(15, 12, INK);
    });
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Novo Mundo: bandeira do reino fincada no chão

  function flag() {
    const p = new Pix(24, 24);
    const wave = (x) => Math.sin((x - 6) * 0.5) * 1.2;
    // monte de terra com capim
    p.ellipse(5.5, 21, 4.6, 1.8, (x, y) => (y < 20.5 ? PAL.grass[4] : pick(PAL.dirt, 0.4 - (y - 20) * 0.1, x, y)));
    // pano ondulando
    p.fill(6, 1, 21, 16, (x, y) => x >= 6 && x <= 21 && y >= 3 + wave(x) && y <= 12 + wave(x) + (x - 6) * 0.08, (x, y) => {
      const s = Math.cos((x + 0.5 - 6) * 0.5);
      let v = 0.55 + s * 0.3 - (y - 3 - wave(x)) * 0.02;
      return pick(PAL.banner, v, x, y);
    });
    // barra dourada junto ao mastro e coroa bordada
    p.fill(6, 1, 7, 16, (x, y) => y >= 3 + wave(x) && y <= 12 + wave(x), (x) => PAL.gold[x === 6 ? 4 : 2]);
    const cy = 7 + Math.round(wave(13));
    p.rect(11, cy, 6, 2, (x, y) => PAL.gold[y === cy ? 4 : 2]);
    for (const x of [11, 13.5, 16]) p.set(x, cy - 1, PAL.gold[4]);
    p.set(13, cy - 2, PAL.gold[5]);
    p.set(14, cy - 1, PAL.gold[4]);
    p.set(13, cy, PAL.banner[2]);
    // mastro com ponta dourada
    p.rect(4, 3, 2, 18, (x) => PAL.wood[x === 4 ? 4 : 2]);
    p.sphere(5, 2, 1.5, 1.4, PAL.gold, 0.1);
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Ritmo: cavalos velozes, duas cabeças com a crina ao vento

  function horses() {
    const p = new Pix(24, 24);
    // crina ao vento
    layer(p, (q) => q.poly([[9.4, 2.6], [11, 4.6], [9.4, 8], [8, 12], [7.4, 16], [7.4, 21.4], [5.4, 21.4], [4, 19.6], [1.6, 19],
      [3.6, 16.8], [1.2, 14.6], [3.8, 12.8], [1.8, 10.2], [4.8, 9.2], [3.4, 6.4], [6.6, 5.6], [6.8, 3.2]],
    (x, y) => pick(HAIR, 0.22 + (((y + x * 0.45) % 3 + 3) % 3 < 1 ? 0.45 : 0) + (x > 5 ? 0.1 : 0) - (y > 17 ? 0.1 : 0), x, y, 3)));
    layer(p, (q) => {
      q.poly([[8, 4.6], [8.4, 1], [10, 3.8]], HORSE[2]); // orelha de trás
      q.poly([[9.2, 5], [10.4, 1.2], [12, 3.6], [13.4, 4.2], [16.2, 6.4], [19.2, 9.4], [21, 11.6], [21.2, 13.8], [20, 15.4],
        [16.8, 15.6], [14.4, 14.4], [12.6, 14], [12.8, 17], [13.8, 21.4], [7, 21.4], [7.2, 15], [7.8, 9.4]],
      (x, y) => pick(HORSE, 0.3 + sphereLight((x + 0.5 - 10) / 14, (y + 0.5 - 7) / 15) * 0.75 - Math.max(0, y - 15) * 0.04, x, y, 3));
      q.set(10, 3, HORSE[1]); q.set(10, 2, HORSE[3]); // dentro da orelha
      // queixada redonda
      for (const [x, y] of [[10, 11], [10, 12], [11, 13], [12, 14], [13, 14], [14, 14]]) q.set(x, y, HORSE[2]);
      q.set(11, 10, HORSE[5]); q.set(11, 11, HORSE[4]); q.set(12, 9, HORSE[5]);
      for (const [x, y] of [[16, 15], [17, 15], [15, 14]]) q.set(x, y, HORSE[1]);
      // estrela branca na testa
      q.set(14, 5, PAL.linen[4]); q.set(15, 6, PAL.linen[3]);
      // olho, narina e boca
      q.set(14, 7, PAL.out); q.set(13, 7, PAL.out); q.set(14, 6, HORSE[1]); q.set(13, 6, HORSE[1]); q.set(14, 8, HORSE[4]);
      q.set(20, 13, PAL.out); q.set(19, 13, HORSE[2]);
      q.line(18, 15, 20, 15, HORSE[0]);
      // cabeçada de couro com argola
      q.line(11, 5, 11, 9, PAL.banner[2]);
      q.line(12, 10, 17, 14, PAL.banner[2]);
      q.line(17, 10, 17, 13, PAL.banner[1]);
      q.set(11, 10, PAL.gold[4]);
      q.set(17, 14, PAL.gold[4]);
    });
    // riscos de velocidade atrás
    for (const [x0, x1, y] of [[2, 5, 2], [1, 3, 5]]) p.line(x0, y, x1, y, PAL.linen[2]);
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Sorte: bússola de latão com agulha

  function compass() {
    const p = new Pix(24, 24);
    const cx = 12, cy = 13.5;
    // argola de pendurar
    p.fill(9, 0, 15, 5, (x, y) => Math.abs(Math.hypot(x - 12, y - 3) - 1.9) < 0.75, (x, y) => BRASS[y < 3 ? 5 : 3]);
    p.rect(11, 4, 2, 2, BRASS[2]);
    // caixa
    p.sphere(cx, cy, 8.6, 8.6, BRASS, 0.05);
    p.fill(cx - 7, cy - 7, cx + 7, cy + 7, (x, y) => Math.hypot(x - cx, y - cy) <= 7, (x, y) => BRASS[x + y < 25 ? 1 : 3]);
    // mostrador
    p.fill(cx - 6.4, cy - 6.4, cx + 6.4, cy + 6.4, (x, y) => Math.hypot(x - cx, y - cy) <= 6.3, (x, y) =>
      pick(PAL.linen, 0.95 - Math.hypot(x + 0.5 - cx + 2, y + 0.5 - cy + 2) * 0.05, x, y));
    // marcas dos rumos
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      p.set(cx + Math.sin(a) * 5.3 - 0.5, cy - Math.cos(a) * 5.3, k % 2 ? PAL.linen[1] : INK);
    }
    // rosa dos ventos discreta
    p.line(cx - 4, cy, cx + 3, cy, PAL.linen[2]);
    // agulha: norte vermelho, sul de aço
    p.poly([[11, 13.5], [12, 7.2], [13, 13.5]], (x) => (x < 12 ? WAX[3] : WAX[2]));
    p.poly([[11, 13.5], [12, 19.8], [13, 13.5]], (x) => (x < 12 ? PAL.steel[4] : PAL.steel[2]));
    p.set(12, 13, PAL.gold[4]);
    // reflexo no vidro
    for (const [x, y] of [[8, 10], [9, 9], [10, 8]]) p.set(x, y, WHITE);
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Recrutamento: edital de colonos pregado no quadro

  function edict() {
    const p = new Pix(24, 24);
    // poste e capim
    p.rect(10, 13, 3, 9, (x) => PAL.wood[x === 10 ? 3 : x === 11 ? 2 : 1]);
    for (const [x, y, k] of [[9, 21, 4], [8, 21, 3], [13, 21, 4], [14, 20, 5], [9, 20, 5]]) p.set(x, y, PAL.grass[k]);
    // quadro de tábuas
    p.rect(2, 3, 20, 12, (x, y) => {
      let v = 0.5 - (y - 3) * 0.02 + (hash(x >> 2, y, 3) - 0.5) * 0.1;
      if (y === 3 || y === 7 || y === 11) v += 0.25;
      if (y === 6 || y === 10 || y === 14) v -= 0.25;
      return pick(PAL.wood, v, x, y);
    });
    p.rect(1, 2, 22, 1, PAL.wood[4]); // beiral
    // folha pregada
    layer(p, (q) => {
      q.poly([[6, 4], [18, 4], [18, 16], [7, 16.4]], (x, y) => pick(PARCH, 0.85 - (y - 4) * 0.02 + (hash(x, y, 1) - 0.5) * 0.06, x, y));
      q.set(18, 16, 0);
      q.set(17, 16, PARCH[2]);
    });
    // título vermelho
    p.rect(8, 6, 9, 1, WAX[2]);
    // três colonos desenhados e a casinha
    for (const [x, c] of [[8, PAL.banner[2]], [10, PAL.hood[3]], [12, PAL.water[2]]]) {
      p.set(x, 9, PAL.skin[3]);
      p.rect(x, 10, 1, 2, c);
    }
    p.poly([[14, 10], [15.5, 8], [17, 10]], PAL.roof[3]);
    p.rect(14, 10, 3, 2, PAL.straw[3]);
    p.set(15, 11, PAL.wood[1]);
    for (let x = 8; x <= 16; x++) if (hash(x, 13, 2) > 0.2) p.set(x, 13, INK);
    for (let x = 8; x <= 13; x++) if (hash(x, 14, 2) > 0.2) p.set(x, 15, INK);
    // pregos
    for (const [x, y] of [[7, 5], [17, 5]]) p.set(x, y, PAL.iron[4]);
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Desconto: tratado de passagem enrolado, com fita, selo e a chave

  function treaty() {
    const p = new Pix(24, 24);
    const x0 = 3, y0 = 16, x1 = 19.5, y1 = 6.5, r = 3.2;
    const a = axis(x0, y0, x1, y1);
    layer(p, (q) => {
      rod(q, x0, y0, x1, y1, r, PARCH, 0.35, 0.65);
      // fita em volta do meio
      q.fill(0, 0, 23, 23, (x, y) => { const [u, v] = a.at(x, y); return Math.abs(u - a.L * 0.48) < 1.1 && Math.abs(v) <= r; },
        (x, y) => { const [, v] = a.at(x + 0.5, y + 0.5); return pick(PAL.banner, 0.35 + cylLight(Math.max(-1, Math.min(1, v / r))) * 0.6, x, y); });
      // ponta do rolo mostrando a espiral
      q.sphere(x1, y1, 2.9, 3.1, PARCH, 0.15);
      q.set(x1 - 1, y1, PARCH[1]); q.set(x1, y1 + 1, PARCH[1]); q.set(x1 + 1, y1, PARCH[2]); q.set(x1, y1, PAL.out);
    });
    // pontas da fita
    p.line(10, 15, 8, 21, PAL.banner[2]);
    p.line(12, 15, 13, 20, PAL.banner[1]);
    // selo
    layer(p, (q) => {
      q.sphere(10.5, 14, 2.6, 2.4, WAX, 0.1);
      q.set(10, 14, WAX[1]); q.set(11, 14, WAX[1]); q.set(10, 13, WAX[4]);
    });
    // chave de ferro presa à fita
    layer(p, (q) => {
      q.fill(13, 15, 19, 21, (x, y) => Math.abs(Math.hypot(x - 16, y - 17.5) - 1.8) < 0.7, (x, y) => PAL.iron[x + y < 33 ? 4 : 2]);
      q.line(17, 19, 21, 21, PAL.iron[3]);
      q.line(18, 19, 21, 20, PAL.iron[4]);
      q.rect(20, 21, 1, 2, PAL.iron[3]);
      q.set(21, 22, PAL.iron[2]);
    });
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Bonança: mapa do tesouro com a ilha, o X e moedas

  function treasureMap() {
    const p = new Pix(24, 24);
    // pergaminho de bordas rasgadas
    p.fill(1, 3, 22, 20, (x, y) => {
      const jx = (hash(0, y, 5) - 0.5) * 1.5, jy = (hash(x, 0, 6) - 0.5) * 1.5;
      return x >= 1.5 + jx && x <= 21.5 - jx * 0.5 && y >= 3.5 + jy && y <= 19.5 + jy * 0.7;
    }, (x, y) => {
      const e = Math.min(x - 1, 22 - x, y - 3, 20 - y);
      return pick(PARCH, 0.45 + Math.min(e, 3) * 0.12 + (hash(x, y, 7) - 0.5) * 0.1, x, y);
    });
    // mar riscado
    for (const [x, y] of [[4, 6], [5, 6], [16, 5], [17, 5], [3, 15], [4, 15], [18, 17], [19, 17]]) p.set(x, y, PAL.water[2]);
    // ilha: areia e mata
    p.fill(5, 7, 18, 17, (x, y) => ((x - 11) / 6.5) ** 2 + ((y - 12) / 4.2) ** 2 <= 1 + (hash(x, y, 2) - 0.5) * 0.3,
      (x, y) => {
        const d = ((x + 0.5 - 11) / 6.5) ** 2 + ((y + 0.5 - 12) / 4.2) ** 2;
        return d > 0.6 ? PAL.straw[3] : pick(PAL.herb, 0.45 + (y < 11 ? 0.2 : 0) + (hash(x, y, 3) - 0.5) * 0.3, x, y);
      });
    // trilha tracejada até o X
    for (const [x, y] of [[6, 14], [8, 13], [9, 12], [11, 11]]) p.set(x, y, INK);
    for (const [x, y, k] of [[13, 9, 3], [15, 9, 2], [14, 10, 3], [13, 11, 2], [15, 11, 1]]) p.set(x, y, WAX[k]);
    // moedas de ouro empilhadas no canto
    layer(p, (q) => {
      for (let i = 0; i < 3; i++) q.ellipse(18.5, 21 - i * 1.6, 3.4, 1.5, (x, y) => PAL.gold[y < 21 - i * 1.6 ? 4 : 2]);
      q.ellipse(18.5, 21 - 2 * 1.6, 3.4, 1.5, (x, y) => pick(PAL.gold, 0.6 + sphereLight((x + 0.5 - 18.5) / 3.4, 0) * 0.4, x, y));
      q.set(17, 17, PAL.gold[5]);
      q.ellipse(14, 21.5, 2.4, 1.1, (x, y) => PAL.gold[y < 21 ? 4 : 2]);
    });
    p.outline(PAL.out);
    return p;
  }

  Object.assign(ART.icons, {
    'c-fart:batedor': boots,
    'c-fart:acampamento': tent,
    'c-fart:cartografo': dividers,
    'c-fart:posto': palisade,
    'c-fart:caravana': wagon,
    'c-fart:desbravador': machete,
    'c-fart:estrada': cobbles,
    'c-fart:porto': crane,
    'c-fart:navio': hull,
    'c-fart:navegador': sextant,
    'c-fart:expedicao': provisions,
    'c-fart:farol': lens,
    'c-fart:colonia': charter,
    'c-fart:descobridor': logbook,
    'c-fart:novomundo': flag,
    'c-ritmo:exploracao': horses,
    'c-sorte:exploracao': compass,
    'c-recruta:exploracao': edict,
    'c-desconto:exploracao': treaty,
    'c-bonanca:exploracao': treasureMap,
  });
})();
