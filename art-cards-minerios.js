'use strict';
// Arte das cartas da linha Minérios: uma ilustração 24x24 por carta (ferramentas dos geradores e cartas da linha).
(() => {
  // rampas próprias desta linha
  const COPPER = ramp('#3e1a0e', '#6e2e14', '#a04a1e', '#cc6e2c', '#ec9a48', '#ffcc80');
  const BRONZE = ramp('#2a1a0a', '#4e3214', '#7a5222', '#a87834', '#d0a24c', '#f0d282');
  const CLAY = ramp('#3a1a10', '#62301a', '#8e4a26', '#b46a38', '#d08c52', '#e8b078');
  const ROCK = ramp('#211b23', '#302730', '#41363c', '#56484b', '#6e5d5c', '#89746d', '#a58e80');
  const WAX = ramp('#3a0a10', '#6a141c', '#9a2228', '#c83c38', '#ec6a56');
  const RIBBON = ramp('#141a3e', '#232f6c', '#3a4c98', '#5a72c0');
  const RUNE = ramp('#0e3a3a', '#1a6a66', '#2ea89a', '#6ae0c8', '#c8fff0');
  const GEM = ramp('#0e1a4a', '#1a3a8a', '#2e6ac4', '#56a4e8', '#a6dcfa', '#f0fcff');
  const VOID = ramp('#0b080b', '#151013', '#20171a', '#2d201f');
  const WHITE = C('#ffffff');
  const INK = C('#3a2414');

  // Traço grosso ao longo de um caminho pos(t), t em 0..1, com meia largura half(t).
  // shade(x, y, t, s) recebe s em -1..1: negativo do lado da luz, positivo na sombra.
  function stroke(p, pos, half, shade, n = 72) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const [x, y] = pos(t);
      pts.push({ x, y, r: half(t), t });
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
      let tx = b.x - a.x, ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1;
      let nx = -ty / l, ny = tx / l;
      if (nx * -0.55 + ny * -0.7 > 0) { nx = -nx; ny = -ny; } // normal apontando para a sombra
      const q = pts[i];
      q.nx = nx; q.ny = ny;
      x0 = Math.min(x0, q.x - q.r); y0 = Math.min(y0, q.y - q.r);
      x1 = Math.max(x1, q.x + q.r); y1 = Math.max(y1, q.y + q.r);
    }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const px = x + 0.5, py = y + 0.5;
        let best = null, bd = Infinity;
        for (const q of pts) {
          const d = Math.hypot(px - q.x, py - q.y) - q.r;
          if (d < bd) { bd = d; best = q; }
        }
        if (bd > 0) continue;
        const s = clamp01(((px - best.x) * best.nx + (py - best.y) * best.ny) / best.r * 0.5 + 0.5) * 2 - 1;
        p.set(x, y, shade(x, y, best.t, s));
      }
    }
    return p;
  }

  // Segmento reto com meia largura fixa.
  const bar = (p, ax, ay, bx, by, r, shade) => stroke(p, (t) => [ax + (bx - ax) * t, ay + (by - ay) * t], () => r, shade);
  const wood = (bias = 0.3, k = 0.6) => (x, y, t, s) => pick(PAL.wood, bias + cylLight(s) * k + (hash(x, y, 7) - 0.5) * 0.12, x, y);

  // Brilho em cruz desenhado depois do contorno.
  function sparkle(p, x, y, big = false) {
    p.set(x, y, WHITE);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(x + dx, y + dy, PAL.gold[5]);
    if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) p.set(x + dx, y + dy, PAL.gold[4]);
  }

  // Picareta de aço: cabo de madeira e cabeça curva de duas pontas.
  function picareta() {
    const p = new Pix(24, 24);
    bar(p, 3.5, 20.5, 15.5, 8.5, 1.3, wood(0.3, 0.65));
    bar(p, 3.5, 20.5, 7.2, 16.8, 1.55, (x, y, t, s) => pick(PAL.leather, 0.25 + cylLight(s) * 0.6 + ((x + y) % 3 === 0 ? -0.2 : 0), x, y));
    // cabeça arqueada para trás nas pontas
    const cx = 15.5, cy = 8, L = 9.6, b = 3.2, u = 0.7071;
    stroke(p, (t) => {
      const k = t * 2 - 1;
      return [cx + k * L * u - b * k * k * u, cy + k * L * u + b * k * k * u];
    }, (t) => 0.45 + 1.75 * (1 - Math.abs(t * 2 - 1) ** 1.6),
    (x, y, t, s) => pick(PAL.steel, 0.2 + cylLight(s) * 0.62 + (Math.abs(t - 0.5) < 0.1 ? -0.12 : 0), x, y));
    // gume brilhante na quina de cima
    for (const [x, y] of [[9, 4], [10, 4], [11, 5], [12, 5], [13, 6], [17, 9], [18, 10], [18, 11], [19, 12]]) p.set(x, y, PAL.steel[5]);
    // colar de ferro do olho
    p.rect(14, 8, 3, 2, (x, y) => PAL.iron[y === 8 ? 3 : 1]);
    p.set(15, 8, PAL.iron[4]);
    p.outline(PAL.out);
    sparkle(p, 20, 3);
    return p;
  }

  // Escoras de carvalho: dois esteios, o chapéu por cima e cunhas, diante do breu do túnel.
  function escoras() {
    const p = new Pix(24, 24);
    // breu do túnel e rocha em volta
    p.fill(2, 5, 21, 22, () => true, (x, y) => pick(VOID, 0.75 - (y - 5) / 30 - Math.abs(x - 11.5) / 22, x, y));
    p.fill(1, 1, 22, 6, (x, y) => y > 1.5 + Math.abs(x - 12) * 0.12, (x, y) => pick(ROCK, 0.35 + (hash(x >> 1, y >> 1, 3) - 0.5) * 0.5 + (y < 4 ? 0.2 : 0), x, y));
    // tábuas do teto entre os esteios
    for (let y = 9; y <= 11; y += 2) p.rect(7, y, 10, 1, (x) => PAL.wood[1 + ((x + y) % 4 === 0 ? 1 : 0)]);
    // esteios levemente abertos
    const post = (xt, xb) => stroke(p, (t) => [xt + (xb - xt) * t, 6 + t * 16], () => 1.9,
      (x, y, t, s) => pick(PAL.wood, 0.28 + cylLight(s) * 0.68 + (hash(x, y >> 1, 11) < 0.18 ? -0.25 : 0), x, y));
    post(5.5, 4.5);
    post(18.5, 19.5);
    // chapéu: tronco deitado
    p.fill(1, 5, 22, 8, () => true, (x, y) => pick(PAL.wood, 0.25 + cylLight((y + 0.5 - 6) / 2.6 * -1 * -1) * 0.7 + (hash(x >> 1, y, 4) < 0.2 ? -0.2 : 0), x, y));
    p.rect(1, 5, 22, 1, PAL.wood[4]);
    // topo de corte (anéis) nas pontas do chapéu
    for (const ex of [1, 21]) {
      p.rect(ex, 5, 2, 4, PAL.straw[3]);
      p.set(ex + (ex === 1 ? 0 : 1), 6, PAL.straw[2]);
      p.set(ex + (ex === 1 ? 1 : 0), 7, PAL.straw[1]);
    }
    // cunhas entre esteio e chapéu
    for (const wx of [7, 15]) p.poly([[wx, 9], [wx + 2, 9], [wx + (wx === 7 ? 0 : 2), 11.5]], (x, y) => PAL.wood[y === 9 ? 4 : 2]);
    // pregos de ferro
    for (const [x, y] of [[4, 6], [19, 6], [5, 15], [18, 15]]) p.set(x, y, PAL.iron[3]);
    // entulho no pé
    for (const [x, y, r] of [[2, 21, 1.6], [8, 21.5, 1.3], [15, 21.5, 1.4], [21, 21, 1.6]]) p.sphere(x, y, r + 0.4, r, ROCK, 0.1);
    p.outline(PAL.out);
    return p;
  }

  // Cunha de ferro cravada num bloco de pedra que racha ao meio.
  function cunha() {
    const p = new Pix(24, 24);
    const tex = (x, y, base) => pick(PAL.stone, base + (hash(x, y, 9) - 0.5) * 0.14 + (hash(x >> 2, y >> 1, 2) - 0.5) * 0.12, x, y);
    p.poly([[1.5, 12], [6.5, 8], [22.5, 8], [17.5, 12]], (x, y) => tex(x, y, 0.8)); // topo
    p.poly([[1.5, 12], [17.5, 12], [17.5, 22], [1.5, 22]], (x, y) => tex(x, y, 0.5)); // frente
    p.poly([[17.5, 12], [22.5, 8], [22.5, 18], [17.5, 22]], (x, y) => tex(x, y, 0.22)); // lado
    p.rect(2, 12, 16, 1, PAL.stone[5]);
    // rachadura descendo pela frente e cortando o topo
    const crack = [[12, 12], [12, 13], [11, 14], [11, 15], [12, 16], [12, 17], [11, 18], [11, 19], [12, 20], [12, 21]];
    for (const [x, y] of crack) { p.set(x, y, PAL.out); p.set(x + 1, y, PAL.stone[1]); }
    for (const [x, y] of [[11, 11], [10, 11], [15, 9], [16, 8]]) p.set(x, y, PAL.out);
    // cunha: cabeça amassada e lâmina afinando para baixo
    p.poly([[7, 4], [17, 4], [12, 14.5]], (x, y) => pick(PAL.iron, 0.3 + (x < 11 ? 0.3 : x < 13 ? 0.15 : 0) + (y < 7 ? 0.12 : 0), x, y, 3)); // frente
    p.poly([[17, 4], [19.5, 1.5], [12, 14.5]], (x, y) => pick(PAL.iron, 0.1 + (y < 5 ? 0.1 : 0), x, y)); // lado
    p.poly([[7, 4], [9.5, 1.5], [19.5, 1.5], [17, 4]], (x, y) => PAL.iron[hash(x, y, 4) < 0.2 ? 2 : (x < 13 ? 4 : 3)]); // topo batido
    p.line(8, 4, 12, 13, PAL.iron[4]);
    p.line(8, 4, 16, 4, PAL.iron[4]);
    // lascas voando
    for (const [x, y, k] of [[5, 6, 4], [6, 4, 3], [19, 5, 4], [20, 3, 3]]) p.set(x, y, PAL.stone[k]);
    p.outline(PAL.out);
    return p;
  }

  // Cadinho de barro com metal derretido, sobre brasas.
  function cadinho() {
    const p = new Pix(24, 24);
    // brasas
    for (const [x, y, r] of [[5, 21, 1.8], [9, 21.5, 1.6], [15, 21.5, 1.6], [19, 21, 1.8], [12, 22, 1.3]]) p.sphere(x, y, r + 0.3, r, PAL.fire, -0.05);
    // corpo afunilado
    const half = (y) => 7.6 - (y - 8) * 0.28;
    p.fill(3, 8, 20, 20, (x, y) => Math.abs(x - 12) <= half(y) && y <= 20.2,
      (x, y) => pick(CLAY, 0.15 + cylLight((x + 0.5 - 12) / half(y)) * 0.75 + (y < 11 ? 0.15 : 0) + (hash(x, y, 4) - 0.5) * 0.1, x, y));
    // reflexo quente da brasa no pé
    p.fill(5, 18, 19, 20, (x, y) => Math.abs(x - 12) <= half(y), (x, y) => (bayer(x, y) < 0.5 ? CLAY[4] : 0));
    // bico de despejar à esquerda
    p.poly([[2, 6.5], [6, 7.5], [6, 10], [3.5, 9]], (x, y) => CLAY[y < 8 ? 4 : 2]);
    // borda grossa e o metal em brasa dentro
    p.ellipse(12, 8, 8.4, 2.6, (x, y) => pick(CLAY, y < 7 ? 0.95 : 0.6, x, y));
    p.ellipse(12, 8.2, 6.6, 1.7, (x, y) => pick(PAL.fire, 0.65 + sphereLight((x + 0.5 - 12) / 6.6, (y + 0.5 - 8.2) / 1.7) * 0.45, x, y));
    p.set(9, 8, PAL.fire[5]); p.set(10, 8, PAL.fire[5]);
    // gota escorrendo no bico
    p.set(3, 8, PAL.fire[4]); p.set(3, 9, PAL.fire[3]);
    // faixas de barro riscadas
    for (let x = 5; x <= 19; x++) if (Math.abs(x - 12) <= half(14) - 0.5) p.set(x, 14, CLAY[1]);
    p.outline(PAL.out);
    // faíscas subindo
    for (const [x, y, k] of [[11, 3, 5], [14, 2, 4], [8, 1, 3], [16, 4, 3]]) p.set(x, y, PAL.fire[k]);
    return p;
  }

  // Sino de bronze pendurado numa trave, balançando.
  function sino() {
    const p = new Pix(24, 24);
    // trave e argola
    p.rect(3, 1, 18, 3, (x, y) => pick(PAL.wood, y === 1 ? 0.9 : y === 2 ? 0.55 : 0.25, x, y));
    for (const x of [5, 18]) p.set(x, 2, PAL.iron[3]);
    p.rect(11, 4, 2, 2, (x, y) => PAL.iron[x === 11 ? 3 : 1]);
    // perfil: cúpula estreita que abre na boca
    const half = (y) => (y < 8.5 ? 2.2 + 3 * Math.sqrt(Math.max(0, (y - 5.8) / 2.7)) : 5.2 + ((y - 8.5) / 8.5) ** 2.3 * 3.8);
    p.fill(2, 6, 21, 18, (x, y) => Math.abs(x - 12) <= half(y),
      (x, y) => pick(BRONZE, 0.08 + cylLight((x + 0.5 - 12) / half(y) * 1.05) * 0.85 + (y < 9 ? 0.1 : 0), x, y));
    // lábio grosso
    p.fill(2, 17, 22, 19, (x, y) => Math.abs(x - 12) <= 9.2 - (y === 19 ? 0.6 : 0), (x, y) => pick(BRONZE, 0.1 + cylLight((x + 0.5 - 12) / 9.2) * 0.75 + (y === 17 ? 0.2 : 0), x, y));
    // frisos decorativos
    for (const fy of [9, 15]) for (let x = 2; x <= 21; x++) if (Math.abs(x + 0.5 - 12) < half(fy)) p.set(x, fy, BRONZE[x < 10 ? 2 : 1]);
    for (let x = 8; x <= 16; x += 2) p.set(x, 12, BRONZE[x < 11 ? 5 : 2]);
    // reflexo vertical
    for (let y = 7; y <= 16; y++) p.set(12 - half(y) * 0.5, y, BRONZE[5]);
    // badalo
    p.rect(11, 19, 2, 1, BRONZE[1]);
    p.sphere(12, 21, 1.8, 1.6, PAL.iron, 0.1);
    p.outline(PAL.out);
    // ondas de som
    for (const [x, y] of [[1, 12], [1, 13], [0, 14], [22, 12], [22, 13], [23, 14]]) p.set(x, y, BRONZE[5]);
    return p;
  }

  // Balde pequeno de madeira com aros.
  function bucket(p, x0, y0, w, h) {
    p.fill(x0, y0, x0 + w - 1, y0 + h - 1, (x, y) => x >= x0 + (y - y0) * 0.15 && x <= x0 + w - 1 - (y - y0) * 0.15,
      (x, y) => pick(PAL.wood, 0.25 + cylLight((x + 0.5 - x0 - w / 2) / (w / 2)) * 0.7 + (x % 2 ? -0.08 : 0), x, y));
    for (const by of [y0 + 1, y0 + h - 2]) for (let x = x0; x < x0 + w; x++) if (p.get(x, by)) p.set(x, by, PAL.iron[x < x0 + w / 2 ? 3 : 2]);
    p.rect(x0 + 1, y0, w - 2, 1, PAL.water[3]);
    p.set(x0 + 2, y0, PAL.water[5]);
  }

  // Roldana dupla: duas rodas num suporte e dois baldes subindo.
  function roldana() {
    const p = new Pix(24, 24);
    p.rect(1, 1, 22, 3, (x, y) => pick(PAL.wood, y === 1 ? 0.9 : y === 2 ? 0.55 : 0.25, x, y));
    // cordas
    const rope = (x0, y0, y1) => { for (let y = y0; y <= y1; y++) p.set(x0, y, (y & 1) ? PAL.straw[2] : PAL.straw[3]); };
    rope(3, 8, 15); rope(11, 9, 22); rope(12, 9, 22); rope(20, 8, 11);
    bucket(p, 1, 16, 6, 6);
    bucket(p, 17, 12, 6, 6);
    // alças dos baldes
    p.line(1, 16, 3, 14, PAL.iron[2]); p.line(3, 14, 6, 16, PAL.iron[2]);
    p.line(17, 12, 20, 10, PAL.iron[2]); p.line(20, 10, 22, 12, PAL.iron[2]);
    // rodas com sulco, raios e eixo
    for (const cx of [7, 16.5]) {
      p.rect(Math.floor(cx) - 1, 4, 2, 2, (x) => PAL.iron[x < cx ? 3 : 1]); // forquilha
      p.ellipse(cx, 8.5, 4.4, 4.4, (x, y) => pick(PAL.iron, 0.3 + sphereLight((x + 0.5 - cx) / 4.4, (y + 0.5 - 8.5) / 4.4) * 0.8, x, y));
      p.ellipse(cx, 8.5, 3.2, 3.2, (x, y) => PAL.wood[1]);
      p.ellipse(cx, 8.5, 2.6, 2.6, (x, y) => pick(PAL.wood, 0.35 + sphereLight((x + 0.5 - cx) / 2.6, (y + 0.5 - 8.5) / 2.6) * 0.6, x, y));
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) p.set(cx + dx, 8.5 + dy, PAL.wood[1]);
      p.set(cx, 8.5, PAL.gold[4]);
      p.set(cx - 0.5 - 1, 8.5 - 3, PAL.iron[4]);
    }
    p.outline(PAL.out);
    return p;
  }

  // Pinça fina de ourives segurando uma pepita, com um fio de ouro.
  function pinca() {
    const p = new Pix(24, 24);
    const steel = (x, y, t, s) => pick(PAL.steel, 0.35 + cylLight(s) * 0.6 + (t > 0.3 && t < 0.5 && (x + y) % 2 === 0 ? -0.25 : 0), x, y);
    const arm = (bow) => stroke(p, (t) => {
      const b = bow * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.3);
      return [3.5 + 13.5 * t + b * 0.707, 3.5 + 13.5 * t - b * 0.707];
    }, (t) => (t < 0.08 ? 1.5 : 0.95 - t * 0.35), steel);
    arm(2.6);
    arm(-2.6);
    // rebite da junta
    p.sphere(4, 4, 1.8, 1.8, PAL.steel, 0.15);
    p.set(4, 4, PAL.steel[1]);
    // pepita presa nas pontas e o fio enrolado
    // fio de ouro saindo da pepita e fazendo uma volta
    for (const [x, y, k] of [[19, 21, 3], [19, 22, 2], [20, 22, 3], [21, 22, 4], [22, 21, 4], [22, 20, 3], [22, 19, 2], [21, 18, 3]]) p.set(x, y, PAL.gold[k]);
    p.sphere(18.5, 18.5, 2.7, 2.5, PAL.gold, 0.05);
    p.outline(PAL.out);
    p.set(17, 17, WHITE);
    sparkle(p, 20, 12);
    return p;
  }

  // Cunho real: punção de aço sobre uma moeda com coroa.
  function cunho() {
    const p = new Pix(24, 24);
    // moeda deitada: espessura e face
    p.ellipse(12, 18.6, 9, 3.6, (x, y) => PAL.gold[x < 12 ? 2 : 1]);
    p.ellipse(12, 17.4, 9, 3.6, (x, y) => pick(PAL.gold, 0.45 + sphereLight((x + 0.5 - 12) / 9, (y + 0.5 - 17.4) / 3.6) * 0.5, x, y));
    p.ellipse(12, 17.4, 7.2, 2.6, (x, y) => (Math.abs(((x + 0.5 - 12) / 7.2) ** 2 + ((y + 0.5 - 17.4) / 2.6) ** 2 - 0.85) < 0.18 ? PAL.gold[2] : 0));
    // coroa em relevo
    p.rect(9, 17, 7, 2, (x, y) => PAL.gold[y === 17 ? 5 : 3]);
    for (const [x, y] of [[9, 16], [12, 15], [12, 16], [15, 16]]) p.set(x, y, PAL.gold[5]);
    p.set(12, 17, PAL.banner[3]);
    p.rect(9, 19, 7, 1, PAL.gold[1]);
    // punção: cilindro de aço com cabeça batida
    p.rect(8, 4, 8, 9, (x, y) => pick(PAL.steel, 0.25 + cylLight((x + 0.5 - 12) / 4) * 0.75, x, y));
    p.fill(6, 1, 17, 4, (x, y) => Math.abs(x - 12) <= 5.2 - (y < 2 ? 1 : 0), (x, y) => pick(PAL.steel, 0.25 + cylLight((x + 0.5 - 12) / 5.2) * 0.7 + (y === 1 ? 0.2 : 0), x, y));
    p.rect(8, 13, 8, 1, PAL.steel[1]);
    p.fill(9, 13, 15, 13, () => true, (x) => PAL.steel[x === 9 ? 3 : 2]);
    for (const y of [6, 10]) p.rect(8, y, 8, 1, (x) => PAL.steel[x < 11 ? 2 : 0]);
    p.rect(10, 7, 1, 3, PAL.steel[5]);
    p.outline(PAL.out);
    // lampejos do golpe
    for (const [x, y] of [[4, 13], [3, 12], [19, 13], [20, 12], [5, 15], [18, 15]]) p.set(x, y, PAL.gold[5]);
    return p;
  }

  // Selo da guilda: lacre de cera vermelha com martelos cruzados e fitas.
  function selo() {
    const p = new Pix(24, 24);
    // fitas pendentes
    for (const [x0, x1] of [[9, 4], [14, 19]]) {
      p.poly([[x0 - 1.5, 13], [x0 + 1.5, 13], [x1 + 2, 22.5], [x1 + 0.2, 21], [x1 - 1.5, 22.5]], (x, y) => pick(RIBBON, 0.3 + (x0 < 12 ? 0.35 : 0) + (y < 16 ? 0.2 : 0), x, y));
    }
    // lacre com borda irregular
    p.fill(2, 1, 21, 20, (x, y) => {
      const a = Math.atan2(y - 10.5, x - 11.5);
      const r = 8.8 + Math.sin(a * 5) * 0.6 + Math.sin(a * 3 + 1) * 0.4;
      return Math.hypot(x - 11.5, y - 10.5) <= r;
    }, (x, y) => pick(WAX, 0.15 + sphereLight((x + 0.5 - 11.5) / 9, (y + 0.5 - 10.5) / 9) * 0.85, x, y));
    // anel prensado
    p.fill(4, 3, 19, 18, (x, y) => Math.abs(Math.hypot(x - 11.5, y - 10.5) - 6.2) < 0.6, (x, y) => WAX[x + y < 22 ? 1 : 4]);
    p.ellipse(11.5, 10.5, 5.4, 5.4, (x, y) => pick(WAX, 0.35 + sphereLight((x + 0.5 - 11.5) / 5.4, (y + 0.5 - 10.5) / 5.4) * 0.25, x, y));
    // martelo de mestre em relevo: luz em cima, sombra embaixo à direita
    const ham = [[7, 6, 9, 3], [10, 9, 3, 7]]; // x, y, w, h: cabeça e cabo
    for (const [x, y, w, h] of ham) p.rect(x + 1, y + 1, w, h, WAX[0]);
    p.rect(7, 6, 9, 3, (x, y) => WAX[y === 6 ? 4 : x === 15 || y === 8 ? 2 : 3]);
    p.rect(10, 9, 3, 7, (x) => WAX[x === 10 ? 4 : x === 12 ? 2 : 3]);
    p.set(5, 6, WAX[4]); p.set(6, 5, WAX[4]); p.set(7, 4, WAX[3]);
    p.outline(PAL.out);
    return p;
  }

  // Bateia de cobre: prato raso com água, areia e pintas de ouro.
  function bateia() {
    const p = new Pix(24, 24);
    // fundo cônico por baixo da borda
    p.fill(3, 12, 20, 20, (x, y) => ((x - 11.5) / (8.5 - (y - 12) * 0.5)) ** 2 + ((y - 12) / 8) ** 2 <= 1 && y >= 12,
      (x, y) => pick(COPPER, 0.15 + cylLight((x + 0.5 - 11.5) / 8) * 0.6, x, y));
    // borda
    p.ellipse(11.5, 11.5, 10.6, 5.6, (x, y) => pick(COPPER, 0.3 + sphereLight((x + 0.5 - 11.5) / 10.6, (y + 0.5 - 11.5) / 5.6) * 0.75, x, y));
    // bacia côncava: escura em cima à esquerda, clara embaixo à direita
    p.ellipse(11.5, 11.8, 8.8, 4.4, (x, y) => pick(COPPER, 0.15 + (1 - sphereLight((x + 0.5 - 11.5) / 8.8, (y + 0.5 - 11.8) / 4.4)) * 0.75, x, y));
    // água com areia no centro
    p.ellipse(11.5, 12.4, 6.2, 3, (x, y) => pick(PAL.water, 0.35 + ((y + 0.5 - 12.4) / 3) * 0.2 + (x < 10 ? 0.15 : 0), x, y));
    p.ellipse(12, 13, 3.8, 1.6, (x, y) => pick(PAL.dirt, 0.55 + (hash(x, y, 6) - 0.5) * 0.4, x, y));
    for (const [x, y, k] of [[11, 13, 5], [13, 12, 4], [14, 13, 5], [10, 12, 3], [9, 13, 4]]) p.set(x, y, PAL.gold[k]);
    p.set(8, 11, PAL.water[5]); p.set(9, 11, PAL.water[4]);
    // rebites da borda
    for (const [x, y] of [[2, 11], [21, 11], [11, 6]]) p.set(x, y, COPPER[5]);
    p.outline(PAL.out);
    sparkle(p, 14, 13);
    return p;
  }

  // Lareira de pedra com fogo aceso, consolo e chaminé.
  function lareira() {
    const p = new Pix(24, 24);
    const stoneAt = (x, y, warm) => {
      const row = Math.floor((y - 1) / 3);
      const off = (row & 1) * 2;
      const mortar = (y - 1) % 3 === 2 || (x + off) % 5 === 0;
      const v = mortar ? 0.12 : 0.45 + (hash(Math.floor((x + off) / 5), row, 8) - 0.5) * 0.35 + ((y - 1) % 3 === 0 ? 0.15 : 0);
      return pick(warm ? PAL.dirt : PAL.stone, v, x, y);
    };
    // chaminé
    p.fill(7, 1, 16, 5, () => true, (x, y) => stoneAt(x, y, false));
    // corpo
    p.fill(1, 8, 22, 22, () => true, (x, y) => {
      const d = Math.hypot(x + 0.5 - 11.5, y + 0.5 - 17);
      return stoneAt(x, y, d < 8.5 && hash(x, y, 2) < 0.5 + (8.5 - d) / 10);
    });
    // consolo de madeira
    p.rect(0, 6, 24, 2, (x, y) => pick(PAL.wood, y === 6 ? 0.85 : 0.35, x, y));
    p.rect(0, 8, 24, 1, PAL.wood[1]);
    // boca em arco
    const arch = (x, y) => Math.abs(x - 11.5) <= 6.5 && (y >= 14 || ((x - 11.5) / 6.5) ** 2 + ((y - 14) / 4) ** 2 <= 1);
    p.fill(4, 10, 19, 21, arch, (x, y) => pick(VOID, 0.3 + (y - 10) / 20, x, y));
    // aduelas do arco
    p.fill(3, 9, 20, 14, (x, y) => !arch(x, y) && ((x - 11.5) / 7.6) ** 2 + ((y - 14) / 5) ** 2 <= 1, (x, y) => (Math.round(Math.atan2(y - 14, x - 11.5) * 3.2) % 2 ? PAL.stone[4] : PAL.stone[3]));
    // fogo e lenha
    p.fill(6, 11, 17, 20, (x, y) => {
      const w = 4.6 * Math.sin(Math.PI * clamp01((y - 11) / 9.5)) + Math.sin(y * 1.7 + x) * 0.6;
      return Math.abs(x - 11.5) < w;
    }, (x, y) => pick(PAL.fire, 0.2 + (y - 11) / 10 - Math.abs(x - 11.5) / 6 + 0.25, x, y));
    p.ellipse(11.5, 18, 2, 2.4, (x, y) => PAL.fire[y < 17 ? 4 : 5]);
    bar(p, 6, 20.5, 16, 19.5, 1, wood(0.2, 0.6));
    bar(p, 7, 19.5, 17, 20.5, 1, wood(0.25, 0.6));
    p.rect(3, 21, 18, 2, (x, y) => pick(PAL.stone, y === 21 ? 0.7 : 0.4, x, y));
    p.outline(PAL.out);
    for (const [x, y] of [[10, 9], [13, 10]]) p.set(x, y, PAL.fire[4]);
    return p;
  }

  // Roda de polir sobre cavalete, com uma gema encostada soltando brilhos.
  function rodaPolir() {
    const p = new Pix(24, 24);
    // cavalete
    bar(p, 10, 10, 4, 22, 1.1, wood(0.3, 0.6));
    bar(p, 11, 10, 16, 22, 1.1, wood(0.2, 0.55));
    bar(p, 5.5, 18.5, 15.5, 18.5, 0.8, wood(0.3, 0.5));
    // pedra de polir: disco grosso, a borda aparece à direita
    const cx = 10, cy = 9.5, R = 7.5;
    p.ellipse(cx + 1.6, cy + 0.6, R, R, (x, y) => PAL.cobble[(x + y) % 3 === 0 ? 0 : 1]);
    p.ellipse(cx, cy, R, R, (x, y) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / R;
      const ring = (Math.floor(d * 5.5) % 2 ? -0.07 : 0.05);
      return pick(PAL.cobble, 0.5 - (dx + dy) / R * 0.18 + ring + (d > 0.86 ? (dx + dy < 0 ? 0.25 : -0.2) : 0), x, y);
    });
    // riscos de giro
    for (const a of [-2.5, 0.65]) for (let k = 0; k < 4; k++) {
      const aa = a + k * 0.17;
      p.set(cx + Math.cos(aa) * 5.3, cy + Math.sin(aa) * 5.3, PAL.cobble[5]);
    }
    // eixo e manivela
    p.sphere(cx, cy, 1.7, 1.7, PAL.iron, 0.2);
    p.set(cx - 0.5, cy - 0.5, PAL.iron[4]);
    // gema lapidada encostada na borda
    const gx = 19.5, gy = 14;
    p.poly([[gx - 3, gy - 1], [gx - 1.5, gy - 3], [gx + 1.5, gy - 3], [gx + 3, gy - 1], [gx, gy + 3.5]], (x, y) => {
      if (y < gy - 1) return GEM[x < gx ? 5 : 4];
      return GEM[x < gx - 1 ? 3 : x < gx + 1 ? 2 : 1];
    });
    p.set(gx - 1, gy - 2, WHITE);
    p.outline(PAL.out);
    // faíscas na fricção
    for (const [x, y, k] of [[17, 8, 5], [19, 6, 4], [21, 8, 5], [16, 5, 3]]) p.set(x, y, PAL.gold[k]);
    sparkle(p, 22, 18);
    return p;
  }

  // Cofre de ferro com três fechaduras e uma chave enfiada.
  function cofre() {
    const p = new Pix(24, 24);
    const st = (x, y, base) => pick(PAL.steel, base + (hash(x, y, 12) - 0.5) * 0.08, x, y);
    p.poly([[1.5, 9], [5.5, 5], [22.5, 5], [18.5, 9]], (x, y) => st(x, y, 0.75)); // tampa
    p.poly([[18.5, 9], [22.5, 5], [22.5, 17], [18.5, 21]], (x, y) => st(x, y, 0.2)); // lado
    p.fill(1, 9, 18, 21, () => true, (x, y) => st(x, y, 0.45 - (y - 9) / 50)); // frente
    // aros rebitados
    for (const by of [9, 19]) p.rect(1, by, 18, 2, (x, y) => PAL.iron[y === by ? 3 : 1]);
    for (const by of [9, 19]) for (let x = 2; x <= 17; x += 3) p.set(x, by, PAL.iron[4]);
    p.line(19, 9, 22, 6, PAL.iron[2]); p.line(19, 19, 22, 16, PAL.iron[1]);
    // três espelhos de fechadura dourados
    for (const lx of [2, 8, 14]) {
      p.rect(lx, 12, 4, 6, (x, y) => pick(PAL.gold, 0.35 + (x === lx ? 0.35 : 0) + (y === 12 ? 0.3 : 0) - (x === lx + 3 ? 0.2 : 0), x, y));
      p.rect(lx + 1, 14, 2, 1, PAL.out);
      p.set(lx + 1, 15, PAL.out);
      p.set(lx + 2, 15, PAL.out);
      p.set(lx + 1, 16, PAL.out);
    }
    // chave enfiada na do meio, com o anel para fora
    p.rect(9, 13, 2, 3, (x) => PAL.gold[x === 9 ? 4 : 2]);
    p.ellipse(10, 21, 2.4, 2, (x, y) => PAL.gold[y < 21 ? 4 : 2]);
    p.rect(9, 17, 2, 3, (x) => PAL.gold[x === 9 ? 4 : 2]);
    p.set(10, 21, 0);
    p.outline(PAL.out);
    p.set(10, 21, PAL.out);
    return p;
  }

  // Livro-razão aberto, colunas de contas, fita marcadora e moedas.
  function livro() {
    const p = new Pix(24, 24);
    // capa de couro por baixo
    p.poly([[0.5, 6], [11.5, 7.5], [23.5, 6], [23.5, 20], [11.5, 21.5], [0.5, 20]], (x, y) => pick(PAL.band, 0.3 + (y > 19 ? -0.15 : 0.1), x, y));
    // páginas curvas
    const top = (x) => 4.5 + Math.abs(x - 11.5) * 0.05 + (Math.abs(x - 11.5) < 9 ? -Math.sin(Math.abs(x - 11.5) / 10 * Math.PI) * 1.3 : 0) + (Math.abs(x - 11.5) < 1.2 ? 1.6 : 0);
    p.fill(1, 2, 22, 20, (x, y) => x >= 1.5 && x <= 22.5 && y >= top(x) + 0.5 && y <= top(x) + 14.5,
      (x, y) => {
        const g = Math.abs(x + 0.5 - 12);
        return pick(PAL.linen, 0.85 - (g < 2 ? 0.35 : 0) - (x > 12 ? 0.08 : 0), x, y, 3);
      });
    // linhas pautadas e números
    for (let x = 2; x <= 21; x++) {
      if (x === 11 || x === 12) continue;
      const t = Math.ceil(top(x) + 0.5);
      for (let y = t + 2; y <= t + 12; y += 2) {
        const col = x < 12 ? x - 2 : x - 13;
        const pg = x < 12 ? 0 : 1;
        if (col === 6) p.set(x, y, PAL.banner[2]);
        else if (hash(x, y, pg) < 0.62 && col % 7 !== 5) p.set(x, y, col > 6 ? PAL.gold[1] : INK);
      }
    }
    // colunas vermelhas
    for (const cx of [8, 19]) for (let y = 0; y < 24; y++) if (p.get(cx, y) && p.get(cx, y) !== PAL.band[0] && y > top(cx) + 1 && y < top(cx) + 14) p.set(cx, y, PAL.banner[2]);
    // fita marcadora
    p.rect(12, 18, 1, 5, PAL.banner[3]);
    p.set(12, 22, PAL.banner[1]);
    // moedas empilhadas no canto
    for (let i = 0; i < 3; i++) {
      const cy = 20.5 - i * 1.6;
      p.ellipse(19.5, cy, 3.2, 1.5, (x, y) => (y + 0.5 > cy ? PAL.gold[x < 19 ? 2 : 1] : PAL.gold[3]));
    }
    p.ellipse(19.5, 17.3, 3.2, 1.4, (x, y) => pick(PAL.gold, 0.6 + (x < 19 ? 0.3 : 0), x, y));
    p.set(18, 17, PAL.gold[5]);
    p.outline(PAL.out);
    return p;
  }

  // Martelo ancestral: cabeça de pedra antiga com runas que brilham.
  function martelo() {
    const p = new Pix(24, 24);
    // cabo descendo para a direita, com tiras de couro e pomo de bronze
    bar(p, 9.8, 9.3, 20, 19.5, 1.35, (x, y, t, s) => (t > 0.45 && t < 0.92 && Math.floor(t * 16) % 2 === 0
      ? pick(PAL.leather, 0.3 + cylLight(s) * 0.6, x, y) : pick(PAL.wood, 0.22 + cylLight(s) * 0.65, x, y)));
    p.sphere(20.5, 20, 1.9, 1.9, BRONZE, 0.1);
    // cabeça de pedra girada: a ao longo da cabeça, b na direção do cabo
    const cx = 9.8, cy = 9.3, HA = 7.3, HB = 4.4, r2 = Math.SQRT1_2;
    const loc = (x, y) => [((x - cx) - (y - cy)) * r2, ((x - cx) + (y - cy)) * r2];
    p.fill(0, 0, 20, 17, (x, y) => {
      const [a, b] = loc(x, y);
      return Math.abs(a) <= HA && Math.abs(b) <= HB && (HA - Math.abs(a)) + (HB - Math.abs(b)) >= 1;
    }, (x, y) => {
      const [a, b] = loc(x + 0.5, y + 0.5);
      const band = Math.abs(a) > 4.6 && Math.abs(a) < 6;
      const r = band ? BRONZE : ROCK;
      let v = 0.5 - b * 0.06 + (b < -3.1 ? 0.28 : 0) + (b > 3.1 ? -0.22 : 0) + (Math.abs(a) > 6 ? (a > 0 ? 0.12 : -0.1) : 0);
      if (!band) v += (hash(x, y, 21) - 0.5) * 0.1;
      return pick(r, v, x, y);
    });
    // runas angulosas acesas, gravadas no meio da cabeça
    const segs = [[-3.2, -2.6, -3.2, 2.6], [-3.2, -0.8, -1.8, -2.4],
      [0.7, -2.6, -0.6, 0], [-0.6, 0, 0.7, 2.6], [2.8, -2.6, 2.8, 2.6], [2.8, 0, 4, -1.4]];
    const near = (a, b) => Math.min(...segs.map(([a0, b0, a1, b1]) => {
      const dx = a1 - a0, dy = b1 - b0;
      const t = clamp01(((a - a0) * dx + (b - b0) * dy) / (dx * dx + dy * dy));
      return Math.hypot(a - a0 - dx * t, b - b0 - dy * t);
    }));
    for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) {
      const [a, b] = loc(x + 0.5, y + 0.5);
      if (Math.abs(a) > 4.3 || Math.abs(b) > 3.2) continue;
      const d = near(a, b);
      if (d < 0.45) p.set(x, y, d < 0.2 ? RUNE[4] : RUNE[3]);
    }
    // musgo e rachadura de velhice
    for (const [x, y] of [[4, 12], [5, 13], [13, 1], [14, 2]]) p.set(x, y, PAL.herb[2]);
    p.line(15, 8, 16, 10, ROCK[0]);
    p.outline(PAL.out);
    p.set(20, 4, RUNE[4]); p.set(21, 6, RUNE[3]);
    return p;
  }

  // Trilhos da mina sumindo num túnel escorado.
  function trilhos() {
    const p = new Pix(24, 24);
    // boca do túnel ao fundo
    p.fill(5, 1, 18, 9, (x, y) => ((x - 11.5) / 6.5) ** 2 + ((y - 9) / 8) ** 2 <= 1, (x, y) => pick(ROCK, 0.3 + (hash(x >> 1, y, 5) - 0.5) * 0.4 + (y < 4 ? 0.2 : 0), x, y));
    p.fill(7, 3, 16, 9, (x, y) => ((x - 11.5) / 4.6) ** 2 + ((y - 9) / 6) ** 2 <= 1, (x, y) => pick(VOID, 0.15 + (y - 3) / 18, x, y));
    p.rect(7, 4, 1, 6, PAL.wood[3]); p.rect(16, 4, 1, 6, PAL.wood[2]); p.rect(7, 3, 10, 1, PAL.wood[3]);
    // leito de cascalho em perspectiva
    const span = (y) => 2.6 + (y - 9) * 0.7;
    p.fill(0, 9, 23, 23, (x, y) => Math.abs(x - 11.5) <= span(y) + 1.5 && y <= 22.5, (x, y) => pick(PAL.dirt, 0.3 + (hash(x, y, 3) - 0.5) * 0.5 + (y < 12 ? -0.2 : 0), x, y));
    // dormentes cada vez mais juntos ao longe
    for (const y0 of [21, 18, 15.5, 13.5, 12, 10.8, 9.8]) {
      const h = y0 > 17 ? 2 : 1;
      const w = span(y0) + 1;
      p.rect(Math.round(11.5 - w), Math.floor(y0), Math.round(w * 2), h, (x, y) => pick(PAL.wood, (y === Math.floor(y0) ? 0.75 : 0.35) + (hash(x, y, 9) - 0.5) * 0.15, x, y));
    }
    // dois trilhos de ferro
    for (const side of [-1, 1]) {
      for (let y = 9; y <= 22; y++) {
        const x = 11.5 + side * span(y) * 0.72;
        const w = y > 16 ? 2 : 1;
        for (let k = 0; k < w; k++) p.set(x - (side < 0 ? k : 0) + (side > 0 ? k : 0) - 0.5, y, k === 0 || w === 1 ? PAL.steel[side < 0 ? 5 : 4] : PAL.steel[2]);
      }
    }
    p.outline(PAL.out);
    return p;
  }

  // Lanterna do mineiro acesa, de ferro e vidro, com argola.
  function lanterna() {
    const p = new Pix(24, 24);
    // brilho em volta
    for (let y = 3; y < 23; y++) for (let x = 2; x < 22; x++) {
      const d = Math.hypot(x + 0.5 - 12, y + 0.5 - 13);
      if (d < 10 && bayer(x, y) < (1 - d / 10) * 0.55) p.set(x, y, d < 7 ? PAL.gold[3] : PAL.gold[2]);
    }
    // argola
    p.fill(8, 0, 15, 5, (x, y) => Math.abs(Math.hypot(x - 11.5, y - 4) - 3) < 0.75 && y < 4.5, (x) => PAL.iron[x < 12 ? 4 : 2]);
    // chapéu cônico
    p.poly([[11, 4], [13, 4], [17.5, 8], [6.5, 8]], (x, y) => pick(PAL.iron, 0.3 + (x < 12 ? 0.35 : 0) + (y < 6 ? 0.2 : 0), x, y));
    p.rect(6, 8, 12, 1, PAL.iron[3]);
    // vidro iluminado
    p.rect(7, 9, 10, 9, (x, y) => {
      const d = Math.hypot(x + 0.5 - 12, (y + 0.5 - 14) * 0.8);
      return pick(PAL.gold, 0.95 - d / 8, x, y);
    });
    // chama
    p.fill(10, 10, 13, 17, (x, y) => Math.abs(x - 12) < 1.6 * Math.sin(Math.PI * clamp01((y - 10) / 6.8)), (x, y) => PAL.fire[y < 13 ? 4 : 5]);
    p.set(11, 15, WHITE); p.set(12, 15, WHITE);
    p.rect(11, 16, 2, 1, PAL.linen[4]); // pavio na vela
    // grade de ferro
    for (const gx of [7, 11.5, 16]) p.rect(Math.floor(gx), 9, 1, 9, PAL.iron[gx === 7 ? 3 : 1]);
    p.rect(7, 12, 10, 1, PAL.iron[2]);
    // base
    p.rect(6, 18, 12, 2, (x, y) => pick(PAL.iron, 0.3 + (y === 18 ? 0.35 : 0) + (x < 9 ? 0.2 : 0), x, y));
    p.rect(8, 20, 8, 1, PAL.iron[1]);
    p.outline(PAL.out);
    sparkle(p, 20, 5, true);
    p.set(3, 9, PAL.gold[4]);
    return p;
  }

  // Contrato de mineiros: pergaminho com picareta desenhada, marcas e lacre.
  function contrato() {
    const p = new Pix(24, 24);
    const parch = (x, y) => pick(PAL.sail, 0.5 + (hash(x, y, 14) - 0.5) * 0.2 + (x < 7 ? 0.15 : 0) - (x > 16 ? 0.15 : 0), x, y);
    p.rect(5, 3, 14, 17, parch);
    // rolos em cima e embaixo
    for (const ry of [2, 20]) p.fill(3, ry - 1, 20, ry + 1, () => true, (x, y) => pick(PAL.sail, 0.2 + cylLight((y + 0.5 - ry) / 1.6 * 1) * 0.8, x, y));
    for (const ry of [2, 20]) { p.set(3, ry, PAL.sail[0]); p.set(20, ry, PAL.sail[0]); }
    // picareta desenhada a tinta no topo
    p.line(9, 9, 13, 5, INK);
    p.line(10, 4, 12, 4, INK); p.line(12, 4, 14, 5, INK); p.line(14, 5, 15, 7, INK); p.line(10, 4, 9, 5, INK);
    // linhas do texto
    for (const [y, x0, x1] of [[11, 7, 16], [13, 7, 15], [15, 7, 16]]) for (let x = x0; x <= x1; x++) if (hash(x, y, 2) < 0.75) p.set(x, y, PAL.sail[0]);
    // marcas dos mineiros (cruzinhas de assinatura) e o nome do senhor
    for (const mx of [7, 10]) { p.set(mx, 17, INK); p.set(mx + 1, 18, INK); p.set(mx + 1, 17, INK); p.set(mx, 18, INK); }
    // lacre com fita
    p.poly([[14, 18], [16, 18], [17, 23], [15.5, 22], [14, 23]], (x, y) => RIBBON[x < 15 ? 3 : 2]);
    p.sphere(15.5, 17.5, 2.4, 2.2, WAX, 0.1);
    p.set(15, 17, WAX[4]);
    p.outline(PAL.out);
    return p;
  }

  // Contramestre: busto do capataz de boné, bigode farto e vara de medir.
  function contramestre() {
    const p = new Pix(24, 24);
    // vara de medir atrás do ombro
    bar(p, 20, 1.5, 15, 22, 1, (x, y, t, s) => (Math.floor(t * 22) % 3 === 0 && s > -0.2 ? PAL.wood[1] : PAL.straw[s < 0 ? 4 : 2]));
    // ombros e gibão
    p.fill(1, 15, 22, 23, (x, y) => ((x - 11.5) / 10.5) ** 2 + ((y - 23.5) / 8.5) ** 2 <= 1,
      (x, y) => pick(PAL.vest, 0.2 + sphereLight((x + 0.5 - 10) / 10, (y + 0.5 - 17) / 7) * 0.8, x, y));
    // gola da camisa e a correia de couro atravessada no peito
    p.poly([[8.5, 16], [14.5, 16], [11.5, 19.5]], (x, y) => PAL.linen[y < 17 ? 3 : 2]);
    bar(p, 5, 17.5, 15.5, 23.5, 0.9, (x, y, t, s) => PAL.leather[s < 0 ? 4 : 2]);
    p.rect(12, 20, 2, 2, (x, y) => PAL.iron[x === 12 && y === 20 ? 4 : 2]); // fivela
    // cabeça
    p.fill(6, 5, 17, 17, (x, y) => ((x - 11.5) / 5) ** 2 + ((y - 11) / 5.5) ** 2 <= 1,
      (x, y) => pick(PAL.skin, 0.25 + sphereLight((x + 0.5 - 10.5) / 5, (y + 0.5 - 10) / 5.5) * 0.75, x, y));
    p.set(6, 11, PAL.skin[2]); p.set(17, 11, PAL.skin[1]); // orelhas
    // boné de feltro com aba
    p.fill(5, 2, 18, 8, (x, y) => ((x - 11.5) / 6) ** 2 + ((y - 7.5) / 5.5) ** 2 <= 1 && y <= 7,
      (x, y) => pick(PAL.hood, 0.25 + sphereLight((x + 0.5 - 10) / 6, (y + 0.5 - 4) / 5) * 0.75, x, y));
    p.rect(5, 7, 14, 2, (x, y) => PAL.leather[y === 7 ? 4 : 2]);
    p.set(14, 5, PAL.gold[4]); p.set(15, 5, PAL.gold[3]);
    // sobrancelhas franzidas e olhos
    p.line(8, 10, 10, 11, PAL.beard[1]); p.line(15, 10, 13, 11, PAL.beard[1]);
    p.set(9, 12, PAL.iris); p.set(14, 12, PAL.iris);
    p.set(11, 13, PAL.skin[2]); p.set(12, 13, PAL.skin[2]);
    // bigode farto e barba curta
    p.fill(7, 13, 16, 17, (x, y) => (y === 14 && x >= 8 && x <= 15) || (y === 15 && (x <= 10 || x >= 13) && x >= 7 && x <= 16) || (y >= 16 && x >= 9 && x <= 14),
      (x, y) => pick(PAL.beard, 0.35 + (y === 14 ? 0.35 : 0) + (x < 11 ? 0.15 : 0) + (hash(x, y, 30) - 0.5) * 0.2, x, y));
    p.rect(11, 15, 2, 1, PAL.lip);
    p.outline(PAL.out);
    return p;
  }

  // Filão rico: rocha partida com um veio grosso de ouro e pepitas.
  function filao() {
    const p = new Pix(24, 24);
    const face = (pts, base) => p.poly(pts, (x, y) => pick(ROCK, base + (hash(x, y, 5) - 0.5) * 0.14 + (hash(x >> 2, y >> 2, 6) - 0.5) * 0.1, x, y));
    face([[1, 15], [2.5, 8], [8, 11], [14, 10.5], [13.5, 22.5], [5, 22]], 0.55); // frente
    face([[14, 10.5], [21, 6.5], [22.5, 14.5], [19, 21], [13.5, 22.5]], 0.28); // lado
    face([[2.5, 8], [8, 2.5], [16, 1.5], [21, 6.5], [14, 10.5], [8, 11]], 0.85); // topo
    // veio de ouro serpenteando pelas três faces
    const vein = (t) => {
      const x = 1.5 + t * 20.5;
      return [x, 16 - t * 9 + Math.sin(t * 9) * 1.4];
    };
    stroke(p, vein, (t) => 0.9 + Math.sin(t * 17) * 0.35 + (Math.abs(t - 0.4) < 0.1 ? 0.7 : 0),
      (x, y, t, s) => pick(PAL.gold, 0.4 + cylLight(s) * 0.6, x, y));
    // ramificações
    stroke(p, (t) => [6 + t * 3, 14.5 + t * 6], () => 0.6, (x, y, t, s) => pick(PAL.gold, 0.35 + cylLight(s) * 0.5, x, y));
    stroke(p, (t) => [12 + t * 3, 4 + t * 5], () => 0.6, (x, y, t, s) => pick(PAL.gold, 0.5 + cylLight(s) * 0.5, x, y));
    // pepitas saltando
    p.sphere(10, 12.5, 2, 1.8, PAL.gold, 0.15);
    p.sphere(18, 13, 1.5, 1.4, PAL.gold, 0);
    p.sphere(4, 19.5, 1.3, 1.2, PAL.gold, 0.1);
    p.outline(PAL.out);
    sparkle(p, 9, 11, true);
    sparkle(p, 19, 4);
    p.set(17, 12, WHITE);
    return p;
  }

  Object.assign(ART.icons, {
    'c-fart:mineiro': picareta,
    'c-fart:mina': escoras,
    'c-fart:pedreira': cunha,
    'c-fart:fundicao': cadinho,
    'c-fart:capataz': sino,
    'c-fart:poco': roldana,
    'c-fart:ourives': pinca,
    'c-fart:casadamoeda': cunho,
    'c-fart:guilda': selo,
    'c-fart:veio': bateia,
    'c-fart:salao': lareira,
    'c-fart:lapidario': rodaPolir,
    'c-fart:tesouraria': cofre,
    'c-fart:banqueiro': livro,
    'c-fart:coracao': martelo,
    'c-ritmo:minerios': trilhos,
    'c-sorte:minerios': lanterna,
    'c-recruta:minerios': contrato,
    'c-desconto:minerios': contramestre,
    'c-bonanca:minerios': filao,
  });
})();
