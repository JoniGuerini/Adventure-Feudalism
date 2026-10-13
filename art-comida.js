'use strict';
// Linha de produção: COMIDA (trigo).
// Camponês (tier 1) colhe trigo, Moinho (tier 2) gera camponeses, Celeiro (tier 3) virá depois.
// Aqui ficam os retratos, os ícones e a cena do trigal dessa linha.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

// ---------------------------------------------------------------------------
// Camponês

function buildPeasant() {
  const p = new Pix(64, 64);
  const cx = 32;
  const mirror = (pts) => pts.map(([x, y]) => [64 - x, y]);

  // camisa de linho
  p.poly([[3, 64], [5, 57], [11, 52.5], [22, 49], [42, 49], [53, 52.5], [59, 57], [61, 64]], (x, y) => {
    const nx = (x + 0.5 - cx) / 29;
    return pick(PAL.linen, 0.62 - nx * 0.42 - (y - 50) * 0.01, x, y);
  });
  // dobras das mangas
  p.line(9, 58, 12, 64, PAL.linen[1]);
  p.line(55, 58, 52, 64, PAL.linen[0]);
  p.line(7, 61, 8, 64, PAL.linen[2]);

  // colete de couro
  const vestL = [[9, 64], [11, 56.5], [17, 52], [24.5, 49.5], [27.5, 53], [28.5, 64]];
  const vestShade = (bias) => (x, y) => {
    const nx = (x + 0.5 - cx) / 26;
    let v = 0.55 - nx * 0.45 + bias + (hash(x, y, 7) - 0.5) * 0.12;
    return pick(PAL.vest, v, x, y);
  };
  p.poly(vestL, vestShade(0.05));
  p.poly(mirror(vestL), vestShade(-0.05));
  // costura e acabamento da borda do colete
  for (let y = 53; y < 64; y++) {
    p.set(27, y, y % 2 ? PAL.vest[4] : PAL.vest[3]);
    p.set(36, y, y % 2 ? PAL.vest[2] : PAL.vest[1]);
  }
  // bolso
  p.rect(14, 57, 7, 1, PAL.vest[1]);
  p.rect(14, 58, 7, 4, PAL.vest[3]);
  p.rect(15, 58, 5, 1, PAL.vest[4]);
  // botões da camisa
  for (const y of [57, 61]) { p.set(31, y, PAL.linen[1]); p.set(32, y, PAL.linen[0]); }

  // pescoço
  p.rect(27, 41, 10, 9, (x, y) => pick(PAL.skin, (y < 45 ? 0.18 : 0.4) - (x - 31) * 0.03, x, y));

  // lenço no pescoço
  p.poly([[23.5, 48], [40.5, 48], [32, 56.5]], (x, y) => pick(PAL.scarf, 0.75 - (x - 26) * 0.04 - (y - 48) * 0.05, x, y));
  p.sphere(32, 49.5, 3, 2.2, PAL.scarf, 0.1);

  // orelhas
  p.sphere(19.9, 36, 2.3, 3.4, PAL.skin, 0.15);
  p.sphere(44.1, 36, 2.3, 3.4, PAL.skin, -0.15);
  p.set(19, 36, PAL.skin[1]);
  p.set(44, 36, PAL.skin[0]);

  // cabeça: elipse que afina no queixo
  const hx = 32, hy = 34.5, hrx = 12, hry = 13.4;
  const inHead = (x, y) => {
    const dy = (y - hy) / hry;
    const rx = dy > 0 ? hrx * (1 - 0.3 * dy * dy) : hrx;
    return ((x - hx) / rx) ** 2 + dy * dy <= 1;
  };
  p.fill(hx - hrx, hy - hry, hx + hrx, hy + hry, inHead, (x, y) => {
    let v = 0.1 + sphereLight((x + 0.5 - hx) / hrx, (y + 0.5 - hy) / hry) * 1.05;
    if (y < 29) v -= 0.3; // sombra da aba do chapéu
    return pick(PAL.skin, v, x, y);
  });

  // costeletas
  p.fill(18, 24, 46, 40, (x, y) => inHead(x, y) && Math.abs(x - 32) > (y < 31 ? 8 : 9.4) && y < 39,
    (x, y) => pick(PAL.hair, 0.35 - (x - 32) * 0.02 + (hash(x, y, 3) - 0.5) * 0.2, x, y));

  // barba curta
  p.fill(18, 36, 46, 48, (x, y) => inHead(x, y) && (y > 40.5 || (y > 37 && Math.abs(x - 32) > 8.3)),
    (x, y) => {
      const l = sphereLight((x + 0.5 - hx) / hrx, (y + 0.5 - hy) / hry);
      return pick(PAL.hair, 0.2 + l * 0.75 + (hash(x, y, 5) - 0.5) * 0.25, x, y, 1.4);
    });
  // bigode
  for (let x = 28; x <= 35; x++) p.set(x, 40, PAL.hair[x < 32 ? 2 : 1]);
  p.set(27, 41, PAL.hair[2]);
  p.set(36, 41, PAL.hair[1]);
  // boca
  for (let x = 30; x <= 33; x++) p.set(x, 42, PAL.skin[0]);
  p.set(31, 43, PAL.lip);
  p.set(32, 43, PAL.lip);

  // sobrancelhas
  for (const [x, y] of [[25, 32], [26, 31], [27, 31], [28, 31]]) {
    p.set(x, y, PAL.hair[1]);
    p.set(63 - x, y, PAL.hair[1]);
  }
  // olhos
  drawEyes(p, false);

  // nariz
  p.set(31, 35, PAL.skin[4]);
  p.set(31, 36, PAL.skin[5]);
  p.set(32, 36, PAL.skin[3]);
  p.set(33, 36, PAL.skin[2]);
  p.set(33, 37, PAL.skin[1]);
  p.set(30, 38, PAL.skin[2]);
  p.set(31, 38, PAL.skin[3]);
  p.set(32, 38, PAL.skin[2]);
  p.set(33, 38, PAL.skin[1]);
  p.set(31, 39, PAL.skin[2]);
  p.set(32, 39, PAL.skin[2]);

  // bochechas coradas
  for (let y = 37; y <= 38; y++) {
    for (let x = 25; x <= 28; x++) {
      if (bayer(x, y) < 0.5) { p.set(x, y, PAL.blush); p.set(63 - x, y, PAL.blush); }
    }
  }

  // chapéu: aba larga
  p.ellipse(32, 27, 23.5, 5.2, (x, y) => {
    const nx = (x + 0.5 - 32) / 23.5;
    let v = y < 27 ? 0.68 - nx * 0.3 + (27 - y) * 0.04 : 0.22 - nx * 0.12 - (y - 27) * 0.04;
    if ((x + y * 2) % 4 === 0) v -= 0.16; // trançado da palha
    if (hash(x, y, 11) < 0.05) v += 0.15;
    return pick(PAL.straw, v, x, y);
  });
  // fiapos na borda da aba
  for (const [x, y] of [[8, 28], [7, 27], [56, 28], [57, 27], [13, 31], [51, 31], [21, 32]]) p.set(x, y, PAL.straw[2]);
  // copa
  p.fill(20, 11, 44, 27, (x, y) => ((x - 32) / 11.6) ** 2 + ((y - 22.5) / 11) ** 2 <= 1 && y < 26.5 &&
    !(y < 13 && Math.abs(x - 32) < 3.5), (x, y) => {
    let v = 0.1 + sphereLight((x + 0.5 - 32) / 11.6, (y + 0.5 - 21) / 11) * 1.05;
    if (y % 3 === 0) v -= 0.14;
    if ((x + Math.floor(y / 3)) % 4 === 0) v -= 0.07;
    return pick(PAL.straw, v, x, y);
  });
  // fita do chapéu
  p.fill(20, 21, 44, 26, (x, y) => ((x - 32) / 11.6) ** 2 + ((y - 22.5) / 11) ** 2 <= 1 && y > 21 && y < 25.5,
    (x, y) => pick(PAL.band, 0.15 + sphereLight((x + 0.5 - 32) / 11.6, 0) * (y === 22 ? 1.1 : 0.85), x, y));
  // espiga presa na fita
  p.line(40, 23, 44, 13, PAL.wheat[2]);
  for (const [x, y, k] of [[44, 13, 5], [43, 14, 4], [45, 14, 3], [43, 16, 4], [44, 15, 3], [42, 17, 3], [44, 12, 5], [45, 11, 4]]) p.set(x, y, PAL.wheat[k]);

  p.outline(PAL.out);
  return p;
}

function drawEyes(p, closed) {
  for (const x0 of [26, 35]) {
    const left = x0 === 26;
    if (closed) {
      for (let i = 0; i < 3; i++) {
        p.set(x0 + i, 33, PAL.skin[3]);
        p.set(x0 + i, 34, PAL.hair[1]);
        p.set(x0 + i, 35, PAL.skin[left ? 3 : 2]);
      }
      continue;
    }
    for (let i = 0; i < 3; i++) p.set(x0 + i, 33, PAL.hair[1]);
    const row = left ? [PAL.eyeWhite, PAL.iris, PAL.iris] : [PAL.iris, PAL.iris, PAL.eyeWhite];
    row.forEach((c, i) => p.set(x0 + i, 34, c));
    p.set(x0 + (left ? 2 : 1), 34, PAL.irisHi);
    p.set(x0, 35, PAL.skin[left ? 3 : 2]);
    p.set(x0 + 1, 35, PAL.iris);
    p.set(x0 + 2, 35, left ? PAL.iris : PAL.skin[2]);
    if (!left) p.set(x0, 35, PAL.iris);
  }
}

function buildPeasantBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 44);
  paintSun(p, 56, 8, 4);
  // linha de árvores ao longe
  for (let x = 0; x < 64; x++) {
    const top = 40 + Math.round(1.6 * Math.sin(x * 0.42) + 1.2 * Math.sin(x * 1.1 + 2));
    for (let y = top; y < 46; y++) p.set(x, y, pick(PAL.tree, 0.55 - (y - top) * 0.12 + (hash(x, y) - 0.5) * 0.3, x, y));
  }
  // trigal
  for (let y = 45; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.42 + (y - 45) * 0.018 + (hash(x, y, 2) - 0.5) * 0.22 - (y % 4 === 0 ? 0.1 : 0);
      p.set(x, y, pick(PAL.wheat, v, x, y, 1.6));
    }
  }
  return p;
}

const peasantArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintPeasantPortrait(ctx, t, working) {
  const a = peasantArt;
  if (!a.bg) {
    a.bg = buildPeasantBackdrop();
    a.body = buildPeasant();
  }
  const f = a.frame.copyFrom(a.bg);
  // espigas balançando ao vento
  for (let row = 0; row < 6; row++) {
    const y = 46 + row * 3;
    for (let x = (row % 2) * 2; x < 64; x += 4) {
      const sway = Math.round(Math.sin(t * 1.8 - x * 0.09 + row * 0.6) * (1 + row * 0.25));
      const k = row > 3 ? 5 : 4;
      f.set(x + sway, y, PAL.wheat[k]);
      f.set(x + sway, y + 1, PAL.wheat[k - 1]);
      if (row > 2) f.set(x + Math.round(sway / 2), y + 2, PAL.wheat[2]);
    }
  }
  const bob = working && Math.sin(t * 2.2) > 0.85 ? 1 : 0;
  f.blit(a.body, 0, bob);
  // piscadas
  const blink = t % 4.3 > 4.15 || (t % 9.1 > 8.95);
  if (blink) {
    const tmp = new Pix(64, 64);
    drawEyes(tmp, true);
    f.blit(tmp, 0, bob);
  }
  // talo de trigo no canto da boca, mastigando
  const chew = Math.round(Math.sin(t * (working ? 5 : 2)) * 1.2);
  const sx = 34, sy = 43 + bob, ex = 41, ey = 40 + chew + bob;
  f.line(sx, sy + 1, ex, ey + 1, PAL.out);
  f.line(sx, sy, ex, ey, PAL.wheat[3]);
  for (const [dx, dy, k] of [[0, -1, 5], [1, -1, 4], [1, -2, 5], [2, -2, 3], [2, -3, 4], [0, 0, 4], [-1, -1, 3]]) {
    f.set(ex + dx, ey + dy, PAL.wheat[k]);
  }
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Moinho

function buildMillBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 54);
  paintSun(p, 10, 10, 4.5);
  // morros distantes
  for (let x = 0; x < 64; x++) {
    const top = 47 + Math.round(2.5 * Math.sin(x * 0.11 + 0.5) + Math.sin(x * 0.37));
    for (let y = top; y < 56; y++) p.set(x, y, pick(PAL.far, 0.7 - (y - top) * 0.06 + (x - 32) * -0.004, x, y));
  }
  // colina gramada
  p.ellipse(32, 88, 58, 34, (x, y) => {
    let v = 0.1 + sphereLight((x + 0.5 - 32) / 58, (y + 0.5 - 88) / 34) * 1.1;
    if (hash(x, y, 4) < 0.08) v -= 0.2;
    if (hash(x, y, 8) < 0.05) v += 0.15;
    return pick(PAL.grass, v, x, y);
  });
  // caminho de terra até a porta
  p.poly([[29, 60], [35, 60], [41, 64], [23, 64]], (x, y) => pick(PAL.dirt, 0.55 + (hash(x, y, 6) - 0.5) * 0.4 - (x - 32) * 0.03, x, y));
  // cerca
  for (const x of [48, 53, 58, 63]) {
    p.rect(x, 52, 1, 6, PAL.wood[3]);
    p.set(x, 52, PAL.wood[4]);
  }
  p.rect(48, 53, 16, 1, PAL.wood[2]);
  p.rect(48, 55, 16, 1, PAL.wood[1]);
  // flores no capim
  for (const [x, y, c] of [[8, 59, '#f4e9d0'], [14, 61, '#e0644c'], [44, 60, '#f4e9d0'], [50, 62, '#f3d47c'], [5, 62, '#e0644c']]) p.set(x, y, C(c));
  return p;
}

function buildMillTower() {
  const p = new Pix(64, 64);
  const hw = (y) => 8 + (y - 27) * (5.5 / 33);
  // torre de pedra com tijolos em fiadas
  p.fill(10, 27, 54, 60, (x, y) => y >= 27 && Math.abs(x - 32) <= hw(y), (x, y) => {
    const w = hw(y + 0.5);
    const nx = (x + 0.5 - 32) / w;
    let v = 0.08 + cylLight(nx) * 0.95;
    const row = Math.floor((y - 27) / 4);
    const ry = (y - 27) % 4;
    const off = (row % 2) * 3.5;
    const bx = Math.floor((x + off) / 7);
    if (ry === 3) v -= 0.22;
    else if ((x + off) % 7 < 1) v -= 0.16;
    else v += (hash(bx, row, 3) - 0.5) * 0.2;
    return pick(PAL.stone, v, x, y);
  });
  // base mais larga
  p.fill(16, 58, 48, 61, (x, y) => Math.abs(x - 32) <= 14.6, (x, y) =>
    pick(PAL.stone, 0.05 + cylLight((x + 0.5 - 32) / 14.6) * 0.8 - (y === 58 ? -0.15 : 0), x, y));

  // porta em arco com moldura de pedra
  const doorTest = (rx, top) => (x, y) => (Math.abs(x - 32) <= rx && y >= top + rx * 0.8) || (((x - 32) / rx) ** 2 + ((y - top - rx * 0.8) / (rx * 0.85)) ** 2 <= 1);
  p.fill(26, 46, 38, 59, doorTest(5, 46.5), (x, y) => pick(PAL.stone, 0.8 - (x - 28) * 0.04, x, y));
  p.fill(27, 48, 37, 59, doorTest(3.8, 48.5), (x, y) => {
    let v = 0.55 - (x - 29) * 0.07;
    if (x === 29 || x === 32) v -= 0.3;
    return pick(PAL.wood, v, x, y);
  });
  for (const y of [51, 56]) for (let x = 28; x <= 30; x++) p.set(x, y, PAL.iron[1]);
  p.set(34, 54, PAL.gold[4]);
  p.set(34, 55, PAL.gold[2]);

  // varanda de madeira ao redor da torre
  const gy = 42;
  const gw = hw(gy) + 2.5;
  p.fill(32 - gw, gy, 32 + gw, gy + 1, (x, y) => Math.abs(x - 32) <= gw, (x, y) =>
    pick(PAL.wood, (y === gy ? 0.75 : 0.35) - (x - 32) * 0.02, x, y));
  p.rect(Math.round(32 - gw), gy + 2, Math.round(gw * 2), 1, PAL.stone[0]);
  for (let x = Math.ceil(32 - gw); x <= 32 + gw; x += 3) {
    p.set(x, gy - 1, PAL.wood[2]);
    p.set(x, gy - 2, PAL.wood[3]);
  }
  p.rect(Math.round(32 - gw), gy - 3, Math.round(gw * 2) + 1, 1, PAL.wood[3]);

  // janela em arco
  p.fill(28, 31, 36, 39, doorTest(2.9, 31.5), PAL.stone[4]);
  p.fill(29, 32, 35, 38, doorTest(1.9, 32.5), (x, y) => (x === 31 && y < 35 ? PAL.glassHi : PAL.glass));
  p.set(32, 35, PAL.stone[3]);

  // capuz (telhado em cúpula com telhas de madeira)
  const capH = 15, capBase = 28;
  const chw = (y) => 10.5 * Math.pow(Math.max(0, 1 - (capBase - y) / capH), 0.7);
  p.fill(20, capBase - capH, 44, capBase, (x, y) => y <= capBase && Math.abs(x - 32) <= chw(y), (x, y) => {
    const w = Math.max(1, chw(y + 0.5));
    let v = 0.15 + cylLight((x + 0.5 - 32) / w) * 0.9 + (capBase - y) * 0.015;
    if (y % 3 === 0) v -= 0.2;
    else if ((x + (Math.floor(y / 3) % 2) * 2) % 4 === 0) v -= 0.1;
    return pick(PAL.roof, v, x, y);
  });
  // beiral
  p.fill(20, capBase, 44, capBase + 1, (x, y) => Math.abs(x - 32) <= 11.6, (x, y) =>
    pick(PAL.wood, (y === capBase ? 0.7 : 0.3) - (x - 32) * 0.02, x, y));
  // ponteira
  p.rect(31, 9, 2, 5, (x) => (x === 31 ? PAL.iron[3] : PAL.iron[1]));
  p.sphere(32, 8, 1.8, 1.8, PAL.gold, 0.1);

  p.outline(PAL.out);
  return p;
}

// Pás do moinho: cada pixel é transformado para o sistema da pá (r ao longo, o ao lado),
// então a rotação fica limpa em qualquer ângulo.
function paintSails(p, hx, hy, angle, len, width, inner) {
  const R = len + 1.5;
  const cos = [], sin = [];
  for (let k = 0; k < 4; k++) {
    cos.push(Math.cos(angle + (k * Math.PI) / 2));
    sin.push(Math.sin(angle + (k * Math.PI) / 2));
  }
  const bar = Math.max(2.2, len / 6.5);
  for (let y = Math.floor(hy - R); y <= hy + R; y++) {
    for (let x = Math.floor(hx - R); x <= hx + R; x++) {
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy;
      for (let k = 0; k < 4; k++) {
        const r = dx * cos[k] + dy * sin[k];
        const o = -dx * sin[k] + dy * cos[k];
        if (r < 1 || r > len) continue;
        if (Math.abs(o) <= 0.75) { p.set(x, y, o < 0 ? PAL.wood[2] : PAL.wood[1]); break; }
        if (r >= inner && o > 0.75 && o <= width) {
          const edge = o > width - 0.9 || r > len - 0.9;
          const lat = (r - inner) % bar < 0.85;
          let c;
          if (edge) c = PAL.wood[2];
          else if (lat) c = PAL.wood[3];
          else c = pick(PAL.sail, 0.62 - (o / width) * 0.3 + Math.sin(((r - inner) / bar) * Math.PI) * 0.12, x, y, 1.6);
          p.set(x, y, c);
          break;
        }
      }
    }
  }
}

const millArt = { bg: null, tower: null, sails: new Pix(64, 64), frame: new Pix(64, 64), cloud: null };

function paintMillPortrait(ctx, t, angle) {
  const a = millArt;
  if (!a.bg) {
    a.bg = buildMillBackdrop();
    a.tower = buildMillTower();
    a.cloud = makeCloud(22, 9, 3);
  }
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.cloud, Math.floor(((t * 2) % 90) - 24), 14);
  f.blit(a.tower, 0, 0);
  a.sails.clear();
  paintSails(a.sails, 32, 22, angle, 21, 6.5, 5);
  a.sails.sphere(32, 22, 2.4, 2.4, PAL.wood, 0.1);
  a.sails.outline(PAL.out);
  f.blit(a.sails, 0, 0);
  f.draw(ctx);
}


// ---------------------------------------------------------------------------
// Celeiro (tier 3 bloqueado): silhueta com cadeado

function paintBarnLocked(ctx) {
  ART.paintLocked(ctx, (p, body, rim) => {
    p.poly([[9, 61], [9, 37], [17, 27], [32, 19], [47, 27], [55, 37], [55, 61]], body);
    p.line(17, 27, 32, 19, rim);
    p.line(9, 37, 17, 27, rim);
    p.line(22, 44, 41, 60, C('#18121a'));
    p.line(41, 44, 22, 60, C('#18121a'));
    p.rect(22, 44, 20, 1, C('#18121a'));
  });
}

// ---------------------------------------------------------------------------
// Ícones 16x16

function iconWheat() {
  const p = new Pix(16, 16);
  const stalks = [[4.5, 4, 6.5, 15], [8, 2, 8, 15], [11.5, 4, 9.5, 15]];
  for (const [tx, ty, bx, by] of stalks) p.line(tx, ty + 3, bx, by, PAL.wheat[2]);
  for (const [tx, ty] of stalks) {
    p.ellipse(tx, ty + 2.6, 1.7, 3.2, (x, y) => {
      let v = 0.2 + sphereLight((x + 0.5 - tx) / 1.7, (y + 0.5 - ty - 2.6) / 3.2) * 1.1;
      if ((x + y) % 2 === 0) v -= 0.12;
      return pick(PAL.wheat, v, x, y);
    });
    p.set(Math.round(tx) - 1, ty - 1, PAL.wheat[4]);
    p.set(Math.round(tx), ty - 2, PAL.wheat[5]);
  }
  p.rect(5, 10, 6, 2, (x, y) => PAL.band[y === 10 ? 3 : 1]);
  p.outline(PAL.out);
  return p;
}

function iconPeasant() {
  const p = new Pix(16, 16);
  p.sphere(8, 10, 4.2, 4.6, PAL.skin, 0.05);
  p.fill(3, 11, 13, 15, (x, y) => ((x - 8) / 4.2) ** 2 + ((y - 10) / 4.6) ** 2 <= 1 && y > 12, (x, y) => PAL.hair[y > 13 ? 1 : 2]);
  p.set(6, 10, PAL.iris);
  p.set(9, 10, PAL.iris);
  for (let x = 4; x <= 11; x++) p.set(x, 8, PAL.skin[1]);
  p.ellipse(8, 7, 7.6, 1.6, (x, y) => PAL.straw[y < 7 ? 4 : 2]);
  p.fill(3, 1, 13, 7, (x, y) => ((x - 8) / 4.2) ** 2 + ((y - 5.5) / 4) ** 2 <= 1 && y < 6.6, (x, y) =>
    pick(PAL.straw, 0.2 + sphereLight((x + 0.5 - 8) / 4.2, (y + 0.5 - 4.5) / 4) * 1.05, x, y));
  for (let x = 4; x <= 11; x++) p.set(x, 5, PAL.band[x < 8 ? 2 : 1]);
  p.outline(PAL.out);
  return p;
}

function iconMill() {
  const p = new Pix(16, 16);
  p.fill(3, 7, 13, 15, (x, y) => Math.abs(x - 8) <= 2.4 + (y - 7) * 0.22, (x, y) =>
    pick(PAL.stone, 0.15 + cylLight((x + 0.5 - 8) / (2.4 + (y - 7) * 0.22)) * 0.9 - (y % 3 === 0 ? 0.15 : 0), x, y));
  p.rect(7, 12, 2, 3, PAL.wood[1]);
  p.fill(4, 3, 12, 7, (x, y) => Math.abs(x - 8) <= (y - 3) * 0.85 + 0.5, (x, y) => pick(PAL.roof, 0.6 - (x - 7) * 0.08, x, y));
  const s = new Pix(16, 16);
  paintSails(s, 8, 6, Math.PI / 4, 7, 2.6, 2);
  p.blit(s, 0, 0);
  p.set(7, 5, PAL.wood[1]); p.set(8, 5, PAL.wood[1]); p.set(7, 6, PAL.wood[1]); p.set(8, 6, PAL.wood[1]);
  p.outline(PAL.out);
  return p;
}


// ---------------------------------------------------------------------------
// Cena: o trigal ao vento, com moinhos nas colinas e camponeses ceifando.

  const H = SCENES.H;
  const farMount = (x) => 49 + 7 * Math.sin(x * 0.011 + 1.3) + 3 * Math.sin(x * 0.037 + 0.2) + 1.4 * Math.sin(x * 0.13);
  const hill = (x) => 67 + 4 * Math.sin(x * 0.019 + 0.4) + 2.4 * Math.sin(x * 0.051 + 2) + 0.8 * Math.sin(x * 0.17);
  const fieldTop = (x) => 80 + 1.2 * Math.sin(x * 0.027 + 1);
  const pathCenter = (y) => 34 + (y - 78) * 1.5 + 5 * Math.sin(y * 0.15);
  const pathHalf = (y) => 1 + (y - 78) * 0.17;

  // ------------------------------------------------------------------ sprites fixos

  function buildCottage() {
    const p = new Pix(28, 22);
    // paredes de taipa com enxaimel
    p.rect(4, 10, 18, 11, (x, y) => pick(PAL.linen, 0.8 - (x - 4) * 0.025 + (hash(x, y, 2) - 0.5) * 0.15, x, y));
    for (const x of [4, 12, 21]) p.rect(x, 10, 1, 11, PAL.wood[1]);
    p.rect(4, 10, 18, 1, PAL.wood[1]);
    p.line(5, 20, 11, 11, PAL.wood[2]);
    // janela acesa e porta
    p.rect(7, 13, 4, 3, PAL.glow);
    p.set(8, 13, C('#fff1b8'));
    p.rect(9, 13, 1, 3, PAL.wood[1]);
    p.rect(15, 14, 4, 7, (x) => PAL.wood[x === 15 ? 3 : 2]);
    p.set(18, 17, PAL.gold[4]);
    // chaminé
    p.rect(18, 2, 3, 7, (x, y) => PAL.stone[x === 18 ? 4 : y % 2 ? 2 : 3]);
    // telhado de sapé
    p.poly([[0.5, 11.5], [13, 0.5], [25.5, 11.5]], (x, y) => {
      let v = 0.75 - (x - 4) * 0.025 - (y > 9 ? 0.25 : 0);
      if ((x * 3 + Math.floor(y / 2)) % 5 === 0) v -= 0.18;
      return pick(PAL.straw, v, x, y);
    });
    p.outline(PAL.out);
    return p;
  }

  function buildMiniTower() {
    const p = new Pix(22, 28);
    p.fill(4, 12, 18, 26, (x, y) => Math.abs(x - 11) <= 3.2 + (y - 12) * 0.14, (x, y) => {
      const w = 3.2 + (y - 12) * 0.14;
      let v = 0.1 + cylLight((x + 0.5 - 11) / w) * 0.9;
      if (y % 3 === 0) v -= 0.15;
      return pick(PAL.stone, v, x, y);
    });
    p.rect(10, 22, 2, 4, PAL.wood[1]);
    p.set(11, 16, PAL.glass);
    p.fill(5, 6, 17, 12, (x, y) => Math.abs(x - 11) <= 4.4 * Math.pow(Math.max(0, (y - 6) / 6), 0.7), (x, y) =>
      pick(PAL.roof, 0.2 + cylLight((x + 0.5 - 11) / 4.4) * 0.85 - (y % 2 ? 0.1 : 0), x, y));
    p.rect(6, 12, 11, 1, PAL.wood[2]);
    p.outline(PAL.out);
    return p;
  }

  function buildTree(seed) {
    const tall = hash(seed, 3) > 0.72;
    const rx = tall ? 2.4 : 3.5 + hash(seed, 1) * 2.2;
    const ry = tall ? 6 : 3 + hash(seed, 2) * 1.6;
    const w = Math.ceil(rx * 2 + 4), h = Math.ceil(ry * 2 + 6);
    const p = new Pix(w, h);
    const cx = w / 2, cy = ry + 2;
    p.rect(Math.floor(cx) - 1, Math.floor(cy + ry - 1), 1, 3, PAL.wood[1]);
    p.ellipse(cx, cy, rx, ry, (x, y) => {
      let v = 0.1 + sphereLight((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) * 1.05;
      if (hash(x, y, seed) < 0.15) v -= 0.2;
      return pick(PAL.tree, v, x, y, 1.6);
    });
    p.outline(PAL.tree[0]);
    return { p, foot: h - 2 };
  }

  // ------------------------------------------------------------------ cena

  class FarmScene extends SCENES.BaseScene {
    constructor() {
      super();
      this.cottage = buildCottage();
      this.miniTower = buildMiniTower();
      this.sails = new Pix(26, 26);
      this.man = new Pix(32, 36);
    }

    layout() {
      const w = this.w;
      this.millSpots = [];
      for (let x = 92; x < w - 24; x += 140) this.millSpots.push(x);
      this.peasantSpots = [];
      let i = 0;
      for (let x = 70; x < w - 14; x += 52, i++) {
        this.peasantSpots.push({ x: x + Math.round((hash(i, 4) - 0.5) * 14), foot: 98 + (i % 3) * 5, dir: i % 2 ? -1 : 1, phase: hash(i, 5) * 6 });
      }
    }

    buildBackground() {
      const p = this.bg, w = this.w;
      paintSky(p, 0, 80, PAL.sky, 3);
      this.sun = [Math.round(w * 0.83), 21];
      paintSun(p, this.sun[0], this.sun[1], 8);

      // serras azuladas ao longe
      for (let x = 0; x < w; x++) {
        const top = Math.round(farMount(x));
        const slope = farMount(x + 1) - farMount(x);
        for (let y = top; y < 80; y++) {
          const v = y === top ? 0.95 : 0.5 - slope * 0.9 + (y - top) * 0.03;
          p.d[y * w + x] = pick(PAL.far, v, x, y, 1.6);
        }
      }
      // colinas verdes com retalhos de lavoura
      for (let x = 0; x < w; x++) {
        const top = Math.round(hill(x));
        const slope = hill(x + 1) - hill(x);
        for (let y = top; y < 84; y++) {
          const patch = Math.floor((x + (y - top) * 2.2) / 41) % 3;
          let v = (y === top ? 0.85 : 0.6) - slope * 1.1 - (y - top) * 0.025 + (patch - 1) * 0.07;
          if (hash(x, y, 1) < 0.05) v -= 0.25;
          p.d[y * w + x] = pick(PAL.grass, v, x, y, 1.6);
        }
      }
      // árvores nas colinas
      const blocked = (x) => this.millSpots.some((m) => Math.abs(m - x) < 15) || (x > 14 && x < 50);
      for (let x = 6; x < w; x += 9 + Math.floor(hash(x, 7) * 30)) {
        if (blocked(x)) continue;
        const tree = buildTree(x);
        p.blit(tree.p, x - tree.p.w / 2, hill(x) - tree.foot + 2 + hash(x, 8) * 4);
      }
      // casinha com chaminé
      this.cottageAt = [32, Math.round(hill(32)) - 16];
      p.blit(this.cottage, this.cottageAt[0] - 14, this.cottageAt[1]);
      this.chimney = [this.cottageAt[0] + 5, this.cottageAt[1] + 1];

      // cerca viva separando a colina do trigal
      for (let x = 0; x < w; x++) {
        const top = Math.round(fieldTop(x));
        const bump = Math.round(Math.sin(x * 0.7) + hash(x, 9) * 1.5);
        for (let y = top - 2 - bump; y < top + 1; y++) p.set(x, y, pick(PAL.tree, 0.25 + (top - y) * 0.15 + (hash(x, y, 3) - 0.5) * 0.3, x, y));
      }
      // chão do trigal e trilha de terra
      for (let y = 78; y < H; y++) {
        for (let x = 0; x < w; x++) {
          if (y < Math.round(fieldTop(x)) + 1) continue;
          const depth = (y - 80) / (H - 80);
          const onPath = Math.abs(x + 0.5 - pathCenter(y)) < pathHalf(y);
          if (onPath) {
            p.d[y * w + x] = pick(PAL.dirt, 0.45 + depth * 0.3 + (hash(x, y, 6) - 0.5) * 0.35, x, y);
            continue;
          }
          const v = 0.2 + depth * 0.26 + (hash(x, y, 2) - 0.5) * 0.1 - (y % 3 === 0 ? 0.05 : 0);
          p.d[y * w + x] = pick(PAL.wheat, v, x, y, 3);
        }
      }
      this.buildStalks();
    }

    buildStalks() {
      const xs = [], ys = [], hs = [], heads = [], ds = [], tones = [];
      for (let y = 82; y < H + 10;) {
        const depth = Math.min(1, (y - 80) / (H - 80));
        const sx = 2 + depth * 2.2;
        for (let x = -6; x < this.w + 6; x += sx) {
          const jx = Math.round(x + (hash(Math.round(x * 10), y, 1) - 0.5) * sx);
          if (Math.abs(jx + 0.5 - pathCenter(y)) < pathHalf(y) + 1) continue;
          xs.push(jx);
          ys.push(y + Math.floor(hash(jx, y, 2) * 2));
          hs.push(Math.round(2 + depth * 9 + hash(jx, y, 3) * 2));
          heads.push(Math.round(1 + depth * 3.4));
          ds.push(depth);
          tones.push(hash(jx, y, 4));
        }
        y += 1.4 + depth * 2.4;
        y = Math.round(y * 10) / 10;
      }
      const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
      const take = (arr, T) => T.from(order.map((i) => arr[i]));
      this.st = {
        n: xs.length,
        x: take(xs, Int16Array), y: take(ys, Float32Array), h: take(hs, Int8Array),
        head: take(heads, Int8Array), d: take(ds, Float32Array), tone: take(tones, Float32Array),
      };
    }

    // ---------------------------------------------------------------- quadro a quadro

    paintFrame(p, t, info) {
      const w = this.w;
      const peasants = info.t1, mills = info.t2, millAngle = info.angle;
      this.paintBirds(p, t);
      this.paintSmoke(p, t, this.chimney[0], this.chimney[1]);

      const shownMills = Math.min(mills, this.millSpots.length);
      for (let i = 0; i < shownMills; i++) this.paintMiniMill(p, this.millSpots[i], millAngle + i * 0.7);

      const shownMen = Math.min(peasants, this.peasantSpots.length);
      const men = this.peasantSpots.slice(0, shownMen).sort((a, b) => a.foot - b.foot);
      let next = 0;

      const S = this.st;
      const d = p.d;
      const wheat = PAL.wheat;
      for (let i = 0; i < S.n; i++) {
        const by = S.y[i];
        while (next < men.length && men[next].foot <= by) this.paintMan(p, men[next++], t);
        const x = S.x[i];
        if (x < -4 || x > w + 4) continue;
        const depth = S.d[i];
        const wave = Math.sin(t * 1.9 - x * 0.05 + by * 0.11);
        const gust = 0.5 + 0.5 * Math.sin(t * 0.45 - x * 0.008);
        const lean = (0.55 + wave * 0.75) * (0.6 + depth * 2.3) * (0.45 + gust * 0.85);
        const h = S.h[i];
        const y0 = Math.floor(by);
        if (depth > 0.2) {
          const stem = wheat[depth > 0.6 ? 2 : 1];
          for (let k = 1; k < h; k++) {
            const px = x + Math.round(lean * (k / h) * (k / h));
            const py = y0 - k;
            if (px >= 0 && px < w && py >= 0 && py < H) d[py * w + px] = stem;
          }
        }
        const tx = x + Math.round(lean);
        const sheen = wave > 0.7 && gust > 0.55 ? 1 : 0;
        const base = (S.tone[i] > 0.85 ? 4 : 3) + sheen;
        const hd = S.head[i];
        for (let k = 0; k < hd; k++) {
          const py = y0 - h - k + hd - 1;
          const px = tx + (k === hd - 1 && hd > 2 ? Math.sign(lean) : 0);
          const c = wheat[Math.min(5, base + (k === hd - 1 ? 1 : 0) - (k === 0 && hd > 2 ? 1 : 0))];
          if (px >= 0 && px < w && py >= 0 && py < H) d[py * w + px] = c;
        }
        if (hd > 2) {
          const ax = tx + Math.round(lean * 0.6) + Math.sign(lean);
          const ay = y0 - h - 1;
          if (ax >= 0 && ax < w && ay >= 0) d[ay * w + ax] = wheat[5];
        }
      }
      while (next < men.length) this.paintMan(p, men[next++], t);
    }

    paintMiniMill(p, x, angle) {
      const base = Math.round(hill(x)) + 3;
      p.blit(this.miniTower, x - 11, base - 27);
      const s = this.sails.clear();
      paintSails(s, 13, 13, angle, 11, 3.6, 3);
      s.set(12, 12, PAL.wood[1]); s.set(13, 12, PAL.wood[1]); s.set(12, 13, PAL.wood[1]); s.set(13, 13, PAL.wood[1]);
      s.outline(PAL.out);
      p.blit(s, x - 13, base - 27 + 10 - 13);
    }

    // Camponês pequeno ceifando com a foice.
    paintMan(p, spot, t) {
      const m = this.man.clear();
      const dir = spot.dir;
      const cx = 15, foot = 32;
      const X = (dx) => cx + dx * dir;
      // pernas
      m.rect(cx - 3, foot - 8, 2, 8, PAL.vest[1]);
      m.rect(cx + 1, foot - 8, 2, 8, PAL.vest[2]);
      // braço de trás
      const swing = Math.sin(t * 2.6 + spot.phase);
      const a = 1.1 - swing * 0.85; // ângulo do cabo (0 = para frente, ~1.6 = para baixo)
      const ux = Math.cos(a) * dir, uy = Math.sin(a);
      const hx = X(4), hy = foot - 13;
      m.line(X(-3), foot - 17, hx - ux * 4, hy - uy * 4, PAL.linen[2]);
      // tronco: camisa clara, colete e cinto
      m.fill(cx - 4, foot - 18, cx + 4, foot - 8, (x, y) => Math.abs(x - cx) <= 4 - (y < foot - 17 ? 1 : 0), (x, y) => {
        const s = (x + 0.5 - cx) * dir;
        if (Math.abs(s) > 2) return PAL.vest[s < 0 ? 2 : 3];
        return pick(PAL.linen, 0.8 - (x - cx) * 0.05, x, y);
      });
      m.rect(cx - 4, foot - 9, 9, 1, PAL.wood[0]);
      m.set(X(1), foot - 9, PAL.gold[3]);
      // cabeça
      m.sphere(cx + 0.5, foot - 21, 3, 3.2, PAL.skin, 0.1);
      m.set(X(2), foot - 21, PAL.iris);
      m.rect(cx - 2, foot - 19, 5, 1, PAL.hair[2]);
      m.set(X(-3), foot - 21, PAL.hair[2]);
      // chapéu
      m.rect(cx - 6, foot - 24, 13, 1, (x) => PAL.straw[x < cx ? 4 : 3]);
      m.rect(cx - 3, foot - 27, 7, 3, (x, y) => PAL.straw[y === foot - 27 ? 5 : x < cx + 1 ? 4 : 3]);
      m.rect(cx - 3, foot - 25, 7, 1, PAL.band[2]);
      // foice: o cabo gira em torno das mãos
      const ax = hx - ux * 7, ay = hy - uy * 7;
      const bx = hx + ux * 9, by = hy + uy * 9;
      m.line(ax, ay, bx, by, (x, y) => PAL.wood[(x + y) % 3 ? 3 : 2]);
      for (let k = 1; k <= 8; k++) {
        const px = bx + dir * Math.sin(a) * k - ux * k * k * 0.06;
        const py = by - Math.cos(a) * k - uy * k * k * 0.06;
        m.set(px, py, PAL.iron[k < 4 ? 4 : 3]);
      }
      // braço da frente
      m.line(X(3), foot - 17, hx, hy, PAL.linen[3]);
      m.set(hx, hy, PAL.skin[3]);
      m.outline(PAL.out);
      p.blit(m, spot.x - cx, spot.foot - foot);
    }
  }


ART.portraits.peasant = (ctx, t, info) => paintPeasantPortrait(ctx, t, info.working);
ART.portraits.mill = (ctx, t, info) => paintMillPortrait(ctx, t, info.angle);
ART.locked.barn = paintBarnLocked;
ART.locked.peasant = ART.silhouette(buildPeasant);
ART.locked.mill = ART.silhouette(() => {
  const p = buildMillTower();
  const s = new Pix(64, 64);
  paintSails(s, 32, 22, 0.4, 21, 6.5, 5);
  s.sphere(32, 22, 2.4, 2.4, PAL.wood, 0.1);
  p.blit(s, 0, 0);
  return p;
});
Object.assign(ART.icons, { wheat: iconWheat, peasant: iconPeasant, mill: iconMill });
SCENES.register('farm', FarmScene);
ART.paintSails = paintSails;
})();
