'use strict';
// Lógica do jogo idle: várias linhas de produção, cada uma com seu recurso e
// uma cadeia de geradores em tiers. O tier 1 produz o recurso da linha e cada
// tier acima produz unidades do tier de baixo. Todas as linhas abertas
// trabalham ao mesmo tempo; a tela mostra uma linha por vez.
//
// Tudo é liberado aos poucos: o jogo começa só com a linha da comida e trigo
// para comprar o primeiro camponês. Os outros geradores aparecem como silhueta com cadeado e só mostram
// a arte quando o jogador junta o suficiente para comprar o primeiro. As outras
// linhas também começam fechadas e são abertas pagando com recursos.
//
// Regra de texto: toda descrição cabe numa linha só, para os cartões terem
// todos a mesma altura.

const SAVE_KEY = 'jogo-idle:v2';
const OLD_SAVE_KEYS = ['jogo-idle:trigo:v1'];
const OFFLINE_CAP = 8 * 3600; // segundos de progresso offline, no máximo

const LINES = [
  {
    id: 'comida', name: 'Comida', res: 'trigo', icon: 'wheat', scene: 'farm', sceneLabel: 'O campo de trigo',
    gens: ['campones', 'moinho', 'celeiro', 'granja', 'aldeia', 'feira', 'vila', 'solar', 'castelo',
      'barao', 'conde', 'duque', 'rei', 'imperador', 'dinastia'],
    unlock: [],
    blurb: 'Camponeses colhem o trigo que alimenta o feudo.',
    next: null,
  },
  {
    id: 'militar', name: 'Militar', res: 'armas', icon: 'sword', scene: 'castle', sceneLabel: 'O pátio do castelo',
    gens: ['ferreiro', 'forja'],
    unlock: [{ res: 'trigo', amount: 500 }],
    blurb: 'Ferreiros e forjas armam a guarda do castelo.',
    next: { name: 'Arsenal', plural: 'Arsenais', makes: 'forja', art: 'arsenal',
      blurb: 'Guarda as armas do feudo e ergue novas forjas.' },
  },
  {
    id: 'alquimia', name: 'Alquimia', res: 'ervas', icon: 'herb', scene: 'garden', sceneLabel: 'A horta de ervas',
    gens: ['herborista', 'botica'],
    unlock: [{ res: 'trigo', amount: 2500 }, { res: 'armas', amount: 150 }],
    blurb: 'Herboristas colhem as ervas que curam os feridos.',
    next: { name: 'Mosteiro', plural: 'Mosteiros', makes: 'botica', art: 'monastery',
      blurb: 'Monges estudam as ervas e abrem novas boticas.' },
  },
];

const GENERATORS = [
  {
    id: 'campones', a: 'um', line: 'comida', name: 'Camponês', tier: 1, portrait: 'peasant',
    accent: '#f4d478', stripes: '--bar-wheat',
    makes: 'trigo', amount: 3, cycle: 3,
    blurb: 'Colhe trigo no campo de sol a sol.',
    costs: [{ res: 'trigo', base: 10, growth: 1.07 }],
  },
  {
    id: 'ferreiro', a: 'um', line: 'militar', name: 'Ferreiro', tier: 1, portrait: 'smith',
    accent: '#ff9a4a', stripes: '--bar-ember',
    makes: 'armas', amount: 2, cycle: 4,
    blurb: 'Martela o aço até virar lâmina.',
    costs: [{ res: 'armas', base: 10, growth: 1.08 }],
  },
  {
    id: 'forja', a: 'uma', line: 'militar', name: 'Forja', tier: 2, portrait: 'forge',
    accent: '#c3cbd6', stripes: '--bar-steel',
    makes: 'ferreiro', amount: 1, cycle: 8,
    blurb: 'Fogo aceso dia e noite atrai aprendizes.',
    costs: [{ res: 'armas', base: 120, growth: 1.15 }, { res: 'ferreiro', base: 8, growth: 1 }],
  },
  {
    id: 'herborista', a: 'um', line: 'alquimia', name: 'Herborista', tier: 1, portrait: 'herbalist',
    accent: '#94c874', stripes: '--bar-herb',
    makes: 'ervas', amount: 4, cycle: 5,
    blurb: 'Conhece cada folha e a erva de cada mal.',
    costs: [{ res: 'ervas', base: 12, growth: 1.07 }],
  },
  {
    id: 'botica', a: 'uma', line: 'alquimia', name: 'Botica', tier: 2, portrait: 'botica',
    accent: '#b9a2e0', stripes: '--bar-lavender',
    makes: 'herborista', amount: 1, cycle: 7,
    blurb: 'Entre frascos, forma novos herboristas.',
    costs: [{ res: 'ervas', base: 180, growth: 1.15 }, { res: 'herborista', base: 12, growth: 1 }],
  },
];

// Linha da comida do tier 2 ao 15, do moinho à dinastia. Cada tier gera 1
// unidade do tier de baixo por ciclo. O preço em trigo sobe 40x de um tier para
// o outro e também pede algumas unidades do tier de baixo (10, 15, 20...).
const FOOD_TIERS = [
  // id, artigo, nome, plural, retrato, cor, listras, ciclo (s), trigo, descrição
  ['moinho', 'um', 'Moinho', 'moinhos', 'mill', '#a3d466', 'grass', 6, 150,
    'Farinha farta atrai famílias para o campo.'],
  ['celeiro', 'um', 'Celeiro', 'celeiros', 'barn', '#e07a52', 'roof', 9, 6e3,
    'Guarda a colheita e paga novos moinhos.'],
  ['granja', 'uma', 'Granja', 'granjas', 'farmstead', '#d4a070', 'earth', 12, 240e3,
    'Terra e gado para erguer novos celeiros.'],
  ['aldeia', 'uma', 'Aldeia', 'aldeias', 'village', '#8cc6dc', 'sky', 15, 9.6e6,
    'Famílias em volta do poço fundam granjas.'],
  ['feira', 'uma', 'Feira', 'feiras', 'fair', '#b9a2e0', 'lavender', 18, 380e6,
    'Mercadores de longe fazem aldeias crescer.'],
  ['vila', 'uma', 'Vila', 'vilas', 'town', '#cbbea9', 'stone', 21, 15e9,
    'Atrás das muralhas, a vila organiza feiras.'],
  ['solar', 'um', 'Solar', 'solares', 'manor', '#f8dc7a', 'gold', 24, 600e9,
    'O senhor do solar funda novas vilas.'],
  ['castelo', 'um', 'Castelo', 'castelos', 'castle', '#c3cbd6', 'steel', 27, 25e12,
    'Do alto da colina, reparte terras em solares.'],
  ['barao', 'um', 'Barão', 'barões', 'baron', '#8fb8f0', 'cape', 30, 1e15,
    'Um barão leal ergue castelos na fronteira.'],
  ['conde', 'um', 'Conde', 'condes', 'count', '#94c874', 'herb', 36, 40e15,
    'O conde nomeia barões para suas terras.'],
  ['duque', 'um', 'Duque', 'duques', 'duke', '#62a6c2', 'water', 42, 1.6e18,
    'Senhor de um ducado, concede títulos de conde.'],
  ['rei', 'um', 'Rei', 'reis', 'king', '#ffd45e', 'gold', 48, 64e18,
    'Basta uma palavra do rei para nascer um duque.'],
  ['imperador', 'um', 'Imperador', 'imperadores', 'emperor', '#c890e0', 'royal', 54, 2.5e21,
    'O imperador coroa reis pelo continente.'],
  ['dinastia', 'uma', 'Dinastia', 'dinastias', 'dynasty', '#ff9a4a', 'ember', 60, 100e21,
    'Uma linhagem que dá ao mundo novos imperadores.'],
];

FOOD_TIERS.forEach(([id, a, name, , portrait, accent, stripes, cycle, trigo, blurb], i) => {
  const below = i === 0 ? 'campones' : FOOD_TIERS[i - 1][0];
  GENERATORS.push({
    id, a, line: 'comida', name, tier: i + 2, portrait, accent, stripes: '--bar-' + stripes,
    makes: below, amount: 1, cycle, blurb,
    costs: [{ res: 'trigo', base: trigo, growth: 1.15 }, { res: below, base: 10 + 5 * i, growth: 1 }],
  });
});

const GEN = Object.fromEntries(GENERATORS.map((g) => [g.id, g]));
const LINE = Object.fromEntries(LINES.map((l) => [l.id, l]));

const RES_LABEL = {
  trigo: { one: 'trigo', many: 'trigo', icon: 'wheat' },
  armas: { one: 'arma', many: 'armas', icon: 'sword' },
  ervas: { one: 'erva', many: 'ervas', icon: 'herb' },
  campones: { one: 'camponês', many: 'camponeses', icon: 'peasant' },
  ferreiro: { one: 'ferreiro', many: 'ferreiros', icon: 'smith' },
  forja: { one: 'forja', many: 'forjas', icon: 'forge' },
  herborista: { one: 'herborista', many: 'herboristas', icon: 'herbalist' },
  botica: { one: 'botica', many: 'boticas', icon: 'flask' },
};
for (const [id, , name, many, icon] of FOOD_TIERS) RES_LABEL[id] = { one: name.toLowerCase(), many, icon };

// Começo do jogo: nenhum gerador, só o trigo exato para comprar o primeiro camponês.
function freshState() {
  const gens = {};
  for (const gen of GENERATORS) {
    const starter = gen.line === LINES[0].id && gen.tier === 1;
    gens[gen.id] = { count: 0, bought: 0, progress: 0, made: 0, seen: starter };
  }
  const res = {};
  const lines = {};
  for (const line of LINES) {
    res[line.res] = 0;
    lines[line.id] = line.unlock.length === 0;
  }
  const first = GEN[LINES[0].gens[0]];
  res[LINES[0].res] = first.costs[0].base;
  return { res, gens, lines, mode: '1', line: LINES[0].id };
}

let state = freshState();

// ---------------------------------------------------------------------------
// Recursos e números

function getRes(id) {
  return id in state.res ? state.res[id] : state.gens[id].count;
}

function addRes(id, n) {
  if (id in state.res) state.res[id] += n;
  else state.gens[id].count += n;
}

// Depois de decilhão (Dc) vêm pares de letras, como em outros jogos idle: aa, ab, ac...
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
for (let i = 0; i < 26 * 26; i++) SUFFIXES.push(String.fromCharCode(97 + Math.floor(i / 26), 97 + (i % 26)));
function fmt(n) {
  n = Math.floor(n + 1e-9);
  if (n < 1000) return n.toLocaleString('pt-BR');
  const i = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(n) / 3));
  const v = n / Math.pow(1000, i);
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0;
  return v.toFixed(digits).replace('.', ',') + SUFFIXES[i];
}

function fmtRate(n) {
  if (n === 0) return '0';
  if (n < 10) return n.toFixed(1).replace('.', ',');
  return fmt(n);
}

function fmtTime(sec) {
  sec = Math.ceil(sec);
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'min ' + String(sec % 60).padStart(2, '0') + 's';
  return Math.floor(sec / 3600) + 'h ' + String(Math.floor((sec % 3600) / 60)).padStart(2, '0') + 'min';
}

function plural(id, n) {
  return n === 1 ? RES_LABEL[id].one : RES_LABEL[id].many;
}

// "150 trigo e 10 camponeses"
function costText(cost) {
  const parts = cost.map((c) => fmt(c.amount) + ' ' + plural(c.res, c.amount));
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1] : parts[0];
}

// ---------------------------------------------------------------------------
// Custos: crescem geometricamente a cada unidade comprada.

function costFor(gen, n) {
  const b = state.gens[gen.id].bought;
  return gen.costs.map((c) => ({
    res: c.res,
    amount: c.growth === 1
      ? c.base * n
      : Math.ceil(c.base * Math.pow(c.growth, b) * (Math.pow(c.growth, n) - 1) / (c.growth - 1)),
  }));
}

function canAfford(cost) {
  return cost.every((c) => getRes(c.res) >= c.amount);
}

function maxAffordable(gen) {
  const b = state.gens[gen.id].bought;
  let best = Infinity;
  for (const c of gen.costs) {
    const have = getRes(c.res);
    let n;
    if (c.growth === 1) n = Math.floor(have / c.base);
    else n = Math.floor(Math.log(have * (c.growth - 1) / (c.base * Math.pow(c.growth, b)) + 1) / Math.log(c.growth));
    best = Math.min(best, n);
  }
  // o arredondamento dos custos pode passar do saldo por 1 unidade
  while (best > 0 && !canAfford(costFor(gen, best))) best--;
  return Math.max(0, best);
}

// Quanto falta para poder pagar, pelo ritmo de produção atual.
function timeToAfford(cost) {
  let worst = 0;
  for (const c of cost) {
    const missing = c.amount - getRes(c.res);
    if (missing <= 0) continue;
    const rate = ratePerSecond(c.res);
    if (rate <= 0) return { never: c.res };
    worst = Math.max(worst, missing / rate);
  }
  return { seconds: worst };
}

// "Dá para <verbo> em 36s", ou o que falta quando nada está produzindo aquilo
function etaText(cost, verb) {
  const eta = timeToAfford(cost);
  if (!eta.never) return verb + ' em ' + fmtTime(eta.seconds);
  const label = RES_LABEL[eta.never].many;
  return eta.never in state.res ? 'Sem produção de ' + label + ' no momento' : 'Compre mais ' + label;
}

function buyAmount(gen) {
  if (state.mode === 'max') return Math.max(1, maxAffordable(gen));
  return Number(state.mode);
}

function buy(gen) {
  if (!state.gens[gen.id].seen) return false;
  const n = buyAmount(gen);
  const cost = costFor(gen, n);
  if (!canAfford(cost)) return false;
  for (const c of cost) addRes(c.res, -c.amount);
  state.gens[gen.id].count += n;
  state.gens[gen.id].bought += n;
  return true;
}

// Abre uma linha: paga o custo e ganha o primeiro gerador do tier 1.
function unlockLine(line) {
  if (state.lines[line.id] || !canAfford(line.unlock)) return false;
  for (const c of line.unlock) addRes(c.res, -c.amount);
  state.lines[line.id] = true;
  // como no começo do jogo: a linha abre com o preço do primeiro gerador
  const first = GEN[line.gens[0]];
  addRes(line.res, first.costs[0].base);
  state.gens[first.id].seen = true;
  return true;
}

// ---------------------------------------------------------------------------
// Simulação: todas as linhas andam juntas, mesmo as que não estão na tela.

function step(dt, onCycle) {
  for (const gen of GENERATORS) {
    const g = state.gens[gen.id];
    if (g.count <= 0) { g.progress = 0; continue; }
    g.progress += dt / gen.cycle;
    if (g.progress >= 1) {
      const cycles = Math.floor(g.progress);
      g.progress -= cycles;
      const made = cycles * gen.amount * g.count;
      addRes(gen.makes, made);
      g.made += made;
      if (onCycle) onCycle(gen, made);
    }
  }
}

function simulateSilently(seconds) {
  let left = Math.min(seconds, OFFLINE_CAP);
  while (left > 0) {
    const dt = Math.min(1, left);
    step(dt);
    left -= dt;
  }
}

function ratePerSecond(resId) {
  let r = 0;
  for (const gen of GENERATORS) {
    if (gen.makes === resId) r += state.gens[gen.id].count * gen.amount / gen.cycle;
  }
  return r;
}

// Um gerador ainda escondido aparece quando dá para comprar o primeiro.
function checkReveals(announce) {
  for (const gen of GENERATORS) {
    const g = state.gens[gen.id];
    if (g.seen || !state.lines[gen.line]) continue;
    if (canAfford(costFor(gen, 1))) {
      g.seen = true;
      if (announce) announce(gen);
    }
  }
}

// ---------------------------------------------------------------------------
// Salvamento (só neste navegador)

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 3, savedAt: Date.now(), state }));
  } catch (_) { /* sem armazenamento: o jogo segue sem salvar */ }
}

function readSave() {
  for (const key of [SAVE_KEY, ...OLD_SAVE_KEYS]) {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  }
  return null;
}

function load() {
  try {
    const data = readSave();
    if (!data || !data.state) return 0;
    const base = freshState();
    const saved = data.state;
    const savedGens = saved.gens || {};
    const gens = {};
    for (const id in base.gens) {
      gens[id] = { ...base.gens[id], ...savedGens[id] };
      if (!savedGens[id] || savedGens[id].seen === undefined) gens[id].seen = gens[id].count > 0 || gens[id].bought > 0;
    }
    const res = { ...base.res, ...saved.res };
    if (typeof saved.trigo === 'number') res.trigo = saved.trigo; // save da versão só com trigo
    // saves antigos não tinham linhas fechadas: fica aberta a linha em que o
    // jogador já comprou algo; nas outras, some o gerador que vinha de graça
    const lines = { ...base.lines };
    for (const line of LINES) {
      if (saved.lines) lines[line.id] = lines[line.id] || !!saved.lines[line.id];
      else lines[line.id] = lines[line.id] || line.gens.some((id) => gens[id].bought > 0);
      if (!lines[line.id]) for (const id of line.gens) gens[id] = { ...base.gens[id] };
    }
    state = {
      res,
      gens,
      lines,
      mode: ['1', '10', 'max'].includes(saved.mode) ? saved.mode : '1',
      line: LINE[saved.line] ? saved.line : base.line,
    };
    return Math.max(0, (Date.now() - (data.savedAt || Date.now())) / 1000);
  } catch (_) {
    state = freshState();
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Interface

const ui = { cards: {}, tabs: {}, panels: {}, scenes: {}, lineLocks: {}, chains: {} };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Só mexe no DOM quando o texto muda, para não pesar a 180 quadros por segundo.
function setText(node, text) {
  if (node._text !== text) {
    node._text = text;
    node.textContent = text;
  }
}

function setClass(node, cls, on) {
  const key = '_c_' + cls;
  if (node[key] !== on) {
    node[key] = on;
    node.classList.toggle(cls, on);
  }
}

function setOk(btn, ok) {
  setClass(btn, 'can', ok);
  if (btn._ok !== ok) {
    btn._ok = ok;
    btn.setAttribute('aria-disabled', String(!ok));
  }
}

function costChip(resId) {
  const chip = el('span', 'cost-chip');
  chip.append(ART.iconCanvas(RES_LABEL[resId].icon, 2));
  const num = el('span', 'cost-num');
  chip.append(num);
  return { chip, num, resId };
}

function stat(label, icon) {
  const box = el('div', 'stat fr fr-slot');
  const line = el('span', 'stat-value');
  const value = el('span');
  line.append(value);
  if (icon) line.append(ART.iconCanvas(icon, 2));
  box.append(el('span', 'stat-label', label), line);
  return { box, value };
}

function portraitFrame(tier, label) {
  const frame = el('div', 'portrait fr fr-gold');
  const canvas = el('canvas');
  canvas.width = 64;
  canvas.height = 64;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  frame.append(canvas, el('span', 'badge', 'T' + tier));
  return { frame, canvas, ctx: canvas.getContext('2d') };
}

function buildRow(gen) {
  const card = el('article', 'gen fr fr-wood');
  card.dataset.gen = gen.id;
  card.style.setProperty('--accent', gen.accent);
  card.style.setProperty('--stripes', `var(${gen.stripes})`);

  const pic = portraitFrame(gen.tier, 'Retrato: ' + gen.name);

  // centro: nome, descrição, números e a barra do ciclo
  const main = el('div', 'main');
  const head = el('div', 'gen-head');
  const count = el('span', 'gen-count');
  const tier = el('span', 'gen-tier');
  tier.append(`Tier ${gen.tier} · produz`, ART.iconCanvas(RES_LABEL[gen.makes].icon, 2), RES_LABEL[gen.makes].many);
  head.append(el('h2', 'gen-name', gen.name), tier, count);
  const desc = el('p', 'gen-desc');

  const stats = el('div', 'stats');
  const madeIcon = RES_LABEL[gen.makes].icon;
  const perCycle = stat('Por ciclo', madeIcon);
  const cycle = stat('Ciclo');
  const perSec = stat('Por segundo', madeIcon);
  const total = stat('Produzido', madeIcon);
  stats.append(perCycle.box, cycle.box, perSec.box, total.box);

  const bar = el('div', 'bar fr fr-slot');
  const fill = el('div', 'fill');
  const barText = el('span', 'bar-text');
  const barTime = el('span', 'bar-time');
  bar.append(fill, barText, barTime);
  main.append(head, desc, stats, bar);

  // lateral: compra
  const side = el('div', 'side');
  const btn = el('button', 'btn buy');
  btn.type = 'button';
  btn.id = 'buy-' + gen.id;
  const btnLabel = el('span', 'buy-label');
  const btnCosts = el('span', 'buy-costs');
  const chips = gen.costs.map((c) => costChip(c.res));
  chips.forEach((c) => btnCosts.append(c.chip));
  btn.append(btnLabel, btnCosts);
  SFX.bind(btn, 'press');
  btn.addEventListener('click', () => {
    if (buy(gen)) {
      replay(count, 'pulse');
      renderNow();
    } else {
      btn.sfxResult = 'thud';
      replay(btn, 'nope');
    }
  });
  const note = el('p', 'buy-note');
  const owned = el('p', 'buy-owned');
  side.append(btn, note, owned);

  card.append(pic.frame, main, side);
  ui.cards[gen.id] = {
    card, portrait: pic.frame, canvas: pic.canvas, ctx: pic.ctx, count, desc, fill, bar, barText, barTime,
    perCycle: perCycle.value, cycle: cycle.value, perSec: perSec.value, total: total.value,
    btn, btnLabel, chips, note, owned, gen, lastP: -1, sealed: null, onScreen: true,
  };
  return card;
}

// Liga e desliga o modo "escondido" de um gerador: silhueta com cadeado,
// números trocados por "?" e o custo do primeiro como meta.
function applySeal(c) {
  const gen = c.gen;
  const sealed = !state.gens[gen.id].seen;
  if (c.sealed === sealed) return;
  const wasSealed = c.sealed;
  c.sealed = sealed;
  setClass(c.card, 'sealed', sealed);
  c.canvas.setAttribute('aria-label', sealed ? gen.name + ' bloqueado' : 'Retrato: ' + gen.name);
  if (sealed) {
    ART.locked[gen.portrait](c.ctx);
    setText(c.desc, 'Ainda bloqueado: junte o preço para descobrir.');
    for (const v of [c.perCycle, c.cycle, c.perSec, c.total]) setText(v, '?');
    setText(c.barText, 'Bloqueado');
    setText(c.barTime, '');
    setClass(c.card, 'working', false);
    c.fill.style.clipPath = 'inset(0 100% 0 0)';
    c.lastP = -1;
  } else {
    setText(c.desc, gen.blurb);
    setText(c.cycle, String(gen.cycle.toFixed(1)).replace('.', ',') + 's');
    if (wasSealed) replay(c.portrait, 'reveal');
  }
}

function buildLink(text) {
  const link = el('div', 'link');
  link.append(ART.iconCanvas('arrow', 2), el('span', null, text));
  return link;
}

function buildLockedRow(line) {
  const next = line.next;
  const tierN = line.gens.length + 1;
  const card = el('article', 'gen fr fr-wood locked');
  const pic = portraitFrame(tierN, next.name + ' bloqueado');
  ART.locked[next.art](pic.ctx);

  const main = el('div', 'main');
  const head = el('div', 'gen-head');
  const tier = el('span', 'gen-tier');
  tier.append(`Tier ${tierN} · vai produzir`, ART.iconCanvas(RES_LABEL[next.makes].icon, 2), RES_LABEL[next.makes].many);
  head.append(el('h2', 'gen-name', next.name), tier, el('span', 'gen-count', '×0'));
  const stats = el('div', 'stats');
  for (const label of ['Por ciclo', 'Ciclo', 'Por segundo', 'Produzido']) {
    const s = stat(label);
    s.value.textContent = '?';
    stats.append(s.box);
  }
  main.append(head, el('p', 'gen-desc', next.blurb), stats);

  const side = el('div', 'side');
  const btn = el('button', 'btn buy');
  btn.type = 'button';
  btn.disabled = true;
  btn.append(el('span', 'buy-label', 'Bloqueado'));
  side.append(btn, el('p', 'buy-note', 'Chega numa próxima versão.'));
  card.append(pic.frame, main, side);
  return card;
}

// Cartão de uma linha fechada: silhueta do primeiro gerador e o preço da linha.
function buildLineLock(line) {
  const card = el('article', 'gen fr fr-wood line-lock');
  const first = GEN[line.gens[0]];
  card.style.setProperty('--accent', first.accent);
  const pic = portraitFrame(1, 'Linha ' + line.name + ' bloqueada');
  ART.locked[first.portrait](pic.ctx);

  const main = el('div', 'main');
  const head = el('div', 'gen-head');
  const tier = el('span', 'gen-tier');
  tier.append('Linha fechada · produz', ART.iconCanvas(RES_LABEL[line.res].icon, 2), RES_LABEL[line.res].many);
  head.append(el('h2', 'gen-name', 'Linha ' + line.name), tier);
  main.append(head, el('p', 'gen-desc', line.blurb));

  const side = el('div', 'side');
  const btn = el('button', 'btn buy');
  btn.type = 'button';
  const costs = el('span', 'buy-costs');
  const chips = line.unlock.map((c) => {
    const chip = costChip(c.res);
    setText(chip.num, fmt(c.amount));
    costs.append(chip.chip);
    return chip;
  });
  btn.append(el('span', 'buy-label', 'Abrir linha'), costs);
  SFX.bind(btn, 'press');
  btn.addEventListener('click', () => {
    if (unlockLine(line)) {
      btn.sfxResult = 'unlock';
      const first = GEN[line.gens[0]];
      toast(`Linha ${line.name} aberta! Compre ${first.a === 'uma' ? 'a primeira' : 'o primeiro'} ${first.name.toLowerCase()} para começar.`);
      setLine(line.id);
    } else {
      btn.sfxResult = 'thud';
      replay(btn, 'nope');
    }
  });
  const note = el('p', 'buy-note');
  side.append(btn, note);
  card.append(pic.frame, main, side);
  ui.lineLocks[line.id] = { card, btn, chips, note };
  return card;
}

// Painel de uma linha: o cartão de abertura (se fechada) ou a cadeia de
// geradores, com o próximo tier bloqueado no fim.
function buildPanel(line) {
  const panel = el('section', 'gens');
  panel.id = 'gens-' + line.id;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-label', 'Geradores: ' + line.name);
  panel.append(buildLineLock(line));
  const chain = el('div', 'chain');
  const rows = line.gens.map((id, i) => {
    const gen = GEN[id];
    const link = i > 0
      ? buildLink(`Cada ${gen.name.toLowerCase()} gera ${gen.amount} ${plural(gen.makes, gen.amount)} a cada ${gen.cycle}s`)
      : null;
    const card = buildRow(gen);
    if (link) chain.append(link);
    chain.append(card);
    return { link, card };
  });
  // o que ainda não apareceu fica escondido; só o número de geradores restantes é mostrado
  const teaser = el('div', 'teaser');
  const teaserText = el('span');
  teaser.append(ART.iconCanvas('lock', 2), teaserText);
  chain.append(teaser);
  const tail = line.next
    ? [buildLink(`${line.next.plural} vão gerar ${RES_LABEL[line.next.makes].many}`), buildLockedRow(line)]
    : [];
  chain.append(...tail);
  panel.append(chain);
  ui.chains[line.id] = { node: chain, rows, teaser, teaserText, tail, shown: -1 };
  return panel;
}

// Quantos geradores da linha aparecem: todos os já descobertos e mais um, como
// silhueta. O resto vira só uma linha "Mais N geradores por descobrir".
function visibleCount(line) {
  let last = 0;
  line.gens.forEach((id, i) => { if (state.gens[id].seen) last = i; });
  return Math.min(line.gens.length, last + 2);
}

function renderChain(line) {
  const ch = ui.chains[line.id];
  const shown = visibleCount(line);
  const allSeen = line.gens.every((id) => state.gens[id].seen);
  if (ch.shown === shown && ch.allSeen === allSeen) return;
  ch.shown = shown;
  ch.allSeen = allSeen;
  ch.rows.forEach((r, i) => {
    r.card.hidden = i >= shown;
    if (r.link) r.link.hidden = i >= shown;
  });
  const rest = line.gens.length - shown;
  ch.teaser.hidden = rest <= 0;
  setText(ch.teaserText, rest === 1 ? 'Mais 1 gerador por descobrir' : `Mais ${rest} geradores por descobrir`);
  // o tier da próxima versão só aparece quando a linha inteira já foi descoberta
  for (const node of ch.tail) node.hidden = !allSeen;
}

// Aba de uma linha no topo: ícone, nome, estoque do recurso e ritmo.
function buildTab(line, index) {
  const tab = el('button', 'line-tab fr fr-slot');
  tab.type = 'button';
  tab.dataset.line = line.id;
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', 'gens-' + line.id);
  const icon = el('span', 'tab-icon');
  const shut = ART.iconCanvas('lock', 3);
  shut.classList.add('tab-lock');
  icon.append(ART.iconCanvas(line.icon, 3), shut);
  const name = el('span', 'tab-name', line.name);
  name.append(el('kbd', null, String(index + 1)));
  const num = el('span', 'tab-num');
  const rate = el('span', 'tab-rate');
  tab.append(icon, name, num, rate);
  SFX.bind(tab, 'flap');
  tab.addEventListener('click', () => setLine(line.id));
  ui.tabs[line.id] = { tab, num, rate };
  return tab;
}

function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

function floatText(gen, text) {
  const c = ui.cards[gen.id];
  if (!c || gen.line !== state.line) return;
  const f = el('span', 'float', text);
  const cardBox = c.card.getBoundingClientRect();
  const picBox = c.portrait.getBoundingClientRect();
  f.style.left = (picBox.left - cardBox.left + picBox.width * (0.35 + Math.random() * 0.3)) + 'px';
  f.style.top = (picBox.top - cardBox.top + picBox.height * 0.45) + 'px';
  c.card.append(f);
  setTimeout(() => f.remove(), 1250);
}

function onCycle(gen, made) {
  if (gen.line !== state.line) return;
  floatText(gen, '+' + fmt(made) + ' ' + plural(gen.makes, made));
  if (gen.makes in state.res) replay(ui.tabs[gen.line].num, 'pulse');
  else if (ui.cards[gen.makes]) replay(ui.cards[gen.makes].count, 'pulse');
}

function onReveal(gen) {
  SFX.play('unlock');
  toast(`Novo gerador liberado na linha ${LINE[gen.line].name}: ${gen.name}!`);
}

function renderTabs() {
  for (const line of LINES) {
    const t = ui.tabs[line.id];
    const open = state.lines[line.id];
    setClass(t.tab, 'closed', !open);
    if (open) {
      setText(t.num, fmt(state.res[line.res]));
      setText(t.rate, RES_LABEL[line.res].many + ' +' + fmtRate(ratePerSecond(line.res)) + '/s');
    } else {
      setText(t.num, 'Fechada');
      setText(t.rate, canAfford(line.unlock) ? 'Pronta para abrir' : 'Abre com ' + costText(line.unlock));
    }
  }
}

function renderLineLock(line) {
  const lock = ui.lineLocks[line.id];
  const ok = canAfford(line.unlock);
  setOk(lock.btn, ok);
  line.unlock.forEach((c, i) => setClass(lock.chips[i].chip, 'short', getRes(c.res) < c.amount));
  setText(lock.note, ok ? 'Pronto para abrir' : etaText(line.unlock, 'Dá para abrir'));
  setClass(lock.note, 'ready', ok);
}

function renderCard(c) {
  const gen = c.gen;
  const g = state.gens[gen.id];
  applySeal(c);
  setText(c.count, '×' + fmt(g.count));

  if (c.sealed) {
    const cost = costFor(gen, 1);
    setOk(c.btn, false);
    setText(c.btnLabel, 'Bloqueado');
    cost.forEach((k, i) => {
      setText(c.chips[i].num, fmt(k.amount));
      setClass(c.chips[i].chip, 'short', getRes(k.res) < k.amount);
    });
    setText(c.note, etaText(cost, 'Aparece'));
    setClass(c.note, 'ready', false);
    setText(c.owned, '');
    return;
  }

  const working = g.count > 0;
  setClass(c.card, 'working', working);

  // barra contínua: um valor novo a cada quadro, sem arredondar em degraus
  const p = working ? g.progress : 0;
  if (p !== c.lastP) {
    c.lastP = p;
    c.fill.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(3)}% 0 0)`;
  }
  const per = gen.amount * g.count;
  setText(c.barText, working ? 'Ciclo em andamento' : `Parado: compre ${gen.a} ${gen.name.toLowerCase()} para começar`);
  setText(c.barTime, working ? 'faltam ' + ((1 - g.progress) * gen.cycle).toFixed(1).replace('.', ',') + 's' : '');
  setText(c.perCycle, '+' + fmt(per));
  setText(c.perSec, fmtRate(per / gen.cycle) + '/s');
  setText(c.total, fmt(g.made));

  const n = buyAmount(gen);
  const cost = costFor(gen, n);
  const ok = canAfford(cost);
  setOk(c.btn, ok);
  setText(c.btnLabel, 'Comprar ×' + fmt(n));
  cost.forEach((k, i) => {
    setText(c.chips[i].num, fmt(k.amount));
    setClass(c.chips[i].chip, 'short', getRes(k.res) < k.amount);
  });
  setText(c.note, ok ? 'Pronto para comprar' : etaText(cost, 'Dá para comprar'));
  setClass(c.note, 'ready', ok);
  setText(c.owned, fmt(g.bought) + (g.bought === 1 ? ' comprado' : ' comprados') + ' por você');
}

function renderNow() {
  renderTabs();
  const line = LINE[state.line];
  const open = state.lines[line.id];
  ui.lineLocks[line.id].card.hidden = open;
  ui.chains[line.id].node.hidden = !open;
  if (!open) return renderLineLock(line);
  renderChain(line);
  const shown = ui.chains[line.id].shown;
  for (let i = 0; i < shown; i++) renderCard(ui.cards[line.gens[i]]);
}

// ---------------------------------------------------------------------------
// Arte animada: cena e retratos da linha aberta, redesenhados a cada quadro.

let millAngle = 0;
let sceneScale = 3;

function currentScene() {
  const line = LINE[state.line];
  if (!ui.scenes[line.id]) ui.scenes[line.id] = SCENES.create(line.scene);
  return ui.scenes[line.id];
}

function fitScene() {
  sceneScale = window.innerWidth < 700 ? 2 : 3;
  const w = Math.ceil(ui.sceneBox.clientWidth / sceneScale);
  currentScene().resize(w);
  const cv = ui.sceneCanvas;
  if (cv.width !== w) {
    cv.width = w;
    cv.height = SCENES.H;
  }
  cv.style.width = w * sceneScale + 'px';
  cv.style.height = SCENES.H * sceneScale + 'px';
}

function paintArt(t, dt) {
  const mills = state.gens.moinho.count;
  if (mills > 0) millAngle += dt * (0.9 + Math.min(mills, 30) * 0.04);
  const line = LINE[state.line];
  const open = state.lines[line.id];
  const [t1, t2] = line.gens.map((id) => state.gens[id].count);
  currentScene().paint(ui.sceneCtx, t, { t1, t2, angle: millAngle }, !open);
  if (!open) return;
  const info = { angle: millAngle, working: false };
  for (const id of line.gens) {
    if (!state.gens[id].seen) continue; // escondido: a silhueta já está desenhada
    if (!ui.cards[id].onScreen) continue; // fora da tela: não precisa animar
    info.working = state.gens[id].count > 0;
    ART.portraits[GEN[id].portrait](ui.cards[id].ctx, t, info);
  }
}

function setLine(id) {
  if (!LINE[id]) return;
  state.line = id;
  const line = LINE[id];
  for (const l of LINES) {
    const on = l.id === id;
    ui.panels[l.id].hidden = !on;
    const tab = ui.tabs[l.id].tab;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    setClass(tab, 'active', on);
  }
  document.body.dataset.line = id;
  setText(ui.lineName, '· ' + line.name);
  ui.sceneBox.setAttribute('aria-label', line.sceneLabel);
  fitScene();
  renderNow();
}

function toast(text) {
  setText(ui.toast, text);
  ui.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { ui.toast.hidden = true; }, 6000);
}

function setMode(mode) {
  state.mode = mode;
  for (const b of ui.modeBtns) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  renderNow();
}

function init() {
  ART.buildFrames();
  SCROLLBAR.init();
  SFX.warm();
  const away = load();

  ui.toast = document.getElementById('toast');
  ui.lineName = document.getElementById('line-name');
  ui.sceneBox = document.getElementById('scene-box');
  ui.sceneCanvas = document.getElementById('scene');
  ui.sceneCtx = ui.sceneCanvas.getContext('2d');

  const tabs = document.getElementById('line-tabs');
  const board = document.getElementById('gens');
  LINES.forEach((line, i) => {
    tabs.append(buildTab(line, i));
    const panel = buildPanel(line);
    ui.panels[line.id] = panel;
    board.append(panel);
  });

  // só os retratos que estão na tela são animados
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.cardUi.onScreen = e.isIntersecting;
  });
  for (const c of Object.values(ui.cards)) {
    c.portrait.cardUi = c;
    seen.observe(c.portrait);
  }

  // 1, 2, 3 trocam de linha; setas andam entre as abas quando uma delas tem foco
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const n = Number(e.key);
    if (n >= 1 && n <= LINES.length) {
      if (LINES[n - 1].id !== state.line) SFX.play('flap');
      setLine(LINES[n - 1].id);
    } else if (e.target.classList && e.target.classList.contains('line-tab') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const i = LINES.findIndex((l) => l.id === state.line);
      const next = LINES[(i + (e.key === 'ArrowRight' ? 1 : LINES.length - 1)) % LINES.length];
      SFX.play('flap');
      setLine(next.id);
      ui.tabs[next.id].tab.focus();
    }
  });

  // sem menu de contexto nem arrastar imagens, para não quebrar a imersão
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());

  ui.modeBtns = [...document.querySelectorAll('[data-mode]')];
  ui.modeBtns.forEach((b) => {
    SFX.bind(b, 'latch');
    b.addEventListener('click', () => setMode(b.dataset.mode));
  });
  checkReveals();
  setLine(state.line);
  setMode(state.mode);
  new ResizeObserver(fitScene).observe(ui.sceneBox);

  const mute = document.getElementById('mute');
  const showMute = () => {
    mute.textContent = SFX.muted ? 'Som desligado' : 'Som ligado';
    mute.setAttribute('aria-pressed', String(!SFX.muted));
  };
  SFX.bind(mute, 'press');
  mute.addEventListener('click', () => { SFX.setMuted(!SFX.muted); showMute(); });
  showMute();

  const reset = document.getElementById('reset');
  SFX.bind(reset, 'knock');
  reset.addEventListener('click', () => {
    if (reset.dataset.armed === '1') {
      state = freshState();
      save();
      for (const id in ui.cards) ui.cards[id].sealed = null;
      reset.dataset.armed = '';
      reset.textContent = 'Recomeçar';
      setLine(state.line);
      setMode('1');
      return;
    }
    reset.dataset.armed = '1';
    reset.textContent = 'Clique de novo para apagar tudo';
    setTimeout(() => { reset.dataset.armed = ''; reset.textContent = 'Recomeçar'; }, 3000);
  });

  if (away > 5) {
    const before = { ...state.res };
    simulateSilently(away);
    checkReveals();
    const parts = LINES
      .filter((l) => state.lines[l.id])
      .map((l) => [l.res, state.res[l.res] - before[l.res]])
      .filter(([, d]) => d >= 1)
      .map(([res, d]) => '+' + fmt(d) + ' ' + plural(res, Math.floor(d)));
    if (parts.length) toast('Enquanto você esteve fora: ' + parts.join(', ') + '.');
  }

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 1) { simulateSilently(dt); dt = 0; } // aba ficou em segundo plano
    step(dt, onCycle);
    checkReveals(onReveal);
    paintArt(now / 1000, dt);
    renderNow();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  setInterval(save, 5000);
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
