'use strict';
// Retrato do jogador (avatar do Renome), 32x32 com fundo próprio.
(() => {
  const S = 32;
  const BLUE = ramp('#10142c', '#1a2248', '#26346a', '#344a8c', '#4a64aa');
  const TUNIC = ramp('#14182e', '#222c52', '#33437a', '#4a5e9c');
  const FUR = ramp('#6e6672', '#a69c9e', '#d2c8c0', '#eee6da', '#fffaf0');
  const SPOT = C('#1e1618');
  const GEM = ramp('#3a0a14', '#8a1626', '#d03a44', '#ff9a90');

  // Fundo: parede azul com losangos discretos e estandartes vermelhos nas bordas.
  function backdrop(p) {
    p.fill(0, 0, S - 1, S - 1, () => true, (x, y) => {
      const lx = (x + 0.5) / S, ly = (y + 0.5) / S;
      let v = 0.62 - ly * 0.35 - lx * 0.15;
      if ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0) v -= 0.07; // treliça
      if ((x + y) % 6 === 3 && (x - y + 60) % 6 === 3) v += 0.18; // florões
      return pick(BLUE, v, x, y, 1.6);
    });
    // estandartes
    for (const bx of [1, 26]) {
      p.rect(bx - 1, 1, 7, 1, (x) => PAL.gold[x === bx - 1 ? 4 : 2]); // varão
      p.fill(bx, 2, bx + 4, 19, (x, y) => y <= 15 || Math.abs(x - (bx + 2)) >= y - 15.5, (x, y) =>
        pick(PAL.banner, 0.2 + cylLight((x + 0.5 - bx - 2) / 2.8) * 0.6 - (y - 2) * 0.012, x, y));
      // coroinha bordada
      p.set(bx + 1, 5, PAL.gold[4]); p.set(bx + 3, 5, PAL.gold[3]);
      p.rect(bx + 1, 6, 3, 1, (x) => PAL.gold[x === bx + 1 ? 4 : 3]);
      p.rect(bx + 1, 7, 3, 1, PAL.gold[2]);
      p.rect(bx, 13, 5, 1, PAL.gold[1]);
    }
  }

  // Figura: busto do jovem senhor, desenhado à parte para receber contorno.
  function figure() {
    const f = new Pix(S, S);
    const cx = 16;
    // manto vermelho
    f.fill(0, 20, S - 1, S - 1, (x, y) => ((x - cx) / 15.5) ** 2 + ((y - 34) / 13.4) ** 2 <= 1,
      (x, y) => pick(PAL.banner, 0.22 + sphereLight((x + 0.5 - 12) / 15, (y + 0.5 - 25) / 9) * 0.8 - (y > 29 ? 0.08 : 0), x, y, 3.5));
    // gibão azul na abertura do manto
    f.poly([[12.5, 21], [19.5, 21], [21.5, 32], [10.5, 32]],
      (x, y) => pick(TUNIC, 0.35 + cylLight((x + 0.5 - cx) / 5) * 0.5, x, y));
    // pescoço
    f.rect(14, 18, 5, 4, (x, y) => PAL.skin[y < 20 ? 1 : x < 16 ? 3 : 2]);
    // gola de arminho sobre os ombros e descendo pelas bordas
    const inFur = (x, y) => {
      const outer = ((x - cx) / 15.5) ** 2 + ((y - 34) / 13.4) ** 2 <= 1;
      if (!outer) return false;
      const collar = ((x - cx) / 9.6) ** 2 + ((y - 20.6) / 3.6) ** 2 <= 1;
      const edge = Math.abs(x - cx) - (3.6 + (y - 21) * 0.18);
      return collar || (y >= 20.5 && edge >= -0.2 && edge < 2.2);
    };
    f.fill(0, 19, S - 1, S - 1, inFur, (x, y) => {
      let v = 0.35 + sphereLight((x + 0.5 - 12) / 15, (y + 0.5 - 22) / 6) * 0.65;
      v += (hash(x, y, 3) - 0.5) * 0.2;
      return pick(FUR, v, x, y, 1.8);
    });
    // pintas do arminho
    for (const [x, y] of [[9, 21], [23, 21], [12, 23], [20, 23], [12, 27], [20, 26], [11, 30], [21, 30]]) {
      if (f.get(x, y)) { f.set(x, y, SPOT); f.set(x, y + 1, FUR[1]); }
    }
    // corrente de ouro com medalhão
    for (let x = 11; x <= 21; x++) {
      const t = (x - cx) / 5;
      const y = Math.round(23.4 + (1 - t * t) * 3.2);
      f.set(x, y, PAL.gold[(x % 2) ? 4 : 2]);
    }
    f.fill(14, 26, 18, 30, (x, y) => ((x - 16.5) / 2.2) ** 2 + ((y - 28.5) / 2.2) ** 2 <= 1,
      (x, y) => pick(PAL.gold, 0.25 + sphereLight((x + 0.5 - 16.5) / 2.2, (y + 0.5 - 28.5) / 2.2) * 0.9, x, y));
    f.set(16, 28, GEM[2]); f.set(16, 29, GEM[1]); f.set(17, 28, GEM[1]);
    f.set(15, 27, PAL.gold[5]);

    // cabelo: volume atrás da cabeça, até a altura do queixo
    f.fill(9, 3, 23, 19, (x, y) => ((x - 16.4) / 7) ** 2 + ((y - 10.5) / 7.6) ** 2 <= 1 && y < 18.5,
      (x, y) => pick(PAL.hair, 0.15 + sphereLight((x + 0.5 - 15) / 7, (y + 0.5 - 7) / 7) * 0.95 + (x % 3 === 0 ? -0.08 : 0), x, y));
    // rosto
    f.fill(10, 6, 22, 20, (x, y) => {
      const dy = (y - 13) / 6.3;
      const k = dy > 0 ? 5.2 * (1 - 0.32 * dy * dy) : 5.2;
      return ((x - 16.4) / k) ** 2 + dy * dy <= 1;
    }, (x, y) => pick(PAL.skin, 0.36 + sphereLight((x + 0.5 - 15.6) / 5.4, (y + 0.5 - 13.6) / 6.6) * 0.75, x, y, 3));
    // franja sobre a testa
    f.fill(10, 5, 23, 11, (x, y) => {
      const lock = 9.2 + ((x * 7) % 3 === 0 ? 1 : 0) + (x > 18 ? -0.4 : 0);
      return ((x - 16.4) / 6.4) ** 2 + ((y - 10.5) / 6.4) ** 2 <= 1 && y < lock;
    }, (x, y) => pick(PAL.hair, 0.3 + sphereLight((x + 0.5 - 14) / 6.4, (y + 0.5 - 5) / 5) * 0.9 + ((x + y) % 4 === 0 ? 0.12 : 0), x, y));
    // mechas laterais caindo sobre as orelhas
    for (const [x, y0, y1] of [[10, 10, 17], [11, 10, 15], [22, 10, 17], [21, 10, 14]]) {
      for (let y = y0; y <= y1; y++) f.set(x, y, PAL.hair[x < 16 ? (y % 3 ? 3 : 2) : (y % 3 ? 2 : 1)]);
    }
    // brilho do cabelo
    for (const [x, y] of [[12, 5], [13, 5], [14, 4], [15, 4], [19, 4], [11, 7], [20, 5]]) f.set(x, y, PAL.hair[4]);
    f.set(17, 4, PAL.hair[1]); f.set(17, 5, PAL.hair[1]); // risca
    // diadema de ouro, curvando um pouco no meio
    for (let x = 10; x <= 22; x++) {
      const y = Math.abs(x - 16.4) < 2.5 ? 8 : 7;
      f.set(x, y, PAL.gold[x < 14 ? 4 : x < 19 ? 3 : 2]);
    }
    f.set(16, 7, PAL.gold[4]); f.set(16, 6, PAL.gold[5]);
    f.set(16, 8, GEM[2]); f.set(17, 8, GEM[1]);
    f.set(12, 7, PAL.gold[5]);

    // sobrancelhas
    f.rect(12, 10, 3, 1, PAL.hair[1]);
    f.rect(18, 10, 3, 1, PAL.hair[1]);
    // olhos
    f.rect(13, 11, 2, 1, PAL.hair[0]); f.rect(18, 11, 2, 1, PAL.hair[0]);
    f.set(13, 12, PAL.iris); f.set(14, 12, PAL.eyeWhite);
    f.set(18, 12, PAL.iris); f.set(19, 12, PAL.eyeWhite);
    // nariz
    f.set(16, 13, PAL.skin[4]);
    f.set(16, 14, PAL.skin[5]);
    f.set(17, 14, PAL.skin[2]);
    f.set(17, 15, PAL.skin[1]);
    // bochechas
    f.set(12, 14, PAL.blush); f.set(20, 14, PAL.blush);
    // sorriso
    f.set(14, 16, PAL.skin[2]);
    f.rect(15, 17, 3, 1, PAL.lip);
    f.set(18, 16, PAL.skin[2]);
    f.set(16, 18, PAL.skin[4]);

    f.outline(PAL.out);
    return f;
  }

  function avatar() {
    const p = new Pix(S, S);
    backdrop(p);
    p.blit(figure(), 0, 0);
    return p;
  }

  ART.icons.avatar = avatar;
})();
