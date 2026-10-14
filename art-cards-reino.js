'use strict';
// Arte das cartas do reino: uma ilustração 24x24 por carta (bibliotecário,
// tesoureiro, coroa, estrela da sorte, cofre e tratado). Mais ouro e pedras que as ferramentas.
(() => {
  const ruby = ramp('#3e0f14', '#7a1622', '#c22a36', '#f05a5a', '#ffb4a8');
  const sapphire = ramp('#141c48', '#22357a', '#3a5cb4', '#6a92e0', '#b8d2ff');
  const emerald = PAL.herb;

  // Pedra lapidada: esfera da rampa com um brilho no alto à esquerda.
  function gem(p, cx, cy, rx, ry, r) {
    p.sphere(cx, cy, rx, ry, r, 0.05);
    p.set(cx - rx * 0.45, cy - ry * 0.45, r[r.length - 1]);
  }

  // Moeda de frente: aro escuro, face clara e um brilho.
  function coinFace(p, cx, cy, rx, ry) {
    p.ellipse(cx, cy, rx, ry, (x, y) => pick(PAL.gold, 0.15 + sphereLight((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) * 0.5, x, y));
    p.ellipse(cx - 0.3, cy - 0.3, rx - 1, ry - 1, (x, y) =>
      pick(PAL.gold, 0.35 + sphereLight((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) * 0.75, x, y));
    p.set(cx - rx * 0.4, cy - ry * 0.4, PAL.gold[5]);
  }

  // Moeda deitada (vista de lado, um pouco de cima): borda serrilhada e tampo claro.
  function coinFlat(p, cx, cy, rx = 3, ry = 1.3) {
    p.ellipse(cx, cy + 0.8, rx, ry, (x, y) => PAL.gold[x % 2 ? 1 : 2]);
    p.ellipse(cx, cy, rx, ry, (x, y) => pick(PAL.gold, 0.45 + sphereLight((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) * 0.55, x, y));
  }

  // Brilho de quatro pontas.
  function sparkle(p, x, y, big) {
    p.set(x, y, PAL.sunCore);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(x + dx, y + dy, PAL.gold[5]);
    if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) p.set(x + dx, y + dy, PAL.gold[4]);
  }

  // Bibliotecário: pilha de livros antigos, óculos por cima e uma pena.
  function librarian() {
    const p = new Pix(24, 24);
    // pena atrás da pilha
    const ax = 15.5, ay = 11, bx = 21.5, by = 1;
    const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
    p.fill(12, 0, 23, 12, (x, y) => {
      const t = ((x - ax) * ux + (y - ay) * uy) / L;
      const d = (x - ax) * -uy + (y - ay) * ux; // negativo = lado esquerdo
      if (t < 0.25 || t > 1.02) return false;
      const w = Math.sin(Math.PI * Math.min(1, (t - 0.2) / 0.85)) ** 0.6;
      return d < 0 ? -d <= 2.6 * w : d <= 1.5 * w;
    }, (x, y) => {
      const d = (x - ax) * -uy + (y - ay) * ux;
      const t = ((x - ax) * ux + (y - ay) * uy) / L;
      let v = d < 0 ? 0.75 : 0.45;
      if (Math.round(t * L + d * 0.8) % 3 === 0) v -= 0.25; // barbas
      return pick(PAL.sail, v, x, y);
    });
    p.line(ax, ay, bx, by, (x, y) => PAL.sail[y < 6 ? 1 : 0]);
    // livro de baixo: lombada vermelha
    p.rect(2, 17, 19, 5, (x, y) => pick(PAL.banner, 0.25 + sphereLight(0, (y + 0.5 - 18.6) / 2.6) * 0.75, x, y));
    for (const gx of [5, 17]) p.rect(gx, 17, 1, 5, (x, y) => PAL.gold[y === 17 ? 5 : y === 21 ? 2 : 3]);
    p.rect(9, 18, 5, 3, (x, y) => PAL.gold[y === 18 ? 4 : 2]); // rótulo
    p.rect(10, 19, 3, 1, PAL.gold[1]);
    // livro do meio: corte das folhas, capa de couro
    p.rect(4, 13, 18, 4, (x, y) => PAL.leather[y === 13 ? 4 : y === 16 ? 1 : 2]);
    p.rect(5, 14, 17, 2, (x, y) => PAL.linen[(y === 14 ? 4 : 3) - ((x + y) % 4 === 0 ? 1 : 0)]);
    p.rect(4, 14, 1, 2, PAL.leather[3]);
    p.set(21, 13, PAL.gold[3]); p.set(21, 16, PAL.gold[2]); // cantoneiras
    // livro de cima: lombada roxa
    p.rect(3, 9, 15, 4, (x, y) => pick(PAL.lavender, 0.2 + sphereLight(0, (y + 0.5 - 10.3) / 2.2) * 0.7, x, y));
    for (const gx of [5, 15]) p.rect(gx, 9, 1, 4, (x, y) => PAL.gold[y === 9 ? 5 : 3]);
    p.rect(8, 10, 5, 2, (x, y) => PAL.gold[y === 10 ? 4 : 2]);
    // óculos apoiados no livro
    for (const cx of [7.5, 13.5]) {
      p.ellipse(cx, 6.5, 2.4, 2.4, (x, y) => PAL.gold[y < 6 ? 4 : 2]);
      p.ellipse(cx, 6.5, 1.4, 1.4, (x, y) => PAL.water[y < 6 ? 5 : 4]);
      p.set(cx - 0.6, 5.6, C('#ffffff'));
    }
    p.rect(10, 5, 1, 1, PAL.gold[4]); // ponte
    p.rect(11, 5, 1, 1, PAL.gold[3]);
    p.line(5, 6, 4, 8, PAL.gold[2]); // haste
    p.outline(PAL.out);
    return p;
  }

  // Tesoureiro: bolsa de couro cheia de ouro, moedas saltando e uma pilha ao lado.
  function treasurer() {
    const p = new Pix(24, 24);
    const lit = (x, y) => 0.2 + sphereLight((x + 0.5 - 7.5) / 7, (y + 0.5 - 12) / 8) * 0.9;
    // corpo e pescoço da bolsa
    p.ellipse(9, 15.2, 7, 6.4, (x, y) => pick(PAL.leather, lit(x, y), x, y));
    p.poly([[4.5, 11], [13.5, 11], [11.5, 7], [6.5, 7]], (x, y) => pick(PAL.leather, lit(x, y), x, y));
    // boca aberta: aba franzida e o ouro lá dentro
    p.ellipse(9, 5.2, 5.2, 2.4, (x, y) => pick(PAL.leather, lit(x, y) + 0.15, x, y));
    p.ellipse(9, 4.6, 3.6, 1.5, (x, y) => pick(PAL.gold, 0.45 + sphereLight((x + 0.5 - 8) / 3.6, (y + 0.5 - 3.6) / 1.5) * 0.6, x, y));
    for (const x of [5, 7, 9, 11, 13]) p.set(x, 7, PAL.leather[x < 9 ? 3 : 2]); // franzido
    p.set(8, 3, PAL.gold[5]);
    // dobras do couro
    p.line(12, 11, 14, 15, PAL.leather[1]);
    p.line(9, 12, 9, 14, PAL.leather[2]);
    // cordão e borla
    p.rect(6, 8, 7, 1, (x, y) => PAL.band[x < 9 ? 3 : 2]);
    p.line(6, 9, 4, 12, PAL.band[2]);
    p.rect(3, 12, 2, 2, (x, y) => PAL.band[x === 3 ? 3 : 1]);
    // moeda saltando da boca
    coinFace(p, 15, 3.5, 2, 2);
    // pilha de moedas à direita
    for (let i = 0; i < 5; i++) coinFlat(p, 19, 20.2 - i * 2, 3.2, 1.4);
    // moedas soltas na frente
    coinFace(p, 14.2, 19.4, 2.4, 2.6);
    coinFlat(p, 3.5, 21, 2.2, 1);
    sparkle(p, 20.5, 6, true);
    p.outline(PAL.out);
    return p;
  }

  // Coroa do Rei: ouro com pontas de pérola, veludo por dentro e pedras no aro.
  function crown() {
    const p = new Pix(24, 24);
    const bow = (x) => 1.3 * (1 - ((x - 12) / 9.5) ** 2);
    // veludo vermelho por trás das pontas
    p.ellipse(12, 12, 7.8, 6, (x, y) => pick(PAL.banner, 0.05 + sphereLight((x + 0.5 - 10) / 7.8, (y + 0.5 - 9) / 6) * 0.6, x, y));
    // pontas: triângulos largos, lado esquerdo mais claro
    const spikes = [[3.2, 8, 2.4], [7.6, 5.6, 2.6], [12, 3.8, 2.8], [16.4, 5.6, 2.6], [20.8, 8, 2.4]];
    for (const [sx, ty, hw] of spikes) {
      p.poly([[sx - 1.1, ty + 0.6], [sx + 1.1, ty + 0.6], [sx + hw, 15], [sx - hw, 15]], (x, y) =>
        pick(PAL.gold, 0.3 + cylLight((x + 0.5 - 12) / 11) * 0.45 + (x + 0.5 < sx ? 0.18 : -0.05), x, y));
    }
    // aro curvo com frisos em cima e embaixo
    p.fill(2, 11, 21, 22, (x, y) => y >= 12.8 + bow(x) && y <= 19.6 + bow(x), (x, y) => {
      const t = y + 0.5 - 12.8 - bow(x + 0.5);
      let v = 0.22 + cylLight((x + 0.5 - 12) / 10.5) * 0.55;
      if (t < 1) v += 0.3; else if (t > 5.8) v -= 0.3; else if (t < 2 || t > 4.9) v -= 0.12;
      return pick(PAL.gold, v, x, y);
    });
    // pérolas nas pontas e o rubi do alto
    for (const [sx, ty] of spikes) if (sx !== 12) gem(p, sx, ty - 0.4, 1.3, 1.3, PAL.linen);
    gem(p, 12, 2.4, 1.7, 1.7, ruby);
    // pedrinhas no corpo das pontas
    for (const sx of [7.6, 16.4]) { p.set(sx, 9, sapphire[3]); p.set(sx, 10, sapphire[1]); }
    p.rect(11, 8, 2, 2, (x, y) => emerald[x === 11 && y === 8 ? 5 : y === 8 ? 3 : 2]);
    // pedras do aro
    gem(p, 12, 16.4 + bow(12), 1.9, 2.1, ruby);
    gem(p, 6.8, 16.3 + bow(6.8), 1.4, 1.6, emerald);
    gem(p, 17.2, 16.3 + bow(17.2), 1.4, 1.6, emerald);
    for (const x of [3.6, 9.4, 14.6, 20.4]) p.set(x, 16.1 + bow(x), PAL.linen[4]);
    p.outline(PAL.out);
    return p;
  }

  // Estrela da Sorte: estrela de ouro facetada com brilhos.
  function luckStar() {
    const p = new Pix(24, 24);
    const cx = 12, cy = 12.6, R = 10.2, r = 4.3;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? r : R;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    const LX = -0.6, LY = -0.8;
    p.poly(pts, (x, y) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      // faceta: metade da ponta mais próxima, cada uma inclinada para um lado
      const a = Math.atan2(dy, dx) + Math.PI / 2;
      const k = Math.round(a / (2 * Math.PI / 5));
      const tip = -Math.PI / 2 + k * 2 * Math.PI / 5;
      const side = Math.sin(Math.atan2(dy, dx) - tip) > 0 ? 1 : -1;
      const n = tip + side * 0.9;
      let v = 0.56 + (Math.cos(n) * LX + Math.sin(n) * LY) * 0.36;
      const dist = Math.hypot(dx, dy);
      if (dist < 2.2) v += 0.25;
      return pick(PAL.gold, v, x, y, 3);
    });
    // brilho no centro e na ponta de cima
    p.set(11, 11, PAL.sunCore); p.set(12, 11, PAL.gold[5]); p.set(11, 12, PAL.gold[5]);
    p.set(11, 4, PAL.gold[5]);
    sparkle(p, 19.5, 3.5, true);
    sparkle(p, 3.5, 3.5, false);
    sparkle(p, 12, 21, false);
    p.set(2, 17, PAL.gold[4]); p.set(21, 18, PAL.gold[4]);
    p.outline(PAL.out);
    return p;
  }

  // Cofre do Reino: arca de madeira com cintas de ferro, tampa aberta e ouro transbordando.
  function vault() {
    const p = new Pix(24, 24);
    // tampa aberta para trás: o lado de dentro, escuro, com moldura de ferro
    p.poly([[4, 2], [20, 2], [21, 10], [3, 10]], (x, y) => {
      const edge = y === 2 || x <= 3 + (10 - y) * 0.13 || x >= 20 - (10 - y) * 0.13;
      return edge ? PAL.steel[y === 2 ? 4 : 2] : pick(PAL.wood, 0.05 + (y - 2) * 0.03 + (y % 3 === 0 ? 0.1 : 0), x, y);
    });
    p.rect(5, 5, 14, 1, PAL.steel[1]);
    // monte de moedas: base escura e moedas deitadas, de trás para a frente
    p.ellipse(12, 12.5, 9, 6.4, (x, y) => pick(PAL.gold, 0.05 + sphereLight((x + 0.5 - 12) / 9, (y + 0.5 - 9) / 6.4) * 0.5, x, y));
    for (const [x, y] of [[11, 6.8], [7.5, 8.4], [15.5, 8.6], [4.6, 10.6], [11.4, 9.6], [19.2, 10.8], [8.2, 11.2], [14.8, 11.4]]) {
      coinFlat(p, x, y, 2.3, 1);
    }
    gem(p, 8.5, 10, 1.3, 1.2, ruby);
    gem(p, 16, 9.8, 1.2, 1.2, sapphire);
    gem(p, 13.5, 7.6, 1, 1, emerald);
    // corpo da arca
    p.rect(2, 12, 20, 10, (x, y) => pick(PAL.wood, 0.25 + cylLight((x + 0.5 - 12) / 10.5) * 0.55 - ((y - 12) % 3 === 2 ? 0.18 : 0), x, y));
    const iron = (x, y) => pick(PAL.steel, 0.3 + cylLight((x + 0.5 - 12) / 10.5) * 0.5, x, y);
    p.rect(2, 12, 20, 2, (x, y) => (y === 12 ? PAL.steel[4] : iron(x, y)));
    p.rect(2, 20, 20, 2, (x, y) => (y === 20 ? PAL.steel[3] : PAL.steel[1]));
    for (const bx of [4, 18]) {
      p.rect(bx, 12, 2, 10, (x, y) => PAL.steel[x === bx ? 3 : 2]);
      for (const ry of [15, 18]) p.set(bx, ry, PAL.steel[5]);
    }
    // cantoneiras de ouro
    for (const [x0, y0, sx, sy] of [[2, 12, 1, 1], [21, 12, -1, 1], [2, 21, 1, -1], [21, 21, -1, -1]]) {
      p.set(x0, y0, PAL.gold[4]);
      p.set(x0 + sx, y0, PAL.gold[3]);
      p.set(x0, y0 + sy, PAL.gold[3]);
    }
    // espelho da fechadura em forma de escudo, com o buraco da chave
    p.poly([[9, 13], [15, 13], [15, 17.2], [12, 20.2], [9, 17.2]], (x, y) =>
      pick(PAL.gold, 0.4 + (x < 12 ? 0.25 : 0) + (y < 15 ? 0.2 : 0), x, y));
    for (const x of [10, 13]) p.set(x, 13, PAL.gold[5]);
    p.rect(11, 15, 2, 1, C('#140b06'));
    p.set(11.5, 16, C('#140b06'));
    p.set(11.5, 17, C('#140b06'));
    // moedas caindo pela borda
    coinFace(p, 6.5, 12.6, 1.8, 1.8);
    coinFlat(p, 17.6, 12.6, 1.8, 0.8);
    coinFlat(p, 20.5, 21.6, 2, 0.9);
    sparkle(p, 19, 7, false);
    p.outline(PAL.out);
    return p;
  }

  // Tratado de Comércio: pergaminho aberto entre dois rolos, texto, lacre e fitas.
  function treaty() {
    const p = new Pix(24, 24);
    // folha
    p.rect(5, 4, 14, 14, (x, y) => {
      let v = 0.6 + (x < 8 ? 0.1 : 0) - (x > 16 ? 0.15 : 0) - (y > 14 ? 0.1 : 0);
      if (hash(x, y, 31) < 0.12) v -= 0.18;
      return pick(PAL.sail, v, x, y);
    });
    // texto: linhas de palavras e uma assinatura de cada parte
    for (const [y, x0, x1] of [[7, 7, 16], [9, 7, 16], [11, 7, 15], [13, 7, 13]]) {
      for (let x = x0; x <= x1; x++) if (hash(x, y, 5) > 0.22) p.set(x, y, PAL.dirt[x % 3 ? 1 : 2]);
    }
    p.rect(9, 5, 6, 1, PAL.banner[2]); // título em vermelho
    p.set(7, 15, PAL.leather[1]); p.set(8, 14, PAL.leather[1]); p.set(9, 15, PAL.leather[1]); p.set(10, 14, PAL.leather[1]);
    // rolos de cima e de baixo com pontas de ouro
    const roll = (y0) => {
      p.rect(3, y0, 18, 3, (x, y) => pick(PAL.sail, 0.05 + sphereLight(0, (y + 0.5 - y0 - 1.2) / 1.6) * 0.9 - (x > 17 ? 0.15 : 0), x, y));
      p.rect(3, y0, 2, 3, (x, y) => PAL.sail[x === 3 ? 2 : y === y0 + 1 ? 0 : 1]); // espiral da ponta
      for (const kx of [1.6, 22]) gem(p, kx, y0 + 1.5, 1.2, 1.4, PAL.gold);
    };
    roll(2);
    roll(17);
    // fitas pendendo do lacre
    for (const [x0, lean] of [[12, -1], [16, 1]]) {
      for (let y = 17; y <= 22; y++) {
        const x = x0 + (y > 19 ? lean : 0);
        if (y === 22) { p.set(x + (lean < 0 ? 0 : 1), y, sapphire[2]); continue; } // corte em V
        p.set(x, y, sapphire[3]);
        p.set(x + 1, y, sapphire[1]);
      }
    }
    // lacre de cera vermelha
    p.sphere(14.5, 16, 3, 2.8, ruby, -0.08);
    p.ellipse(14.5, 16, 1.7, 1.6, ruby[1]);
    p.set(14, 15, ruby[3]); p.set(15, 16, ruby[2]);
    p.set(13, 14, ruby[4]);
    p.outline(PAL.out);
    return p;
  }

  Object.assign(ART.icons, {
    'c-reino:cartas': librarian,
    'c-reino:tesouro': treasurer,
    'c-reino:fartura': crown,
    'c-reino:sorte': luckStar,
    'c-reino:bonanca': vault,
    'c-reino:desconto': treaty,
  });
})();
