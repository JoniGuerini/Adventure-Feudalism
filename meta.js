'use strict';
// Cartas, servos, colheita farta, missões e baús, inspirados no Adventure
// Communist. Só regras e números: a tela fica em meta-ui.js. Depende do que
// game.js define (LINES, GEN, state, fmt...), então carrega depois dele.
//
// Resumo:
//  - toda melhoria é uma carta. Subir uma carta de nível gasta cópias dela e
//    coroas, e cada raridade tem um nível máximo;
//  - as cartas vêm de baús, e os baús vêm das missões. As missões aparecem 3
//    por vez e, cumpridas as exigidas, o Renome sobe (sem zerar nada);
//  - todo gerador comprado custa servos, que nascem sozinhos depois da
//    primeira compra e aumentam com o Recrutamento de cada linha.

// ---------------------------------------------------------------------------
// Números de balanceamento, todos num lugar só

const BAL = {
  // cópias gastas para subir ao nível i+1 (o nível 1 vem com a primeira cópia)
  copies: [1, 2, 5, 10, 20, 50, 100, 200, 400, 800],
  // chance de colheita farta por nível da carta de Sorte da linha
  luck: [0, 0.05, 0.0725, 0.1, 0.1325, 0.17, 0.2125, 0.26, 0.3125],
  luckKingdom: 0.02, // por nível da Estrela da Sorte
  luckCap: 0.75,
  luckBase: 3, // a colheita farta rende ×3 antes da Bonança
  // Os efeitos somam por nível em vez de dobrar: cada tier multiplica o de
  // baixo, então um bônus em todos os tiers se acumula em cadeia (×2 por
  // nível em 15 tiers virava um número astronômico em poucas horas).
  power: 0.5, // Fartura: +50% de produção por nível
  speed: 0.25, // Ritmo: +25% de velocidade por nível
  bonus: 2, // Bonança: +2 no multiplicador da colheita farta por nível
  kingdomPower: 0.5, // Coroa do Rei: +50% em todos os geradores por nível
  // servos
  servoBase: 1, // por segundo, depois da primeira compra
  recruitBase: 5, // o recrutamento n custa 5 × 1.000^n do recurso da linha
  recruitGrowth: 1000,
  // baús
  chestCardsPerRenome: 0.1,
  chestCrownsPerRenome: 0.2,
  pity: 25, // baús seguidos sem lendária até a próxima carta ser lendária
};

const RARITIES = {
  comum: { name: 'Comum', max: 10, crowns: [0, 3, 8, 20, 50, 120, 300, 750, 1800, 4500], extra: 0.5 },
  rara: { name: 'Rara', max: 8, crowns: [0, 10, 30, 80, 200, 500, 1200, 3000], extra: 3 },
  epica: { name: 'Épica', max: 6, crowns: [0, 40, 120, 350, 1000, 3000], extra: 15 },
  lendaria: { name: 'Lendária', max: 5, crowns: [0, 200, 800, 3000, 10000], extra: 60 },
};
const RARITY_ORDER = ['comum', 'rara', 'epica', 'lendaria'];

// Ferramenta de cada gerador (as cartas comuns): nome e frase de uma linha só.
const TOOLS = {
  campones: ['Foice Afiada', 'Corta o trigo num só golpe.'],
  moinho: ['Mó de Pedra', 'Mói mais farinha a cada volta.'],
  celeiro: ['Tranca de Ferro', 'Nenhum grão se perde no inverno.'],
  granja: ['Arado de Bois', 'Abre sulcos fundos na terra.'],
  aldeia: ['Poço Novo', 'Água perto atrai mais famílias.'],
  feira: ['Balança Justa', 'Mercadores voltam onde não são roubados.'],
  vila: ['Muralha Alta', 'Gente segura faz a vila crescer.'],
  solar: ['Livro de Contas', 'O senhor sabe cada moeda do feudo.'],
  castelo: ['Ponte Levadiça', 'O castelo nunca cai e as terras crescem.'],
  barao: ['Selo de Lacre', 'Cartas seladas valem como lei.'],
  conde: ['Anel de Sinete', 'O anel do conde abre todas as portas.'],
  duque: ['Estandarte', 'O pendão do duque reúne vassalos.'],
  rei: ['Cetro', 'Uma ordem do cetro move o reino.'],
  imperador: ['Orbe Imperial', 'O mundo cabe na palma da mão.'],
  dinastia: ['Árvore Genealógica', 'Cada ramo dá um novo herdeiro.'],

  ferreiro: ['Martelo Temperado', 'Cada golpe sai mais certeiro.'],
  forja: ['Fole de Couro', 'Mais ar, mais fogo, mais aço.'],
  arsenal: ['Cabides de Lança', 'Tudo no lugar, nada se perde.'],
  quartel: ['Tambor de Marcha', 'O passo certo apressa o treino.'],
  torre: ['Luneta', 'Vê o inimigo a léguas de distância.'],
  cavaleiro: ['Ferradura Nova', 'O cavalo galopa sem mancar.'],
  fortaleza: ['Portão Reforçado', 'Nenhum aríete passa por ele.'],
  capitao: ['Apito de Comando', 'Um silvo e a tropa se move.'],
  ordem: ['Juramento de Honra', 'Irmãos de armas não recuam.'],
  trabuco: ['Contrapeso de Pedra', 'Arremessa mais longe e mais forte.'],
  marechal: ['Mapa de Batalha', 'Cada tropa no seu lugar.'],
  armada: ['Velas Remendadas', 'Os navios cortam o mar sem atraso.'],
  legiao: ['Escudo em Muralha', 'Mil escudos fazem uma só parede.'],
  conquistador: ['Elmo Dourado', 'Quem o vê passar se rende.'],
  lenda: ['Canção do Bardo', 'Seus feitos correm o mundo inteiro.'],

  herborista: ['Tesoura de Poda', 'Colhe a erva sem ferir a raiz.'],
  botica: ['Pilão de Mármore', 'Mói as folhas até virar pó fino.'],
  mosteiro: ['Horta do Claustro', 'Canteiros cuidados com paciência.'],
  destilaria: ['Serpentina de Cobre', 'Cada gota sai mais pura.'],
  alquimista: ['Balança de Precisão', 'Nenhum grão a mais, nenhum a menos.'],
  laboratorio: ['Retorta de Vidro', 'Ferve sem rachar no fogo alto.'],
  biblioteca: ['Lupa de Cristal', 'Letras miúdas viram receitas.'],
  sabio: ['Pena de Coruja', 'Anota tudo o que descobre.'],
  observatorio: ['Astrolábio', 'Lê o céu para saber a hora certa.'],
  academia: ['Lousa Nova', 'Mais alunos aprendem de uma vez.'],
  arquimago: ['Cajado Rúnico', 'Concentra o poder numa só ponta.'],
  torrearcana: ['Cristal de Foco', 'A luz da torre nunca se apaga.'],
  pedra: ['Pó de Ouro', 'Uma pitada transforma tudo.'],
  elixir: ['Frasco Selado', 'Nem uma gota se evapora.'],
  grandeobra: ['Tomo Perdido', 'O segredo final, enfim revelado.'],

  mineiro: ['Picareta de Aço', 'Quebra a rocha na primeira batida.'],
  mina: ['Escoras de Carvalho', 'Túneis seguros vão mais fundo.'],
  pedreira: ['Cunha de Ferro', 'Racha blocos inteiros sem esforço.'],
  fundicao: ['Cadinho de Barro', 'Derrete o minério sem perder nada.'],
  capataz: ['Sino de Turno', 'Ninguém perde a hora de trabalhar.'],
  poco: ['Roldana Dupla', 'Sobe dois baldes de uma vez.'],
  ourives: ['Pinça Fina', 'Trabalha o ouro fio por fio.'],
  casadamoeda: ['Cunho Real', 'Cada moeda sai perfeita.'],
  guilda: ['Selo da Guilda', 'Mestres reconhecidos em todo o reino.'],
  veio: ['Bateia de Cobre', 'Separa o ouro da areia num instante.'],
  salao: ['Lareira de Pedra', 'O trabalho segue noite adentro.'],
  lapidario: ['Roda de Polir', 'Cada pedra ganha mil brilhos.'],
  tesouraria: ['Cofre de Três Chaves', 'O tesouro só cresce lá dentro.'],
  banqueiro: ['Livro-Razão', 'Juros sobre juros, todo mês.'],
  coracao: ['Martelo Ancestral', 'Acorda o que dorme sob a rocha.'],

  batedor: ['Botas de Couro', 'Anda léguas sem sentir os pés.'],
  acampamento: ['Barraca de Lona', 'Monta e desmonta num instante.'],
  cartografo: ['Compasso de Latão', 'Cada distância medida no mapa.'],
  posto: ['Paliçada', 'Um posto seguro na fronteira.'],
  caravana: ['Carroça Robusta', 'Atravessa a lama sem atolar.'],
  desbravador: ['Facão de Mato', 'Abre trilha onde não havia nada.'],
  estrada: ['Pedras de Calçamento', 'Chuva nenhuma estraga o caminho.'],
  porto: ['Guindaste de Madeira', 'Carrega os navios mais depressa.'],
  navio: ['Casco Calafetado', 'Nem uma gota entra no porão.'],
  navegador: ['Sextante', 'Acha o rumo até sem estrelas.'],
  expedicao: ['Mantimentos Salgados', 'A comida dura a viagem toda.'],
  farol: ['Lente Polida', 'A luz alcança o dobro do mar.'],
  colonia: ['Carta de Foral', 'Terra própria atrai novos colonos.'],
  descobridor: ['Diário de Bordo', 'Nenhuma descoberta fica esquecida.'],
  novomundo: ['Bandeira do Reino', 'Terras sem fim sob a mesma bandeira.'],
};

// Cartas de cada linha: [ritmo, sorte, recrutamento, desconto, bonança]
const LINE_CARDS = {
  comida: ['Capataz da Colheita', 'Almanaque do Lavrador', 'Arauto da Aldeia', 'Mestre de Obras', 'Cornucópia'],
  militar: ['Mestre-Armeiro', 'Martelo da Sorte', 'Sargento Recrutador', 'Intendente do Arsenal', 'Bigorna Rúnica'],
  alquimia: ['Ampulheta do Alquimista', 'Trevo de Quatro Folhas', 'Aprendiz Fiel', 'Tratado dos Preços Justos', 'Caldeirão Dourado'],
  minerios: ['Trilhos da Mina', 'Lanterna do Mineiro', 'Contrato de Mineiros', 'Contramestre', 'Filão Rico'],
  exploracao: ['Cavalos Velozes', 'Bússola', 'Edital de Colonos', 'Tratado de Passagem', 'Mapa do Tesouro'],
};

// Tipos de efeito: rótulo curto, ícone e o valor do efeito num nível.
const pct = (v) => (Math.round(v * 1000) / 10).toLocaleString('pt-BR') + '%';
const dec = (v) => (Math.round(v * 100) / 100).toLocaleString('pt-BR');

// Valor de cada efeito num nível (0 = sem a carta)
const EFFECT = {
  fartura: (lv) => 1 + BAL.power * lv,
  ritmo: (lv) => 1 + BAL.speed * lv,
  recruta: (lv) => 2 ** lv,
  desconto: (lv) => 2 ** lv,
  bonanca: (lv) => BAL.luckBase + BAL.bonus * lv,
  rfartura: (lv) => 1 + BAL.kingdomPower * lv,
  rbonanca: (lv) => 1 + 0.5 * lv,
  rdesconto: (lv) => 1 + lv,
};

const KINDS = {
  fartura: { label: 'Produção', icon: 'sack', eff: (lv) => '×' + dec(EFFECT.fartura(lv)) },
  ritmo: { label: 'Velocidade', icon: 'hourglass', eff: (lv) => '×' + dec(EFFECT.ritmo(lv)) },
  sorte: { label: 'Sorte', icon: 'clover', eff: (lv) => pct(BAL.luck[lv]) },
  recruta: { label: 'Servos', icon: 'horn', eff: (lv) => '×' + dec(EFFECT.recruta(lv)) },
  desconto: { label: 'Preço', icon: 'scales', eff: (lv) => '÷' + dec(EFFECT.desconto(lv)) },
  bonanca: { label: 'Colheita farta', icon: 'cornucopia', eff: (lv) => '×' + dec(EFFECT.bonanca(lv)) },
  cartas: { label: 'Cartas por baú', icon: 'book', eff: (lv) => '+' + 10 * lv + '%' },
  tesouro: { label: 'Coroas por baú', icon: 'coins', eff: (lv) => '+' + 25 * lv + '%' },
  // versões do reino (lendárias)
  rfartura: { label: 'Produção', icon: 'sack', eff: (lv) => '×' + dec(EFFECT.rfartura(lv)) },
  rsorte: { label: 'Sorte', icon: 'clover', eff: (lv) => '+' + pct(BAL.luckKingdom * lv) },
  rbonanca: { label: 'Colheita farta', icon: 'cornucopia', eff: (lv) => '×' + dec(EFFECT.rbonanca(lv)) },
  rdesconto: { label: 'Preço', icon: 'scales', eff: (lv) => '÷' + dec(EFFECT.rdesconto(lv)) },
};

const CARDS = [];
for (const line of LINES) {
  for (const id of line.gens) {
    const [name, blurb] = TOOLS[id];
    CARDS.push({ id: 'fart:' + id, rarity: 'comum', kind: 'fartura', line: line.id, gen: id, name, blurb, icon: GEN[id].portrait });
  }
}
for (const line of LINES) {
  const [rit, sor, rec, des, bon] = LINE_CARDS[line.id];
  const res = RES_LABEL[line.res].many;
  const add = (rarity, kind, name, blurb) => CARDS.push({ id: kind + ':' + line.id, rarity, kind, line: line.id, name, blurb, icon: KINDS[kind].icon });
  add('rara', 'ritmo', rit, `Todos os ciclos da linha ${line.name} ficam mais curtos.`);
  add('rara', 'sorte', sor, `Chance de um ciclo da linha ${line.name} render bem mais.`);
  add('rara', 'recruta', rec, `Recrutar com ${res} traz mais servos por segundo.`);
  add('epica', 'desconto', des, `Geradores da linha ${line.name} custam menos ${res}.`);
  add('epica', 'bonanca', bon, `Colheitas fartas da linha ${line.name} rendem ainda mais.`);
}
CARDS.push(
  { id: 'reino:cartas', rarity: 'epica', kind: 'cartas', name: 'Bibliotecário', blurb: 'Todo baú traz mais cartas.', icon: 'book' },
  { id: 'reino:tesouro', rarity: 'epica', kind: 'tesouro', name: 'Tesoureiro', blurb: 'Todo baú traz mais coroas.', icon: 'coins' },
  { id: 'reino:fartura', rarity: 'lendaria', kind: 'rfartura', name: 'Coroa do Rei', blurb: 'Todos os geradores do reino produzem mais.', icon: 'sack' },
  { id: 'reino:sorte', rarity: 'lendaria', kind: 'rsorte', name: 'Estrela da Sorte', blurb: 'Mais colheitas fartas em todas as linhas.', icon: 'clover' },
  { id: 'reino:bonanca', rarity: 'lendaria', kind: 'rbonanca', name: 'Cofre do Reino', blurb: 'Colheitas fartas rendem mais em todo o reino.', icon: 'cornucopia' },
  { id: 'reino:desconto', rarity: 'lendaria', kind: 'rdesconto', name: 'Tratado de Comércio', blurb: 'Todo gerador do reino custa menos.', icon: 'scales' },
);
const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// Estado das cartas e efeitos

function cardState(id) {
  return state.cards[id] || (state.cards[id] = { lv: 0, n: 0 });
}

const lv = (id) => (state.cards[id] ? state.cards[id].lv : 0);

// A carta já pode cair de baús: gerador visto, linha aberta ou carta do reino.
function cardOpen(card) {
  if (card.gen) return state.lines[card.line] && state.gens[card.gen].seen;
  if (card.line) return state.lines[card.line];
  return true;
}

// Efeitos (substituem os antigos Ritmo e Fartura comprados com coroas)
const cycleOf = (gen) => gen.cycle / EFFECT.ritmo(lv('ritmo:' + gen.line));
const amountOf = (gen) => gen.amount * EFFECT.fartura(lv('fart:' + gen.id)) * EFFECT.rfartura(lv('reino:fartura'));
const discountOf = (line) => EFFECT.desconto(lv('desconto:' + line)) * EFFECT.rdesconto(lv('reino:desconto'));

function luckOf(gen) {
  const own = lv('sorte:' + gen.line);
  if (!own) return 0; // a colheita farta só existe depois da primeira carta de Sorte da linha
  return Math.min(BAL.luckCap, BAL.luck[own] + BAL.luckKingdom * lv('reino:sorte'));
}
const bonusOf = (gen) => EFFECT.bonanca(lv('bonanca:' + gen.line)) * EFFECT.rbonanca(lv('reino:bonanca'));

// Texto do efeito: "Produção ×8 → ×16", ou só o atual no máximo.
function cardEffect(card) {
  const k = KINDS[card.kind];
  const now = lv(card.id);
  const max = RARITIES[card.rarity].max;
  if (now >= max) return `${k.label} ${k.eff(now)} (máximo)`;
  if (now === 0) return `${k.label} ${k.eff(1)} no nível 1`;
  return `${k.label} ${k.eff(now)} → ${k.eff(now + 1)}`;
}

// O que falta para subir de nível: cópias e coroas
function promoteNeed(card) {
  const c = state.cards[card.id];
  if (!c) return null;
  const r = RARITIES[card.rarity];
  if (c.lv === 0 || c.lv >= r.max) return null;
  return { copies: BAL.copies[c.lv], crowns: r.crowns[c.lv] };
}

function canPromote(card) {
  const need = promoteNeed(card);
  return !!need && state.cards[card.id].n >= need.copies && state.coroas >= need.crowns;
}

function promote(card) {
  if (!canPromote(card)) return false;
  const c = state.cards[card.id];
  const need = promoteNeed(card);
  c.n -= need.copies;
  state.coroas -= need.crowns;
  c.lv += 1;
  state.stats.promos += 1;
  state.stats.spent += need.crowns;
  // chegou ao máximo: as cópias que sobraram viram coroas
  if (c.lv >= RARITIES[card.rarity].max && c.n > 0) {
    state.coroas += c.n * RARITIES[card.rarity].extra;
    c.n = 0;
  }
  return true;
}

// Entrega k cópias. A primeira já vira o nível 1; no máximo, viram coroas.
function giveCard(id, k) {
  const card = CARD[id];
  const c = cardState(id);
  const out = { id, k, fresh: false, crowns: 0 };
  if (c.lv === 0) {
    c.lv = 1;
    k -= 1;
    out.fresh = true;
  }
  if (c.lv >= RARITIES[card.rarity].max) out.crowns = k * RARITIES[card.rarity].extra;
  else c.n += k;
  state.coroas += out.crowns;
  return out;
}

// Quantas cartas dá para promover agora (as da linha e as do reino)
function promotableCount(lineId) {
  let n = 0;
  for (const card of CARDS) {
    if (card.line && card.line !== lineId) continue;
    if (canPromote(card)) n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Servos

const servoCost = (lineId) => LINES.findIndex((l) => l.id === lineId) + 1;

function servoRate() {
  if (!state.servoOn) return 0;
  let r = BAL.servoBase;
  LINES.forEach((line, i) => {
    r += (state.recruits[line.id] || 0) * (i + 1) * EFFECT.recruta(lv('recruta:' + line.id));
  });
  return r;
}

const recruitGain = (line) => servoCost(line.id) * EFFECT.recruta(lv('recruta:' + line.id));

function recruitCost(line) {
  const n = (state.recruits[line.id] || 0) + 1;
  return [{ res: line.res, amount: Big.pow(BAL.recruitGrowth, n).mul(BAL.recruitBase) }];
}

function recruit(line) {
  if (!state.lines[line.id]) return false;
  const cost = recruitCost(line);
  if (!canAfford(cost)) return false;
  for (const c of cost) addRes(c.res, c.amount.neg());
  state.recruits[line.id] = (state.recruits[line.id] || 0) + 1;
  state.stats.recruits += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Baús

const CHESTS = {
  madeira: { name: 'Baú de Madeira', cards: 2, crowns: 2, odds: [0.88, 0.11, 0.01, 0], sure: null },
  pedra: { name: 'Baú de Pedra', cards: 4, crowns: 5, odds: [0.8, 0.16, 0.035, 0.005], sure: 'rara' },
  ferro: { name: 'Baú de Ferro', cards: 6, crowns: 5, odds: [0.75, 0.2, 0.045, 0.005], sure: 'rara' },
  prata: { name: 'Baú de Prata', cards: 8, crowns: 10, odds: [0.7, 0.22, 0.07, 0.01], sure: 'epica' },
  ouro: { name: 'Baú de Ouro', cards: 15, crowns: 25, odds: [0.6, 0.27, 0.11, 0.02], sure: 'epica' },
};

function rollRarity(odds) {
  let x = Math.random();
  for (let i = 0; i < odds.length; i++) {
    if (x < odds[i]) return RARITY_ORDER[i];
    x -= odds[i];
  }
  return 'comum';
}

// Uma carta da raridade pedida, entre as que já podem cair. As comuns de
// geradores que o jogador tem pesam o dobro. Sem nenhuma, desce de raridade.
function pickCard(rarity) {
  for (let r = RARITY_ORDER.indexOf(rarity); r >= 0; r--) {
    const pool = CARDS.filter((c) => c.rarity === RARITY_ORDER[r] && cardOpen(c));
    if (!pool.length) continue;
    const w = pool.map((c) => (c.gen && state.gens[c.gen].count.sign > 0 ? 2 : 1));
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      x -= w[i];
      if (x < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
  return CARD['fart:' + LINES[0].gens[0]];
}

const chestCards = (type) => Math.max(1, Math.round(CHESTS[type].cards
  * (1 + BAL.chestCardsPerRenome * (state.renome - 1)) * (1 + 0.1 * lv('reino:cartas'))));
const chestCrowns = (type) => Math.round(CHESTS[type].crowns
  * (1 + BAL.chestCrownsPerRenome * (state.renome - 1)) * (1 + 0.25 * lv('reino:tesouro')));

// Sorteia e entrega um baú. fixed = { idDaCarta: cópias } troca o sorteio.
function openChest(type, fixed) {
  const def = CHESTS[type];
  let picks = [];
  if (fixed) {
    for (const [id, k] of Object.entries(fixed)) for (let i = 0; i < k; i++) picks.push(CARD[id]);
  } else {
    const n = chestCards(type);
    const rarities = [];
    for (let i = 0; i < n; i++) rarities.push(i === 0 && def.sure ? def.sure : rollRarity(def.odds));
    if (rarities.includes('lendaria')) state.pity = 0;
    else if (++state.pity >= BAL.pity) {
      rarities[rarities.length - 1] = 'lendaria';
      state.pity = 0;
    }
    picks = rarities.map(pickCard);
  }
  const counts = new Map();
  for (const c of picks) counts.set(c.id, (counts.get(c.id) || 0) + 1);
  const items = [...counts].map(([id, k]) => giveCard(id, k));
  // da comum para a lendária: as melhores viram por último
  items.sort((a, b) => RARITY_ORDER.indexOf(CARD[a.id].rarity) - RARITY_ORDER.indexOf(CARD[b.id].rarity));
  const crowns = chestCrowns(type);
  state.coroas += crowns;
  state.stats.cards += picks.length;
  const chest = { type, crowns, items, cards: picks.length };
  state.chests.push(chest);
  if (state.chests.length > 12) state.chests.shift();
  return chest;
}

// ---------------------------------------------------------------------------
// Missões e Renome

// Contador de cada tipo de missão. Os marcados com "rel" contam a partir de
// quando a missão apareceu (guardam uma base).
const MISSION_TYPES = {
  own: { rel: false, count: (m) => state.gens[m.gen].count },
  gather: { rel: true, count: (m) => state.stats.made[m.res] },
  unlock: { rel: false, count: (m) => (state.lines[m.line] ? 1 : 0) },
  milestone: { rel: true, count: () => state.stats.ms },
  cards: { rel: true, count: () => state.stats.cards },
  spend: { rel: true, count: () => state.stats.spent },
  promote: { rel: true, count: () => state.stats.promos },
  lucky: { rel: true, count: () => state.stats.lucky },
  recruit: { rel: true, count: () => state.stats.recruits },
  servos: { rel: false, count: () => state.res.servos },
};

const GATHER_VERB = { trigo: 'Colha', armas: 'Forje', ervas: 'Colha', minerio: 'Extraia', terras: 'Explore' };

function missionText(m) {
  const n = Big.from(m.n);
  const one = n.eq(1);
  switch (m.t) {
    case 'own': return state.gens[m.gen].seen ? `Tenha ${fmt(n)} ${plural(m.gen, n)}` : `Tenha ${fmt(n)} ???`;
    case 'gather': return `${GATHER_VERB[m.res]} ${fmt(n)} ${plural(m.res, n)}`;
    case 'unlock': return `Abra a linha ${LINE[m.line].name}`;
    case 'milestone': return one ? 'Alcance 1 marco' : `Alcance ${fmt(n)} marcos`;
    case 'cards': return `Junte ${fmt(n)} cartas de baús`;
    case 'spend': return `Gaste ${fmt(n)} coroas em cartas`;
    case 'promote': return one ? 'Promova 1 carta' : `Promova ${fmt(n)} cartas`;
    case 'lucky': return `Tenha ${fmt(n)} colheitas fartas`;
    case 'recruit': return one ? 'Faça 1 recrutamento' : `Faça ${fmt(n)} recrutamentos`;
    case 'servos': return `Junte ${fmt(n)} servos`;
    default: return '?';
  }
}

function missionIcon(m) {
  switch (m.t) {
    case 'own': return state.gens[m.gen].seen ? GEN[m.gen].portrait : 'lock';
    case 'gather': return RES_LABEL[m.res].icon;
    case 'unlock': return LINE[m.line].icon;
    case 'milestone': case 'spend': return 'crown';
    case 'cards': case 'promote': return 'card';
    case 'lucky': return 'clover';
    default: return 'servo';
  }
}

function slotBase(m) {
  return MISSION_TYPES[m.t].rel ? Big.from(MISSION_TYPES[m.t].count(m)).toJSON() : null;
}

function missionProgress(slot) {
  const m = state.mission.list[slot.i];
  const type = MISSION_TYPES[m.t];
  let have = Big.from(type.count(m));
  if (type.rel) have = have.sub(Big.from(slot.base));
  const goal = Big.from(m.n);
  if (have.sign < 0) have = Big.ZERO;
  return { m, have, goal, done: have.gte(goal) };
}

// Números redondos para as metas: 1.234 vira 1.300, 87.512 vira 90.000.
function nice(x) {
  const b = Big.from(x);
  if (b.lt(10)) return Math.max(1, Math.ceil(b.toNumber()));
  if (b.layer > 0) return b.toJSON();
  const L = b.log10();
  const e = Math.floor(L);
  const m = 10 ** (L - e);
  const r = m < 3 ? Math.ceil(m * 10) / 10 : Math.ceil(m * 2) / 2;
  const v = Big.make(r, e);
  return v.small ? Math.round(v.toNumber()) : v.toJSON();
}

// Os quatro primeiros Renomes são escritos à mão e ensinam o jogo.
const RENOMES = [
  { need: 3, list: [
    { t: 'own', gen: 'campones', n: 10, r: 'madeira' },
    { t: 'gather', res: 'trigo', n: 500, r: 'madeira' },
    { t: 'own', gen: 'moinho', n: 1, r: 'madeira' },
  ] },
  { need: 5, list: [
    { t: 'own', gen: 'campones', n: 25, r: 'madeira' },
    { t: 'own', gen: 'moinho', n: 5, r: 'madeira' },
    { t: 'promote', n: 1, r: 'pedra' },
    { t: 'milestone', n: 2, r: 'madeira' },
    { t: 'gather', res: 'trigo', n: 10000, r: 'madeira' },
  ] },
  { need: 6, list: [
    { t: 'own', gen: 'celeiro', n: 1, r: 'madeira' },
    { t: 'unlock', line: 'militar', r: 'pedra', n: 1 },
    { t: 'recruit', n: 1, r: 'madeira' },
    { t: 'own', gen: 'ferreiro', n: 10, r: 'madeira' },
    { t: 'cards', n: 6, r: 'ferro' },
    { t: 'spend', n: 5, r: 'madeira' },
    { t: 'own', gen: 'moinho', n: 50, r: 'madeira' },
  ] },
  { need: 7, list: [
    { t: 'own', gen: 'campones', n: 100, r: 'madeira' },
    { t: 'own', gen: 'forja', n: 5, r: 'madeira' },
    { t: 'own', gen: 'celeiro', n: 10, r: 'madeira' },
    { t: 'gather', res: 'armas', n: 5000, r: 'madeira' },
    { t: 'promote', n: 3, r: 'pedra' },
    { t: 'own', gen: 'granja', n: 1, r: 'madeira' },
    { t: 'milestone', n: 10, r: 15 },
    { t: 'servos', n: 200, r: 'madeira' },
  ] },
];

// Sorteio com semente: o mesmo Renome sempre sorteia na mesma ordem.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Do Renome 5 em diante a lista é montada na hora em que o Renome começa,
// a partir do que o jogador tem: metas um pouco acima do que ele já alcançou.
function makeRenome(r) {
  const rnd = seeded(r * 7919 + 17);
  const need = Math.min(20, 8 + Math.floor((r - 5) / 5));
  const total = need + 3;
  const list = [];
  const open = LINES.filter((l) => state.lines[l.id]);
  const closed = LINES.find((l) => !state.lines[l.id]);
  const used = new Set();
  const reward = (t) => (t === 'cards' ? 'ferro' : rnd() < 0.25 ? 'pedra' : rnd() < 0.15 ? 3 + r : 'madeira');
  if (closed) list.push({ t: 'unlock', line: closed.id, n: 1, r: 'pedra' });
  for (let guard = 0; list.length < total && guard < 200; guard++) {
    const u = rnd();
    const line = open[Math.floor(rnd() * open.length)];
    if (u < 0.45) {
      // possuir: mais vezes o tier mais alto já visto da linha
      const seen = line.gens.filter((id) => state.gens[id].seen);
      const top = seen.length - 1;
      const i = Math.max(0, top - Math.floor(rnd() ** 2 * Math.min(4, seen.length)));
      const id = seen[i];
      if (used.has(id)) continue;
      used.add(id);
      const have = state.gens[id].count;
      // o tier mais alto é comprado (preço sobe a cada unidade); os de baixo
      // são produzidos pelo de cima e crescem sozinhos
      const goal = i === top ? Big.max(have.mul(1.5), have.add(5 + r)) : Big.max(have.mul(10), Big.from(100));
      list.push({ t: 'own', gen: id, n: nice(goal), r: reward('own') });
    } else if (u < 0.65) {
      if (used.has(line.res)) continue;
      used.add(line.res);
      const goal = Big.max(Big.from(100), ratePerSecond(line.res).mul(60 * (10 + 2 * r)));
      list.push({ t: 'gather', res: line.res, n: nice(goal), r: reward('gather') });
    } else {
      const lucky = LINES.some((l) => lv('sorte:' + l.id) > 0);
      const kinds = ['cards', 'promote', 'spend', 'milestone', 'recruit', 'servos', ...(lucky ? ['lucky'] : [])];
      const t = kinds[Math.floor(rnd() * kinds.length)];
      if (list.some((m) => m.t === t)) continue;
      const n = {
        cards: () => nice(5 + 2 * r),
        promote: () => 1 + Math.floor(r / 4),
        spend: () => nice(5 * r),
        milestone: () => 2 + Math.floor(r / 3),
        recruit: () => 1,
        servos: () => nice(Math.max(50, servoRate() * 300)),
        lucky: () => nice(20 * r),
      }[t]();
      list.push({ t, n, r: reward(t) });
    }
  }
  return { need: Math.min(need, list.length), list };
}

function openSlot(i) {
  return { i, base: slotBase(state.mission.list[i]) };
}

// Começa o Renome atual: monta a lista e mostra as 3 primeiras missões.
function startRenome() {
  const r = state.renome;
  const def = r <= RENOMES.length ? RENOMES[r - 1] : makeRenome(r);
  state.mission = { list: def.list.map((m) => ({ ...m })), need: def.need, done: 0, next: 0, slots: [] };
  for (let k = 0; k < 3; k++) fillSlot(k);
}

const missionsReady = () => state.mission.slots.filter((s) => missionProgress(s).done).length;

// Coleta a missão do slot: entrega a recompensa e, com as exigidas feitas,
// sobe o Renome. Devolve os baús abertos (para a animação) e as coroas diretas.
function collectMission(k) {
  const slot = state.mission.slots[k];
  if (!slot || !missionProgress(slot).done) return null;
  const m = state.mission.list[slot.i];
  const out = { chests: [], crowns: 0, renome: 0 };
  if (typeof m.r === 'number') {
    state.coroas += m.r;
    out.crowns = m.r;
  } else {
    // a primeira missão do jogo sempre dá a ferramenta do camponês
    const first = !state.stats.missions;
    out.chests.push(openChest(m.r, first ? { ['fart:' + LINES[0].gens[0]]: 3 } : null));
  }
  state.stats.missions = (state.stats.missions || 0) + 1;
  state.mission.done += 1;
  if (state.mission.done >= state.mission.need) {
    state.renome += 1;
    out.renome = state.renome;
    out.chests.push(openChest(state.renome % 5 === 0 ? 'ouro' : 'prata'));
    startRenome();
  } else {
    state.mission.slots.splice(k, 1);
    fillSlot(k);
  }
  return out;
}

// As missões de cartas e coroas só andam com os baús das outras missões.
// Para o Renome nunca travar, a fila nunca deixa as três vagas só com
// missões assim: puxa uma de produção para a frente ou, se a lista acabou,
// acrescenta uma.
const NEEDS_CHESTS = new Set(['cards', 'spend', 'promote']);
function fillSlot(k) {
  const ms = state.mission;
  const others = ms.slots.filter((s) => !missionProgress(s).done).map((s) => ms.list[s.i]);
  // no máximo uma missão de cartas ou coroas à mostra por vez
  const metaShown = others.some((m) => NEEDS_CHESTS.has(m.t));
  const allMeta = others.length > 0 && others.every((m) => NEEDS_CHESTS.has(m.t));
  const ok = (m) => !(metaShown && NEEDS_CHESTS.has(m.t));
  let j = ms.next;
  while (j < ms.list.length && !ok(ms.list[j])) j++;
  if (j >= ms.list.length) {
    if (ms.next < ms.list.length || !allMeta) {
      if (ms.next >= ms.list.length) return; // nada mais na fila
      j = ms.next;
    } else {
      const line = LINES.filter((l) => state.lines[l.id]).pop();
      const goal = Big.max(Big.from(100), ratePerSecond(line.res).mul(60 * (10 + 2 * state.renome)));
      ms.list.push({ t: 'gather', res: line.res, n: nice(goal), r: 'madeira' });
      j = ms.list.length - 1;
    }
  }
  // traz a escolhida para a posição "next" (a ordem do resto não muda)
  const [m] = ms.list.splice(j, 1);
  ms.list.splice(ms.next, 0, m);
  ms.slots.splice(k, 0, openSlot(ms.next++));
}

// ---------------------------------------------------------------------------
// Estado novo e saves antigos

function freshMeta() {
  const made = {};
  for (const line of LINES) made[line.res] = Big.ZERO;
  return {
    cards: {},
    renome: 1,
    mission: null,
    chests: [],
    pity: 0,
    servoOn: false,
    recruits: {},
    stats: { made, ms: 0, cards: 0, spent: 0, promos: 0, lucky: 0, recruits: 0, missions: 0 },
  };
}

// Junta o que o save tinha com os padrões. Devolve true se o save é de antes
// das cartas (para dar o baú de boas-vindas).
function loadMeta(saved, into) {
  const base = freshMeta();
  const old = !saved.cards;
  Object.assign(into, base);
  if (old) return true;
  for (const [id, c] of Object.entries(saved.cards || {})) {
    if (CARD[id]) into.cards[id] = { lv: Math.min(c.lv | 0, RARITIES[CARD[id].rarity].max), n: Math.max(0, c.n | 0) };
  }
  into.renome = Math.max(1, saved.renome | 0);
  into.pity = saved.pity | 0;
  into.servoOn = !!saved.servoOn;
  into.recruits = { ...(saved.recruits || {}) };
  const st = saved.stats || {};
  for (const k of ['ms', 'cards', 'spent', 'promos', 'lucky', 'recruits', 'missions']) into.stats[k] = Number(st[k]) || 0;
  for (const res in into.stats.made) if (st.made && st.made[res] != null) into.stats.made[res] = Big.from(st.made[res]);
  const ms = saved.mission;
  if (ms && Array.isArray(ms.list) && Array.isArray(ms.slots)) into.mission = ms;
  into.chests = Array.isArray(saved.chests) ? saved.chests.filter((c) => CHESTS[c.type]) : [];
  return false;
}
