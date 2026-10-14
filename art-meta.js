'use strict';
// Arte das cartas, missões e baús: ícones 16x16 dos efeitos (trevo, corneta,
// balança, cornucópia, livro, moedas, carta, servo, estandarte) e os baús, que existem em
// cinco materiais, em ícone 16x16 e grande 32x32, fechados ou abertos.

// Servo: camponês de capuz, de frente.
function iconServo() {
  const p = new Pix(16, 16);
  // ombros e capa
  p.fill(1, 10, 15, 15, (x, y) => ((x - 8) / 7) ** 2 + ((y - 16) / 6) ** 2 <= 1,
    (x, y) => pick(PAL.vest, 0.2 + sphereLight((x + 0.5 - 7) / 7, (y + 0.5 - 12) / 5) * 0.8, x, y));
  // capuz
  p.fill(3, 1, 13, 12, (x, y) => ((x - 8) / 5.2) ** 2 + ((y - 7) / 5.6) ** 2 <= 1,
    (x, y) => pick(PAL.leather, 0.2 + sphereLight((x + 0.5 - 7) / 5.2, (y + 0.5 - 5) / 5.6) * 0.9, x, y));
  // rosto na abertura do capuz
  p.fill(5, 5, 11, 12, (x, y) => ((x - 8) / 3) ** 2 + ((y - 8.6) / 3.3) ** 2 <= 1,
    (x, y) => pick(PAL.skin, 0.25 + sphereLight((x + 0.5 - 7) / 3, (y + 0.5 - 7.5) / 3.3) * 0.8, x, y));
  p.rect(5, 5, 6, 1, PAL.leather[1]); // sombra da aba
  p.set(6, 8, PAL.iris);
  p.set(9, 8, PAL.iris);
  p.set(7, 10, PAL.skin[1]);
  p.set(8, 10, PAL.skin[1]);
  p.rect(5, 13, 6, 1, PAL.band[1]); // corda da capa
  p.outline(PAL.out);
  return p;
}

// Trevo de quatro folhas: a Sorte (colheita farta).
function iconClover() {
  const p = new Pix(16, 16);
  const leaf = (cx, cy) => p.sphere(cx, cy, 3.2, 3.2, PAL.herb, 0.05);
  leaf(5, 5); leaf(11, 5); leaf(5, 10); leaf(11, 10);
  p.line(8, 9, 12, 15, PAL.herb[1]);
  p.line(9, 9, 13, 15, PAL.herb[2]);
  // veios das folhas e o centro
  for (const [x, y] of [[5, 5], [10, 5], [5, 10], [10, 10]]) p.set(x, y, PAL.herb[5]);
  p.rect(7, 7, 2, 2, PAL.herb[3]);
  p.outline(PAL.out);
  return p;
}

// Corneta de arauto: o Recrutamento.
function iconHorn() {
  const p = new Pix(16, 16);
  const brass = (x, y) => pick(PAL.gold, 0.25 + sphereLight((x + 0.5 - 8) / 7, (y + 0.5 - 6) / 6) * 0.85, x, y);
  // tubo que abre num sino à direita
  p.fill(1, 3, 15, 12, (x, y) => {
    const half = 1.2 + Math.max(0, x - 8) ** 1.6 * 0.18;
    return x > 1 && Math.abs(y - 7.5) <= half;
  }, brass);
  p.rect(13, 2, 2, 11, (x, y) => PAL.gold[x === 13 ? 4 : 2]); // boca do sino
  p.rect(1, 6, 2, 3, PAL.gold[1]); // bocal
  // flâmula pendurada
  p.poly([[5, 9], [11, 9], [11, 14], [8, 12.5], [5, 14]], (x, y) => PAL.banner[y === 9 ? 3 : x < 8 ? 2 : 1]);
  p.set(8, 10, PAL.gold[4]);
  p.outline(PAL.out);
  return p;
}

// Balança de pratos: o Desconto.
function iconScales() {
  const p = new Pix(16, 16);
  const iron = (x, y) => pick(PAL.iron, 0.4 + cylLight((x + 0.5 - 8) / 2) * 0.5, x, y);
  p.rect(7, 2, 2, 11, iron); // haste
  p.rect(5, 13, 6, 2, (x, y) => PAL.wood[y === 13 ? 3 : 1]); // base
  p.rect(1, 3, 14, 1, PAL.iron[3]); // travessão
  p.set(8, 1, PAL.gold[4]);
  for (const cx of [3, 13]) {
    p.line(cx - 2, 8, cx, 4, PAL.iron[2]);
    p.line(cx + 2, 8, cx, 4, PAL.iron[2]);
    p.fill(cx - 3, 8, cx + 3, 11, (x, y) => ((x - cx) / 3) ** 2 + ((y - 8) / 2.4) ** 2 <= 1 && y >= 8,
      (x, y) => pick(PAL.gold, 0.3 + cylLight((x + 0.5 - cx) / 3) * 0.6, x, y));
  }
  // uma moeda no prato da esquerda
  p.set(2, 7, PAL.gold[5]);
  p.set(3, 7, PAL.gold[4]);
  p.outline(PAL.out);
  return p;
}

// Cornucópia transbordando: a Bonança (colheita farta maior).
function iconCornucopia() {
  const p = new Pix(16, 16);
  // chifre: curva de palha trançada, da ponta (esquerda baixo) à boca (direita)
  p.fill(0, 4, 13, 15, (x, y) => {
    const t = Math.max(0, Math.min(1, (x - 1) / 11));
    const cy = 13 - t * 5.5;
    const half = 0.6 + t * 3.6;
    return Math.abs(y - cy) <= half;
  }, (x, y) => pick(PAL.straw, 0.3 + ((x + y) % 3 === 0 ? 0.35 : 0) + (y < 9 ? 0.2 : 0), x, y));
  // frutos e espigas saindo pela boca
  p.sphere(13, 6, 2.2, 2.2, PAL.roof, 0.1);
  p.sphere(11, 3.5, 1.8, 1.8, PAL.gold, 0.1);
  p.sphere(14.2, 10, 1.6, 1.6, PAL.herb, 0.15);
  p.line(9, 4, 9, 0, PAL.wheat[4]);
  p.set(8, 1, PAL.wheat[3]);
  p.set(10, 2, PAL.wheat[3]);
  p.outline(PAL.out);
  return p;
}

// Livro fechado com fecho: o Bibliotecário (mais cartas por baú).
function iconBook() {
  const p = new Pix(16, 16);
  p.rect(3, 2, 10, 12, (x, y) => pick(PAL.banner, 0.35 + cylLight((x + 0.5 - 7) / 6) * 0.5, x, y));
  p.rect(12, 3, 2, 11, (x, y) => PAL.linen[y % 2 ? 3 : 4]); // páginas
  p.rect(3, 2, 2, 12, PAL.banner[0]); // lombada
  for (const y of [4, 11]) p.rect(5, y, 7, 1, PAL.gold[3]);
  p.rect(7, 6, 3, 3, (x, y) => PAL.gold[x === 7 && y === 6 ? 5 : 3]);
  p.outline(PAL.out);
  return p;
}

// Pilha de moedas: o Tesoureiro (mais coroas por baú).
function iconCoins() {
  const p = new Pix(16, 16);
  const stack = (cx, base, n) => {
    for (let i = 0; i < n; i++) {
      const y = base - i * 2;
      p.ellipse(cx, y, 3.6, 1.6, (x, yy) => PAL.gold[yy < y ? 4 : 2]);
    }
    p.ellipse(cx, base - (n - 1) * 2, 3.6, 1.6, (x, y) => pick(PAL.gold, 0.6 + sphereLight((x + 0.5 - cx) / 3.6, 0) * 0.4, x, y));
  };
  stack(5, 13, 4);
  stack(11, 13, 2);
  p.set(4, 6, PAL.gold[5]);
  p.outline(PAL.out);
  return p;
}

// Carta virada: missões de cartas.
function iconCard() {
  const p = new Pix(16, 16);
  p.rect(5, 1, 9, 12, (x, y) => PAL.linen[x === 5 || y === 1 ? 4 : 3]); // carta de trás
  p.rect(2, 3, 9, 12, (x, y) => (x === 2 || y === 3 ? PAL.gold[4] : x === 10 || y === 14 ? PAL.gold[1] : PAL.gold[2]));
  p.rect(4, 5, 5, 8, (x, y) => pick(PAL.banner, 0.3 + (y < 8 ? 0.3 : 0), x, y));
  p.set(6, 8, PAL.gold[5]);
  p.set(6, 9, PAL.gold[4]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Baús: madeira (missões) e pedra (Renome)

const CHEST_MAT = {
  madeira: { body: PAL.wood, band: PAL.iron, lock: PAL.iron },
  pedra: { body: PAL.stone, band: PAL.iron, lock: PAL.gold },
};

// Desenha o baú num quadro size×size (16 ou 32). open: tampa aberta e
// luz saindo de dentro.
function drawChest(type, size, open) {
  const p = new Pix(size, size);
  const s = size / 32;
  const m = CHEST_MAT[type];
  const X0 = 3 * s, X1 = 29 * s; // laterais
  const cx = 16 * s;
  const shade = (r, x, y, bias = 0) => pick(r, 0.3 + bias + cylLight((x + 0.5 - cx) / (13 * s)) * 0.55
    + (type === 'madeira' && (y % Math.max(2, Math.round(4 * s)) === 0) ? -0.15 : 0), x, y);
  // corpo
  p.fill(X0, 15 * s, X1 - 1, 29 * s - 1, () => true, (x, y) => shade(m.body, x, y));
  if (!open) {
    // tampa abaulada
    p.fill(X0, 6 * s, X1 - 1, 15 * s, (x, y) => ((x - cx) / (13 * s)) ** 2 + ((y - 15 * s) / (9 * s)) ** 2 <= 1,
      (x, y) => pick(m.body, 0.2 + sphereLight((x + 0.5 - cx) / (13 * s), (y + 0.5 - 11 * s) / (9 * s)) * 0.85, x, y));
  } else {
    // interior escuro com brilho e a tampa caída para trás
    p.fill(X0 + s, 13 * s, X1 - 1 - s, 16 * s, () => true, C('#0e0806'));
    p.fill(X0 + 2 * s, 11 * s, X1 - 2 * s, 15 * s, (x, y) => Math.abs(x - cx) < 9 * s - (15 * s - y) * 0.6,
      (x, y) => pick(PAL.gold, 0.55 + (y > 13 * s ? 0.35 : 0), x, y));
    p.fill(X0, 2 * s, X1 - 1, 9 * s, (x, y) => y >= 2 * s + Math.abs(x - cx) * 0.12,
      (x, y) => pick(m.body, 0.1 + (y < 4 * s ? 0.3 : 0), x, y));
    p.rect(X0, 9 * s, X1 - X0, Math.max(1, s), m.band[1]);
  }
  // aro entre tampa e corpo
  p.rect(X0, 14 * s, X1 - X0, Math.max(1, 2 * s), (x, y) => m.band[y === Math.floor(14 * s) ? 3 : 2]);
  // tiras verticais
  for (const bx of [7 * s, 23 * s]) {
    p.fill(bx, (open ? 15 : 7) * s, bx + 2 * s - 1, 29 * s - 1,
      (x, y) => open || y >= 15 * s || ((x - cx) / (13 * s)) ** 2 + ((y - 15 * s) / (9 * s)) ** 2 <= 1,
      (x, y) => m.band[x === Math.floor(bx) ? 3 : 2]);
    if (size >= 32) for (const ry of [18, 25]) p.set(bx + 0.5, ry, m.band[4] || m.band[3]);
  }
  // fechadura
  p.fill(cx - 2 * s, 13 * s, cx + 2 * s - 1, 19 * s, () => true, (x, y) => pick(m.lock, 0.4 + (x < cx ? 0.3 : 0) + (y < 15 * s ? 0.2 : 0), x, y));
  p.set(cx - 0.5, 16 * s, C('#140b06'));
  if (size >= 32) p.set(cx - 0.5, 17 * s, C('#140b06'));
  // pés
  p.rect(X0, 29 * s, 3 * s, s, m.band[1]);
  p.rect(X1 - 3 * s, 29 * s, 3 * s, s, m.band[1]);
  p.outline(PAL.out);
  return p;
}

// Estandarte vermelho com uma coroa: o Renome.
function iconBanner() {
  const p = new Pix(16, 16);
  p.rect(2, 2, 2, 14, (x, y) => PAL.wood[x === 2 ? 3 : 1]); // mastro
  p.rect(1, 0, 4, 2, (x, y) => PAL.gold[y === 0 ? 4 : 2]); // ponta
  p.rect(4, 3, 10, 1, PAL.gold[2]); // travessa
  // pano com a ponta cortada em V
  p.fill(5, 4, 13, 14, (x, y) => y <= 11 || Math.abs(x - 9) >= y - 10,
    (x, y) => pick(PAL.banner, 0.25 + cylLight((x + 0.5 - 8) / 5) * 0.75, x, y));
  // coroa bordada
  p.rect(7, 7, 5, 2, PAL.gold[3]);
  for (const cx of [7, 9, 11]) p.set(cx, 6, PAL.gold[4]);
  p.set(9, 7, PAL.gold[5]);
  p.outline(PAL.out);
  return p;
}

// Configurações: uma engrenagem de ferro com oito dentes e o eixo de latão
function iconGear() {
  const p = new Pix(16, 16);
  const cx = 7.5;
  const cy = 7.5;
  p.fill(0, 0, 15, 15, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const tooth = Math.cos(a * 8) > 0.35;
    return r < (tooth ? 7.4 : 5.6) && r > 2.2;
  }, (x, y) => pick(PAL.steel, 0.2 + sphereLight((x + 0.5 - cx) / 7, (y + 0.5 - cy) / 7) * 0.8, x, y));
  p.fill(5, 5, 10, 10, (x, y) => Math.hypot(x - cx, y - cy) <= 2.2 && Math.hypot(x - cx, y - cy) > 1.1,
    (x, y) => PAL.gold[x + y < 15 ? 4 : 2]);
  p.outline(PAL.out);
  return p;
}

Object.assign(ART.icons, {
  gear: iconGear,
  banner: iconBanner, servo: iconServo, clover: iconClover, horn: iconHorn, scales: iconScales,
  cornucopia: iconCornucopia, book: iconBook, coins: iconCoins, card: iconCard,
});
for (const type of Object.keys(CHEST_MAT)) ART.icons['chest-' + type] = () => drawChest(type, 16, false);
ART.chest = (type, open) => drawChest(type, 32, open);
