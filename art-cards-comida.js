'use strict';
// Arte das cartas da linha comida: uma ilustração 24x24 por carta (ferramentas dos geradores e cartas da linha).
(() => {
  const S = 24;
  const DARK = C('#140c0a');
  const INK = C('#3a2418');
  const BLUE = ramp('#141a36', '#22305e', '#33498a', '#4d68b0', '#7590d0', '#a8c0ea');
  const RUBY = ramp('#3a0a14', '#7a1424', '#b8263a', '#e85a6a', '#ffb0b8');
  const WAX = ramp('#3a0c10', '#6e1418', '#a42222', '#d23e30', '#f07a5a');

  // ---------------------------------------------------------------------------
  // Peças comuns

  // Tubo ao longo de um caminho: path(t) -> [x, y], rad(t) -> raio, col(t, s, x, y) -> cor.
  // s vai de -1 (lado de cima/esquerda, iluminado) a 1 (lado da sombra).
  function tube(p, path, rad, col, n = 48) {
    const pts = [];
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const [x, y] = path(t);
      const r = rad(t);
      pts.push([x, y, r, t]);
      bx0 = Math.min(bx0, x - r); by0 = Math.min(by0, y - r);
      bx1 = Math.max(bx1, x + r); by1 = Math.max(by1, y + r);
    }
    for (let y = Math.max(0, Math.floor(by0)); y <= Math.min(S - 1, Math.ceil(by1)); y++) {
      for (let x = Math.max(0, Math.floor(bx0)); x <= Math.min(S - 1, Math.ceil(bx1)); x++) {
        const px = x + 0.5, py = y + 0.5;
        let best = Infinity, bi = 0;
        for (let i = 0; i <= n; i++) {
          const d = Math.hypot(px - pts[i][0], py - pts[i][1]) / pts[i][2];
          if (d < best) { best = d; bi = i; }
        }
        if (best > 1) continue;
        const a = pts[Math.max(0, bi - 1)], b = pts[Math.min(n, bi + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const l = Math.hypot(nx, ny) || 1;
        nx /= l; ny /= l;
        if (nx + ny < 0) { nx = -nx; ny = -ny; }
        const [sx, sy, r, t] = pts[bi];
        const s = ((px - sx) * nx + (py - sy) * ny) / r;
        p.set(x, y, col(t, s, x, y));
      }
    }
    return p;
  }
  const seg = (x0, y0, x1, y1) => (t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  const shadeCyl = (r, bias = 0) => (t, s, x, y) => pick(r, 0.12 + cylLight(s) * 0.85 + bias, x, y);
  function stick(p, x0, y0, x1, y1, r, rmp, bias = 0) {
    return tube(p, seg(x0, y0, x1, y1), () => r, shadeCyl(rmp, bias), Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3) + 2);
  }
  const ball = (p, cx, cy, r, rmp, bias = 0.05) => p.sphere(cx, cy, r, r, rmp, bias);
  const shine = (p, x, y, c = PAL.linen[4]) => p.set(x, y, c);

  // ---------------------------------------------------------------------------
  // Ferramentas dos geradores

  // Foice afiada: lâmina em meia-lua com fio brilhante e cabo de madeira.
  function sickle() {
    const p = new Pix(S, S);
    stick(p, 18, 22, 19.4, 15.5, 1.6, PAL.wood);
    for (const y of [17, 19]) p.set(18, y, PAL.wood[1]); // veios do cabo
    stick(p, 19.2, 16, 19.6, 14.2, 1.9, PAL.iron, 0.1); // virola
    const cx = 11.6, cy = 12.2, R = 8.2;
    tube(p, (t) => {
      const a = -0.2 + t * (Math.PI * 0.98);
      return [cx + Math.cos(a) * R, cy - Math.sin(a) * R];
    }, (t) => 0.5 + 2.1 * (1 - t) ** 0.6, (t, s, x, y) => {
      const dr = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - R; // <0: fio (lado de dentro)
      if (dr < -0.9 + t * 0.5) return (x + y) % 3 ? PAL.steel[5] : PAL.steel[4];
      let v = 0.62 - (x - 6) * 0.012 - (y - 4) * 0.035 + dr * 0.18;
      return pick(PAL.steel, v, x, y);
    }, 96);
    p.set(5, 7, PAL.steel[5]); // reflexo
    p.set(15, 5, PAL.steel[5]);
    p.outline(PAL.out);
    return p;
  }

  // Mó de pedra: roda de pedra em pé, com sulcos raiados, eixo de madeira e farinha.
  function millstone() {
    const p = new Pix(S, S);
    const cx = 10.5, cy = 11, R = 9.4;
    // espessura vista de lado
    p.fill(cx - R + 2, cy - R, cx + R + 2.6, cy + R + 0.6, (x, y) => Math.hypot(x - cx - 2.4, y - cy - 0.5) <= R,
      (x, y) => pick(PAL.stone, 0.12 + (hash(x, y, 3) - 0.5) * 0.15 + ((y + 1) % 3 === 0 ? -0.08 : 0.1), x, y));
    // face picada
    p.fill(cx - R, cy - R, cx + R, cy + R, (x, y) => Math.hypot(x - cx, y - cy) <= R, (x, y) => {
      const nx = (x + 0.5 - cx) / R, ny = (y + 0.5 - cy) / R;
      const r = Math.hypot(nx, ny);
      let v = 0.62 - nx * 0.22 - ny * 0.22 + (hash(x, y, 5) - 0.5) * 0.2;
      if (r > 0.86) v += (nx + ny < 0 ? 0.2 : -0.2); // aro chanfrado
      return pick(PAL.stone, v, x, y);
    });
    // sulcos raiados, curvos
    for (let k = 0; k < 8; k++) {
      const a0 = k * Math.PI / 4 + 0.15;
      for (let r = 3.2; r <= 7.9; r += 0.2) {
        const a = a0 + (r - 3) * 0.1;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        p.set(x, y, PAL.stone[1]);
        p.set(x - Math.sin(a) * 1.2, y + Math.cos(a) * 1.2, PAL.stone[5]);
      }
    }
    // olho quadrado com o eixo de madeira
    p.rect(8, 9, 5, 5, DARK);
    p.rect(9, 10, 3, 3, (x, y) => pick(PAL.wood, 0.85 - (x - 9) * 0.2 - (y - 10) * 0.15, x, y));
    p.set(9, 10, PAL.wood[4]);
    // farinha caída na frente
    p.fill(13, 17, 22, 22, (x, y) => ((x - 18) / 4.6) ** 2 + ((y - 22.5) / 4.2) ** 2 <= 1,
      (x, y) => pick(PAL.linen, 0.45 + sphereLight((x + 0.5 - 17) / 4.6, (y + 0.5 - 19.5) / 3.4) * 0.6, x, y));
    p.set(12, 21, PAL.linen[3]); p.set(22, 21, PAL.linen[2]);
    p.outline(PAL.out);
    return p;
  }

  // Tranca de ferro: porta de celeiro em tábuas, travada por uma barra e cadeado.
  function bolt() {
    const p = new Pix(S, S);
    for (let i = 0; i < 4; i++) {
      const x0 = 2 + i * 5, x1 = x0 + 4;
      p.fill(x0, 2, x1, 21, () => true, (x, y) => {
        if (x === x1 && i < 3) return PAL.wood[1];
        let v = 0.5 + (x === x0 ? 0.18 : 0) - (y - 2) * 0.01 + (hash(x, (y / 4) | 0, i) - 0.5) * 0.18;
        if (hash(x, y, 9 + i) < 0.08) v -= 0.25;
        return pick(PAL.wood, v, x, y);
      });
    }
    // ferragens das dobradiças
    for (const y of [4, 18]) {
      p.rect(2, y, 20, 2, (x, yy) => PAL.iron[yy === y ? 2 : 1]);
      for (const x of [4, 9, 14, 19]) p.set(x, y, PAL.iron[4]);
    }
    // barra de ferro
    p.rect(1, 9, 22, 4, (x, y) => (x === 1 || x === 22) ? PAL.iron[2] : PAL.iron[[4, 3, 2, 1][y - 9]]);
    p.set(3, 9, PAL.iron[4]); p.set(4, 9, PAL.steel[5]);
    // grampos que seguram a barra
    for (const bx of [5, 16]) {
      p.rect(bx, 8, 3, 6, (x, y) => (y === 8 || y === 13 ? PAL.iron[x === bx ? 3 : 2] : x === bx ? PAL.iron[2] : PAL.iron[1]));
      p.rect(bx + 1, 9, 1, 4, (x, y) => PAL.iron[[4, 3, 2, 1][y - 9]]);
      p.set(bx + 1, 8, PAL.iron[4]);
    }
    // cadeado pendurado
    p.fill(10, 12, 14, 16, (x, y) => {
      const d = Math.hypot(x - 12, y - 15.5);
      return d <= 2.6 && d >= 1.4 && y < 15.5;
    }, PAL.iron[3]);
    p.rect(9, 15, 7, 6, (x, y) => pick(PAL.gold, 0.35 + (x < 12 ? 0.25 : 0) + (y === 15 ? 0.3 : 0), x, y));
    p.set(12, 17, DARK); p.set(12, 18, DARK);
    p.set(10, 16, PAL.gold[5]);
    p.outline(PAL.out);
    return p;
  }

  // Arado de bois: relha de ferro abrindo o sulco, timão com a canga dos bois e as rabiças.
  function plow() {
    const p = new Pix(S, S);
    // terra com sulcos
    p.fill(1, 16, 22, 22, (x, y) => y >= 18 - Math.max(0, 2.5 - Math.abs(x - 17) * 0.5),
      (x, y) => pick(PAL.dirt, 0.65 - (y - 17) * 0.08 + ((x + y * 2) % 5 === 0 ? -0.3 : 0) + (hash(x, y, 4) - 0.5) * 0.15, x, y));
    // rabiças (a de trás mais escura) e travessa
    stick(p, 14.5, 14.5, 21, 3, 0.85, PAL.wood, -0.3);
    stick(p, 13, 15, 19, 3.5, 1, PAL.wood, 0.05);
    stick(p, 16, 9, 19.6, 8.6, 0.6, PAL.wood, -0.1);
    p.rect(18, 3, 2, 1, PAL.wood[4]);
    // timão até a canga
    stick(p, 14, 14, 5.5, 5.5, 1.2, PAL.wood);
    // canga: barra grossa com as duas argolas dos bois
    stick(p, 1.6, 4, 9.8, 4, 1.25, PAL.wood, 0.15);
    for (const ax of [3.2, 8.2]) {
      tube(p, (t) => [ax - Math.cos(Math.PI * t) * 1.6, 5 + Math.sin(Math.PI * t) * 2.6], () => 0.55,
        (t, s, x, y) => PAL.wood[t < 0.5 ? 4 : 2], 24);
    }
    p.set(5, 4, PAL.iron[3]); p.set(6, 4, PAL.iron[2]); // pino de ferro
    // aiveca de ferro e relha de aço afiada
    p.poly([[11, 12], [16, 13], [16.5, 19], [11.5, 18]], (x, y) => pick(PAL.iron, 0.6 - (x - 11) * 0.08 + (y < 14 ? 0.2 : 0), x, y));
    p.poly([[2, 19.5], [12, 15.5], [16, 17.5], [15, 21], [5, 21]], (x, y) => pick(PAL.steel, 0.95 - (y - 16) * 0.16 - (x - 3) * 0.01, x, y));
    p.line(4, 19, 12, 16, PAL.steel[5]);
    p.set(2, 19, PAL.steel[5]);
    p.outline(PAL.out);
    return p;
  }

  // Poço novo: bocal de pedra, telhadinho de palha nova, sarilho e balde.
  function well() {
    const p = new Pix(S, S);
    const cx = 12;
    // postes
    for (const x of [4, 18]) p.rect(x, 6, 2, 9, (xx) => PAL.wood[xx === x ? 3 : 1]);
    // bocal de pedra (cilindro com fiadas)
    p.fill(3, 13, 21, 22, (x, y) => Math.abs(x + 0.5 - cx) <= 8.6 && (y <= 19 || ((x + 0.5 - cx) / 8.6) ** 2 + ((y + 0.5 - 19) / 2.6) ** 2 <= 1),
      (x, y) => {
        const nx = (x + 0.5 - cx) / 8.6;
        const row = Math.floor((y - 14) / 2.5);
        const mortar = (y - 14) % 3 === 2 || (Math.floor((x + row * 2) / 4) !== Math.floor((x + 1 + row * 2) / 4));
        let v = 0.18 + cylLight(nx) * 0.7 + (hash(Math.floor((x + row * 2) / 4), row, 7) - 0.5) * 0.2;
        return pick(PAL.stone, mortar ? v - 0.3 : v, x, y);
      });
    // borda e água
    p.ellipse(cx, 13.5, 8.6, 2.6, (x, y) => pick(PAL.stone, 0.75 - (x - 4) * 0.02 + (y > 13 ? -0.1 : 0.1), x, y));
    p.ellipse(cx, 13.6, 6.6, 1.5, (x, y) => (y < 13 ? DARK : PAL.water[x < 10 ? 2 : 1]));
    p.set(8, 14, PAL.water[4]);
    // telhado de palha
    p.poly([[1, 7.5], [12, 1], [23, 7.5], [21, 8.5], [3, 8.5]], (x, y) => {
      let v = 0.75 - (x - 4) * 0.025 - (y - 2) * 0.04 + ((x * 2 + y) % 4 === 0 ? -0.25 : 0);
      return pick(PAL.straw, v, x, y);
    });
    for (let x = 3; x <= 20; x++) p.set(x, 8, PAL.straw[(x % 2) ? 2 : 1]);
    // sarilho com manivela
    stick(p, 5, 9.5, 19, 9.5, 0.9, PAL.wood, 0.05);
    p.rect(9, 9, 6, 2, (x, y) => PAL.straw[y === 9 ? 3 : 2]); // corda enrolada
    p.rect(20, 9, 1, 3, PAL.iron[3]); p.rect(21, 11, 1, 1, PAL.iron[2]);
    // balde
    p.set(12, 11, PAL.straw[2]);
    p.rect(10, 12, 5, 3, (x, y) => (y === 13 ? PAL.iron[2] : pick(PAL.wood, 0.75 - (x - 10) * 0.15, x, y)));
    p.outline(PAL.out);
    return p;
  }

  // Balança justa: travessão nivelado, moedas num prato e o peso no outro.
  function scales() {
    const p = new Pix(S, S);
    // base de madeira
    p.poly([[6, 22.5], [7.5, 19], [16.5, 19], [18, 22.5]], (x, y) => pick(PAL.wood, 0.8 - (x - 7) * 0.05 - (y - 19) * 0.08, x, y));
    p.rect(7, 19, 10, 1, PAL.wood[4]);
    // coluna
    stick(p, 12, 4.5, 12, 19, 1.1, PAL.iron, 0.05);
    // travessão e fiel
    p.rect(2, 5, 20, 2, (x, y) => (y === 5 ? PAL.gold[4] : PAL.gold[2]));
    p.rect(11, 2, 2, 3, (x, y) => PAL.gold[x === 11 ? 5 : 3]);
    ball(p, 12, 6, 1.6, PAL.gold, 0.2);
    p.rect(1, 5, 1, 2, PAL.gold[3]); p.rect(22, 5, 1, 2, PAL.gold[1]);
    for (const cx of [4.5, 19.5]) {
      // correntes
      p.line(cx - 0.5, 7, cx - 3, 13, (x, y) => PAL.iron[y % 2 ? 3 : 2]);
      p.line(cx - 0.5, 7, cx + 2, 13, (x, y) => PAL.iron[y % 2 ? 2 : 1]);
      // prato
      p.fill(cx - 4, 13, cx + 4, 17, (x, y) => ((x - cx) / 4) ** 2 + ((y - 13.4) / 3) ** 2 <= 1 && y >= 13,
        (x, y) => pick(PAL.gold, 0.25 + cylLight((x + 0.5 - cx) / 4) * 0.7 + (y === 13 ? 0.2 : 0), x, y));
    }
    // moedas na esquerda
    for (const [x, y] of [[3, 12], [5, 12], [4, 11]]) {
      p.rect(x - 1, y, 3, 1, PAL.gold[3]);
      p.set(x - 1, y, PAL.gold[5]);
    }
    // peso de ferro na direita
    p.rect(18, 10, 4, 3, (x, y) => pick(PAL.iron, 0.75 - (x - 18) * 0.15 - (y - 10) * 0.1, x, y));
    p.rect(19, 9, 2, 1, PAL.iron[3]);
    p.outline(PAL.out);
    return p;
  }

  // Muralha alta: pano de pedra com ameias, seteiras e o caminho de ronda.
  function wall() {
    const p = new Pix(S, S);
    const blk = (x, y, seed) => {
      const row = Math.floor((y - 1) / 3);
      const off = row % 2 ? 2 : 0;
      const col = Math.floor((x + off) / 5);
      if ((y - 1) % 3 === 2 || (x + off) % 5 === 4) return -1;
      return hash(col, row, seed);
    };
    const shade = (x, y, base) => {
      const h = blk(x, y, 3);
      if (h < 0) return PAL.stone[1];
      const top = (y - 1) % 3 === 0;
      return pick(PAL.stone, base + (h - 0.5) * 0.3 + (top ? 0.12 : 0) - (x - 2) * 0.012, x, y);
    };
    // ameias
    for (const x0 of [1, 7, 13, 19]) p.rect(x0, 1, 4, 5, (x, y) => (y === 1 ? PAL.stone[5] : shade(x, y, 0.62)));
    // sombra do adarve
    p.rect(1, 6, 22, 1, PAL.stone[1]);
    p.rect(1, 7, 22, 1, PAL.stone[4]);
    // pano da muralha
    p.rect(1, 8, 22, 12, (x, y) => shade(x, y, 0.55 - (y - 8) * 0.012));
    // seteiras
    for (const sx of [6, 17]) {
      p.rect(sx, 10, 1, 6, DARK);
      p.rect(sx - 1, 12, 3, 1, DARK);
      p.rect(sx + 1, 10, 1, 6, PAL.stone[2]);
      p.set(sx - 1, 13, PAL.stone[2]);
    }
    // estandarte no meio
    p.rect(11, 9, 2, 6, (x, y) => (y === 14 ? (x === 11 ? PAL.banner[2] : 0) : PAL.banner[x === 11 ? 3 : 2]));
    p.set(11, 9, PAL.gold[4]); p.set(12, 9, PAL.gold[3]);
    // base com mato
    p.rect(1, 20, 22, 2, (x, y) => pick(PAL.grass, 0.6 - (y - 20) * 0.3 + (hash(x, y, 2) - 0.5) * 0.3, x, y));
    for (const x of [2, 5, 9, 14, 18, 21]) p.set(x, 19, PAL.grass[x % 2 ? 3 : 4]);
    p.outline(PAL.out);
    return p;
  }

  // Livro de contas: livro aberto com colunas de números, pena e moedas.
  function ledger() {
    const p = new Pix(S, S);
    // capa de couro por baixo
    p.poly([[1, 7], [11.5, 9], [22.5, 7], [22.5, 20], [11.5, 22.5], [1, 20]], (x, y) => pick(PAL.leather, 0.3 + (y > 19 ? -0.1 : 0.1), x, y));
    // páginas
    p.poly([[2, 6], [11.5, 8], [11.5, 21], [2, 19]], (x, y) => pick(PAL.linen, 0.85 - (x - 2) * 0.03 + (x > 9 ? -0.15 : 0), x, y));
    p.poly([[12, 8], [22, 6], [22, 19], [12, 21]], (x, y) => pick(PAL.linen, 0.7 - (x - 12) * 0.015 + (x < 14 ? -0.15 : 0), x, y));
    p.line(11, 8, 11, 21, PAL.linen[1]);
    p.line(12, 8, 12, 21, PAL.linen[2]);
    // linhas de texto à esquerda e números em colunas à direita
    for (let r = 0; r < 5; r++) {
      const y0 = 9 + r * 2;
      for (let x = 3; x <= 9; x++) if (hash(x, r, 1) > 0.2 && !(r === 4 && x > 6)) p.set(x, y0 + Math.round((x - 2) * 0.2), INK);
      for (const x of [14, 15, 18, 19, 20]) if (hash(x, r, 2) > 0.15) p.set(x, y0 + 1 - Math.round((x - 12) * 0.2), x < 17 ? INK : PAL.band[1]);
    }
    p.line(17, 9, 17, 18, PAL.linen[2]);
    // pena
    tube(p, seg(21.5, 1.5, 15.5, 9.5), (t) => 0.5 + Math.sin(t * Math.PI) * 1.4 * (1 - t * 0.5),
      (t, s, x, y) => pick(PAL.sail, 0.85 - s * 0.35 - t * 0.2, x, y), 40);
    p.line(21, 2, 15, 10, PAL.sail[1]);
    p.set(15, 10, INK);
    // moedas
    for (const [x, y] of [[19, 21], [19, 20], [19, 19]]) p.ellipse(x, y, 2.6, 1.2, (xx, yy) => PAL.gold[yy < y ? 4 : 2]);
    p.ellipse(19, 18.6, 2.6, 1.1, (x, y) => PAL.gold[x < 19 ? 4 : 3]);
    p.set(18, 18, PAL.gold[5]);
    p.outline(PAL.out);
    return p;
  }

  // Ponte levadiça: portão de pedra com a ponte de tábuas baixada sobre o fosso.
  function drawbridge() {
    const p = new Pix(S, S);
    // fosso
    p.rect(1, 17, 22, 5, (x, y) => pick(PAL.water, 0.55 - (y - 17) * 0.1 + ((x + y * 3) % 7 === 0 ? 0.35 : 0), x, y));
    // torre do portão
    p.rect(3, 4, 18, 13, (x, y) => {
      const row = Math.floor((y - 4) / 3), off = row % 2 ? 2 : 0;
      if ((y - 4) % 3 === 2 || (x + off) % 4 === 3) return PAL.stone[1];
      return pick(PAL.stone, 0.55 - (x - 3) * 0.015 + (hash(Math.floor((x + off) / 4), row, 11) - 0.5) * 0.3, x, y);
    });
    for (const x0 of [3, 8, 13, 18]) p.rect(x0, 1, 3, 3, (x, y) => (y === 1 ? PAL.stone[5] : PAL.stone[x === x0 ? 4 : 3]));
    p.rect(3, 4, 18, 1, PAL.stone[1]);
    // arco escuro com a grade levantada
    p.fill(7, 7, 16, 16, (x, y) => Math.abs(x - 12) <= 4.2 && (y >= 10 || Math.hypot(x - 12, y - 10.5) <= 4.2), (x, y) =>
      (y < 10 && (x % 2 === 0 || y === 8)) ? PAL.iron[1] : DARK);
    p.fill(6, 6, 17, 16, (x, y) => {
      const d = Math.hypot(x - 12, y - 10.5);
      return y < 10.5 && d > 4.2 && d <= 5.3;
    }, (x, y) => PAL.stone[x < 12 ? 5 : 3]);
    // ponte baixada em perspectiva
    p.poly([[7.5, 16], [16.5, 16], [19.5, 22.5], [4.5, 22.5]], (x, y) => {
      const plank = (y - 16) % 2 === 0;
      return pick(PAL.wood, 0.6 + (plank ? 0.15 : -0.12) + (y - 16) * 0.03 - (x - 7) * 0.012, x, y);
    });
    p.line(5, 22, 7, 16, PAL.wood[1]); p.line(18, 22, 16, 16, PAL.wood[1]);
    // correntes
    for (const [x0, x1] of [[7, 5], [16, 18]]) {
      p.line(x0, 9, x1, 21, (x, y) => (y % 2 ? PAL.iron[4] : PAL.iron[2]));
    }
    p.set(7, 9, PAL.iron[3]); p.set(16, 9, PAL.iron[3]);
    p.outline(PAL.out);
    return p;
  }

  // Selo de lacre: carta dobrada fechada por um selo vermelho com fitas.
  function waxSeal() {
    const p = new Pix(S, S);
    p.rect(1, 4, 22, 14, (x, y) => pick(PAL.sail, 0.72 - (y - 4) * 0.02 - (x - 1) * 0.01, x, y));
    // aba da dobra
    p.poly([[1, 4], [23, 4], [12, 12.5]], (x, y) => pick(PAL.sail, 0.92 - (y - 4) * 0.05, x, y));
    p.line(1, 4, 11, 12, PAL.sail[1]); p.line(22, 4, 12, 12, PAL.sail[0]);
    p.rect(1, 17, 22, 1, PAL.sail[0]);
    // fitas
    p.poly([[10, 14], [12, 15], [8, 22.5], [5.5, 21]], (x, y) => PAL.banner[x < 8 ? 3 : 2]);
    p.poly([[12, 15], [14, 14], [18.5, 21], [16, 22.5]], (x, y) => PAL.banner[x < 16 ? 2 : 1]);
    p.set(7, 22, 0); p.set(17, 22, 0);
    // pingo de lacre irregular
    p.fill(6, 8, 18, 19, (x, y) => {
      const a = Math.atan2(y - 13.5, x - 12);
      return Math.hypot(x - 12, y - 13.5) <= 5 + Math.sin(a * 5 + 1) * 0.6;
    }, (x, y) => pick(WAX, 0.15 + sphereLight((x + 0.5 - 12) / 5.4, (y + 0.5 - 13.5) / 5.4) * 0.95, x, y));
    // marca do sinete
    p.fill(8, 10, 16, 17, (x, y) => Math.abs(Math.hypot(x - 12, y - 13.5) - 3.1) < 0.55, WAX[1]);
    p.rect(11, 12, 2, 3, WAX[1]);
    p.rect(10, 12, 4, 1, WAX[1]);
    p.set(10, 11, WAX[1]); p.set(13, 11, WAX[1]);
    p.set(9, 11, WAX[4]);
    p.outline(PAL.out);
    return p;
  }

  // Anel de sinete: aro de ouro com a chapa gravada com o brasão do conde.
  function signetRing() {
    const p = new Pix(S, S);
    const cx = 12, cy = 14.5;
    p.fill(2, 7, 22, 22, (x, y) => {
      const o = ((x - cx) / 8) ** 2 + ((y - cy) / 7.2) ** 2;
      const i = ((x - cx) / 5.2) ** 2 + ((y - cy - 0.6) / 4.6) ** 2;
      return o <= 1 && i > 1;
    }, (x, y) => {
      const nx = (x + 0.5 - cx) / 8, ny = (y + 0.5 - cy) / 7.2;
      const r = Math.hypot(nx, ny);
      let v = 0.2 + sphereLight(nx * 0.9, ny * 0.9) * 0.9 + (r > 0.85 ? -0.15 : 0) + (r < 0.75 ? -0.12 : 0);
      return pick(PAL.gold, v, x, y);
    });
    // interior do aro na sombra
    p.fill(6, 13, 18, 20, (x, y) => ((x - cx) / 5.2) ** 2 + ((y - cy - 0.6) / 4.6) ** 2 <= 1 && ((x - cx) / 5.2) ** 2 + ((y - cy - 1.6) / 4.6) ** 2 > 1 && y > 15, PAL.gold[1]);
    // chapa: espessura, aro e a pedra vermelha gravada
    p.ellipse(cx, 7.4, 6.4, 4.6, PAL.gold[1]);
    p.ellipse(cx, 6.4, 6.4, 4.6, (x, y) => pick(PAL.gold, 0.5 + sphereLight((x + 0.5 - cx) / 6.4, (y + 0.5 - 6.4) / 4.6) * 0.6, x, y));
    p.ellipse(cx, 6.4, 4.6, 3.2, (x, y) => pick(WAX, 0.25 + (x < 11 && y < 6 ? 0.2 : 0) - (x > 13 ? 0.1 : 0), x, y));
    // brasão gravado: escudo de ouro
    p.poly([[10, 4.4], [14, 4.4], [14, 6.6], [12, 8.8], [10, 6.6]], (x, y) => PAL.gold[x + y < 16 ? 5 : 3]);
    p.set(7, 4, PAL.gold[5]); p.set(8, 3, PAL.gold[5]);
    p.set(4, 14, PAL.gold[5]);
    p.outline(PAL.out);
    return p;
  }

  // Estandarte do duque: mastro com ponta de lança e pano azul de rabo de andorinha.
  function standard() {
    const p = new Pix(S, S);
    p.rect(3, 4, 2, 19, (x) => PAL.wood[x === 3 ? 3 : 1]);
    p.poly([[4, 0.5], [6, 3.5], [4, 4.5], [2, 3.5]], (x, y) => PAL.steel[x < 4 ? 5 : 3]);
    p.rect(3, 4, 2, 1, PAL.gold[3]);
    // travessa
    stick(p, 4, 5.5, 21, 5.5, 0.8, PAL.gold);
    // pano ondulado com a ponta cortada em V
    p.fill(5, 6, 21, 21, (x, y) => {
      const yy = y - Math.sin(x * 0.55) * 0.6;
      return yy <= 16 || Math.abs(x - 13) >= (yy - 16) * 1.6 && yy <= 20.5;
    }, (x, y) => pick(BLUE, 0.35 + Math.sin(x * 0.55 + 1.2) * 0.25 + (y < 8 ? 0.12 : 0) - (y - 6) * 0.01, x, y));
    // barra dourada e divisa
    for (let x = 5; x <= 21; x++) p.set(x, 7, PAL.gold[(x % 2) ? 3 : 2]);
    p.fill(6, 9, 20, 17, (x, y) => {
      const d = y - (9 + Math.abs(x - 13) * -0.75 + 6);
      return d >= 0 && d < 2.2;
    }, (x, y) => PAL.gold[x < 13 ? 4 : 3]);
    // coroa ducal bordada
    p.rect(11, 10, 5, 2, (x, y) => PAL.gold[y === 10 ? 4 : 2]);
    for (const x of [11, 13, 15]) p.set(x, 9, PAL.gold[4]);
    p.set(13, 10, RUBY[3]);
    // borla
    p.line(21, 6, 21, 10, PAL.gold[2]);
    p.rect(20, 10, 2, 2, (x) => PAL.gold[x === 20 ? 4 : 2]);
    p.outline(PAL.out);
    return p;
  }

  // Cetro: bastão de ouro em diagonal com cabeça de rubi e pontas com pérolas.
  function scepter() {
    const p = new Pix(S, S);
    stick(p, 4, 20, 14.5, 9.5, 1.1, PAL.gold, 0.05);
    // anéis da empunhadura
    for (const t of [0.3, 0.45, 0.6]) {
      const x = 4 + 10.5 * t, y = 20 - 10.5 * t;
      stick(p, x - 0.4, y - 0.4, x + 0.4, y + 0.4, 1.6, PAL.gold, 0.25);
    }
    ball(p, 3.5, 20.5, 2, PAL.gold, 0.15); // pomo
    // pontas radiando da cabeça, cada uma com pérola
    for (const a of [-0.35, 0.785, 1.92]) {
      const ex = 16 + Math.cos(a) * 5.5, ey = 8 - Math.sin(a) * 5.5;
      stick(p, 16, 8, ex, ey, 0.75, PAL.gold, 0.1);
      ball(p, ex, ey, 1.4, PAL.sail, 0.25);
    }
    ball(p, 15.5, 8.5, 3.2, PAL.gold, 0.05); // copa
    ball(p, 15.5, 8.3, 2.1, RUBY, 0.1);
    shine(p, 14, 7, RUBY[4]);
    p.outline(PAL.out);
    return p;
  }

  // Orbe imperial: o mundo em azul e verde, cintado de ouro, sobre uma almofada.
  function orb() {
    const p = new Pix(S, S);
    // almofada com borlas
    p.fill(1, 16, 22, 22, (x, y) => ((x - 12) / 10.6) ** 2 + ((y - 19.5) / 3) ** 2 <= 1,
      (x, y) => pick(PAL.lavender, 0.25 + sphereLight((x + 0.5 - 11) / 10, (y + 0.5 - 18.5) / 3) * 0.75, x, y));
    for (const x of [1, 22]) { p.set(x, 20, PAL.gold[3]); p.set(x, 21, PAL.gold[2]); }
    // globo: mar e terras
    const cx = 12, cy = 11, r = 7.4;
    p.fill(cx - r, cy - r, cx + r, cy + r, (x, y) => Math.hypot(x - cx, y - cy) <= r, (x, y) => {
      const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r;
      const l = 0.08 + sphereLight(nx, ny) * 0.95;
      const land = Math.sin(nx * 4.2 + 1) + Math.cos(ny * 3.6 - nx * 2) + (hash(x >> 1, y >> 1, 21) - 0.5) * 0.7 > 0.9;
      return land ? pick(PAL.herb, l + 0.05, x, y) : pick(PAL.water, l, x, y);
    });
    // faixa do equador com gemas
    for (let x = cx - 7; x <= cx + 7; x++) {
      const nx = (x + 0.5 - cx) / r;
      const y = Math.round(cy + 1 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 1.6);
      p.set(x, y - 1, PAL.gold[x < cx ? 4 : 3]);
      p.set(x, y, PAL.gold[x < cx ? 2 : 1]);
    }
    p.set(9, 13, RUBY[3]); p.set(14, 13, RUBY[2]); p.set(12, 13, BLUE[4]);
    // remate com rubi no topo
    p.rect(10, 3, 5, 1, PAL.gold[3]);
    p.rect(11, 2, 3, 1, PAL.gold[4]);
    ball(p, 12.5, 1.3, 1.3, RUBY, 0.2);
    shine(p, 8, 7);
    p.outline(PAL.out);
    return p;
  }

  // Árvore genealógica: tronco com ramos que terminam em medalhões dos herdeiros.
  function familyTree() {
    const p = new Pix(S, S);
    // copa de folhas por trás
    for (const [x, y, r] of [[12, 7, 6], [6, 10, 4.5], [18, 10, 4.5], [9, 5, 4], [15, 5, 4]]) {
      p.sphere(x, y, r, r * 0.85, PAL.herb, -0.1);
    }
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(2 + hash(i, 1, 5) * 20), y = Math.floor(1 + hash(i, 2, 5) * 13);
      if (p.get(x, y)) p.set(x, y, PAL.herb[hash(i, 3, 5) > 0.5 ? 5 : 1]);
    }
    // tronco e raízes
    p.fill(8, 13, 16, 22, (x, y) => Math.abs(x + 0.5 - 12) <= 1.6 + Math.max(0, y - 18) ** 1.5 * 0.6,
      (x, y) => pick(PAL.wood, 0.2 + cylLight((x + 0.5 - 12) / (1.6 + Math.max(0, y - 18) ** 1.5 * 0.6)) * 0.75 - ((y + x) % 4 === 0 ? 0.12 : 0), x, y));
    // ramos
    stick(p, 12, 15, 5, 9, 0.9, PAL.wood);
    stick(p, 12, 15, 19, 9, 0.9, PAL.wood);
    stick(p, 12, 15, 12, 4, 1, PAL.wood);
    stick(p, 8, 11.5, 5, 16, 0.7, PAL.wood);
    stick(p, 16, 11.5, 19, 16, 0.7, PAL.wood);
    // medalhões
    const med = (x, y, r, inner) => {
      ball(p, x, y, r, PAL.gold, 0.15);
      ball(p, x, y, r - 1, inner, 0.15);
    };
    med(12, 3.2, 2.3, RUBY);
    med(4.5, 8.5, 2.2, BLUE);
    med(19.5, 8.5, 2.2, BLUE);
    med(4.5, 16, 2, PAL.herb);
    med(19.5, 16, 2, RUBY);
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Cartas da linha

  // Rosto de frente para os bustos (olhos, nariz, boca).
  function face(p, cx, cy, rx, ry) {
    p.fill(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => {
      const dy = (y - cy) / ry;
      const k = dy > 0 ? rx * (1 - 0.28 * dy * dy) : rx;
      return ((x - cx) / k) ** 2 + dy * dy <= 1;
    }, (x, y) => pick(PAL.skin, 0.2 + sphereLight((x + 0.5 - cx) / rx, (y + 0.5 - cy + 1) / ry) * 0.9, x, y));
  }

  // Capataz da colheita: chapéu de aba larga com espiga, bigode e a vara de capataz.
  function overseer() {
    const p = new Pix(S, S);
    // ombros com túnica verde
    p.fill(1, 15, 20, 22, (x, y) => ((x - 10.5) / 9.5) ** 2 + ((y - 23) / 7.6) ** 2 <= 1,
      (x, y) => pick(PAL.hood, 0.2 + sphereLight((x + 0.5 - 9) / 9, (y + 0.5 - 18) / 6) * 0.8, x, y));
    p.poly([[8, 15], [13, 15], [10.5, 19]], PAL.linen[3]); // gola
    p.rect(3, 19, 4, 1, PAL.leather[2]);
    face(p, 10.5, 11.5, 4.4, 5);
    // olhos sob as sobrancelhas carregadas
    p.rect(8, 10, 2, 1, PAL.beard[1]); p.rect(12, 10, 2, 1, PAL.beard[1]);
    p.set(9, 11, PAL.iris); p.set(12, 11, PAL.iris);
    p.set(11, 12, PAL.skin[2]);
    // bigodão
    p.rect(8, 13, 6, 1, PAL.beard[2]);
    p.set(7, 14, PAL.beard[2]); p.set(14, 14, PAL.beard[1]);
    p.set(9, 13, PAL.beard[3]);
    // chapéu de feltro
    p.ellipse(10.5, 7.8, 9, 1.6, (x, y) => PAL.leather[y < 8 ? 3 : 1]);
    p.fill(5, 1, 16, 8, (x, y) => ((x - 10.5) / 4.6) ** 2 + ((y - 7) / 5.6) ** 2 <= 1 && y < 7.6,
      (x, y) => pick(PAL.leather, 0.25 + sphereLight((x + 0.5 - 10) / 4.6, (y + 0.5 - 4) / 5) * 0.9, x, y));
    p.rect(6, 6, 10, 1, (x) => PAL.band[x < 10 ? 2 : 1]);
    // espiga presa na fita
    p.line(14, 6, 17, 1, PAL.wheat[2]);
    p.ellipse(17, 2, 1.1, 1.8, (x, y) => PAL.wheat[x < 17 ? 5 : 3]);
    // vara e mão
    stick(p, 20, 2, 20, 22, 0.9, PAL.wood, 0.05);
    p.ellipse(19.5, 15, 1.8, 1.5, (x, y) => PAL.skin[x < 19 ? 4 : 3]);
    p.set(20, 2, PAL.iron[3]);
    p.outline(PAL.out);
    return p;
  }

  // Almanaque do lavrador: livro grosso verde com sol e lua, e uma espiga marcando a página.
  function almanac() {
    const p = new Pix(S, S);
    // folhas vistas de lado
    p.poly([[18, 3.5], [21.5, 1.5], [21.5, 19], [18, 21.5]], (x, y) => PAL.linen[(y % 2) ? 3 : 4]);
    // espiga marcador
    p.line(15, 0, 16, 4, PAL.wheat[2]);
    p.ellipse(15, 1, 1, 1.6, (x, y) => PAL.wheat[x < 15 ? 5 : 3]);
    // capa
    p.rect(3, 3, 16, 19, (x, y) => pick(PAL.herb, 0.3 + cylLight((x + 0.5 - 10) / 9) * 0.55 - (y > 19 ? 0.1 : 0), x, y));
    p.rect(3, 3, 2, 19, (x) => PAL.herb[x === 3 ? 2 : 1]); // lombada
    for (const y of [6, 18]) p.rect(3, y, 2, 1, PAL.gold[3]);
    // cantoneiras
    for (const [x, y] of [[17, 3], [17, 20]]) p.rect(x, y, 2, 2, (xx, yy) => PAL.gold[xx === 17 ? 4 : 2]);
    // moldura dourada
    for (let x = 6; x <= 16; x++) { p.set(x, 4, PAL.gold[2]); p.set(x, 20, PAL.gold[2]); }
    // sol
    ball(p, 11, 9, 2.6, PAL.gold, 0.25);
    for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0], [3, 3], [-3, -3], [3, -3], [-3, 3]]) p.set(11 + dx, 9 + dy, PAL.gold[4]);
    // lua crescente
    p.fill(8, 13, 15, 19, (x, y) => Math.hypot(x - 11, y - 16) <= 2.6 && Math.hypot(x - 12.2, y - 15.2) > 2.2, PAL.linen[4]);
    // estrelas
    p.set(7, 15, PAL.linen[4]); p.set(15, 17, PAL.linen[3]); p.set(15, 13, PAL.linen[4]);
    p.outline(PAL.out);
    return p;
  }

  // Arauto da aldeia: tocando a trombeta com flâmula, de gorro com pena.
  function herald() {
    const p = new Pix(S, S);
    // tabardo partido vermelho e ouro
    p.fill(0, 15, 19, 22, (x, y) => ((x - 9) / 9) ** 2 + ((y - 23) / 7.4) ** 2 <= 1, (x, y) => {
      const r = x < 9 ? PAL.banner : PAL.gold;
      return pick(r, 0.25 + sphereLight((x + 0.5 - 8) / 9, (y + 0.5 - 18) / 6) * 0.7 - (x >= 9 ? 0.15 : 0), x, y);
    });
    face(p, 9, 11.5, 4.2, 4.8);
    p.set(7, 11, PAL.iris); p.set(10, 11, PAL.iris);
    p.set(6, 10, PAL.hair[2]); p.set(10, 10, PAL.hair[2]);
    // bochechas cheias de ar
    p.set(6, 13, PAL.blush); p.set(12, 13, PAL.blush);
    // cabelo e gorro
    p.rect(4, 8, 2, 4, PAL.hair[3]); p.rect(12, 8, 2, 3, PAL.hair[2]);
    p.fill(3, 3, 15, 9, (x, y) => ((x - 9) / 5.6) ** 2 + ((y - 7.6) / 4) ** 2 <= 1 && y < 8.6,
      (x, y) => pick(PAL.banner, 0.3 + sphereLight((x + 0.5 - 8) / 5.6, (y + 0.5 - 5) / 4) * 0.8, x, y));
    p.rect(4, 8, 10, 1, (x) => PAL.gold[x < 9 ? 3 : 2]);
    // pena
    tube(p, (t) => [4 - t * 2.5 + t * t * 1, 7 - t * 6], (t) => 0.5 + Math.sin(t * Math.PI) * 0.9,
      (t, s, x, y) => pick(PAL.sail, 0.8 - s * 0.3, x, y), 30);
    // flâmula pendurada na trombeta
    p.poly([[14, 12], [19.5, 10], [19.5, 15.5], [17, 14], [14.5, 16.5]], (x, y) => pick(PAL.banner, 0.75 - (y - 11) * 0.1, x, y));
    p.rect(16, 12, 2, 2, (x, y) => PAL.gold[x === 16 ? 4 : 3]);
    // trombeta saindo da boca para a direita
    p.fill(9, 3, 22, 15, (x, y) => {
      if (x < 9.5) return false;
      const t = (x - 9.5) / 13;
      const cy = 12.8 - t * 5.5;
      const half = 0.75 + Math.max(0, t - 0.65) ** 1.4 * 8;
      return Math.abs(y - cy) <= half;
    }, (x, y) => {
      const t = (x - 9.5) / 13;
      return pick(PAL.gold, 1 - (y - (12.3 - t * 5.5)) * 0.3 - t * 0.15, x, y);
    });
    p.rect(21, 3, 1, 9, (x, y) => PAL.gold[y < 7 ? 5 : 2]);
    p.outline(PAL.out);
    return p;
  }

  // Mestre de obras: barba grisalha, gorro de feltro, esquadro de ferro e lápis na orelha.
  function masterBuilder() {
    const p = new Pix(S, S);
    // ombros com avental de couro
    p.fill(2, 15, 21, 22, (x, y) => ((x - 11.5) / 9.5) ** 2 + ((y - 23) / 7.6) ** 2 <= 1,
      (x, y) => pick(PAL.vest, 0.25 + sphereLight((x + 0.5 - 10) / 9, (y + 0.5 - 18) / 6) * 0.75, x, y));
    p.fill(7, 17, 16, 22, (x, y) => Math.abs(x + 0.5 - 11.5) <= 3 + (y - 17) * 0.3, (x, y) => pick(PAL.leather, 0.6 - (x - 9) * 0.06, x, y));
    face(p, 11.5, 10.5, 4.4, 5);
    // barba grisalha
    p.fill(6, 11, 17, 18, (x, y) => ((x - 11.5) / 4.6) ** 2 + ((y - 12.5) / 5) ** 2 <= 1 && y > 12 && !(y < 14 && Math.abs(x - 11.5) < 1.5),
      (x, y) => pick(PAL.linen, 0.45 - (x - 9) * 0.04 + (hash(x, y, 8) - 0.5) * 0.25, x, y));
    p.rect(10, 13, 3, 1, PAL.skin[1]); // boca
    p.set(10, 10, PAL.iris); p.set(13, 10, PAL.iris);
    p.rect(9, 9, 2, 1, PAL.linen[1]); p.rect(13, 9, 2, 1, PAL.linen[1]);
    // gorro de feltro
    p.fill(6, 2, 17, 8, (x, y) => ((x - 11.5) / 5) ** 2 + ((y - 7.5) / 5) ** 2 <= 1 && y < 7.5,
      (x, y) => pick(BLUE, 0.3 + sphereLight((x + 0.5 - 11) / 5, (y + 0.5 - 4) / 4) * 0.8, x, y));
    p.rect(6, 7, 11, 1, (x) => BLUE[x < 11 ? 2 : 1]);
    // lápis atrás da orelha
    p.line(15, 6, 18, 9, PAL.straw[3]); p.set(18, 9, INK);
    // esquadro de ferro à frente
    p.rect(2, 9, 2, 14, (x, y) => PAL.steel[x === 2 ? 4 : 2]);
    p.rect(2, 21, 9, 2, (x, y) => PAL.steel[y === 21 ? 4 : 2]);
    for (let y = 11; y <= 19; y += 2) p.set(3, y, PAL.steel[0]);
    for (let x = 5; x <= 9; x += 2) p.set(x, 22, PAL.steel[0]);
    p.outline(PAL.out);
    return p;
  }

  // Cornucópia: chifre de vime transbordando de frutas, uvas, pão e espigas.
  function cornucopia() {
    const p = new Pix(S, S);
    // chifre: ponta enrolada em cima à esquerda, barriga embaixo, boca aberta à direita
    const bz = (t) => {
      const u = 1 - t;
      return [u * u * 2.5 + 2 * u * t * 1.5 + t * t * 12.5, u * u * 6 + 2 * u * t * 22 + t * t * 14];
    };
    tube(p, bz, (t) => 0.6 + t ** 1.25 * 4.4, (t, s, x, y) => {
      const f = (t * 6.5 + 0.2) % 1;
      if (t < 0.9 && f < 0.28) return PAL.straw[s < -0.3 ? 2 : 1];
      if (t < 0.9 && f < 0.5) return pick(PAL.straw, 0.4 + cylLight(s) * 0.65, x, y);
      return pick(PAL.straw, 0.1 + cylLight(s) * 0.75, x, y);
    }, 90);
    // boca com borda clara
    p.fill(9, 8, 17, 20, (x, y) => ((x - 13.4) / 2.3) ** 2 + ((y - 14) / 4.9) ** 2 <= 1,
      (x, y) => (((x - 13.4) / 2.3) ** 2 + ((y - 14) / 4.9) ** 2 > 0.45 ? PAL.straw[x < 13 ? 5 : 3] : DARK));
    // espigas para cima
    for (const [x0, y0, x1, y1] of [[13, 10, 10.5, 2], [14, 10, 15, 1]]) {
      p.line(x0, y0, x1, y1 + 2, PAL.wheat[2]);
      p.ellipse(x1, y1 + 1, 1.1, 2, (x, y) => pick(PAL.wheat, 0.95 - (x - x1 + 1) * 0.25 - ((x + y) % 2) * 0.12, x, y));
    }
    // maçã, pera, pão e uvas saindo da boca
    ball(p, 17, 9.2, 2.7, PAL.roof, 0.15);
    p.set(17, 6, PAL.wood[2]);
    p.set(18, 6, PAL.herb[4]); p.set(19, 5, PAL.herb[3]);
    shine(p, 16, 8, PAL.roof[5]);
    ball(p, 20.6, 12.2, 2.1, PAL.herb, 0.2); // pera
    p.set(21, 10, PAL.wood[2]);
    p.sphere(17.8, 15.2, 2.8, 2, PAL.dirt, 0.25); // pão
    p.set(16, 14, PAL.dirt[4]); p.line(17, 15, 19, 14, PAL.dirt[1]);
    for (const [x, y] of [[17, 18.6], [19, 18.4], [21, 18.6], [18, 20.4], [20, 20.4], [19, 22]]) ball(p, x, y, 1.25, PAL.lavender, 0.1);
    p.set(21, 17, PAL.herb[3]);
    ball(p, 9.5, 21.2, 1.5, PAL.roof, 0.2); // maçã caída
    p.outline(PAL.out);
    return p;
  }

  Object.assign(ART.icons, {
    'c-fart:campones': sickle,
    'c-fart:moinho': millstone,
    'c-fart:celeiro': bolt,
    'c-fart:granja': plow,
    'c-fart:aldeia': well,
    'c-fart:feira': scales,
    'c-fart:vila': wall,
    'c-fart:solar': ledger,
    'c-fart:castelo': drawbridge,
    'c-fart:barao': waxSeal,
    'c-fart:conde': signetRing,
    'c-fart:duque': standard,
    'c-fart:rei': scepter,
    'c-fart:imperador': orb,
    'c-fart:dinastia': familyTree,
    'c-ritmo:comida': overseer,
    'c-sorte:comida': almanac,
    'c-recruta:comida': herald,
    'c-desconto:comida': masterBuilder,
    'c-bonanca:comida': cornucopia,
  });
})();
