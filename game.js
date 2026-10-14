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
//
// Cartas, servos, missões e baús ficam em meta.js e meta-ui.js.

const SAVE_KEY = 'jogo-idle:v2';
const OLD_SAVE_KEYS = ['jogo-idle:trigo:v1'];
const OFFLINE_CAP = 8 * 3600; // segundos de progresso offline, no máximo

// As linhas de produção. Cada uma tem 15 tiers: o tier 1 produz o recurso da
// linha e cada tier acima produz unidades do tier de baixo.
//   make: [quanto o tier 1 produz por ciclo, ciclo do tier 1 (s)]. Cada tier
//         acima produz 1 a mais por ciclo e leva o dobro do tempo.
//   t1: [preço, crescimento do preço] do tier 1
//   t2: preço do tier 2; do tier 3 em diante o preço sobe 40x por tier
//   need: quantas unidades do tier de baixo cada tier pede, do tier 2 ao 15.
//         Sobe rápido no começo e depois em passos (pedido do usuário), com
//         um ritmo próprio em cada linha. Os primeiros de cada tier saem das
//         unidades compradas do tier de baixo (com preço que cresce a cada
//         compra), então os do topo ficam em umas poucas centenas.
const LINES = [
  {
    id: 'comida', name: 'Comida', res: 'trigo', icon: 'wheat', scene: 'farm', sceneLabel: 'O campo de trigo',
    unlock: [],
    blurb: 'Camponeses colhem o trigo que alimenta o feudo.',
    make: [3, 2], t1: [10, 1.07], t2: 150,
    need: [10, 25, 50, 100, 200, 250, 300, 325, 350, 375, 400, 425, 450, 500],
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
    make: [4, 3], t1: [10, 1.08], t2: 120,
    need: [8, 20, 40, 75, 120, 180, 240, 280, 320, 350, 380, 410, 440, 480],
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
    make: [5, 4], t1: [12, 1.07], t2: 180,
    need: [12, 30, 60, 100, 150, 200, 240, 280, 310, 340, 370, 400, 430, 460],
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
    make: [6, 5], t1: [12, 1.07], t2: 160,
    need: [10, 30, 60, 120, 180, 220, 260, 300, 330, 360, 390, 420, 450, 480],
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
    make: [7, 6], t1: [15, 1.07], t2: 200,
    need: [10, 20, 40, 80, 160, 220, 270, 310, 345, 380, 410, 440, 470, 500],
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

const roundPrice = (n) => Number(n.toPrecision(2));

const RES_LABEL = {
  trigo: { one: 'trigo', many: 'trigo', icon: 'wheat' },
  armas: { one: 'arma', many: 'armas', icon: 'sword' },
  ervas: { one: 'erva', many: 'ervas', icon: 'herb' },
  minerio: { one: 'minério', many: 'minérios', icon: 'ore' },
  terras: { one: 'terra', many: 'terras', icon: 'map' },
  servos: { one: 'servo', many: 'servos', icon: 'servo' },
};

const GENERATORS = [];
LINES.forEach((line, li) => {
  line.gens = line.tiers.map((row) => row[0]);
  line.tiers.forEach(([id, a, name, many, portrait, accent, stripes, blurb], i) => {
    const tier = i + 1;
    const [amount, cycle] = line.make;
    const gen = {
      id, a, line: line.id, name, tier, portrait, accent, tone: stripes, blurb,
      amount: amount + i, cycle: cycle * 2 ** i,
    };
    if (tier === 1) {
      const [base, growth] = line.t1;
      Object.assign(gen, { makes: line.res, costs: [{ res: line.res, base, growth }] });
    } else {
      const below = line.gens[i - 1];
      Object.assign(gen, {
        makes: below,
        costs: [
          { res: line.res, base: roundPrice(line.t2 * 40 ** (tier - 2)), growth: 1.15 },
          { res: below, base: line.need[tier - 2], growth: 1 },
        ],
      });
    }
    // todo gerador comprado custa servos: 1 na primeira linha, 2 na segunda...
    gen.costs.push({ res: 'servos', base: li + 1, growth: 1 });
    GENERATORS.push(gen);
    RES_LABEL[id] = { one: name.toLowerCase(), many, icon: portrait };
  });
});

const GEN = Object.fromEntries(GENERATORS.map((g) => [g.id, g]));
const LINE = Object.fromEntries(LINES.map((l) => [l.id, l]));

// Começo do jogo: nenhum gerador, só o trigo e o servo exatos para comprar o
// primeiro camponês. As cartas, missões e servos (meta.js) entram com freshMeta.
function freshState() {
  const gens = {};
  for (const gen of GENERATORS) {
    const starter = gen.line === LINES[0].id && gen.tier === 1;
    // ms: marcos já alcançados; pend: coroas desses marcos ainda por coletar
    gens[gen.id] = { count: Big.ZERO, bought: 0, progress: 0, made: Big.ZERO, seen: starter, ms: 0, pend: 0, pendN: 0 };
  }
  const res = {};
  const lines = {};
  for (const line of LINES) {
    res[line.res] = Big.ZERO;
    lines[line.id] = line.unlock.length === 0;
  }
  const first = GEN[LINES[0].gens[0]];
  res[LINES[0].res] = Big.from(first.costs[0].base);
  res.servos = Big.from(servoCost(LINES[0].id));
  return { res, gens, lines, coroas: 0, mode: '1', line: LINES[0].id, view: 'gens', ...freshMeta() };
}

let state = null;

function newGame() {
  state = freshState();
  startRenome();
}

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

// duração de um ciclo: 3,0s, 0,38s, menos de 0,01s com muito ritmo, ou
// minutos e horas nos tiers altos
function fmtCycle(sec) {
  if (sec < 0.01) return '<0,01s';
  if (sec >= 60) return fmtTime(sec);
  return sec.toFixed(sec < 1 ? 2 : 1).replace('.', ',') + 's';
}

function plural(id, n) {
  return Big.from(n).eq(1) ? RES_LABEL[id].one : RES_LABEL[id].many;
}

// ---------------------------------------------------------------------------
// Custos: crescem geometricamente a cada unidade comprada.

// n unidades a partir da compra número b: base · g^b · (g^n − 1) / (g − 1).
// O Desconto (cartas) divide só o preço no recurso da linha.
function costFor(gen, n) {
  const b = state.gens[gen.id].bought;
  const cut = discountOf(gen.line);
  return gen.costs.map((c) => {
    if (c.growth === 1) return { res: c.res, amount: Big.from(c.base * n) };
    let amount = Big.pow(c.growth, b).mul(c.base).mul(Big.pow(c.growth, n).sub(1)).div(c.growth - 1);
    if (cut > 1) amount = amount.div(cut);
    return { res: c.res, amount: amount.ceil() };
  });
}

function canAfford(cost) {
  return cost.every((c) => getRes(c.res).gte(c.amount));
}

function maxAffordable(gen) {
  const b = state.gens[gen.id].bought;
  let best = Infinity;
  for (const c of gen.costs) {
    const have = getRes(c.res);
    let n;
    if (c.growth === 1) n = Math.floor(have.div(c.base).toNumber());
    else {
      const x = have.mul(discountOf(gen.line)).mul(c.growth - 1).div(Big.pow(c.growth, b).mul(c.base));
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
  state.servoOn = true; // os servos começam a nascer na primeira compra
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
  addRes('servos', servoCost(line.id));
  state.gens[first.id].seen = true;
  return true;
}

// ---------------------------------------------------------------------------
// Marcos, como no Adventure Communist: cada gerador dá coroas quando a
// quantidade dele chega a 10, 100, 1.000... (o marco k, de 10^k unidades, vale
// k × tier coroas). As coroas, junto com as cópias, sobem as cartas (meta.js).

const milestoneAt = (k) => Big.fromLog10(k);
const milestoneReward = (gen, k) => k * gen.tier;

// Confere os marcos de todos os geradores. As coroas não entram direto: ficam
// guardadas na barra do marco, somando marco após marco, até o jogador clicar
// nela para coletar (a contagem segue para o próximo marco enquanto isso).
// Devolve o que foi alcançado agora (vários de uma vez depois de um tempo fora).
function checkMilestones() {
  const got = [];
  for (const gen of GENERATORS) {
    const g = state.gens[gen.id];
    for (let guard = 0; guard < 1000 && g.count.gte(milestoneAt(g.ms + 1)); guard++) {
      g.ms += 1;
      state.stats.ms += 1;
      const reward = milestoneReward(gen, g.ms);
      g.pend += reward;
      g.pendN += 1;
      got.push({ gen, k: g.ms, reward });
    }
  }
  return got;
}

// Coleta as coroas guardadas na barra de marcos de um gerador.
function collectMilestones(gen) {
  const g = state.gens[gen.id];
  const got = g.pend;
  if (!got) return 0;
  state.coroas += got;
  g.pend = 0;
  g.pendN = 0;
  return got;
}

// ---------------------------------------------------------------------------
// Simulação: todas as linhas andam juntas, mesmo as que não estão na tela.

// Colheita farta: cada ciclo tem a chance p de render M vezes. Com muitos
// ciclos de uma vez (tempo fora), usa a média e sorteia só a fração.
function luckyCycles(cycles, p) {
  if (p <= 0) return 0;
  if (cycles <= 20) {
    let n = 0;
    for (let i = 0; i < cycles; i++) if (Math.random() < p) n++;
    return n;
  }
  const mean = cycles * p;
  return Math.floor(mean) + (Math.random() < mean % 1 ? 1 : 0);
}

function step(dt, onCycle) {
  if (state.servoOn) state.res.servos = state.res.servos.add(servoRate() * dt);
  for (const gen of GENERATORS) {
    const g = state.gens[gen.id];
    // sem ninguém o ciclo congela onde parou (pedido do usuário) e segue dali na volta
    if (g.count.sign <= 0) continue;
    g.progress += dt / cycleOf(gen);
    if (g.progress >= 1) {
      const cycles = Math.floor(g.progress);
      g.progress -= cycles;
      const lucky = luckyCycles(cycles, luckOf(gen));
      const made = g.count.mul(amountOf(gen) * (cycles + lucky * (bonusOf(gen) - 1)));
      addRes(gen.makes, made);
      g.made = g.made.add(made);
      if (gen.makes in state.stats.made) state.stats.made[gen.makes] = state.stats.made[gen.makes].add(made);
      state.stats.lucky += lucky;
      if (onCycle) onCycle(gen, made, lucky);
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

// Produção média por ciclo, contando as colheitas fartas
const avgAmount = (gen) => amountOf(gen) * (1 + luckOf(gen) * (bonusOf(gen) - 1));

function ratePerSecond(resId) {
  if (resId === 'servos') return Big.from(servoRate());
  let r = Big.ZERO;
  for (const gen of GENERATORS) {
    if (gen.makes === resId) r = r.add(state.gens[gen.id].count.mul(avgAmount(gen) / cycleOf(gen)));
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

// Lê o save. Devolve quantos segundos o jogo ficou fechado e, para saves de
// antes das cartas, o que eles ganham na troca (welcome).
function load() {
  const result = { away: 0, welcome: null };
  try {
    const data = readSave();
    if (!data || !data.state) { newGame(); return result; }
    const base = freshState();
    const saved = data.state;
    const savedGens = saved.gens || {};
    const gens = {};
    let refund = 0;
    for (const id in base.gens) {
      const g = { ...base.gens[id], ...savedGens[id] };
      g.count = Big.from(g.count);
      g.made = Big.from(g.made);
      // as melhorias compradas com coroas viraram cartas: as coroas gastas
      // voltam (Desconto custava 2·tier·3^n; Ritmo e Fartura, 2^n)
      for (let lv = 0; lv < (g.cut || 0); lv++) refund += Math.round(2 * GEN[id].tier * 3 ** lv);
      refund += 2 ** (g.spd || 0) - 1 + 2 ** (g.pow || 0) - 1;
      delete g.cut;
      delete g.spd;
      delete g.pow;
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
      coroas: (typeof saved.coroas === 'number' ? saved.coroas : 0) + refund,
      mode: ['1', '10', 'max'].includes(saved.mode) ? saved.mode : '1',
      line: LINE[saved.line] ? saved.line : base.line,
      view: VIEWS.includes(saved.view) ? saved.view : saved.view === 'upg' ? 'cards' : 'gens',
    };
    const old = loadMeta(saved, state);
    if (old) {
      // save de antes das cartas e dos servos: 100 servos já nascendo, os
      // marcos já alcançados contam, e um Baú de Prata de boas-vindas
      const bought = Object.values(gens).some((g) => g.bought > 0);
      state.servoOn = bought;
      if (bought) state.res.servos = Big.from(100);
      for (const id in gens) state.stats.ms += gens[id].ms || 0;
      result.welcome = { refund };
    }
    if (!state.mission) startRenome();
    result.away = Math.max(0, (Date.now() - (data.savedAt || Date.now())) / 1000);
    return result;
  } catch (err) {
    console.error(err);
    newGame();
    return result;
  }
}

// ---------------------------------------------------------------------------
// Interface

const ui = { cards: {}, tabs: {}, panels: {}, scenes: {}, lineLocks: {}, chains: {}, cardBoxes: {}, recruits: {} };

// Cartão do topo com largura fixa (pedido do usuário: nada muda de tamanho
// com o número): ícone, o nome em cima e o valor embaixo. Valor grande demais
// vira reticências; o valor completo fica na dica do mouse (title).
function buildHudStat(node, icon, label) {
  const num = el('span', 'crown-num');
  const sub = el('span', 'stat-sub');
  const line = el('span', 'stat-line');
  line.append(num, sub);
  const txt = el('span', 'stat-txt');
  txt.append(el('span', 'stat-label', label), line);
  node.append(typeof icon === 'string' ? ART.iconCanvas(icon, 2) : icon, txt);
  return { num, sub };
}

// O número por extenso para a dica do mouse; acima de mil trilhões, o curto
function fullNum(x) {
  const n = typeof x === 'number' ? x : x.toNumber();
  return n < 1e15 ? Math.floor(n).toLocaleString('pt-BR') : fmt(x);
}

function setTitle(node, t) {
  if (node.title !== t) node.title = t;
}

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
  // a barra do ciclo usa três desenhos da mesma cor (art.js): liso e ponta
  // enquanto enche, listras quando a produção é contínua
  card.style.setProperty('--stripes', `var(--bar-${gen.tone})`);
  card.style.setProperty('--solid', `var(--solid-${gen.tone})`);
  card.style.setProperty('--trail', `var(--trail-${gen.tone})`);

  const pic = portraitFrame(gen.tier, 'Retrato: ' + gen.name);

  // centro: nome, descrição e as duas barras. Os números detalhados ficam no
  // painel do gerador (botão Detalhes); a barra do ciclo já diz quanto sai.
  const main = el('div', 'main');
  const head = el('div', 'gen-head');
  const count = el('span', 'gen-count');
  const name = el('h2', 'gen-name', gen.name);
  head.append(name, count);
  const desc = el('p', 'gen-desc');

  // barra do ciclo: quanto sai por ciclo (ou por segundo, com ciclo < 1s) e
  // quanto falta
  const bar = el('div', 'bar fr fr-slot');
  const fill = el('div', 'fill');
  fill.append(el('div', 'bar-trail'));
  const barText = el('span', 'bar-text bar-out');
  const barNum = el('span');
  const barIcon = ART.iconCanvas(RES_LABEL[gen.makes].icon, 2);
  barText.append(barNum, barIcon);
  const barTime = el('span', 'bar-time');
  bar.append(fill, barText, barTime);

  // barra do próximo marco: quantos já tem, a meta e as coroas que ela dá
  const mbar = el('div', 'bar mbar fr fr-slot');
  const markFill = el('div', 'fill mark-fill');
  const markTip = el('div', 'mark-tip');
  markFill.append(markTip);
  const markText = el('span', 'bar-text');
  const markProg = el('span');
  // no celular só "Marco:", para os números grandes caberem
  markText.append(el('span', 'mark-long', 'Próximo marco: '), el('span', 'mark-short', 'Marco: '), markProg);
  // com marcos acumulados, a ponta direita vira "Coletar +N" e a barra é clicável
  const markReward = el('span', 'bar-time mark-reward');
  const markNum = el('span');
  markReward.append(el('span', 'mark-collect', 'Coletar'), markNum, ART.iconCanvas('crown', 2));
  mbar.append(markFill, markText, markReward);
  mbar.addEventListener('click', () => {
    const got = collectMilestones(gen);
    if (!got) return;
    SFX.play('coin');
    bump(ui.crowns);
    toast(`+${fmt(got)} ${got === 1 ? 'coroa' : 'coroas'} dos marcos!`);
    renderNow();
  });
  mbar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mbar.click(); }
  });
  main.append(head, desc, bar, mbar);

  // lateral: compra
  const side = el('div', 'side');
  // botão alto: "Comprar" e a quantidade em cima, os custos numa linha embaixo
  const btn = el('button', 'btn buy tall-buy');
  btn.type = 'button';
  btn.id = 'buy-' + gen.id;
  const btnTop = el('span', 'buy-top');
  const btnLabel = el('span', 'buy-label');
  const btnQty = el('span', 'buy-qty');
  btnTop.append(btnLabel, btnQty);
  const btnCosts = el('span', 'buy-costs');
  const chips = gen.costs.map((c) => costChip(c.res));
  chips.forEach((c) => btnCosts.append(c.chip));
  btn.append(btnTop, btnCosts);
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
  // painel com os números, os marcos e as cartas deste gerador
  const info = el('button', 'btn info-btn');
  info.type = 'button';
  info.append(ART.iconCanvas('book', 2), el('span', null, 'Detalhes'));
  SFX.bind(info, 'tab');
  info.addEventListener('click', () => openGenInfo(gen, info));
  side.append(btn, info);

  card.append(pic.frame, main, side);
  ui.cards[gen.id] = {
    card, portrait: pic.frame, canvas: pic.canvas, ctx: pic.ctx, head, name, count, countLen: 0, desc, fill, bar, barText, barNum, barIcon, barTime,
    mbar, markProg, markReward, markNum, markFill, markTip, markP: -1, pend: -1,
    btn, btnLabel, btnQty, chips, info, gen, lastP: -1, sealed: null, onScreen: true,
    floatSum: null, floatAt: -Infinity,
  };
  return card;
}

// O cabeçalho do cartão (nome e quantidade) fica numa linha só, para todos os
// cartões terem a mesma altura. Quando não cabe, o nome fica menor.
function fitHead(c) {
  if (!c.head.clientWidth) return; // escondido: mede quando aparecer
  setClass(c.head, 'long', false);
  if (c.name.scrollWidth > c.name.clientWidth + 1) setClass(c.head, 'long', true);
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
  setClass(c.info, 'off', sealed); // escondido: nada para detalhar
  c.canvas.setAttribute('aria-label', sealed ? gen.name + ' bloqueado' : 'Retrato: ' + gen.name);
  if (sealed) {
    ART.locked[gen.portrait](c.ctx);
    setText(c.desc, 'Ainda bloqueado: junte o preço para descobrir.');
    setText(c.markProg, '?');
    c.markReward.hidden = true;
    c.markFill.style.clipPath = 'inset(0 100% 0 0)';
    c.markP = -1;
    setText(c.barNum, 'Bloqueado');
    c.barIcon.hidden = true;
    setText(c.barTime, '');
    setClass(c.card, 'working', false);
    setClass(c.card, 'steady', false);
    c.fill.style.clipPath = 'inset(0 100% 0 0)';
    c.lastP = -1;
  } else {
    setText(c.desc, gen.blurb);
    c.markReward.hidden = false;
    if (wasSealed) replay(c.portrait, 'reveal');
  }
}

// Entre um cartão e o de cima: duas correntes, como placas de taverna
// penduradas uma na outra. Só desenho (style.css), sem texto.
function buildLink() {
  const link = el('div', 'link');
  link.setAttribute('aria-hidden', 'true');
  return link;
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
  const btn = el('button', 'btn buy tall-buy');
  btn.type = 'button';
  const costs = el('span', 'buy-costs');
  const chips = line.unlock.map((c) => {
    const chip = costChip(c.res);
    setText(chip.num, fmt(c.amount));
    costs.append(chip.chip);
    return chip;
  });
  const top = el('span', 'buy-top');
  top.append(el('span', 'buy-label', 'Abrir linha'));
  btn.append(top, costs);
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
  panel.append(chain, buildCardBox(line));
  ui.chains[line.id] = { node: chain, rows, teaser, teaserText, shown: -1 };
  return panel;
}

// Menus do rodapé. Os do reino (missões, recrutamento, configurações) não
// dependem da linha: trocar de linha neles volta para os geradores.
const VIEWS = ['gens', 'servos', 'cards', 'missions', 'config'];
const KINGDOM_VIEWS = ['servos', 'missions', 'config'];

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
// silhueta. O resto vira só uma linha "Mais geradores por descobrir", sem contar quantos.
function visibleCount(line) {
  let last = 0;
  line.gens.forEach((id, i) => { if (state.gens[id].seen) last = i; });
  return Math.min(line.gens.length, last + 2);
}

function renderChain(line) {
  const ch = ui.chains[line.id];
  const shown = visibleCount(line);
  if (ch.shown === shown) return;
  ch.shown = shown;
  ch.rows.forEach((r, i) => {
    r.card.hidden = i >= shown;
    if (r.link) r.link.hidden = i >= shown;
  });
  const rest = line.gens.length - shown;
  ch.teaser.hidden = rest <= 0;
  setText(ch.teaserText, 'Mais geradores por descobrir');
}

// Aba de uma linha, logo abaixo da cena: ícone, estoque do recurso e ritmo
// numa linha só. O nome da linha fica no título logo abaixo das abas.
function buildTab(line, index) {
  const tab = el('button', 'line-tab fr fr-slot');
  tab.type = 'button';
  tab.dataset.line = line.id;
  tab.title = `${line.name} (tecla ${index + 1})`;
  tab.setAttribute('aria-label', line.name);
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', 'gens-' + line.id);
  const icon = el('span', 'tab-icon');
  const shut = ART.iconCanvas('lock', 2);
  shut.classList.add('tab-lock');
  icon.append(ART.iconCanvas(line.icon, 2), shut);
  const num = el('span', 'tab-num');
  const rate = el('span', 'tab-rate');
  // linha fechada: o recurso que ainda falta para abrir, com ícone
  const need = el('span', 'tab-need');
  const needNum = el('span');
  need.append('Falta', el('span'), needNum);
  tab.append(icon, num, rate, need);
  SFX.bind(tab, 'tab');
  tab.addEventListener('click', () => {
    if (KINGDOM_VIEWS.includes(state.view)) setView('gens');
    setLine(line.id);
  });
  ui.tabs[line.id] = { tab, num, rate, need, needNum, needRes: null };
  return tab;
}

// Reinicia uma animação de CSS. Lê o layout (offsetWidth), então é só para
// coisas raras, como um clique.
function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

// O "pulo" de um número, sem ler o layout: pode rodar a cada quadro.
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
function bump(node) {
  if (REDUCED_MOTION) return;
  node.animate(
    [{ transform: 'none' }, { transform: 'scale(1.12)', offset: 0.4 }, { transform: 'none' }],
    { duration: 350, easing: 'cubic-bezier(.3, 1.6, .5, 1)' },
  );
}

// Número que sobe do retrato. Fica dentro do retrato, em porcentagem, para
// não precisar medir nada na tela.
function floatText(c, text, lucky) {
  const f = el('span', lucky ? 'float lucky' : 'float', text);
  f.style.left = (35 + Math.random() * 30) + '%';
  c.portrait.append(f);
  setTimeout(() => f.remove(), 1250);
}

// Com ciclos curtos, um número por ciclo vira um borrão e pesa (centenas de
// elementos por segundo). Cada gerador junta o que fez e mostra no máximo um
// número por segundo; com ciclo de 1s ou mais, continua um por ciclo.
const FLOAT_EVERY = 1000;
function onCycle(gen, made, lucky) {
  if (gen.line !== state.line || state.view !== 'gens') return;
  const c = ui.cards[gen.id];
  if (!c) return;
  const now = performance.now();
  if (!c.floatSum || now - c.floatAt > 2 * FLOAT_EVERY) { c.floatSum = Big.ZERO; c.floatLucky = false; } // voltou de uma pausa
  c.floatSum = c.floatSum.add(made);
  if (lucky) c.floatLucky = true;
  if (now - c.floatAt < FLOAT_EVERY) return;
  c.floatAt = now;
  // colheita farta: número dourado com o multiplicador
  const text = '+' + fmt(c.floatSum) + ' ' + plural(gen.makes, c.floatSum);
  floatText(c, c.floatLucky ? `×${fmt(bonusOf(gen))}! ${text}` : text, c.floatLucky);
  if (c.floatLucky) replay(c.portrait, 'lucky-flash');
  c.floatLucky = false;
  c.floatSum = Big.ZERO;
  if (gen.makes in state.res) bump(ui.tabs[gen.line].num);
  else if (ui.cards[gen.makes]) bump(ui.cards[gen.makes].count);
}

function onMilestones(got) {
  SFX.play('tab');
  toast(milestoneText(got));
}

function milestoneText(got) {
  const total = got.reduce((t, m) => t + m.reward, 0);
  const coins = `+${fmt(total)} ${total === 1 ? 'coroa' : 'coroas'} na barra para coletar`;
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
      const rate = fmtRate(ratePerSecond(line.res));
      setText(t.num, fmt(state.res[line.res]));
      setText(t.rate, '+' + rate + '/s');
      setTitle(t.tab, `${line.name}: ${fullNum(state.res[line.res])} ${RES_LABEL[line.res].many} (+${rate} por segundo) · tecla ${LINES.indexOf(line) + 1}`);
    } else {
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
  // número mais comprido que todos os anteriores: confere se o cabeçalho ainda
  // cabe (medir trava o quadro, então não mede a cada troca de tamanho)
  if (c.count._text.length > c.countLen) {
    c.countLen = c.count._text.length;
    fitHead(c);
  }

  if (c.sealed) {
    const cost = costFor(gen, 1);
    setOk(c.btn, false);
    setText(c.btnLabel, 'Bloqueado');
    setText(c.btnQty, '');
    cost.forEach((k, i) => {
      setText(c.chips[i].num, fmt(k.amount));
      setClass(c.chips[i].chip, 'short', getRes(k.res).lt(k.amount));
    });
    return;
  }

  const working = g.count.sign > 0;
  setClass(c.card, 'working', working);
  renderBar(c);
  const cyc = cycleOf(gen);
  const steady = cyc < STEADY;
  setClass(c.card, 'steady', working && steady);
  // dentro da barra: quanto sai por ciclo; com ciclo abaixo de 1s, por segundo
  c.barIcon.hidden = !working;
  setText(c.barNum, !working ? `Parado: compre ${gen.a} ${gen.name.toLowerCase()} para ${g.progress > 0 ? 'continuar' : 'começar'}`
    : steady ? '+' + fmtRate(g.count.mul(avgAmount(gen)).div(cyc)) + '/s'
      : '+' + fmt(g.count.mul(amountOf(gen))));
  const left = (1 - g.progress) * cyc;
  setText(c.barTime, !working || steady ? '' : 'faltam ' + (left >= 60 ? fmtTime(left) : left.toFixed(1).replace('.', ',') + 's'));
  const goal = milestoneAt(g.ms + 1);
  setText(c.markProg, `${fmt(g.count)} / ${fmt(goal)}`);
  const pend = g.seen ? g.pend : 0;
  if (pend !== c.pend) {
    c.pend = pend;
    setClass(c.mbar, 'pend', pend > 0);
    if (pend > 0) {
      c.mbar.setAttribute('role', 'button');
      c.mbar.tabIndex = 0;
    } else {
      c.mbar.removeAttribute('role');
      c.mbar.removeAttribute('tabindex');
    }
  }
  setText(c.markNum, '+' + fmt(pend > 0 ? pend : milestoneReward(gen, g.ms + 1)));
  setTitle(c.mbar, pend > 0 ? `${g.pendN} ${g.pendN === 1 ? 'marco guardado' : 'marcos guardados'}: clique para coletar ${fullNum(pend)} ${pend === 1 ? 'coroa' : 'coroas'}` : '');
  const mp = Math.min(1, g.count.div(goal).toNumber());
  if (mp !== c.markP) {
    c.markP = mp;
    c.markFill.style.clipPath = `inset(0 ${((1 - mp) * 100).toFixed(3)}% 0 0)`;
    c.markTip.style.transform = `translateX(${((mp - 1) * 100).toFixed(3)}%)`;
  }

  const n = buyAmount(gen);
  const cost = costFor(gen, n);
  const ok = canAfford(cost);
  setOk(c.btn, ok);
  setText(c.btnLabel, 'Comprar');
  // comprar um só não precisa dizer ×1
  setText(c.btnQty, n === 1 ? '' : '×' + fmt(n));
  cost.forEach((k, i) => {
    setText(c.chips[i].num, fmt(k.amount));
    setClass(c.chips[i].chip, 'short', getRes(k.res).lt(k.amount));
  });
}

// Barra do ciclo: um valor novo a cada quadro, sem arredondar em degraus. A
// ponta acesa anda junto com transform (só a placa de vídeo trabalha). Com
// ciclo abaixo de 1s (pedido do usuário) ela fica cheia e só as listras andam,
// em vez de piscar enchendo várias vezes por segundo.
const STEADY = 1;
function renderBar(c) {
  if (c.sealed) return;
  const g = state.gens[c.gen.id];
  const p = g.count.sign > 0 && cycleOf(c.gen) < STEADY ? 1 : g.progress;
  if (p !== c.lastP) {
    c.lastP = p;
    c.fill.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(3)}% 0 0)`;
  }
}

// Os textos mudam no máximo 15 vezes por segundo: mais que isso ninguém lê, e
// cada troca de texto faz o navegador refazer o layout. As barras continuam a
// cada quadro (renderNow(false)).
const TEXT_EVERY = 1000 / 15;
let textAt = -Infinity;

function renderNow(full = true) {
  if (!full) return renderBars();
  textAt = performance.now();
  renderTabs();
  renderHud();
  renderGenInfo();
  checkMissionNotices();
  const line = LINE[state.line];
  const open = state.lines[line.id];
  const view = state.view;
  const panel = ui.panels[line.id];
  const kingdom = KINGDOM_VIEWS.includes(view);
  if (panel.hidden !== kingdom) panel.hidden = kingdom;
  ui.missions.node.hidden = view !== 'missions';
  ui.servosView.node.hidden = view !== 'servos';
  ui.settings.hidden = view !== 'config';
  if (view === 'missions') return renderMissions();
  if (view === 'servos') return renderServos();
  if (kingdom) return;
  ui.lineLocks[line.id].card.hidden = open;
  ui.chains[line.id].node.hidden = !open || view !== 'gens';
  ui.cardBoxes[line.id].node.hidden = !open || view !== 'cards';
  if (!open) return renderLineLock(line);
  if (view === 'cards') return renderCards(line);
  renderChain(line);
  const shown = ui.chains[line.id].shown;
  for (let i = 0; i < shown; i++) renderCard(ui.cards[line.gens[i]]);
}

function renderBars() {
  const line = LINE[state.line];
  if (!state.lines[line.id] || state.view !== 'gens') return;
  const shown = ui.chains[line.id].shown;
  for (let i = 0; i < shown; i++) renderBar(ui.cards[line.gens[i]]);
}

// ---------------------------------------------------------------------------
// Arte animada: cena e retratos da linha aberta, redesenhados a cada quadro.

let millAngle = 0;
let sceneScale = 2;

function currentScene() {
  const line = LINE[state.line];
  if (!ui.scenes[line.id]) ui.scenes[line.id] = SCENES.create(line.scene);
  return ui.scenes[line.id];
}

function fitScene() {
  // pixel de 2px em toda tela (pedido do usuário: a cena ocupava altura demais)
  sceneScale = 2;
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
  paintGenInfo(t);
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
  const { away, welcome } = load();

  ui.toast = document.getElementById('toast');
  ui.crowns = document.getElementById('crowns');
  ui.crownNum = buildHudStat(ui.crowns, 'crown', 'Coroas').num;
  ui.sceneBox = document.getElementById('scene-box');
  ui.sceneCanvas = document.getElementById('scene');
  ui.sceneCtx = ui.sceneCanvas.getContext('2d');
  ui.settings = document.getElementById('settings');

  const tabs = document.getElementById('line-tabs');
  const board = document.getElementById('gens');
  LINES.forEach((line, i) => {
    tabs.append(buildTab(line, i));
    const panel = buildPanel(line);
    ui.panels[line.id] = panel;
    board.append(panel);
  });

  if (welcome) openChest('prata'); // initMeta mostra os baús ainda não vistos
  initMeta();

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
      if (KINGDOM_VIEWS.includes(state.view)) setView('gens');
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
    b.prepend(ART.iconCanvas(b.dataset.icon, 2));
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
      newGame();
      save();
      for (const id in ui.cards) ui.cards[id].sealed = null;
      for (const id in ui.cardBoxes) ui.cardBoxes[id].shown = -1;
      missionNoticed.clear();
      chestQueue.length = 0;
      if (chestShowing) showNextChest();
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
    checkMissionNotices(true); // as cumpridas fora aparecem no selo de Missões
  }
  if (welcome) {
    toast(welcome.refund
      ? `Melhorias viraram cartas! As ${fmt(welcome.refund)} coroas gastas nelas voltaram, e aqui vai um Baú de Prata.`
      : 'Chegaram as missões e as cartas! Aqui vai um Baú de Prata para começar.');
  }

  simClock = performance.now();
  // medidor de FPS: quadros contados e mostrados duas vezes por segundo
  const fps = document.getElementById('fps');
  let fpsFrames = 0;
  let fpsAt = performance.now();
  function frame(now) {
    fpsFrames += 1;
    if (now - fpsAt > 2000) { fpsFrames = 0; fpsAt = now; } // voltou de uma pausa: recomeça a contagem
    else if (now - fpsAt >= 500) {
      setText(fps, String(Math.round((fpsFrames * 1000) / (now - fpsAt))));
      fpsFrames = 0;
      fpsAt = now;
    }
    const dt = Math.max(0, (now - simClock) / 1000);
    simClock = Math.max(simClock, now);
    if (dt > 1) simulateSilently(dt, Infinity); // voltou de um tempo sem quadros
    else step(dt, onCycle);
    checkReveals(onReveal);
    const got = checkMilestones();
    if (got.length) onMilestones(got);
    paintArt(now / 1000, dt);
    renderNow(now - textAt >= TEXT_EVERY);
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
  const servos = state.res.servos.sub(before.servos || Big.ZERO);
  if (servos.gte(1)) parts.push('+' + fmt(servos) + ' ' + plural('servos', servos.floor()));
  const coins = got.reduce((t, m) => t + m.reward, 0);
  if (coins) parts.push(`+${fmt(coins)} ${coins === 1 ? 'coroa' : 'coroas'} de marcos para coletar`);
  if (parts.length) toast('Enquanto você esteve fora: ' + parts.join(', ') + '.');
}

// init() é chamado no fim de meta-ui.js, o último script.
