'use strict';
// Arte das cartas da linha militar: uma ilustração 24x24 por carta (ferramentas dos geradores e cartas da linha).
(() => {
  const N = 24;
  const DARK = C('#120a08');
  // tons de aço temperado (azulado) e de vidro
  const TEMPER = ramp('#1c2048', '#2e3a78', '#4a5ca8', '#7c8cd0', '#b8c4ec');
  const GREY = ramp('#3a3440', '#5c5660', '#86808a', '#b0aab0', '#d8d4d6', '#f4f2f0');
  const RUNE = ramp('#2a4a8a', '#4a8ad0', '#7ad0f4', '#c8f4ff', '#ffffff');

  // Luz de uma superfície com normal (nx, ny) dentro de -1..1.
  const lit = (r, nx, ny, bias, x, y) => pick(r, 0.12 + sphereLight(nx, ny) * 0.9 + bias, x, y);

  // Barra cilíndrica entre dois pontos (cabos, hastes, tubos).
  // col é uma rampa ou uma função (x, y, nx, ny, t) com t de 0 a 1 ao longo da barra.
  function bar(p, x0, y0, x1, y1, r, col, bias = 0) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux;
    const at = (x, y) => [(x - x0) * ux + (y - y0) * uy, ((x - x0) * px + (y - y0) * py) / r];
    p.fill(Math.min(x0, x1) - r - 1, Math.min(y0, y1) - r - 1, Math.max(x0, x1) + r + 1, Math.max(y0, y1) + r + 1,
      (x, y) => { const [t, d] = at(x, y); return t >= 0 && t <= L && Math.abs(d) <= 1; },
      (x, y) => {
        const [t, d] = at(x + 0.5, y + 0.5);
        return typeof col === 'function' ? col(x, y, d * px, d * py, t / L) : lit(col, d * px, d * py, bias, x, y);
      });
    return p;
  }

  // Caixa girada: u ao longo do eixo (ang), v na largura, ambos em -1..1.
  function rbox(p, cx, cy, ang, hl, hw, col, test = () => true) {
    const ux = Math.cos(ang), uy = Math.sin(ang), px = -uy, py = ux, R = Math.hypot(hl, hw) + 1;
    const at = (x, y) => [((x - cx) * ux + (y - cy) * uy) / hl, ((x - cx) * px + (y - cy) * py) / hw];
    p.fill(cx - R, cy - R, cx + R, cy + R,
      (x, y) => { const [u, v] = at(x, y); return Math.abs(u) <= 1 && Math.abs(v) <= 1 && test(u, v); },
      (x, y) => { const [u, v] = at(x + 0.5, y + 0.5); return col(u, v, x, y, px, py); });
    return p;
  }

  // Brilho em cruz de 5 pixels (faísca, estrela).
  function sparkle(p, x, y, core, arm) {
    p.set(x, y, core);
    p.set(x - 1, y, arm); p.set(x + 1, y, arm); p.set(x, y - 1, arm); p.set(x, y + 1, arm);
  }

  // Rosto oval sombreado (bustos).
  function face(p, cx, cy, rx, ry) {
    p.fill(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1,
      (x, y) => pick(PAL.skin, 0.25 + sphereLight((x + 0.5 - cx + 1) / rx, (y + 0.5 - cy + 1) / ry) * 0.8, x, y));
    // orelhas
    p.rect(cx - rx - 1, cy, 1, 2, PAL.skin[2]);
    p.rect(cx + rx, cy, 1, 2, PAL.skin[1]);
  }

  // Tronco arredondado cortado na base do quadro.
  function torso(p, cx, top, rx, col) {
    p.fill(cx - rx, top, cx + rx, 23, (x, y) => ((x - cx) / rx) ** 2 + ((y - 24) / (24 - top)) ** 2 <= 1, col);
  }

  // ---------------------------------------------------------------------------
  // Ferramentas dos geradores

  // Ferreiro: martelo de forja com a cabeça temperada (faixa azulada) e uma faísca.
  function temperedHammer() {
    const p = new Pix(N, N);
    bar(p, 3.5, 20.5, 15, 9, 1.3, (x, y, nx, ny, t) => t < 0.36
      ? pick(PAL.leather, 0.15 + sphereLight(nx, ny) * 0.85 + ((x + y) % 3 === 0 ? -0.25 : 0), x, y)
      : lit(PAL.wood, nx, ny, 0.08, x, y));
    rbox(p, 15.4, 8.4, Math.PI / 4, 6.6, 2.5, (u, v, x, y, px, py) => {
      const n = [v * px * 0.85, v * py * 0.85];
      if (u > 0.84) return pick(PAL.steel, 0.55 + sphereLight(...n) * 0.5, x, y); // face de bater
      const m = Math.abs(u + 0.05);
      if (m < 0.24) return lit(TEMPER, n[0], n[1], 0.05, x, y);
      if (m < 0.38) return lit(PAL.gold, n[0], n[1], -0.05, x, y);
      return lit(PAL.steel, n[0], n[1], 0.05, x, y);
    }, (u, v) => u > -0.45 || Math.abs(v) <= 1 - (-u - 0.45) * 1.1);
    p.set(17, 6, PAL.wood[3]); // ponta da cunha do cabo
    // faíscas
    sparkle(p, 20, 18, PAL.fire[5], PAL.fire[3]);
    p.set(22, 15, PAL.fire[4]);
    p.set(17, 21, PAL.fire[3]);
    p.outline(PAL.out);
    return p;
  }

  // Forja: fole de couro: tábua em gota, dobras de couro por baixo, dois cabos abertos em V e bico de ferro.
  function bellows() {
    const p = new Pix(N, N);
    const ex = 8.6, ey = 8.4, gap = 4, tip = 18.6;
    const tear = (oy) => (x, y) => {
      y -= oy;
      if (x < ex) return ((x - ex) / 4.8) ** 2 + ((y - ey) / 5.2) ** 2 <= 1;
      return x <= tip && Math.abs(y - ey) <= 5.2 * (1 - (x - ex) / (tip - ex + 0.8)) ** 1.25 + 0.5;
    };
    // cabos em V
    const handle = (x0, y0, x1, y1, b) => {
      bar(p, x0, y0, x1, y1, 1.15, PAL.wood, b);
      p.sphere(x1, y1, 1.6, 1.6, PAL.wood, b + 0.15);
    };
    handle(5, ey + gap + 1.5, 2, 19.6, -0.05);
    // tábua de baixo e as dobras de couro
    p.fill(0, 0, 23, 23, tear(gap), PAL.wood[1]);
    for (let oy = gap - 1; oy >= 1; oy--) p.fill(0, 0, 23, 23, tear(oy), (x) => PAL.auburn[oy % 2 ? (x < ex + 2 ? 4 : 3) : 1]);
    // tábua de cima
    p.fill(0, 0, 23, 23, tear(0), (x, y) => pick(PAL.wood,
      0.4 + sphereLight((x + 0.5 - ex - 2) / 9, (y + 0.5 - ey) / 6.5) * 0.7 + (hash(x, y >> 1, 7) > 0.82 ? -0.16 : 0), x, y));
    handle(5, ey - 1.5, 2, 2.4, 0.25);
    // bico de ferro preso na ponta, com anel de latão
    bar(p, 17, ey + gap / 2, 22.4, ey + gap / 2 + 1, 1.15, PAL.iron, 0.2);
    bar(p, 16.6, ey + gap / 2, 17.8, ey + gap / 2 + 0.2, 1.9, PAL.gold, 0.1);
    // roseta de latão e tachas na borda
    p.ellipse(ex + 1, ey, 1.8, 1.6, (x, y) => PAL.gold[x < ex + 1 && y < ey ? 4 : 2]);
    p.set(ex, ey - 1, PAL.gold[5]);
    for (const [x, y] of [[5, 5], [8, 3], [12, 4], [15, 6], [5, 12], [10, 13], [14, 11]]) p.set(x, y, PAL.gold[y < ey ? 4 : 3]);
    // faíscas do sopro
    sparkle(p, 21, 17, PAL.fire[5], PAL.fire[3]);
    p.set(22, 8, PAL.fire[4]); p.set(19, 20, PAL.fire[3]);
    p.outline(PAL.out);
    return p;
  }

  // Arsenal: cavalete de madeira com três lanças de pé, cada uma com sua borla vermelha.
  function spearRack() {
    const p = new Pix(N, N);
    const post = (x0) => p.rect(x0, 6, 2, 15, (x, y) => PAL.wood[x === x0 ? 3 : 1]);
    post(2); post(20);
    for (const [sx, top] of [[6, 1], [11, 3], [16, 2]]) {
      p.rect(sx, top + 5, 2, 20 - top - 5, (x, y) => PAL.wood[x === sx ? 4 : 2]);
      // ponta em folha
      ['.xx.', '.xx.', 'xxxx', 'xxxx', 'xxxx', '.xx.'].forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === 'x') p.set(sx - 1 + i, top + j, PAL.steel[i < 2 ? (j < 2 && i === 1 ? 5 : 4) : (j > 3 ? 1 : 2)]);
      }));
      p.rect(sx, top + 6, 2, 1, PAL.gold[3]);
      p.rect(sx - 1, top + 7, 4, 1, PAL.banner[3]);
      p.rect(sx - 1, top + 8, 4, 2, (x, y) => PAL.banner[x === sx - 1 ? 2 : (x + y) % 2 ? 1 : 2]);
    }
    // travessas na frente das hastes
    const rail = (y0) => p.rect(1, y0, 22, 2, (x, y) => pick(PAL.wood, (y === y0 ? 0.75 : 0.3) - (x % 5 === 0 ? 0.15 : 0), x, y));
    rail(11); rail(18);
    for (const x of [2, 20]) { p.set(x, 11, PAL.iron[3]); p.set(x, 18, PAL.iron[3]); }
    // pés
    p.rect(1, 21, 5, 1, PAL.wood[2]);
    p.rect(18, 21, 5, 1, PAL.wood[2]);
    p.outline(PAL.out);
    return p;
  }

  // Quartel: tambor vermelho com aros de madeira, corda em zigue-zague e duas baquetas.
  function drum() {
    const p = new Pix(N, N);
    const cx = 12, rx = 9, top = 10, bot = 18, ry = 3;
    const curve = (x) => ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
    // corpo
    p.fill(cx - rx, top, cx + rx, bot + ry, (x, y) => Math.abs(x - cx) <= rx && y >= top && y <= bot + curve(x),
      (x, y) => {
        const n = (x + 0.5 - cx) / rx;
        if (y + 0.5 > bot + curve(x + 0.5) - 2) return pick(PAL.wood, 0.25 + cylLight(n) * 0.7, x, y); // aro de baixo
        if (y + 0.5 < top + curve(x + 0.5) + 2) return pick(PAL.wood, 0.35 + cylLight(n) * 0.7, x, y); // aro de cima
        return pick(PAL.banner, 0.1 + cylLight(n) * 0.85, x, y);
      });
    // corda
    const xs = [-8, -4, 0, 4, 8].map((d) => cx + d);
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i], b = xs[i + 1];
      const ya = i % 2 ? bot + curve(a) - 2 : top + curve(a) + 1.5, yb = i % 2 ? top + curve(b) + 1.5 : bot + curve(b) - 2;
      p.line(a, ya, b, yb, (x) => PAL.linen[x < cx ? 4 : 3]);
    }
    for (const x of xs) p.set(x, top + curve(x) + 1.5, PAL.gold[4]);
    // pele de cima
    p.ellipse(cx, top, rx, ry, (x, y) => {
      const r = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - top) / ry) ** 2;
      return r > 0.72 ? PAL.wood[x < cx ? 4 : 3] : pick(PAL.linen, 0.75 - (x - cx) * 0.03 + (y < top ? 0.1 : 0), x, y);
    });
    // baquetas cruzadas
    const stick = (x0, y0, x1, y1) => {
      bar(p, x0, y0, x1, y1, 0.85, PAL.straw, 0.1);
      p.sphere(x0, y0, 1.5, 1.5, PAL.straw, 0.2);
    };
    stick(3, 3, 15.5, 10);
    stick(21, 3, 8.5, 10);
    p.outline(PAL.out);
    return p;
  }

  // Torre: luneta de latão e couro na diagonal, com a lente brilhando.
  function spyglass() {
    const p = new Pix(N, N);
    bar(p, 2, 21.6, 6.6, 17, 1.3, PAL.gold, -0.15); // ocular
    bar(p, 2, 21.6, 2.8, 20.8, 1.6, PAL.gold, -0.05);
    bar(p, 6.2, 17.4, 12, 11.6, 2, PAL.gold, 0.05); // tubo do meio
    bar(p, 6.4, 17.2, 7.4, 16.2, 2.3, PAL.gold, -0.2);
    bar(p, 11.6, 12, 18.6, 5, 2.8, (x, y, nx, ny) => pick(PAL.leather,
      0.15 + sphereLight(nx, ny) * 0.9 + ((x - y) % 4 === 0 ? -0.22 : 0), x, y)); // tubo de couro
    bar(p, 11, 12.6, 12.6, 11, 3, PAL.gold, 0.1);
    bar(p, 17.6, 6, 19.8, 3.8, 3.4, PAL.gold, 0.15); // boca larga
    // lente
    rbox(p, 19.9, 3.7, Math.PI / 4, 2.9, 1.1, (u, v, x, y) => (u < -0.25 ? RUNE[3] : u < 0.35 ? PAL.water[3] : PAL.water[1]),
      (u, v) => u * u + v * v <= 1.15);
    p.set(18, 2, PAL.water[5]);
    sparkle(p, 21, 9, PAL.sunCore, PAL.gold[4]);
    p.outline(PAL.out);
    return p;
  }

  // Cavaleiro: ferradura nova e reluzente, com os furos dos cravos.
  function horseshoe() {
    const p = new Pix(N, N);
    const cx = 12, cy = 11.5, ro = 9.2, ri = 4.8;
    const inShoe = (x, y) => {
      if (y < cy) {
        const taper = Math.max(0, cy - y - 5) * 0.35;
        const d = Math.abs(x - cx);
        return y > 2 && d >= ri - taper * 0.3 && d <= ro - taper;
      }
      const r = Math.hypot(x - cx, (y - cy) * 1.05);
      return r >= ri && r <= ro;
    };
    p.fill(1, 1, 22, 22, inShoe, (x, y) => {
      const X = x + 0.5 - cx, Y = y + 0.5 - cy;
      let dx, dy, r;
      if (Y < 0) { dx = Math.sign(X); dy = 0; r = Math.abs(X); } else { r = Math.hypot(X, Y); dx = X / r; dy = Y / r; }
      const t = (r - (ri + ro) / 2) / ((ro - ri) / 2);
      if (Math.abs(t) < 0.22) return PAL.steel[1]; // sulco dos cravos
      return lit(PAL.steel, dx * t * 0.85, dy * t * 0.85, 0.1, x, y);
    });
    // furos dos cravos ao longo do sulco
    for (const a of [-0.15, 0.45, 1.05, 2.1, 2.7, 3.3]) {
      const rm = (ri + ro) / 2;
      p.set(cx + Math.cos(a) * rm, cy + Math.sin(a) * rm / 1.05, DARK);
    }
    p.set(cx - 7, 7, DARK); p.set(cx + 7 - 1, 7, DARK);
    // talões nas pontas
    p.rect(cx - 9, 3, 4, 1, PAL.steel[4]);
    p.rect(cx + 5, 3, 4, 1, PAL.steel[3]);
    sparkle(p, 4, 18, PAL.sunCore, PAL.gold[4]);
    sparkle(p, 12, 4, PAL.sunCore, PAL.gold[4]);
    p.set(20, 19, PAL.gold[5]);
    p.outline(PAL.out);
    return p;
  }

  // Fortaleza: portão de duas folhas com faixas de ferro e cravos, num arco de pedra.
  function gate() {
    const p = new Pix(N, N);
    const cx = 12, ay = 10;
    const outer = (x, y) => (y >= ay && x >= 1 && x <= 23) || (((x - cx) / 11) ** 2 + ((y - ay) / 8.6) ** 2 <= 1);
    const inner = (x, y) => (y >= ay && Math.abs(x - cx) <= 7) || (((x - cx) / 7) ** 2 + ((y - ay) / 6.6) ** 2 <= 1);
    // pedra
    p.fill(1, 1, 22, 22, outer, (x, y) => {
      const X = x + 0.5 - cx, Y = y + 0.5 - ay;
      let joint;
      if (Y < 0) {
        const ang = Math.atan2(Y, X);
        joint = Math.abs(((ang + Math.PI) / (Math.PI / 7)) % 1 - 0.5) > 0.42;
      } else {
        const row = Math.floor(y / 3);
        joint = y % 3 === 0 || (x + row * 2) % 5 === 0;
      }
      const v = 0.3 + (x < cx ? 0.2 : 0) + (hash(x >> 1, y >> 1, 3) - 0.5) * 0.3;
      return joint ? PAL.stone[1] : pick(PAL.stone, v + (Y < 0 ? 0.15 : 0), x, y);
    });
    // folhas de madeira
    p.fill(4, 3, 20, 22, inner, (x, y) => {
      const plank = Math.floor((x - 5) / 3);
      if (x === cx - 1) return PAL.wood[0];
      const edge = (x - 5) % 3 === 0;
      return pick(PAL.wood, 0.2 + (plank % 2 ? 0.1 : 0.3) + (edge ? -0.2 : 0) + (x < cx ? 0.12 : 0) + hash(x, y >> 2, 5) * 0.12, x, y);
    });
    // faixas de ferro com cravos
    for (const by of [7, 12, 18]) {
      p.fill(4, by, 20, by + 1, inner, (x, y) => (x === cx - 1 ? PAL.iron[0] : PAL.iron[y === by ? 3 : 1]));
      for (let x = 6; x <= 18; x += 3) if (x !== cx - 1 && inner(x + 0.5, by + 0.5)) p.set(x, by, PAL.iron[4]);
    }
    // tranca de ferro atravessada nas duas folhas
    p.rect(cx - 5, 15, 9, 2, (x, y) => (y === 15 ? PAL.iron[x < cx ? 4 : 3] : PAL.iron[1]));
    for (const x of [cx - 6, cx + 4]) p.rect(x, 14, 1, 4, (xx, y) => PAL.iron[y === 14 ? 4 : 2]);
    // pedra-chave
    p.rect(cx - 2, 1, 3, 3, (x, y) => PAL.stone[x === cx - 2 || y === 1 ? 5 : 3]);
    p.outline(PAL.out);
    return p;
  }

  // Capitão: apito de latão com cordão vermelho e o silvo saindo pela janela.
  function whistle() {
    const p = new Pix(N, N);
    // cordão
    let prev = null;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = (1 - t) ** 2 * 19.5 + 2 * (1 - t) * t * 23 + t * t * 6;
      const y = (1 - t) ** 2 * 12 + 2 * (1 - t) * t * 25 + t * t * 15;
      if (prev) p.line(prev[0], prev[1], x, y, PAL.banner[i % 2 ? 3 : 2]);
      prev = [x, y];
    }
    // corpo: tubo + câmara redonda
    p.fill(2, 8, 13, 12, (x, y) => y >= 8 + Math.max(0, 4.5 - x) * 0.25 && y <= 12 - Math.max(0, 4.5 - x) * 0.25,
      (x, y) => lit(PAL.gold, 0, (y + 0.5 - 10) / 2.4, 0.05, x, y));
    p.sphere(14.5, 12.5, 4.8, 4.8, PAL.gold, 0.05);
    p.rect(13, 8, 3, 2, (x, y) => PAL.gold[y === 8 ? 4 : 3]);
    // janela do silvo
    p.rect(9, 8, 3, 1, DARK);
    p.set(11, 9, DARK);
    p.set(8, 8, PAL.gold[5]);
    // bocal achatado
    p.rect(2, 9, 2, 3, (x, y) => PAL.gold[y === 9 ? 4 : 2]);
    // argola
    p.fill(17, 10, 22, 15, (x, y) => { const r = Math.hypot(x - 19.8, y - 12.4); return r <= 2.2 && r >= 1.1; },
      (x, y) => PAL.iron[y < 12 ? 4 : 2]);
    // brilhos
    p.set(12, 10, PAL.gold[5]); p.set(13, 11, PAL.gold[5]);
    // silvo
    p.line(9, 5, 7, 3, PAL.sail[4]);
    p.line(11, 5, 11, 2, PAL.sail[4]);
    p.line(13, 5, 15, 3, PAL.sail[4]);
    p.outline(PAL.out);
    return p;
  }

  // Ordem: pergaminho do juramento com selo de cera, diante de uma espada.
  function oath() {
    const p = new Pix(N, N);
    // espada atrás
    bar(p, 6.5, 16.5, 21.5, 1.5, 1.05, PAL.steel, 0.1);
    p.line(8, 15, 21, 2, PAL.steel[5]);
    bar(p, 3.4, 13.4, 9.6, 19.6, 0.95, PAL.gold, 0.1);
    bar(p, 6.4, 16.6, 3.2, 19.8, 0.95, PAL.leather, 0.1);
    p.sphere(2.6, 20.4, 1.4, 1.4, PAL.gold, 0.2);
    // pergaminho
    p.rect(7, 4, 10, 15, (x, y) => pick(PAL.sail, 0.55 + (x < 9 ? 0.2 : 0) - (x > 15 ? 0.2 : 0) + (hash(x, y, 2) - 0.5) * 0.15, x, y));
    const roll = (y0) => bar(p, 6, y0, 18, y0, 1.4, PAL.sail, 0);
    roll(3.5); roll(19);
    p.set(5, 3, PAL.sail[2]); p.set(18, 4, PAL.sail[1]);
    // linhas do texto e a assinatura
    for (const [y, w] of [[6, 7], [8, 8], [10, 6], [12, 8]]) for (let x = 8; x < 8 + w; x++) if (hash(x, y, 9) > 0.18) p.set(x, y, PAL.linen[1]);
    p.line(8, 15, 10, 14, PAL.linen[1]); p.line(10, 14, 11, 16, PAL.linen[1]);
    // selo de cera com fitas
    p.poly([[12.5, 16], [14, 16], [13.2, 22.5], [12, 21]], PAL.banner[1]);
    p.poly([[15, 16], [16.5, 16], [17.5, 21], [16, 22.5]], PAL.banner[2]);
    p.sphere(14.5, 15.5, 2.8, 2.6, PAL.banner, 0.15);
    p.set(14, 15, PAL.banner[0]); p.set(15, 15, PAL.banner[0]); p.set(14, 16, PAL.banner[1]);
    p.set(13, 14, PAL.scarf[3]);
    p.outline(PAL.out);
    return p;
  }

  // Trabuco: caixão de madeira cheio de pedras pendurado na ponta do braço.
  function counterweight() {
    const p = new Pix(N, N);
    bar(p, 1.5, 3.2, 22.5, 3.2, 1.7, PAL.wood, 0); // braço
    for (const x of [5, 18]) p.rect(x, 2, 1, 3, PAL.iron[2]);
    // tirantes de ferro
    bar(p, 11.5, 4, 5.2, 12, 0.65, PAL.iron, 0.1);
    bar(p, 12.5, 4, 18.8, 12, 0.65, PAL.iron, 0);
    // pedras amontoadas
    for (const [x, y, r] of [[7.5, 11, 2.3], [16.5, 11.2, 2.2], [12, 10, 2.8], [9.6, 12, 2], [14.4, 12, 2]]) p.sphere(x, y, r, r * 0.9, PAL.stone, 0);
    // caixão
    p.rect(4, 12, 16, 10, (x, y) => {
      if (x === 4 || x === 19 || y === 12 || y === 21) return PAL.iron[x === 4 || y === 12 ? 3 : 1]; // cantoneiras
      if (y === 16 || y === 17) return PAL.iron[y === 16 ? 3 : 1]; // cinta
      return pick(PAL.wood, 0.3 + (x < 10 ? 0.15 : 0) + ((y - 13) % 3 === 2 ? -0.25 : 0) + hash(x >> 2, y, 4) * 0.12, x, y);
    });
    for (const [x, y] of [[4, 12], [19, 12], [4, 21], [19, 21], [8, 16], [12, 16], [16, 16]]) p.set(x, y, PAL.iron[4]);
    // eixo
    p.sphere(12, 3.4, 1.6, 1.6, PAL.iron, 0.2);
    p.outline(PAL.out);
    return p;
  }

  // Marechal: mapa aberto entre dois rolos, com rio, floresta, castelo e a seta do ataque.
  function battleMap() {
    const p = new Pix(N, N);
    p.rect(3, 4, 18, 16, (x, y) => pick(PAL.sail, 0.55 + (hash(x, y, 1) - 0.5) * 0.18 + (x === 9 || x === 15 ? -0.22 : 0) - (y === 19 ? 0.2 : 0), x, y));
    // rio
    for (let y = 4; y <= 19; y++) {
      const x = 10.5 + (y - 4) * 0.18 + Math.sin(y * 0.6) * 1.3;
      p.set(x, y, PAL.water[2]); p.set(x + 1, y, PAL.water[4]);
    }
    // floresta
    for (const [x, y] of [[4, 6], [6, 5], [5, 8], [7, 8], [17, 17]]) {
      p.rect(x, y, 2, 1, PAL.herb[4]); p.rect(x, y + 1, 2, 1, PAL.herb[2]);
    }
    // castelo inimigo com bandeira
    p.rect(15, 7, 5, 5, (x, y) => PAL.stone[x === 15 ? 4 : x === 19 ? 2 : 3]);
    p.set(15, 6, PAL.stone[4]); p.set(17, 6, PAL.stone[3]); p.set(19, 6, PAL.stone[2]);
    p.rect(17, 10, 1, 2, DARK);
    p.line(17, 5, 17, 4, PAL.wood[1]);
    p.rect(18, 4, 2, 1, PAL.water[1]);
    // seta vermelha do ataque saindo das tropas
    for (const [x, y] of [[4, 15], [4, 17], [6, 16]]) p.rect(x, y, 2, 1, PAL.banner[1]);
    p.rect(7, 16, 3, 2, (x, y) => PAL.banner[y === 16 ? 3 : 2]);
    for (let i = 0; i <= 3; i++) p.rect(10 + i, 15 - i, 1, 2, (x, y) => PAL.banner[y === 15 - i ? 3 : 2]);
    p.poly([[12, 9.6], [16.4, 9.6], [16.4, 14]], (x, y) => PAL.banner[y < 11 ? 3 : 2]);
    // rolos nas pontas
    const roll = (x0) => bar(p, x0, 2.5, x0, 20.5, 1.5, PAL.sail, -0.05);
    roll(2.5); roll(20.5);
    p.rect(2, 1, 1, 1, PAL.wood[3]); p.rect(20, 1, 1, 1, PAL.wood[3]);
    p.rect(2, 22, 1, 1, PAL.wood[2]); p.rect(20, 22, 1, 1, PAL.wood[2]);
    p.outline(PAL.out);
    return p;
  }

  // Armada: vela enfunada cheia de remendos costurados, sobre um casco pequeno.
  function patchedSail() {
    const p = new Pix(N, N);
    // mar e casco
    p.fill(1, 20, 22, 22, (x, y) => y >= 21 - (x % 4 === 0 ? 1 : 0), (x, y) => PAL.water[y === 20 || (x + y) % 5 === 0 ? 4 : 2]);
    p.poly([[2, 16], [22, 16], [19, 21], [5, 21]], (x, y) => pick(PAL.wood, (y === 16 ? 0.8 : 0.4) - (y === 18 ? 0.25 : 0) + (x < 10 ? 0.1 : 0), x, y));
    p.rect(2, 16, 21, 1, PAL.wood[4]);
    // mastro e verga
    p.rect(11, 1, 2, 16, (x) => PAL.wood[x === 11 ? 4 : 2]);
    bar(p, 3, 3.6, 21, 3.6, 0.9, PAL.wood, 0.1);
    // flâmula
    p.poly([[13, 1], [18, 1.8], [13, 3]], (x) => PAL.banner[x < 15 ? 3 : 2]);
    // vela
    const sailIn = (x, y) => {
      const t = (y - 4.5) / 10;
      const half = 7.6 + Math.sin(Math.PI * Math.min(1, t)) * 1.6;
      const s = (x - 12) / half;
      return y >= 4.5 && Math.abs(s) <= 1 && y <= 13.5 + 2.4 * (1 - s * s);
    };
    p.fill(2, 4, 22, 16, sailIn, (x, y) => {
      const s = (x + 0.5 - 12) / 9.2, t = (y + 0.5 - 10) / 7;
      const v = 0.1 + sphereLight(s * 0.95, t * 0.8) * 0.95 + ((x - 3) % 4 === 0 ? -0.1 : 0);
      return pick(PAL.sail, v, x, y);
    });
    // remendos com pontos
    const patch = (x0, y0, w, h, r) => {
      p.rect(x0, y0, w, h, (x, y) => pick(r, 0.55 + (x === x0 ? 0.2 : 0) - (y === y0 + h - 1 ? 0.2 : 0), x, y));
      for (let x = x0; x < x0 + w; x += 2) { p.set(x, y0 - 1, PAL.linen[1]); p.set(x + 1, y0 + h, PAL.linen[1]); }
      for (let y = y0; y < y0 + h; y += 2) { p.set(x0 - 1, y + 1, PAL.linen[1]); p.set(x0 + w, y, PAL.linen[1]); }
    };
    patch(5, 7, 4, 3, PAL.straw);
    patch(14, 10, 3, 4, PAL.dirt);
    patch(9, 13, 3, 2, PAL.linen);
    // cabos
    p.line(3, 5, 3, 15, PAL.wood[1]);
    p.line(21, 5, 21, 15, PAL.wood[1]);
    p.outline(PAL.out);
    return p;
  }

  // Legião: três escudos lado a lado, sobrepostos como uma parede, com lanças por cima.
  function shieldWall() {
    const p = new Pix(N, N);
    for (const sx of [7, 16]) {
      p.rect(sx, 3, 1, 4, PAL.wood[3]);
      p.poly([[sx + 0.5, 0.5], [sx + 2, 3], [sx + 0.5, 4.5], [sx - 1, 3]], (x) => PAL.steel[x <= sx ? 5 : 3]);
    }
    const shield = (cx, top, bot, hw, r) => {
      const inS = (x, y) => Math.abs(x - cx) <= hw && y >= top && y <= bot &&
        !((Math.abs(x - cx) > hw - 1) && (y < top + 1 || y > bot - 1));
      p.fill(cx - hw, top, cx + hw, bot, inS, (x, y) => {
        const n = (x + 0.5 - cx) / hw;
        const rim = Math.abs(x + 0.5 - cx) > hw - 1 || y < top + 1 || y > bot - 1;
        if (rim) return pick(PAL.gold, 0.3 + cylLight(n) * 0.7, x, y);
        if (y === top + 2 || y === bot - 2) return pick(PAL.gold, 0.2 + cylLight(n) * 0.5, x, y);
        return pick(r, 0.1 + cylLight(n) * 0.85, x, y);
      });
      const my = (top + bot) / 2;
      p.sphere(cx, my, 2.2, 2.2, PAL.steel, 0.15);
      p.set(cx - 2, top + 4, PAL.gold[4]); p.set(cx + 1, top + 4, PAL.gold[3]);
      p.set(cx - 2, bot - 4, PAL.gold[3]); p.set(cx + 1, bot - 4, PAL.gold[2]);
    };
    shield(5.5, 5, 20, 4.5, PAL.banner);
    shield(18.5, 5, 20, 4.5, PAL.banner);
    shield(12, 6, 22, 5, PAL.banner);
    p.outline(PAL.out);
    return p;
  }

  // Conquistador: elmo dourado de frente, com penacho vermelho.
  function goldenHelm() {
    const p = new Pix(N, N);
    const cx = 12;
    // penacho
    p.fill(4, 0, 20, 8, (x, y) => ((x - cx) / 6.5) ** 2 + ((y - 4.5) / 3.6) ** 2 <= 1 && y >= 1,
      (x, y) => pick(PAL.banner, 0.25 + sphereLight((x + 0.5 - cx) / 6.5, (y + 0.5 - 4) / 3.6) * 0.8 + ((x * 2 + y) % 4 === 0 ? -0.2 : 0), x, y));
    // casco
    const helm = (x, y) => (((x - cx) / 7.6) ** 2 + ((y - 12) / 7) ** 2 <= 1) || (y >= 12 && y <= 22 && Math.abs(x - cx) <= 7.6 - (y - 12) * 0.3);
    p.fill(3, 4, 21, 22, helm, (x, y) => pick(PAL.gold,
      0.15 + sphereLight((x + 0.5 - cx) / 8.2, (y + 0.5 - 11) / 9) * 0.95, x, y));
    // aba da testa
    p.fill(3, 8, 21, 9, helm, (x, y) => PAL.gold[y === 8 ? (x < cx ? 5 : 4) : 1]);
    for (const x of [6, 9, 15, 18]) p.set(x, 8, PAL.banner[2]);
    // olhos e abertura da boca (aberturas escuras)
    p.fill(4, 10, 20, 12, (x, y) => {
      const d = Math.abs(x - cx);
      return d >= 1.2 && d <= 6 - (y - 10) * 0.9 && (y < 11.5 || d < 4.6);
    }, DARK);
    p.fill(10, 12, 14, 22, (x, y) => Math.abs(x - cx) <= 0.7 + (y - 12) * 0.08 && y > 13, DARK);
    // nasal e reflexos
    p.rect(cx - 1, 9, 2, 4, (x, y) => PAL.gold[x < cx ? 5 : 3]);
    p.set(6, 6, PAL.gold[5]); p.set(7, 5, PAL.gold[5]);
    for (const [x, y] of [[6, 16], [18, 16], [6, 19], [18, 19]]) p.set(x, y, PAL.gold[x < cx ? 5 : 2]);
    p.outline(PAL.out);
    return p;
  }

  // Lenda: alaúde do bardo com notas de música no ar.
  function lute() {
    const p = new Pix(N, N);
    const ang = -Math.PI / 4;
    // braço e cravelhal
    bar(p, 11, 13, 18.3, 5.7, 1.25, PAL.wood, -0.05);
    bar(p, 18, 5.5, 21.2, 7.6, 1.2, PAL.wood, 0.05);
    for (const [x, y] of [[19, 5], [21, 6], [20, 9], [22, 8]]) p.set(x, y, PAL.straw[4]);
    // corpo: fundo escuro e tampo claro
    rbox(p, 8.3, 15.7, ang, 6.8, 5.6, (u, v, x, y) => pick(PAL.wood, 0.25 + (v > 0.5 ? -0.2 : 0.2), x, y), (u, v) => u * u + v * v * (1 + u * 0.15) <= 1);
    rbox(p, 8, 15.4, ang, 6.2, 4.8, (u, v, x, y) => pick(PAL.straw,
      0.35 + sphereLight(-v * 0.6 + 0.1, -u * 0.6 - 0.1) * 0.65, x, y), (u, v) => u * u + v * v * (1 + u * 0.15) <= 1);
    // boca com roseta
    p.fill(6, 10, 13, 17, (x, y) => Math.hypot(x - 9.8, y - 13.6) <= 1.9, (x, y) => (Math.hypot(x + 0.5 - 9.8, y + 0.5 - 13.6) < 1.2 ? DARK : PAL.straw[1]));
    // cavalete
    bar(p, 3.8, 17.2, 6.6, 20, 0.7, PAL.wood, -0.2);
    // cordas
    p.line(5.5, 18, 18, 6, PAL.linen[4]);
    p.line(6, 18.6, 18.4, 6.4, PAL.linen[3]);
    // notas
    const note = (x, y, c) => {
      p.ellipse(x, y, 1.6, 1.2, (xx, yy) => c[xx < x ? 4 : 2]);
      p.rect(x + 1, y - 5, 1, 5, c[3]);
      p.set(x + 2, y - 4, c[3]); p.set(x + 3, y - 3, c[2]);
    };
    note(4, 8, PAL.gold);
    note(17, 17, PAL.gold);
    p.set(8, 2, PAL.gold[5]);
    p.set(21, 13, PAL.gold[5]);
    p.outline(PAL.out);
    return p;
  }

  // ---------------------------------------------------------------------------
  // Cartas da linha

  // Mestre-armeiro: velho careca de barba grisalha, avental de couro e um elmo novo debaixo do braço.
  function masterArmorer() {
    const p = new Pix(N, N);
    torso(p, 12, 15, 11, (x, y) => pick(PAL.linen, 0.25 + cylLight((x + 0.5 - 12) / 11) * 0.6, x, y));
    // avental
    p.fill(6, 15, 18, 23, (x, y) => Math.abs(x + 0.5 - 12) <= 5 + (y - 16) * 0.3,
      (x, y) => pick(PAL.leather, 0.3 + cylLight((x + 0.5 - 12) / 7) * 0.6 + (y === 20 ? -0.2 : 0), x, y));
    p.line(7, 15, 9, 17, PAL.leather[1]); p.line(17, 15, 15, 17, PAL.leather[1]);
    face(p, 12, 9, 5, 5.8);
    // careca lustrosa e testa franzida
    p.set(10, 5, PAL.skin[5]); p.set(11, 4, PAL.skin[5]); p.set(10, 4, PAL.skin[4]);
    p.rect(11, 6, 3, 1, PAL.skin[2]);
    // barba grisalha
    p.fill(5, 9, 19, 21, (x, y) => ((x - 12) / 6) ** 2 + ((y - 11.5) / 7.2) ** 2 <= 1 && y >= 11.5 - Math.abs(x + 0.5 - 12) * 0.35 + 0.8,
      (x, y) => pick(GREY, 0.7 - (y - 11) * 0.05 + ((x + y * 2) % 4 === 0 ? -0.2 : 0) + (x < 12 ? 0.08 : -0.08), x, y));
    p.rect(11, 13, 2, 1, GREY[1]); // boca na barba
    p.rect(9, 12, 6, 1, GREY[4]); // bigode
    // sobrancelhas, olhos e nariz
    p.rect(8, 8, 3, 1, GREY[4]); p.rect(13, 8, 3, 1, GREY[3]);
    p.set(9, 9, PAL.iris); p.set(14, 9, PAL.iris);
    p.set(12, 10, PAL.skin[2]); p.set(12, 11, PAL.skin[1]);
    // fuligem
    p.set(15, 7, PAL.skin[2]); p.set(16, 8, PAL.skin[2]);
    // elmo que ele acabou de forjar, debaixo do braço
    p.fill(1, 14, 10, 23, (x, y) => ((x - 5.2) / 4.2) ** 2 + ((y - 19) / 4.6) ** 2 <= 1 || (y >= 19 && Math.abs(x - 5.2) <= 4.6),
      (x, y) => pick(PAL.steel, 0.15 + sphereLight((x + 0.5 - 4.4) / 4.4, (y + 0.5 - 17.5) / 4.6) * 0.95, x, y));
    p.rect(5, 14, 1, 4, PAL.steel[5]); // crista
    p.rect(2, 18, 7, 1, DARK); // viseira
    for (const [x, y] of [[3, 20], [7, 20], [3, 21], [7, 21]]) p.set(x, y, PAL.steel[1]); // furos de ar
    p.rect(9, 20, 2, 2, (x, y) => PAL.skin[x === 9 ? 3 : 2]); // mão
    p.outline(PAL.out);
    return p;
  }

  // Martelo da sorte: marreta de ouro com um trevo de quatro folhas gravado e brilhos.
  function luckyHammer() {
    const p = new Pix(N, N);
    bar(p, 12, 8, 12, 21.5, 1.3, (x, y, nx, ny, t) => t > 0.6
      ? pick(PAL.leather, 0.2 + sphereLight(nx, 0) * 0.85 + (y % 2 ? -0.2 : 0), x, y)
      : lit(PAL.wood, nx, 0, 0.05, x, y));
    p.sphere(12, 21.6, 1.7, 1.2, PAL.gold, 0.2);
    // cabeça
    p.rect(5, 3, 14, 7, (x, y) => lit(PAL.gold, 0, (y + 0.5 - 6.5) / 3.6, 0.05 + (x < 8 ? 0.05 : 0), x, y));
    for (const x0 of [3, 19]) p.rect(x0, 2, 2, 9, (x, y) => lit(PAL.gold, x === x0 ? -0.6 : 0.4, (y + 0.5 - 6.5) / 4.6, 0.12, x, y));
    p.rect(5, 3, 14, 1, PAL.gold[5]);
    // trevo
    for (const [x, y] of [[11, 4], [13, 4], [11, 6], [13, 6]]) {
      p.rect(x - 1 + (x > 12 ? 1 : 0), y, 2, 2, (xx, yy) => PAL.herb[xx + yy === x + y - (x > 12 ? 0 : 1) ? 5 : 3]);
    }
    p.set(12, 5, PAL.herb[2]); p.set(12, 6, PAL.herb[2]); p.set(12, 8, PAL.herb[1]);
    // brilhos
    sparkle(p, 3, 15, PAL.sunCore, PAL.gold[4]);
    sparkle(p, 20, 15, PAL.sunCore, PAL.gold[4]);
    p.set(6, 19, PAL.gold[5]);
    p.set(18, 20, PAL.gold[5]);
    p.outline(PAL.out);
    return p;
  }

  // Sargento recrutador: chapéu de ferro de aba larga, bigodão e tabardo vermelho, gritando.
  function sergeant() {
    const p = new Pix(N, N);
    // ombros de cota de malha e tabardo
    torso(p, 12, 16, 11, (x, y) => pick(PAL.iron, 0.35 + cylLight((x + 0.5 - 12) / 11) * 0.5 + ((x + y) % 2 ? -0.15 : 0.05), x, y));
    p.fill(5, 16, 19, 23, (x, y) => Math.abs(x + 0.5 - 12) <= 5.5 + (y - 17) * 0.2,
      (x, y) => pick(PAL.banner, 0.25 + cylLight((x + 0.5 - 12) / 7) * 0.7, x, y));
    p.line(6, 17, 6, 23, PAL.gold[3]); p.line(18, 17, 18, 23, PAL.gold[2]);
    // talabarte com fivela
    p.line(7, 17, 15, 23, PAL.leather[2]); p.line(8, 17, 16, 23, PAL.leather[3]);
    p.rect(10, 19, 2, 2, (x, y) => PAL.gold[x === 10 ? 5 : 3]);
    // rosto
    face(p, 12, 11, 4.8, 5.2);
    // olhos zangados, sobrancelhas
    p.line(8, 9, 10, 10, PAL.beard[1]); p.line(16, 9, 14, 10, PAL.beard[1]);
    p.set(9, 11, PAL.iris); p.set(14, 11, PAL.iris);
    p.set(12, 12, PAL.skin[2]);
    // bigodão e boca aberta gritando
    p.rect(9, 13, 6, 1, PAL.beard[3]);
    p.set(8, 14, PAL.beard[2]); p.set(15, 14, PAL.beard[2]); p.set(7, 14, PAL.beard[1]); p.set(16, 14, PAL.beard[1]);
    p.rect(10, 14, 4, 2, DARK);
    p.rect(11, 15, 2, 1, PAL.lip);
    // chapéu de ferro: copa e aba larga
    p.fill(6, 1, 18, 8, (x, y) => ((x - 12) / 5) ** 2 + ((y - 7.5) / 5.6) ** 2 <= 1 && y <= 7.5,
      (x, y) => pick(PAL.steel, 0.2 + sphereLight((x + 0.5 - 12) / 5, (y + 0.5 - 6) / 5) * 0.85, x, y));
    p.fill(2, 6, 22, 9, (x, y) => ((x - 12) / 10) ** 2 + ((y - 8) / 1.7) ** 2 <= 1,
      (x, y) => pick(PAL.steel, y < 8 ? 0.85 - Math.abs(x - 11) * 0.03 : 0.3, x, y));
    p.rect(7, 6, 10, 1, PAL.banner[2]); // fita
    p.set(9, 3, PAL.steel[5]);
    p.outline(PAL.out);
    return p;
  }

  // Intendente do arsenal: escriba de gorro com pena, óculos e o livro de contas aberto.
  function quartermaster() {
    const p = new Pix(N, N);
    torso(p, 12, 16, 11, (x, y) => pick(PAL.hood, 0.2 + cylLight((x + 0.5 - 12) / 11) * 0.7, x, y));
    p.line(12, 16, 12, 18, PAL.hood[0]);
    face(p, 12, 10.5, 4.8, 5.4);
    // óculos
    for (const ex of [9, 14]) {
      p.rect(ex - 1, 9, 3, 1, PAL.gold[3]);
      p.set(ex - 1, 10, PAL.gold[2]); p.set(ex + 1, 10, PAL.gold[2]);
      p.set(ex, 10, PAL.iris);
      p.rect(ex - 1, 11, 3, 1, PAL.gold[2]);
    }
    p.set(11, 10, PAL.gold[3]); p.set(12, 10, PAL.gold[3]);
    p.set(8, 9, PAL.gold[5]);
    p.set(12, 12, PAL.skin[2]);
    p.rect(11, 14, 3, 1, PAL.skin[1]); // boca
    // gorro de feltro caído de lado com a pena
    p.fill(5, 1, 20, 8, (x, y) => ((x - 12.5) / 6.6) ** 2 + ((y - 6) / 4.4) ** 2 <= 1 && y <= 7,
      (x, y) => pick(PAL.lavender, 0.15 + sphereLight((x + 0.5 - 11) / 6.6, (y + 0.5 - 4) / 4.4) * 0.8, x, y));
    p.rect(6, 7, 13, 1, (x) => PAL.lavender[x < 12 ? 2 : 1]);
    bar(p, 16, 5, 21.5, 0.8, 0.95, (x, y) => PAL.linen[x + y > 22 ? 4 : 3]);
    p.line(16, 5, 21, 1, PAL.linen[2]);
    // livro de contas aberto, seguro pelas mãos
    p.poly([[4, 18], [12, 17], [20, 18], [20, 23], [4, 23]], PAL.band[1]);
    p.fill(5, 17, 19, 23, (x, y) => y >= 18 - (x < 12 ? (x - 5) * 0.12 : (19 - x) * 0.12) + 0.4,
      (x, y) => (x === 12 ? PAL.linen[1] : pick(PAL.linen, 0.75 - (x > 12 ? 0.15 : 0) - (y % 2 === 0 && x !== 5 && x !== 19 && x !== 11 && x !== 13 ? 0.35 : 0), x, y)));
    p.rect(2, 19, 3, 3, (x, y) => pick(PAL.skin, 0.6 - (y - 19) * 0.15, x, y));
    p.rect(19, 19, 3, 3, (x, y) => pick(PAL.skin, 0.45 - (y - 19) * 0.15, x, y));
    p.outline(PAL.out);
    return p;
  }

  // Bigorna rúnica: bigorna de ferro com runas azuis acesas e faíscas mágicas.
  function runicAnvil() {
    const p = new Pix(N, N);
    const shape = [[1.5, 6.5], [21.5, 6.5], [21.5, 10.5], [18, 11.5], [16.5, 14.5], [20, 17.5], [21, 21], [5, 21], [6, 17.5], [10, 14.5], [8.6, 11.5], [6, 10.6], [3.5, 8.6]];
    p.poly(shape, (x, y) => {
      if (y === 6) return PAL.steel[x < 9 ? 5 : 4];
      if (y === 7) return PAL.steel[3];
      const v = 0.18 + cylLight((x + 0.5 - 13) / 10) * 0.55 - (y > 17 ? 0.1 : 0) + (y === 18 ? 0.25 : 0);
      return pick(PAL.iron, v, x, y);
    });
    p.set(18, 6, PAL.iron[1]); // furo
    // runas
    const glyphs = [
      ['x.', 'xx', 'x.', 'x.'],
      ['xx', 'x.', 'xx', '.x'],
      ['x.x', '.x.', 'x.x', '.x.'],
      ['.x', 'xx', 'x.', 'x.'],
    ];
    const runeAt = (g, x0, y0) => g.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'x') p.set(x0 + i, y0 + j, RUNE[(i + j) % 2 ? 2 : 3]); }));
    runeAt(glyphs[0], 9, 8);
    runeAt(glyphs[1], 13, 8);
    runeAt(glyphs[3], 17, 8);
    runeAt(glyphs[2], 12, 16);
    // brilho em volta das runas
    for (const [x, y] of [[8, 9], [12, 10], [16, 9], [11, 17], [15, 17]]) p.set(x, y, RUNE[0]);
    sparkle(p, 6, 3, RUNE[4], RUNE[2]);
    sparkle(p, 17, 2, RUNE[4], RUNE[1]);
    p.set(12, 3, RUNE[3]);
    p.set(21, 3, RUNE[2]);
    p.outline(PAL.out);
    return p;
  }

  Object.assign(ART.icons, {
    'c-fart:ferreiro': temperedHammer,
    'c-fart:forja': bellows,
    'c-fart:arsenal': spearRack,
    'c-fart:quartel': drum,
    'c-fart:torre': spyglass,
    'c-fart:cavaleiro': horseshoe,
    'c-fart:fortaleza': gate,
    'c-fart:capitao': whistle,
    'c-fart:ordem': oath,
    'c-fart:trabuco': counterweight,
    'c-fart:marechal': battleMap,
    'c-fart:armada': patchedSail,
    'c-fart:legiao': shieldWall,
    'c-fart:conquistador': goldenHelm,
    'c-fart:lenda': lute,
    'c-ritmo:militar': masterArmorer,
    'c-sorte:militar': luckyHammer,
    'c-recruta:militar': sergeant,
    'c-desconto:militar': quartermaster,
    'c-bonanca:militar': runicAnvil,
  });
})();
