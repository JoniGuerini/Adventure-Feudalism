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

// As linhas de produção. Cada uma tem 15 tiers: o tier 1 produz o recurso da
// linha e cada tier acima produz 1 unidade do tier de baixo por ciclo.
//   t1: [quanto produz, ciclo (s), preço, crescimento do preço] do tier 1
//   t2: [ciclo (s), preço, unidades do tier 1 pedidas] do tier 2
// Do tier 3 em diante o preço sobe 40x por tier e pede 15, 20, 25... unidades
// do tier de baixo, e o ciclo vem de CYCLES.
const LINES = [
  {
    id: 'comida', name: 'Comida', res: 'trigo', icon: 'wheat', scene: 'farm', sceneLabel: 'O campo de trigo',
    unlock: [],
    blurb: 'Camponeses colhem o trigo que alimenta o feudo.',
    t1: [3, 3, 10, 1.07], t2: [6, 150, 10],
    tiers: [
      // id, artigo, nome, plural, retrato, cor, listras, descrição (cabe numa linha)
      ['campones', 'um', 'Camponês', 'camponeses', 'peasant', '#f4d478', 'wheat', 'Colhe trigo no campo de sol a sol.'],
      ['moinho', 'um', 'Moinho', 'moinhos', 'mill', '#a3d466', 'grass', 'Farinha farta atrai famílias para o campo.'],
      ['celeiro', 'um', 'Celeiro', 'celeiros', 'barn', '#e07a52', 'roof', 'Guarda a colheita e paga novos moinhos.'],
      ['granja', 'uma', 'Granja', 'granjas', 'farmstead', '#d4a070', 'earth', 'Terra e gado para erguer novos celeiros.'],
      ['aldeia', 'uma', 'Aldeia', 'aldeias', 'village', '#8cc6dc', 'sky', 'Famílias em volta do poço fundam granjas.'],
      ['feira', 'uma', 'Feira', 'feiras', 'fair', '#b9a2e0', 'lavender', 'Mercadores de longe fazem aldeias crescer.'],
      ['vila', 'uma', 'Vila', 'vilas', 'town', '#cbbea9', 'stone', 'Atrás das muralhas, a vila organiza feiras.'],
      ['solar', 'um', 'Solar', 'solares', 'manor', '#f8dc7a', 'gold', 'O senhor do solar funda novas vilas.'],
      ['castelo', 'um', 'Castelo', 'castelos', 'castle', '#c3cbd6', 'steel', 'Do alto da colina, reparte terras em solares.'],
      ['barao', 'um', 'Barão', 'barões', 'baron', '#8fb8f0', 'cape', 'Um barão leal ergue castelos na fronteira.'],
      ['conde', 'um', 'Conde', 'condes', 'count', '#94c874', 'herb', 'O conde nomeia barões para suas terras.'],
      ['duque', 'um', 'Duque', 'duques', 'duke', '#62a6c2', 'water', 'Senhor de um ducado, concede títulos de conde.'],
      ['rei', 'um', 'Rei', 'reis', 'king', '#ffd45e', 'gold', 'Basta uma palavra do rei para nascer um duque.'],
      ['imperador', 'um', 'Imperador', 'imperadores', 'emperor', '#c890e0', 'royal', 'O imperador coroa reis pelo continente.'],
      ['dinastia', 'uma', 'Dinastia', 'dinastias', 'dynasty', '#ff9a4a', 'ember', 'Uma linhagem que dá ao mundo novos imperadores.'],
    ],
  },
  {
    id: 'militar', name: 'Militar', res: 'armas', icon: 'sword', scene: 'castle', sceneLabel: 'O pátio do castelo',
    unlock: [{ res: 'trigo', amount: 500 }],
    blurb: 'Ferreiros e forjas armam a guarda do castelo.',
    t1: [2, 4, 10, 1.08], t2: [8, 120, 8],
    tiers: [
      ['ferreiro', 'um', 'Ferreiro', 'ferreiros', 'smith', '#ff9a4a', 'ember', 'Martela o aço até virar lâmina.'],
      ['forja', 'uma', 'Forja', 'forjas', 'forge', '#c3cbd6', 'steel', 'Fogo aceso dia e noite atrai aprendizes.'],
      ['arsenal', 'um', 'Arsenal', 'arsenais', 'arsenal', '#d4a070', 'earth', 'Guarda as armas do feudo e ergue forjas.'],
      ['quartel', 'um', 'Quartel', 'quartéis', 'barracks', '#e07a52', 'roof', 'Soldados em treino erguem novos arsenais.'],
      ['torre', 'uma', 'Torre de vigia', 'torres de vigia', 'watchtower', '#cbbea9', 'stone', 'Do alto, a sentinela pede mais quartéis.'],
      ['cavaleiro', 'um', 'Cavaleiro', 'cavaleiros', 'knight', '#8fb8f0', 'cape', 'O cavaleiro ergue torres por onde passa.'],
      ['fortaleza', 'uma', 'Fortaleza', 'fortalezas', 'fortress', '#a3a5ac', 'steel', 'Muralhas grossas onde se formam cavaleiros.'],
      ['capitao', 'um', 'Capitão', 'capitães', 'captain', '#f8dc7a', 'gold', 'O capitão toma fortalezas para o reino.'],
      ['ordem', 'uma', 'Ordem de cavalaria', 'ordens de cavalaria', 'order', '#c890e0', 'royal', 'Uma irmandade de armas que forma capitães.'],
      ['trabuco', 'um', 'Trabuco', 'trabucos', 'trebuchet', '#e8b878', 'wheat', 'Cada muralha derrubada funda uma ordem.'],
      ['marechal', 'um', 'Marechal', 'marechais', 'marshal', '#62a6c2', 'water', 'O marechal comanda os trabucos do cerco.'],
      ['armada', 'uma', 'Armada', 'armadas', 'armada', '#8cc6dc', 'sky', 'Navios de guerra levam marechais longe.'],
      ['legiao', 'uma', 'Legião', 'legiões', 'legion', '#f4a882', 'roof', 'Mil escudos em marcha formam armadas.'],
      ['conquistador', 'um', 'Conquistador', 'conquistadores', 'conqueror', '#ffd45e', 'gold', 'Onde ele pisa, novas legiões se erguem.'],
      ['lenda', 'uma', 'Lenda', 'lendas', 'legend', '#ff9a4a', 'ember', 'Um herói cujo nome cria conquistadores.'],
    ],
  },
  {
    id: 'alquimia', name: 'Alquimia', res: 'ervas', icon: 'herb', scene: 'garden', sceneLabel: 'A horta de ervas',
    unlock: [{ res: 'trigo', amount: 2500 }, { res: 'armas', amount: 150 }],
    blurb: 'Herboristas colhem as ervas que curam os feridos.',
    t1: [4, 5, 12, 1.07], t2: [7, 180, 12],
    tiers: [
      ['herborista', 'um', 'Herborista', 'herboristas', 'herbalist', '#94c874', 'herb', 'Conhece cada folha e a erva de cada mal.'],
      ['botica', 'uma', 'Botica', 'boticas', 'botica', '#b9a2e0', 'lavender', 'Entre frascos, forma novos herboristas.'],
      ['mosteiro', 'um', 'Mosteiro', 'mosteiros', 'monastery', '#cbbea9', 'stone', 'Monges estudam as ervas e abrem boticas.'],
      ['destilaria', 'uma', 'Destilaria', 'destilarias', 'distillery', '#e07a52', 'copper', 'O alambique de cobre sustenta mosteiros.'],
      ['alquimista', 'um', 'Alquimista', 'alquimistas', 'alchemist', '#8cc6dc', 'sky', 'O alquimista monta novas destilarias.'],
      ['laboratorio', 'um', 'Laboratório', 'laboratórios', 'laboratory', '#62a6c2', 'water', 'Fornos e retortas que formam alquimistas.'],
      ['biblioteca', 'uma', 'Biblioteca', 'bibliotecas', 'library', '#d4a070', 'earth', 'Livros antigos guiam novos laboratórios.'],
      ['sabio', 'um', 'Sábio', 'sábios', 'sage', '#f8dc7a', 'gold', 'O sábio copia tomos e funda bibliotecas.'],
      ['observatorio', 'um', 'Observatório', 'observatórios', 'observatory', '#8fb8f0', 'cape', 'Lê as estrelas e atrai novos sábios.'],
      ['academia', 'uma', 'Academia', 'academias', 'academy', '#c3cbd6', 'steel', 'Mestres e alunos erguem observatórios.'],
      ['arquimago', 'um', 'Arquimago', 'arquimagos', 'archmage', '#c890e0', 'royal', 'O arquimago funda academias pelo reino.'],
      ['torrearcana', 'uma', 'Torre arcana', 'torres arcanas', 'arcanetower', '#b9a2e0', 'lavender', 'No topo da torre, nascem arquimagos.'],
      ['pedra', 'uma', 'Pedra filosofal', 'pedras filosofais', 'philstone', '#f4a882', 'roof', 'Transforma chumbo em ouro e ergue torres.'],
      ['elixir', 'um', 'Elixir da vida', 'elixires da vida', 'elixir', '#7ad4b0', 'mint', 'Uma gota dá vida a novas pedras filosofais.'],
      ['grandeobra', 'uma', 'Grande Obra', 'Grandes Obras', 'magnumopus', '#ffd45e', 'gold', 'O segredo final da alquimia, feito luz.'],
    ],
  },
  {
    id: 'minerios', name: 'Minérios', res: 'minerio', icon: 'ore', scene: 'mine', sceneLabel: 'A mina na encosta',
    unlock: [{ res: 'trigo', amount: 25e3 }, { res: 'armas', amount: 2000 }],
    blurb: 'Mineiros arrancam da rocha o ferro e o ouro.',
    t1: [3, 4, 12, 1.07], t2: [7, 160, 10],
    tiers: [
      ['mineiro', 'um', 'Mineiro', 'mineiros', 'miner', '#d9a066', 'copper', 'Picareta na mão, tira minério da rocha.'],
      ['mina', 'uma', 'Mina', 'minas', 'mine', '#cbbea9', 'stone', 'Túneis escuros que chamam mais mineiros.'],
      ['pedreira', 'uma', 'Pedreira', 'pedreiras', 'quarry', '#d4a070', 'earth', 'Blocos de pedra que abrem novas minas.'],
      ['fundicao', 'uma', 'Fundição', 'fundições', 'smelter', '#ff9a4a', 'ember', 'O forno derrete o minério e paga pedreiras.'],
      ['capataz', 'um', 'Capataz', 'capatazes', 'foreman', '#f8dc7a', 'gold', 'O capataz põe as fundições para rodar.'],
      ['poco', 'um', 'Poço', 'poços', 'shaft', '#a3a5ac', 'steel', 'O poço desce fundo e forma capatazes.'],
      ['ourives', 'um', 'Ourives', 'ourives', 'goldsmith', '#ffd45e', 'gold', 'O ouro do ourives financia novos poços.'],
      ['casadamoeda', 'uma', 'Casa da moeda', 'casas da moeda', 'mint', '#e8b878', 'wheat', 'Cunha moedas e contrata ourives.'],
      ['guilda', 'uma', 'Guilda', 'guildas', 'guild', '#c890e0', 'royal', 'A guilda dos mineiros abre casas da moeda.'],
      ['veio', 'um', 'Veio de ouro', 'veios de ouro', 'goldvein', '#ffd45e', 'gold', 'Um filão tão rico que funda guildas.'],
      ['salao', 'um', 'Salão da montanha', 'salões da montanha', 'mountainhall', '#cbbea9', 'stone', 'Um salão escavado na rocha, cheio de veios.'],
      ['lapidario', 'um', 'Lapidário', 'lapidários', 'gemcutter', '#7ad4b0', 'mint', 'Lapida gemas que pagam salões de pedra.'],
      ['tesouraria', 'uma', 'Tesouraria', 'tesourarias', 'treasury', '#f8dc7a', 'gold', 'Cofres cheios que contratam lapidários.'],
      ['banqueiro', 'um', 'Banqueiro', 'banqueiros', 'banker', '#94c874', 'herb', 'Empresta ouro e abre novas tesourarias.'],
      ['coracao', 'um', 'Coração da montanha', 'corações da montanha', 'mountainheart', '#62d4e0', 'crystal', 'Um cristal vivo no fundo da montanha.'],
    ],
  },
  {
    id: 'exploracao', name: 'Exploração', res: 'terras', icon: 'map', scene: 'frontier', sceneLabel: 'A fronteira selvagem',
    unlock: [{ res: 'trigo', amount: 250e3 }, { res: 'ervas', amount: 5000 }, { res: 'minerio', amount: 1000 }],
    blurb: 'Batedores abrem caminho por terras sem dono.',
    t1: [4, 5, 15, 1.07], t2: [8, 200, 10],
    tiers: [
      ['batedor', 'um', 'Batedor', 'batedores', 'scout', '#94c874', 'herb', 'Percorre a mata e marca terras novas.'],
      ['acampamento', 'um', 'Acampamento', 'acampamentos', 'camp', '#d4a070', 'earth', 'Fogueira e barracas que reúnem batedores.'],
      ['cartografo', 'um', 'Cartógrafo', 'cartógrafos', 'cartographer', '#f4d478', 'wheat', 'Desenha mapas e planeja acampamentos.'],
      ['posto', 'um', 'Posto avançado', 'postos avançados', 'outpost', '#e07a52', 'roof', 'Uma paliçada na fronteira, cheia de mapas.'],
      ['caravana', 'uma', 'Caravana', 'caravanas', 'caravan', '#f8dc7a', 'gold', 'Carroças e mulas que montam postos.'],
      ['desbravador', 'um', 'Desbravador', 'desbravadores', 'pathfinder', '#a3d466', 'grass', 'Abre trilhas na mata para as caravanas.'],
      ['estrada', 'uma', 'Estrada', 'estradas', 'road', '#cbbea9', 'stone', 'Pedra sobre pedra, chama desbravadores.'],
      ['porto', 'um', 'Porto', 'portos', 'harbor', '#62a6c2', 'water', 'Cais de madeira de onde partem estradas.'],
      ['navio', 'um', 'Navio', 'navios', 'ship', '#8cc6dc', 'sky', 'Velas ao vento, leva colonos a novos portos.'],
      ['navegador', 'um', 'Navegador', 'navegadores', 'navigator', '#8fb8f0', 'cape', 'Lê o céu e conduz navios por mares novos.'],
      ['expedicao', 'uma', 'Expedição', 'expedições', 'expedition', '#ff9a4a', 'ember', 'Uma grande viagem que forma navegadores.'],
      ['farol', 'um', 'Farol', 'faróis', 'lighthouse', '#ffd45e', 'gold', 'Sua luz guia expedições pela costa.'],
      ['colonia', 'uma', 'Colônia', 'colônias', 'colony', '#94c874', 'herb', 'Uma vila além-mar que constrói faróis.'],
      ['descobridor', 'um', 'Descobridor', 'descobridores', 'discoverer', '#c890e0', 'royal', 'Seu nome batiza terras e funda colônias.'],
      ['novomundo', 'um', 'Novo Mundo', 'Novos Mundos', 'newworld', '#7ad4b0', 'mint', 'Um continente inteiro esperando por você.'],
    ],
  },
];

// ciclo (s) de cada tier, do 3 ao 15
const CYCLES = { 3: 9, 4: 12, 5: 15, 6: 18, 7: 21, 8: 24, 9: 27, 10: 30, 11: 36, 12: 42, 13: 48, 14: 54, 15: 60 };
const roundPrice = (n) => Number(n.toPrecision(2));

const RES_LABEL = {
  trigo: { one: 'trigo', many: 'trigo', icon: 'wheat' },
  armas: { one: 'arma', many: 'armas', icon: 'sword' },
  ervas: { one: 'erva', many: 'ervas', icon: 'herb' },
  minerio: { one: 'minério', many: 'minérios', icon: 'ore' },
  terras: { one: 'terra', many: 'terras', icon: 'map' },
};

const GENERATORS = [];
for (const line of LINES) {
  line.gens = line.tiers.map((row) => row[0]);
  line.tiers.forEach(([id, a, name, many, portrait, accent, stripes, blurb], i) => {
    const tier = i + 1;
    const gen = { id, a, line: line.id, name, tier, portrait, accent, stripes: '--bar-' + stripes, blurb, amount: 1 };
    if (tier === 1) {
      const [amount, cycle, base, growth] = line.t1;
      Object.assign(gen, { makes: line.res, amount, cycle, costs: [{ res: line.res, base, growth }] });
    } else {
      const [cycle2, base2, need2] = line.t2;
      const below = line.gens[i - 1];
      Object.assign(gen, {
        makes: below,
        cycle: tier === 2 ? cycle2 : CYCLES[tier],
        costs: [
          { res: line.res, base: roundPrice(base2 * 40 ** (tier - 2)), growth: 1.15 },
          { res: below, base: tier === 2 ? need2 : 5 * tier, growth: 1 },
        ],
      });
    }
    GENERATORS.push(gen);
    RES_LABEL[id] = { one: name.toLowerCase(), many, icon: portrait };
  });
}

const GEN = Object.fromEntries(GENERATORS.map((g) => [g.id, g]));
const LINE = Object.fromEntries(LINES.map((l) => [l.id, l]));

// Começo do jogo: nenhum gerador, só o trigo exato para comprar o primeiro camponês.
function freshState() {
  const gens = {};
  for (const gen of GENERATORS) {
    const starter = gen.line === LINES[0].id && gen.tier === 1;
    // ms: marcos já alcançados; spd, pow, cut: níveis das melhorias
    gens[gen.id] = { count: Big.ZERO, bought: 0, progress: 0, made: Big.ZERO, seen: starter, ms: 0, spd: 0, pow: 0, cut: 0 };
  }
  const res = {};
  const lines = {};
  for (const line of LINES) {
    res[line.res] = Big.ZERO;
    lines[line.id] = line.unlock.length === 0;
  }
  const first = GEN[LINES[0].gens[0]];
  res[LINES[0].res] = Big.from(first.costs[0].base);
  return { res, gens, lines, coroas: 0, mode: '1', line: LINES[0].id, view: 'gens' };
}

let state = freshState();

// ---------------------------------------------------------------------------
// Recursos e números. Estoques, contagens e preços são Big (big.js), para
// passar do limite do double; só "bought" e o progresso do ciclo são números
// comuns.

function getRes(id) {
  return id in state.res ? state.res[id] : state.gens[id].count;
}

function addRes(id, n) {
  if (id in state.res) state.res[id] = state.res[id].add(n);
  else state.gens[id].count = state.gens[id].count.add(n);
}

// Sufixos do milhar. Depois do decilhão (Dc) vêm letras maiúsculas, como em
// outros jogos idle: AA, AB... ZZ, depois AAA... ZZZ, AAAA, e assim por diante.
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
function suffix(i) {
  if (i < SUFFIXES.length) return SUFFIXES[i];
  let j = i - SUFFIXES.length;
  let len = 2;
  let span = 26 * 26;
  while (j >= span) { j -= span; len++; span *= 26; }
  let out = '';
  for (let k = 0; k < len; k++) {
    out = String.fromCharCode(65 + (j % 26)) + out;
    j = Math.floor(j / 26);
  }
  return out;
}

// 3 dígitos e o sufixo do milhar: 1,23K, 45,6M, 789AB. Quando nem o expoente
// cabe num número comum (as camadas do big.js), mostra "e" e o expoente:
// e1,50B é 10 elevado a 1,5 bilhão, ee1,50B é 10 elevado a isso.
function fmt(n) {
  n = Big.from(n);
  if (n.lt(1000)) return Math.floor(n.toNumber() + 1e-9).toLocaleString('pt-BR');
  if (n.layer > 3) return '(e^' + n.layer.toLocaleString('pt-BR') + ')' + fmt(n.mag); // torre alta demais
  if (n.layer > 0) return 'e' + fmt(n.log10Big());
  const [m, e] = n.parts();
  let i = Math.floor(e / 3);
  let v = m * 10 ** (e - 3 * i);
  if (v >= 999.5) { v /= 1000; i += 1; }
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0;
  return v.toFixed(digits).replace('.', ',') + suffix(i);
}

function fmtRate(n) {
  n = Big.from(n);
  if (n.isZero()) return '0';
  if (n.lt(10)) return n.toNumber().toFixed(1).replace('.', ',');
  return fmt(n);
}

function fmtTime(sec) {
  if (!(sec < 1000 * 86400)) return 'mais de 1.000 dias';
  sec = Math.ceil(sec);
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'min ' + String(sec % 60).padStart(2, '0') + 's';
  if (sec < 86400) return Math.floor(sec / 3600) + 'h ' + String(Math.floor((sec % 3600) / 60)).padStart(2, '0') + 'min';
  return Math.floor(sec / 86400) + 'd ' + String(Math.floor((sec % 86400) / 3600)).padStart(2, '0') + 'h';
}

// duração de um ciclo: 3,0s, 0,38s, ou menos de 0,01s com muito ritmo
function fmtCycle(sec) {
  if (sec < 0.01) return '<0,01s';
  return sec.toFixed(sec < 1 ? 2 : 1).replace('.', ',') + 's';
}

function plural(id, n) {
  return Big.from(n).eq(1) ? RES_LABEL[id].one : RES_LABEL[id].many;
}

// ---------------------------------------------------------------------------
// Custos: crescem geometricamente a cada unidade comprada.

// n unidades a partir da compra número b: base · g^b · (g^n − 1) / (g − 1),
// vezes o desconto das melhorias
function costFor(gen, n) {
  const b = state.gens[gen.id].bought;
  const d = priceMul(gen);
  return gen.costs.map((c) => ({
    res: c.res,
    amount: c.growth === 1
      ? Big.from(Math.ceil(c.base * n * d))
      : Big.pow(c.growth, b).mul(c.base * d).mul(Big.pow(c.growth, n).sub(1)).div(c.growth - 1).ceil(),
  }));
}

function canAfford(cost) {
  return cost.every((c) => getRes(c.res).gte(c.amount));
}

function maxAffordable(gen) {
  const b = state.gens[gen.id].bought;
  const d = priceMul(gen);
  let best = Infinity;
  for (const c of gen.costs) {
    const have = getRes(c.res);
    let n;
    if (c.growth === 1) n = Math.floor(have.div(c.base * d).toNumber());
    else {
      const x = have.mul(c.growth - 1).div(Big.pow(c.growth, b).mul(c.base * d));
      n = Math.floor(x.add(1).log10() / Math.log10(c.growth));
    }
    best = Math.min(best, n);
  }
  // "bought" é um número comum: com saldos astronômicos, compra no máximo isto de uma vez
  best = Math.min(best, Number.MAX_SAFE_INTEGER);
  // o arredondamento dos custos pode passar do saldo por 1 unidade
  for (let tries = 0; best > 0 && !canAfford(costFor(gen, best)); tries++) {
    best = tries < 3 ? best - 1 : Math.floor(best * 0.99);
  }
  return Math.max(0, best);
}

// Quanto falta para poder pagar, pelo ritmo de produção atual.
function timeToAfford(cost) {
  let worst = 0;
  for (const c of cost) {
    const missing = Big.from(c.amount).sub(getRes(c.res));
    if (missing.sign <= 0) continue;
    const rate = ratePerSecond(c.res);
    if (rate.sign <= 0) return { never: c.res };
    worst = Math.max(worst, missing.div(rate).toNumber());
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
  for (const c of cost) addRes(c.res, c.amount.neg());
  state.gens[gen.id].count = state.gens[gen.id].count.add(n);
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
// Marcos e melhorias, como no Adventure Communist. Cada gerador dá coroas
// quando a quantidade dele chega a 10, 100, 1.000... (o marco k, de 10^k
// unidades, vale k × tier coroas), e as coroas compram melhorias para cada
// gerador: ritmo (ciclo pela metade), fartura (produção em dobro) e desconto
// (preço 20% menor). Os efeitos se acumulam a cada nível.

const UPGRADES = [
  { key: 'spd', name: 'Ritmo', icon: 'hourglass', base: 4, growth: 4 },
  { key: 'pow', name: 'Fartura', icon: 'sack', base: 3, growth: 3 },
  { key: 'cut', name: 'Desconto', icon: 'tag', base: 2, growth: 3 },
];
const DISCOUNT = 0.8;

const cycleOf = (gen) => gen.cycle / 2 ** state.gens[gen.id].spd;
const amountOf = (gen) => gen.amount * 2 ** state.gens[gen.id].pow;
const priceMul = (gen) => DISCOUNT ** state.gens[gen.id].cut;

const milestoneAt = (k) => Big.fromLog10(k);
const milestoneReward = (gen, k) => k * gen.tier;

function upgradeCost(gen, u) {
  return Math.round(u.base * gen.tier * u.growth ** state.gens[gen.id][u.key]);
}

// O que o próximo nível faz, em poucas palavras
function upgradeEffect(gen, u) {
  const lv = state.gens[gen.id][u.key] + 1;
  if (u.key === 'spd') return 'Ciclo ÷' + fmt(2 ** lv);
  if (u.key === 'pow') return 'Produção ×' + fmt(2 ** lv);
  return 'Preço −' + Math.round((1 - DISCOUNT ** lv) * 100) + '%';
}

function buyUpgrade(gen, u) {
  const g = state.gens[gen.id];
  const cost = upgradeCost(gen, u);
  if (!g.seen || state.coroas < cost) return false;
  state.coroas -= cost;
  g[u.key] += 1;
  return true;
}

// Confere os marcos de todos os geradores e paga as coroas. Devolve o que foi
// alcançado agora (vários de uma vez depois de um tempo fora).
function checkMilestones() {
  const got = [];
  for (const gen of GENERATORS) {
    const g = state.gens[gen.id];
    for (let guard = 0; guard < 1000 && g.count.gte(milestoneAt(g.ms + 1)); guard++) {
      g.ms += 1;
      const reward = milestoneReward(gen, g.ms);
      state.coroas += reward;
      got.push({ gen, k: g.ms, reward });
    }
  }
  return got;
}

// ---------------------------------------------------------------------------
// Simulação: todas as linhas andam juntas, mesmo as que não estão na tela.

function step(dt, onCycle) {
  for (const gen of GENERATORS) {
    const g = state.gens[gen.id];
    if (g.count.sign <= 0) { g.progress = 0; continue; }
    g.progress += dt / cycleOf(gen);
    if (g.progress >= 1) {
      const cycles = Math.floor(g.progress);
      g.progress -= cycles;
      const made = g.count.mul(cycles * amountOf(gen));
      addRes(gen.makes, made);
      g.made = g.made.add(made);
      if (onCycle) onCycle(gen, made);
    }
  }
}

// Passa um tempo de uma vez, sem animação. Passos de 1s (no máximo 20 mil
// passos, para não travar a tela depois de muito tempo fora).
function simulateSilently(seconds, cap = OFFLINE_CAP) {
  let left = Math.min(seconds, cap);
  const size = Math.max(1, left / 20000);
  while (left > 0) {
    const dt = Math.min(size, left);
    step(dt);
    left -= dt;
  }
}

// Relógio da simulação: o jogo anda pelo tempo real, não pelos quadros. Com a
// aba em segundo plano ou a janela coberta, o navegador para de desenhar e
// segura os timers; o timer de keepUp (que pode atrasar até um minuto) passa o
// tempo que faltou, sem limite, porque o jogo continua aberto.
let simClock = 0;

function keepUp() {
  const now = performance.now();
  if (now - simClock < 500) return; // os quadros estão rodando
  simulateSilently((now - simClock) / 1000, Infinity);
  simClock = now;
}

function ratePerSecond(resId) {
  let r = Big.ZERO;
  for (const gen of GENERATORS) {
    if (gen.makes === resId) r = r.add(state.gens[gen.id].count.mul(amountOf(gen) / cycleOf(gen)));
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
  if (simClock) keepUp(); // o save guarda o estado de agora, não o do último quadro
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
      const g = { ...base.gens[id], ...savedGens[id] };
      g.count = Big.from(g.count);
      g.made = Big.from(g.made);
      if (!savedGens[id] || savedGens[id].seen === undefined) g.seen = g.count.sign > 0 || g.bought > 0;
      gens[id] = g;
    }
    const res = { ...base.res };
    for (const id in res) if (saved.res && id in saved.res) res[id] = Big.from(saved.res[id]);
    if (typeof saved.trigo === 'number') res.trigo = Big.from(saved.trigo); // save da versão só com trigo
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
      coroas: typeof saved.coroas === 'number' ? saved.coroas : 0,
      mode: ['1', '10', 'max'].includes(saved.mode) ? saved.mode : '1',
      line: LINE[saved.line] ? saved.line : base.line,
      view: saved.view === 'upg' ? 'upg' : 'gens',
    };
    return Math.max(0, (Date.now() - (data.savedAt || Date.now())) / 1000);
  } catch (_) {
    state = freshState();
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Interface

const ui = { cards: {}, tabs: {}, panels: {}, scenes: {}, lineLocks: {}, chains: {}, upgs: {} };

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
  const makes = el('span', 'tier-makes');
  makes.append('· produz', ART.iconCanvas(RES_LABEL[gen.makes].icon, 2), RES_LABEL[gen.makes].many);
  tier.append(el('span', null, `Tier ${gen.tier}`), makes);
  const name = el('h2', 'gen-name', gen.name);
  head.append(name, tier, count);
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

  // barra do próximo marco: quantos já tem, a meta e as coroas que ela dá
  const mbar = el('div', 'bar mbar fr fr-slot');
  const markFill = el('div', 'fill mark-fill');
  const markText = el('span', 'bar-text');
  const markProg = el('span');
  // no celular só "Marco:", para os números grandes caberem
  markText.append(el('span', 'mark-long', 'Próximo marco: '), el('span', 'mark-short', 'Marco: '), markProg);
  const markReward = el('span', 'bar-time mark-reward');
  const markNum = el('span');
  markReward.append('+', markNum, ART.iconCanvas('crown', 2));
  mbar.append(markFill, markText, markReward);
  main.append(head, desc, stats, bar, mbar);

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
    card, portrait: pic.frame, canvas: pic.canvas, ctx: pic.ctx, head, name, tier, count, countLen: 0, desc, fill, bar, barText, barTime,
    perCycle: perCycle.value, cycle: cycle.value, perSec: perSec.value, total: total.value,
    markProg, markReward, markNum, markFill, markP: -1,
    btn, btnLabel, chips, note, owned, gen, lastP: -1, sealed: null, onScreen: true,
  };
  return card;
}

// O cabeçalho do cartão (nome, tier e quantidade) fica numa linha só, para
// todos os cartões terem a mesma altura. Quando não cabe, some o "produz ..." e,
// se ainda faltar espaço, o nome fica menor.
function fitHead(c) {
  if (!c.head.clientWidth) return; // escondido: mede quando aparecer
  setClass(c.head, 'tight', false);
  setClass(c.head, 'long', false);
  const over = () => c.name.scrollWidth > c.name.clientWidth + 1 || c.tier.scrollWidth > c.tier.clientWidth + 1;
  if (!over()) return;
  setClass(c.head, 'tight', true);
  if (over()) setClass(c.head, 'long', true);
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
    setText(c.markProg, '?');
    c.markReward.hidden = true;
    c.markFill.style.clipPath = 'inset(0 100% 0 0)';
    c.markP = -1;
    setText(c.barText, 'Bloqueado');
    setText(c.barTime, '');
    setClass(c.card, 'working', false);
    c.fill.style.clipPath = 'inset(0 100% 0 0)';
    c.lastP = -1;
  } else {
    setText(c.desc, gen.blurb);
    c.markReward.hidden = false;
    if (wasSealed) replay(c.portrait, 'reveal');
  }
}

function buildLink() {
  const link = el('div', 'link');
  const text = el('span');
  link.append(ART.iconCanvas('arrow', 2), text);
  link.text = text;
  return link;
}

// "Cada moinho gera 1 camponês a cada 6s", já com as melhorias
function linkText(gen) {
  const n = amountOf(gen);
  return `Cada ${gen.name.toLowerCase()} gera ${fmt(n)} ${plural(gen.makes, n)} a cada ${fmtCycle(cycleOf(gen))}`;
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
// geradores.
function buildPanel(line) {
  const panel = el('section', 'gens');
  panel.id = 'gens-' + line.id;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-label', 'Geradores: ' + line.name);
  panel.append(buildLineLock(line));
  const chain = el('div', 'chain');
  const rows = line.gens.map((id, i) => {
    const gen = GEN[id];
    const link = i > 0 ? buildLink() : null;
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
  panel.append(chain, buildUpgrades(line));
  ui.chains[line.id] = { node: chain, rows, teaser, teaserText, shown: -1, linkVer: -1 };
  return panel;
}

// ---------------------------------------------------------------------------
// Melhorias: uma fileira por gerador já descoberto, com os três tipos.

let upgradeVersion = 0; // muda a cada melhoria comprada, para refazer os textos

// Nome comprido que não cabe na linha fica menor, como no cabeçalho dos cartões.
function fitUpgName(name) {
  if (!name.clientWidth) return; // escondido: mede quando aparecer
  setClass(name, 'long', false);
  if (name.scrollWidth > name.clientWidth + 1) setClass(name, 'long', true);
}
let upgNames = null;

function buildUpgrades(line) {
  const box = el('div', 'upgs');
  box.append(el('p', 'upg-intro', 'Cada gerador dá coroas ao chegar em 10, 100, 1.000 unidades e assim por diante.'));
  const rows = line.gens.map((id) => {
    const gen = GEN[id];
    const row = el('article', 'upg-row fr fr-wood');
    row.style.setProperty('--accent', gen.accent);
    const who = el('div', 'upg-who');
    const pic = el('span', 'upg-pic fr fr-gold');
    pic.append(ART.iconCanvas(gen.portrait, 3));
    const names = el('div', 'upg-names');
    const sub = el('span', 'upg-sub');
    const name = el('h3', 'upg-name', gen.name);
    names.append(name, sub);
    upgNames = upgNames || new ResizeObserver((entries) => { for (const e of entries) fitUpgName(e.target); });
    upgNames.observe(name);
    who.append(pic, names);
    row.append(who);
    const btns = UPGRADES.map((u) => {
      const btn = el('button', 'btn buy upg-btn');
      btn.type = 'button';
      const txt = el('span', 'upg-txt');
      const lv = el('span', 'upg-lv');
      const eff = el('span', 'upg-eff');
      const head = el('span', 'upg-head');
      head.append(el('b', null, u.name), lv);
      txt.append(head, eff);
      const chip = el('span', 'cost-chip');
      const num = el('span', 'cost-num');
      chip.append(ART.iconCanvas('crown', 2), num);
      btn.append(ART.iconCanvas(u.icon, 3), txt, chip);
      SFX.bind(btn, 'press');
      btn.addEventListener('click', () => {
        if (buyUpgrade(gen, u)) {
          btn.sfxResult = 'coin';
          upgradeVersion += 1;
          replay(btn, 'pulse');
          renderNow();
        } else {
          btn.sfxResult = 'thud';
          replay(btn, 'nope');
        }
      });
      row.append(btn);
      return { u, btn, lv, eff, num, chip };
    });
    box.append(row);
    return { gen, row, sub, btns };
  });
  const teaser = el('div', 'teaser');
  const teaserText = el('span');
  teaser.append(ART.iconCanvas('lock', 2), teaserText);
  box.append(teaser);
  ui.upgs[line.id] = { node: box, rows, teaser, teaserText, shown: -1 };
  return box;
}

function renderUpgrades(line) {
  const up = ui.upgs[line.id];
  const shown = line.gens.filter((id) => state.gens[id].seen).length;
  if (up.shown !== shown) {
    up.shown = shown;
    up.rows.forEach((r) => { r.row.hidden = !state.gens[r.gen.id].seen; });
    const rest = line.gens.length - shown;
    up.teaser.hidden = rest <= 0;
    setText(up.teaserText, rest === 1 ? 'Descubra mais 1 gerador para novas melhorias' : `Descubra mais ${rest} geradores para novas melhorias`);
  }
  for (const r of up.rows) {
    if (r.row.hidden) continue;
    const g = state.gens[r.gen.id];
    setText(r.sub, `Tier ${r.gen.tier} · ${g.ms === 1 ? '1 marco' : g.ms + ' marcos'}`);
    for (const b of r.btns) {
      const cost = upgradeCost(r.gen, b.u);
      const ok = state.coroas >= cost;
      setOk(b.btn, ok);
      setText(b.lv, 'nível ' + g[b.u.key]);
      setText(b.eff, upgradeEffect(r.gen, b.u));
      setText(b.num, fmt(cost));
      setClass(b.chip, 'short', !ok);
    }
  }
}

// quantas melhorias dá para comprar agora na linha
function upgradesReady(line) {
  let n = 0;
  for (const id of line.gens) {
    if (!state.gens[id].seen) continue;
    for (const u of UPGRADES) if (state.coroas >= upgradeCost(GEN[id], u)) n += 1;
  }
  return n;
}

function setView(view) {
  state.view = view;
  document.body.dataset.view = view;
  for (const b of ui.viewBtns) {
    const on = b.dataset.view === view;
    b.setAttribute('aria-selected', String(on));
    setClass(b, 'active', on);
  }
  renderNow();
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
  if (ch.linkVer !== upgradeVersion) {
    ch.linkVer = upgradeVersion;
    for (const r of ch.rows) if (r.link) setText(r.link.text, linkText(GEN[r.card.dataset.gen]));
  }
  const shown = visibleCount(line);
  if (ch.shown === shown) return;
  ch.shown = shown;
  ch.rows.forEach((r, i) => {
    r.card.hidden = i >= shown;
    if (r.link) r.link.hidden = i >= shown;
  });
  const rest = line.gens.length - shown;
  ch.teaser.hidden = rest <= 0;
  setText(ch.teaserText, rest === 1 ? 'Mais 1 gerador por descobrir' : `Mais ${rest} geradores por descobrir`);
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
  // linha fechada: o recurso que ainda falta para abrir, com ícone
  const need = el('span', 'tab-need');
  const needNum = el('span');
  need.append('Falta', el('span'), needNum);
  tab.append(icon, name, num, rate, need);
  SFX.bind(tab, 'tab');
  tab.addEventListener('click', () => setLine(line.id));
  ui.tabs[line.id] = { tab, num, rate, need, needNum, needRes: null };
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

function onMilestones(got) {
  SFX.play('coin');
  replay(ui.crowns, 'pulse');
  toast(milestoneText(got));
}

function milestoneText(got) {
  const total = got.reduce((t, m) => t + m.reward, 0);
  const coins = `+${fmt(total)} ${total === 1 ? 'coroa' : 'coroas'}`;
  if (got.length > 1) return `${got.length} marcos alcançados! ${coins}`;
  const { gen, k } = got[0];
  return `Marco: ${fmt(milestoneAt(k))} ${plural(gen.id, 2)}! ${coins}`;
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
    t.need.hidden = open || t.need.hidden;
    if (open) {
      setText(t.num, fmt(state.res[line.res]));
      setText(t.rate, RES_LABEL[line.res].many + ' +' + fmtRate(ratePerSecond(line.res)) + '/s');
    } else {
      setText(t.num, 'Fechada');
      const miss = line.unlock.find((c) => getRes(c.res).lt(c.amount));
      setText(t.rate, miss ? '' : 'Pronta para abrir');
      t.need.hidden = !miss;
      if (miss) {
        if (t.needRes !== miss.res) {
          t.needRes = miss.res;
          t.need.children[0].replaceWith(ART.iconCanvas(RES_LABEL[miss.res].icon, 2));
        }
        setText(t.needNum, fmt(miss.amount));
      }
    }
  }
}

function renderLineLock(line) {
  const lock = ui.lineLocks[line.id];
  const ok = canAfford(line.unlock);
  setOk(lock.btn, ok);
  line.unlock.forEach((c, i) => setClass(lock.chips[i].chip, 'short', getRes(c.res).lt(c.amount)));
  setText(lock.note, ok ? 'Pronto para abrir' : etaText(line.unlock, 'Dá para abrir'));
  setClass(lock.note, 'ready', ok);
}

function renderCard(c) {
  const gen = c.gen;
  const g = state.gens[gen.id];
  applySeal(c);
  setText(c.count, '×' + fmt(g.count));
  if (c.count._text.length !== c.countLen) { // número mais comprido: confere se o cabeçalho ainda cabe
    c.countLen = c.count._text.length;
    fitHead(c);
  }

  if (c.sealed) {
    const cost = costFor(gen, 1);
    setOk(c.btn, false);
    setText(c.btnLabel, 'Bloqueado');
    cost.forEach((k, i) => {
      setText(c.chips[i].num, fmt(k.amount));
      setClass(c.chips[i].chip, 'short', getRes(k.res).lt(k.amount));
    });
    setText(c.note, etaText(cost, 'Aparece'));
    setClass(c.note, 'ready', false);
    setText(c.owned, '');
    return;
  }

  const working = g.count.sign > 0;
  setClass(c.card, 'working', working);

  // barra contínua: um valor novo a cada quadro, sem arredondar em degraus
  const p = !working ? 0 : cycleOf(gen) < 0.15 ? 1 : g.progress;
  if (p !== c.lastP) {
    c.lastP = p;
    c.fill.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(3)}% 0 0)`;
  }
  const cyc = cycleOf(gen);
  const per = g.count.mul(amountOf(gen));
  const steady = cyc < 0.15; // rápido demais para a barra acompanhar: fica cheia
  setText(c.barText, !working ? `Parado: compre ${gen.a} ${gen.name.toLowerCase()} para começar` : steady ? 'Produção contínua' : 'Ciclo em andamento');
  setText(c.barTime, working && !steady ? 'faltam ' + ((1 - g.progress) * cyc).toFixed(1).replace('.', ',') + 's' : '');
  setText(c.perCycle, '+' + fmt(per));
  setText(c.cycle, fmtCycle(cyc));
  setText(c.perSec, fmtRate(per.div(cyc)) + '/s');
  setText(c.total, fmt(g.made));
  const goal = milestoneAt(g.ms + 1);
  setText(c.markProg, `${fmt(g.count)} / ${fmt(goal)}`);
  setText(c.markNum, fmt(milestoneReward(gen, g.ms + 1)));
  const mp = Math.min(1, g.count.div(goal).toNumber());
  if (mp !== c.markP) {
    c.markP = mp;
    c.markFill.style.clipPath = `inset(0 ${((1 - mp) * 100).toFixed(3)}% 0 0)`;
  }

  const n = buyAmount(gen);
  const cost = costFor(gen, n);
  const ok = canAfford(cost);
  setOk(c.btn, ok);
  setText(c.btnLabel, 'Comprar ×' + fmt(n));
  cost.forEach((k, i) => {
    setText(c.chips[i].num, fmt(k.amount));
    setClass(c.chips[i].chip, 'short', getRes(k.res).lt(k.amount));
  });
  setText(c.note, ok ? 'Pronto para comprar' : etaText(cost, 'Dá para comprar'));
  setClass(c.note, 'ready', ok);
  setText(c.owned, fmt(g.bought) + (g.bought === 1 ? ' comprado' : ' comprados') + ' por você');
}

function renderNow() {
  renderTabs();
  setText(ui.crownNum, fmt(Math.floor(state.coroas)));
  setText(ui.crownLabel, Math.floor(state.coroas) === 1 ? 'coroa' : 'coroas');
  const line = LINE[state.line];
  const open = state.lines[line.id];
  const upg = state.view === 'upg';
  const ready = open ? upgradesReady(line) : 0;
  setText(ui.upgBadge, ready ? String(ready) : '');
  setClass(ui.upgBadge, 'on', ready > 0);
  ui.lineLocks[line.id].card.hidden = open;
  ui.chains[line.id].node.hidden = !open || upg;
  ui.upgs[line.id].node.hidden = !open || !upg;
  if (!open) return renderLineLock(line);
  if (upg) return renderUpgrades(line);
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
  const mills = state.gens.moinho.count.toNumber();
  if (mills > 0) millAngle += dt * (0.9 + Math.min(mills, 30) * 0.04);
  const line = LINE[state.line];
  const open = state.lines[line.id];
  const [t1, t2] = line.gens.map((id) => Math.min(1e6, state.gens[id].count.toNumber()));
  currentScene().paint(ui.sceneCtx, t, { t1, t2, angle: millAngle }, !open);
  if (!open) return;
  const info = { angle: millAngle, working: false };
  for (const id of line.gens) {
    if (!state.gens[id].seen) continue; // escondido: a silhueta já está desenhada
    if (!ui.cards[id].onScreen) continue; // fora da tela: não precisa animar
    info.working = state.gens[id].count.sign > 0;
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
  ui.crowns = document.getElementById('crowns');
  ui.crownNum = el('span', 'crown-num');
  ui.crownLabel = el('span', 'crown-label', 'coroas');
  ui.crowns.append(ART.iconCanvas('crown', 2), ui.crownNum, ui.crownLabel);
  ui.upgBadge = document.getElementById('upg-badge');
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
  // o cabeçalho é medido de novo quando o cartão muda de largura ou aparece
  const heads = new ResizeObserver((entries) => {
    for (const e of entries) fitHead(e.target.cardUi);
  });
  for (const c of Object.values(ui.cards)) {
    c.portrait.cardUi = c;
    c.head.cardUi = c;
    seen.observe(c.portrait);
    heads.observe(c.head);
  }

  // os números trocam de linha; setas andam entre as abas quando uma delas tem foco
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const n = Number(e.key);
    if (n >= 1 && n <= LINES.length) {
      if (LINES[n - 1].id !== state.line) SFX.play('tab');
      setLine(LINES[n - 1].id);
    } else if (e.target.classList && e.target.classList.contains('line-tab') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const i = LINES.findIndex((l) => l.id === state.line);
      const next = LINES[(i + (e.key === 'ArrowRight' ? 1 : LINES.length - 1)) % LINES.length];
      SFX.play('tab');
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
  ui.viewBtns = [...document.querySelectorAll('[data-view]')];
  ui.viewBtns.forEach((b) => {
    SFX.bind(b, 'tab');
    b.addEventListener('click', () => setView(b.dataset.view));
  });
  checkReveals();
  setLine(state.line);
  setMode(state.mode);
  setView(state.view);
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
      for (const id in ui.upgs) ui.upgs[id].shown = -1;
      upgradeVersion += 1;
      reset.dataset.armed = '';
      reset.textContent = 'Recomeçar';
      setLine(state.line);
      setMode('1');
      setView('gens');
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
    awayToast(before, checkMilestones());
  }

  simClock = performance.now();
  function frame(now) {
    const dt = Math.max(0, (now - simClock) / 1000);
    simClock = Math.max(simClock, now);
    if (dt > 1) simulateSilently(dt, Infinity); // voltou de um tempo sem quadros
    else step(dt, onCycle);
    checkReveals(onReveal);
    const got = checkMilestones();
    if (got.length) onMilestones(got);
    paintArt(now / 1000, dt);
    renderNow();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // sem quadros (aba em segundo plano), a produção continua por aqui
  setInterval(keepUp, 1000);
  setInterval(save, 5000);
  window.addEventListener('beforeunload', save);
  // ao voltar para a aba, mostra o que foi produzido enquanto ela estava escondida
  let hiddenAt = 0;
  let hiddenRes = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      save();
      hiddenAt = Date.now();
      hiddenRes = { ...state.res };
    } else if (hiddenRes) {
      keepUp();
      if (Date.now() - hiddenAt > 30e3) awayToast(hiddenRes, checkMilestones());
      hiddenRes = null;
    }
  });
}

function awayToast(before, got = []) {
  const parts = LINES
    .filter((l) => state.lines[l.id])
    .map((l) => [l.res, state.res[l.res].sub(before[l.res])])
    .filter(([, d]) => d.gte(1))
    .map(([res, d]) => '+' + fmt(d) + ' ' + plural(res, d.floor()));
  const coins = got.reduce((t, m) => t + m.reward, 0);
  if (coins) parts.push(`+${fmt(coins)} ${coins === 1 ? 'coroa' : 'coroas'} de marcos`);
  if (parts.length) toast('Enquanto você esteve fora: ' + parts.join(', ') + '.');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
