'use strict';
// Telas das cartas, das missões, do recrutamento e da abertura de baús. As
// regras ficam em meta.js; aqui só se monta e atualiza o DOM. Como no resto
// do jogo, os textos mudam no máximo 15 vezes por segundo e nada lê layout a
// cada quadro.

const RARITY_SOUND = { comum: 'flip', rara: 'flip2', epica: 'flip3', lendaria: 'flip4' };

// ---------------------------------------------------------------------------
// A carta de pé: arte em cima, o nome, o efeito e a barra das cópias. A mesma
// peça aparece na aba Cartas e na abertura dos baús; a raridade é a cor.

// Arte em escala inteira, o maior possível dentro de px
function cardArt(card, px) {
  const base = ART.iconCanvas(card.icon, 1).width;
  return ART.iconCanvas(card.icon, Math.max(1, Math.floor(px / base)));
}

function buildCardFace(card, px, longAt = 16) {
  const face = el('article', 'tcard r-' + card.rarity);
  const art = el('div', 'tcard-art');
  const lvl = el('span', 'tcard-lv');
  const badge = el('span', 'tcard-badge');
  badge.hidden = true;
  art.append(cardArt(card, px), lvl, badge);
  const name = el('h3', 'tcard-name');
  name.append(el('span', null, card.name));
  if (card.name.length > longAt) name.classList.add('long');
  const label = el('span', 'tcard-label', KINDS[card.kind].label);
  const eff = el('span', 'tcard-eff');
  const bar = el('div', 'bar tcard-bar fr fr-slot');
  const fill = el('div', 'fill');
  const barText = el('span', 'bar-text');
  bar.append(fill, barText);
  face.append(art, name, label, eff, bar);
  return { face, art, lvl, badge, eff, bar, fill, barText, fillP: -1 };
}

function setCardFill(f, p) {
  if (p === f.fillP) return;
  f.fillP = p;
  f.fill.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(3)}% 0 0)`;
}

// Nível, efeito e cópias de uma carta no estado dado (lv, n)
function paintCardFace(f, card, lvNow, n) {
  const max = RARITIES[card.rarity].max;
  setText(f.lvl, lvNow >= max ? 'Máx' : 'Nv ' + lvNow);
  f.lvl.hidden = lvNow === 0;
  setText(f.eff, cardEffectValue(card, lvNow));
  setClass(f.face, 'missing', lvNow === 0);
  if (lvNow === 0) {
    setText(f.barText, 'Não encontrada');
    return 0;
  }
  if (lvNow >= max) {
    setText(f.barText, 'Nível máximo');
    return 1;
  }
  const need = BAL.copies[lvNow];
  setText(f.barText, `${fmt(n)} / ${fmt(need)}`);
  return Math.min(1, n / need);
}

// ---------------------------------------------------------------------------
// Aba Cartas: uma grade de cartas, cada uma com o botão de promover embaixo

function buildCardRow(card) {
  const f = buildCardFace(card, 120);
  const btn = el('button', 'btn buy tcard-btn');
  btn.type = 'button';
  const label = el('span', 'buy-label', 'Promover');
  const chip = el('span', 'cost-chip');
  const num = el('span', 'cost-num');
  chip.append(ART.iconCanvas('crown', 2), num);
  btn.append(label, chip);
  SFX.bind(btn, 'press');
  btn.addEventListener('click', () => {
    if (promote(card)) {
      btn.sfxResult = 'coin';
      replay(f.art, 'pulse');
      toast(`${card.name} subiu para o nível ${lv(card.id)}! ${cardEffect(card).replace(/ →.*/, '')}`);
      renderNow();
    } else {
      btn.sfxResult = 'thud';
      replay(btn, 'nope');
    }
  });
  f.face.append(btn);
  return { card, row: f.face, f, btn, label, chip, num };
}

function buildCardBox(line) {
  const box = el('div', 'cardbox');
  box.append(el('p', 'upg-intro', 'Cartas vêm dos baús das missões. Promover gasta cópias da carta e coroas.'));
  const mine = CARDS.filter((c) => c.line === line.id);
  const lineCards = mine.filter((c) => !c.gen);
  const tools = mine.filter((c) => c.gen);
  const kingdom = CARDS.filter((c) => !c.line);
  const section = (title) => el('h3', 'card-section', title);
  const rows = [];
  const grid = (cards) => {
    const g = el('div', 'card-grid');
    for (const c of cards) {
      const r = buildCardRow(c);
      rows.push(r);
      g.append(r.row);
    }
    return g;
  };
  const teaser = el('div', 'teaser');
  const teaserText = el('span');
  teaser.append(ART.iconCanvas('lock', 2), teaserText);
  box.append(section('Linha ' + line.name), grid([...lineCards, ...tools]), teaser, section('Reino'), grid(kingdom));
  ui.cardBoxes[line.id] = { node: box, rows, teaser, teaserText, shown: -1 };
  return box;
}

function renderCards(line) {
  const cb = ui.cardBoxes[line.id];
  let hidden = 0;
  for (const r of cb.rows) {
    const show = cardOpen(r.card);
    if (r.row.hidden === show) r.row.hidden = !show;
    if (!show) { hidden += 1; continue; }
    const card = r.card;
    const c = state.cards[card.id] || { lv: 0, n: 0 };
    setCardFill(r.f, paintCardFace(r.f, card, c.lv, c.n));
    const need = promoteNeed(card);
    const ok = canPromote(card);
    setOk(r.btn, ok);
    setClass(r.row, 'ready', ok);
    r.chip.hidden = !need;
    setText(r.label, c.lv === 0 ? 'Não tem' : need ? 'Promover' : 'No máximo');
    if (need) {
      setText(r.num, fmt(need.crowns));
      setClass(r.chip, 'short', state.coroas < need.crowns);
    }
  }
  if (cb.shown !== hidden) {
    cb.shown = hidden;
    cb.teaser.hidden = hidden === 0;
    setText(cb.teaserText, hidden === 1 ? 'Mais 1 carta por descobrir' : `Mais ${hidden} cartas por descobrir`);
  }
}

// ---------------------------------------------------------------------------
// Recrutamento: faixa no topo da cadeia de cada linha

function buildRecruit(line) {
  const box = el('div', 'recruit fr fr-wood');
  const pic = el('span', 'recruit-pic');
  pic.append(ART.iconCanvas('servo', 3));
  const txt = el('div', 'recruit-txt');
  const title = el('h3', 'recruit-title', 'Recrutamento');
  const info = el('span', 'recruit-info');
  txt.append(title, info);
  const btn = el('button', 'btn buy recruit-btn');
  btn.type = 'button';
  const chip = costChip(line.res);
  btn.append(el('span', 'buy-label', 'Recrutar'), chip.chip);
  SFX.bind(btn, 'press');
  btn.addEventListener('click', () => {
    if (recruit(line)) {
      btn.sfxResult = 'unlock';
      bump(ui.servoNum);
      toast(`Novos servos chegaram! Agora nascem ${fmtRate(servoRate())} por segundo.`);
      renderNow();
    } else {
      btn.sfxResult = 'thud';
      replay(btn, 'nope');
    }
  });
  box.append(pic, txt, btn);
  ui.recruits[line.id] = { box, info, btn, chip };
  return box;
}

function renderRecruit(line) {
  const r = ui.recruits[line.id];
  const show = state.renome >= 2 || (state.recruits[line.id] || 0) > 0;
  if (r.box.hidden === show) r.box.hidden = !show;
  if (!show) return;
  const n = state.recruits[line.id] || 0;
  const gain = recruitGain(line);
  setText(r.info, `${n === 1 ? '1 feito' : n + ' feitos'} · cada um dá +${fmt(gain)} ${gain === 1 ? 'servo' : 'servos'}/s`);
  const cost = recruitCost(line);
  setText(r.chip.num, fmt(cost[0].amount));
  const ok = canAfford(cost);
  setClass(r.chip.chip, 'short', !ok);
  setOk(r.btn, ok);
}

// ---------------------------------------------------------------------------
// Missões: o Renome e três missões por vez

function buildMissions() {
  const box = el('section', 'missions');
  box.hidden = true;
  const head = el('div', 'mis-head fr fr-wood');
  const title = el('h3', 'mis-title');
  const bar = el('div', 'bar mbar fr fr-slot');
  const fill = el('div', 'fill mark-fill');
  const barText = el('span', 'bar-text');
  bar.append(fill, barText);
  head.append(ART.iconCanvas('crown', 3), title, bar);
  box.append(head);
  const rows = [0, 1, 2].map((k) => {
    const row = el('article', 'mis-row fr fr-wood');
    const pic = el('span', 'mis-pic fr fr-gold');
    const main = el('div', 'mis-main');
    const text = el('h3', 'mis-text');
    const mbar = el('div', 'bar fr fr-slot');
    const mfill = el('div', 'fill mark-fill');
    const mtext = el('span', 'bar-text');
    mbar.append(mfill, mtext);
    main.append(text, mbar);
    const reward = el('div', 'mis-reward');
    const rewardText = el('span', 'mis-reward-text');
    const btn = el('button', 'btn buy mis-btn');
    btn.type = 'button';
    btn.append(el('span', 'buy-label', 'Coletar'));
    SFX.bind(btn, 'press');
    btn.addEventListener('click', () => onCollect(k, btn));
    reward.append(rewardText, btn);
    row.append(pic, main, reward);
    box.append(row);
    return { row, pic, picKey: '', text, mfill, mtext, fillP: -1, rewardText, btn, rewardKey: '' };
  });
  const more = el('p', 'teaser mis-more');
  box.append(more);
  ui.missions = { node: box, title, fill, barText, rows, more, fillP: -1 };
  return box;
}

const rewardName = (r) => (typeof r === 'number' ? `+${r} coroas` : CHESTS[r].name);

// O que a tela mostra de uma missão da vez (na aba Missões e no topo).
function slotView(slot) {
  const pr = missionProgress(slot);
  return {
    m: pr.m,
    done: pr.done,
    icon: missionIcon(pr.m),
    text: missionText(pr.m),
    count: `${fmt(Big.min(pr.have, pr.goal))} / ${fmt(pr.goal)}`,
    f: pr.done ? 1 : Math.min(1, pr.have.div(pr.goal).toNumber() || 0),
    rk: typeof pr.m.r === 'number' ? 'crown' : 'chest-' + pr.m.r,
  };
}

function renderMissions() {
  const mu = ui.missions;
  const ms = state.mission;
  setText(mu.title, 'Renome ' + state.renome);
  setText(mu.barText, `${ms.done} / ${ms.need} missões para o próximo Renome`);
  const p = Math.min(1, ms.done / ms.need);
  if (p !== mu.fillP) {
    mu.fillP = p;
    mu.fill.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(3)}% 0 0)`;
  }
  mu.rows.forEach((r, k) => {
    const slot = ms.slots[k];
    if (r.row.hidden === !!slot) r.row.hidden = !slot;
    if (!slot) return;
    const v = slotView(slot);
    if (r.picKey !== v.icon) {
      r.picKey = v.icon;
      r.pic.replaceChildren(ART.iconCanvas(v.icon, 3));
    }
    setText(r.text, v.text);
    setText(r.mtext, v.count);
    if (v.f !== r.fillP) {
      r.fillP = v.f;
      r.mfill.style.clipPath = `inset(0 ${((1 - v.f) * 100).toFixed(3)}% 0 0)`;
    }
    if (r.rewardKey !== v.rk) {
      r.rewardKey = v.rk;
      r.rewardText.replaceChildren(ART.iconCanvas(v.rk, 3), el('span', null, rewardName(v.m.r)));
    }
    setOk(r.btn, v.done);
    setClass(r.row, 'done', v.done);
  });
  const left = ms.list.length - ms.next;
  const spare = Math.max(0, ms.list.length - ms.need);
  setText(mu.more, left > 0
    ? `Mais ${left} ${left === 1 ? 'missão' : 'missões'} na fila deste Renome` + (spare ? ` (${spare} de sobra)` : '')
    : 'Nenhuma missão nova na fila deste Renome');
}

// As missões da vez também ficam no topo, sempre à vista, com o botão de
// coletar. Uma vaga vazia guarda o lugar, para o topo não mudar de tamanho.
function buildHudMissions() {
  const box = document.getElementById('hud-missions');
  ui.hudMis = [0, 1, 2].map((k) => {
    const chip = el('article', 'mis-chip fr fr-slot');
    chip.setAttribute('role', 'listitem');
    const pic = el('span', 'chip-pic');
    const main = el('div', 'chip-main');
    const text = el('span', 'chip-text');
    const prog = el('div', 'chip-prog');
    const bar = el('span', 'chip-bar');
    const fill = el('span', 'chip-fill');
    bar.append(fill);
    const num = el('span', 'chip-num');
    prog.append(bar, num);
    main.append(text, prog);
    const btn = el('button', 'btn buy chip-btn');
    btn.type = 'button';
    const reward = el('span', 'chip-reward');
    btn.append(reward, el('span', 'chip-go', 'Coletar'));
    SFX.bind(btn, 'press');
    btn.addEventListener('click', () => onCollect(k, btn));
    chip.append(pic, main, btn);
    box.append(chip);
    return { chip, pic, picKey: '', text, fill, fillP: -1, num, btn, reward, rewardKey: '' };
  });
}

function renderHudMissions() {
  const slots = state.mission.slots;
  ui.hudMis.forEach((r, k) => {
    const slot = slots[k];
    setClass(r.chip, 'empty', !slot);
    if (!slot) return;
    const v = slotView(slot);
    if (r.picKey !== v.icon) {
      r.picKey = v.icon;
      r.pic.replaceChildren(ART.iconCanvas(v.icon, 2));
    }
    setText(r.text, v.text);
    setText(r.num, v.count);
    if (v.f !== r.fillP) {
      r.fillP = v.f;
      r.fill.style.transform = `scaleX(${v.f})`;
    }
    if (r.rewardKey !== v.rk) {
      r.rewardKey = v.rk;
      r.reward.replaceChildren(ART.iconCanvas(v.rk, 2));
      r.btn.title = 'Recompensa: ' + rewardName(v.m.r);
    }
    setOk(r.btn, v.done);
    setClass(r.chip, 'done', v.done);
  });
}

function onCollect(k, btn) {
  const out = collectMission(k);
  if (!out) {
    btn.sfxResult = 'thud';
    replay(btn, 'nope');
    return;
  }
  btn.sfxResult = 'coin';
  if (out.crowns) {
    bump(ui.crowns);
    toast(`+${out.crowns} coroas!`);
  }
  if (out.renome) toast(`Renome ${out.renome}! Novas missões e um ${CHESTS[out.chests[out.chests.length - 1].type].name}.`);
  for (const c of out.chests) queueChest(c);
  renderNow();
}

// Avisa uma vez quando uma missão fica pronta para coletar. As que já
// estavam prontas ao abrir o jogo (quiet) só entram na lista, sem aviso.
const missionNoticed = new Set();
function checkMissionNotices(quiet) {
  for (const slot of state.mission.slots) {
    const key = state.renome + ':' + slot.i;
    if (missionNoticed.has(key) || !missionProgress(slot).done) continue;
    missionNoticed.add(key);
    if (quiet) continue;
    SFX.play('unlock');
    toast(`Missão cumprida: ${missionText(state.mission.list[slot.i])}. Colete no topo!`);
  }
}

// ---------------------------------------------------------------------------
// Abertura de baú: cai, balança, abre e as cartas viram uma a uma

const chestQueue = [];
let chestShowing = null;

function buildChestLayer() {
  const layer = el('div', 'chest-layer');
  layer.hidden = true;
  const box = el('div', 'chest-box');
  const title = el('p', 'chest-title');
  const pic = el('canvas', 'chest-pic');
  pic.width = 32;
  pic.height = 32;
  const cards = el('div', 'chest-cards');
  const crowns = el('p', 'chest-crowns');
  const hint = el('p', 'chest-hint');
  box.append(title, pic, cards, crowns, hint);
  layer.append(box);
  layer.addEventListener('click', advanceChest);
  document.addEventListener('keydown', (e) => {
    if (!layer.hidden && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
      e.preventDefault();
      advanceChest();
    }
  });
  ui.chest = { layer, title, pic, ctx: pic.getContext('2d'), cards, crowns, hint, stage: '', timers: [], tiles: [] };
  document.body.append(layer);
}

function queueChest(chest) {
  chestQueue.push(chest);
  if (!chestShowing) showNextChest();
}

function showNextChest() {
  const ch = ui.chest;
  ch.timers.forEach(clearTimeout);
  ch.timers = [];
  chestShowing = chestQueue.shift() || null;
  if (!chestShowing) {
    ch.layer.hidden = true;
    return;
  }
  const c = chestShowing;
  ch.layer.hidden = false;
  ch.stage = 'closed';
  ch.layer.className = 'chest-layer';
  setText(ch.title, CHESTS[c.type].name);
  ART.chest(c.type, false).draw(ch.ctx);
  ch.cards.replaceChildren();
  setText(ch.crowns, '');
  setText(ch.hint, 'Toque para abrir');
  replay(ch.pic, 'chest-drop');
  SFX.play('chest');
  ch.timers.push(setTimeout(() => { if (ch.stage === 'closed') openShownChest(); }, 1400));
}

function bestRarity(c) {
  let best = 0;
  for (const it of c.items) best = Math.max(best, RARITY_ORDER.indexOf(CARD[it.id].rarity));
  return RARITY_ORDER[best];
}

function openShownChest() {
  const ch = ui.chest;
  const c = chestShowing;
  ch.stage = 'opening';
  ART.chest(c.type, true).draw(ch.ctx);
  ch.layer.classList.add('open', 'glow-' + bestRarity(c));
  replay(ch.pic, 'chest-pop');
  SFX.play('lid');
  setText(ch.hint, '');
  const many = c.items.length + 1 > 8;
  setClass(ch.cards, 'many', many);
  const tiles = c.items.map((it) => {
    const card = CARD[it.id];
    const f = buildCardFace(card, many ? 72 : 96, 12);
    f.face.classList.add('chest-card');
    // o retrato guardado no baú; baús salvos antes dele usam o estado de agora
    const st = state.cards[card.id] || { lv: 0, n: 0 };
    const lvNow = it.lv ?? st.lv;
    const nNow = it.n ?? st.n;
    const maxed = lvNow >= RARITIES[card.rarity].max;
    const end = paintCardFace(f, card, lvNow, nNow);
    // a barra começa em quanto havia antes do baú e enche até o que ficou
    const before = it.fresh ? 0 : Math.max(0, nNow - it.k);
    const start = maxed || it.fresh ? end : Math.min(1, before / BAL.copies[lvNow]);
    setCardFill(f, start);
    if (it.crowns) setText(f.barText, `+${fmt(it.crowns)} coroas`);
    f.badge.hidden = false;
    setText(f.badge, it.fresh ? 'Nova!' : '+' + it.k);
    setClass(f.badge, 'fresh', it.fresh);
    f.face.hidden = true;
    ch.cards.append(f.face);
    return { f, rarity: card.rarity, end };
  });
  // as coroas do baú viram uma carta também, a última da fileira
  if (c.crowns) {
    const face = el('article', 'tcard chest-card crown-card');
    const art = el('div', 'tcard-art');
    art.append(ART.iconCanvas('crown', many ? 4 : 6));
    const name = el('h3', 'tcard-name');
    name.append(el('span', null, 'Coroas'));
    face.append(art, name, el('span', 'tcard-eff', '+' + fmt(c.crowns)));
    face.hidden = true;
    ch.cards.append(face);
    tiles.push({ f: { face, bar: null }, sound: 'coin', end: 0 });
  }
  ch.tiles = tiles;
  const gap = Math.max(90, Math.min(260, 2400 / Math.max(1, tiles.length)));
  tiles.forEach((t, i) => {
    ch.timers.push(setTimeout(() => {
      t.f.face.hidden = false;
      t.f.face.classList.add('flip');
      SFX.play(t.sound || RARITY_SOUND[t.rarity]);
      if (t.f.bar) ch.timers.push(setTimeout(() => { t.f.bar.classList.add('grow'); setCardFill(t.f, t.end); }, 300));
    }, 450 + i * gap));
  });
  ch.timers.push(setTimeout(() => finishShownChest(), 450 + tiles.length * gap + 200));
}

function finishShownChest() {
  const ch = ui.chest;
  const c = chestShowing;
  if (!c || ch.stage === 'done') return;
  ch.timers.forEach(clearTimeout);
  ch.timers = [];
  for (const t of ch.tiles) {
    t.f.face.hidden = false;
    t.f.face.classList.remove('flip');
    if (!t.f.bar) continue;
    t.f.bar.classList.add('grow');
    setCardFill(t.f, t.end);
  }
  ch.stage = 'done';
  setText(ch.crowns, `${c.cards} ${c.cards === 1 ? 'carta' : 'cartas'} no total`);
  setText(ch.hint, chestQueue.length ? `Toque para o próximo baú (mais ${chestQueue.length})` : 'Toque para fechar');
  bump(ui.crowns);
}

function advanceChest() {
  const ch = ui.chest;
  if (!chestShowing) return;
  if (ch.stage === 'closed') return openShownChest();
  if (ch.stage === 'opening') return finishShownChest();
  // fechado e visto: sai da pilha de baús não vistos do save
  const i = state.chests.indexOf(chestShowing);
  if (i >= 0) state.chests.splice(i, 1);
  SFX.play('tab');
  showNextChest();
  renderNow();
}

// ---------------------------------------------------------------------------
// Painel do gerador: abre pelo botão Detalhes do cartão. Mostra o retrato, os
// números que saíram do cartão, os marcos e as cartas que mexem nele.

// As cartas que valem para um gerador: a ferramenta dele, as da linha e as do
// reino que mexem na produção.
const genInfoCards = (gen) => [
  'fart:' + gen.id, 'ritmo:' + gen.line, 'sorte:' + gen.line, 'bonanca:' + gen.line, 'desconto:' + gen.line,
  'reino:fartura', 'reino:sorte', 'reino:bonanca', 'reino:desconto',
].map((id) => CARD[id]);

function infoStat(label) {
  const box = el('div', 'stat fr fr-slot');
  const line = el('span', 'stat-value');
  const value = el('span');
  const icon = el('span', 'info-icon');
  line.append(value, icon);
  box.append(el('span', 'stat-label', label), line);
  return { box, value, icon };
}

function buildGenInfo() {
  const layer = el('div', 'info-layer');
  layer.hidden = true;
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-labelledby', 'info-name');
  const box = el('div', 'info-box fr fr-wood');
  const close = el('button', 'btn info-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Fechar');
  SFX.bind(close, 'tab');
  close.addEventListener('click', closeGenInfo);

  // retrato, nome e o que ele faz
  const top = el('div', 'info-top');
  const pic = portraitFrame(1, '');
  const who = el('div', 'info-who');
  const name = el('h2', 'info-name');
  name.id = 'info-name';
  const sub = el('p', 'info-sub');
  const blurb = el('p', 'info-blurb');
  const count = el('p', 'info-count');
  who.append(name, sub, blurb, count);
  top.append(pic.frame, who);

  const stats = el('div', 'info-stats');
  const st = {
    perCycle: infoStat('Por ciclo'), cycle: infoStat('Ciclo'), perSec: infoStat('Por segundo'),
    total: infoStat('Produzido'), bought: infoStat('Comprados'), marks: infoStat('Marcos'),
  };
  for (const k of Object.keys(st)) stats.append(st[k].box);
  const left = el('div', 'info-left');
  left.append(top, stats);

  // efeito somado das cartas e a lista delas
  const right = el('div', 'info-right');
  const sums = el('div', 'info-sums');
  const sm = { power: infoStat('Produção'), speed: infoStat('Velocidade'), luck: infoStat('Colheita farta'), price: infoStat('Preço') };
  for (const k of Object.keys(sm)) sums.append(sm[k].box);
  const list = el('div', 'info-cards');
  right.append(el('h3', 'info-title', 'Melhorias'), sums, list);

  box.append(close, left, right);
  layer.append(box);
  // clique fora da caixa fecha
  layer.addEventListener('click', (e) => { if (e.target === layer) closeGenInfo(); });
  document.addEventListener('keydown', (e) => {
    if (!layer.hidden && e.key === 'Escape') {
      e.preventDefault();
      closeGenInfo();
    }
  });
  document.body.append(layer);
  ui.info = { layer, close, pic, name, sub, blurb, count, st, sm, list, rows: [], gen: null, from: null };
}

function openGenInfo(gen, from) {
  const u = ui.info;
  u.gen = gen;
  u.from = from;
  const madeIcon = RES_LABEL[gen.makes].icon;
  setText(u.name, gen.name);
  u.sub.replaceChildren(`Tier ${gen.tier} da linha ${LINE[gen.line].name} · produz`, ART.iconCanvas(madeIcon, 2), RES_LABEL[gen.makes].many);
  setText(u.blurb, gen.blurb);
  u.pic.frame.querySelector('.badge').textContent = 'T' + gen.tier;
  u.pic.canvas.setAttribute('aria-label', 'Retrato: ' + gen.name);
  for (const k of ['perCycle', 'perSec', 'total']) u.st[k].icon.replaceChildren(ART.iconCanvas(madeIcon, 2));
  u.st.marks.icon.replaceChildren(ART.iconCanvas('crown', 2));
  u.layer.style.setProperty('--accent', gen.accent);
  u.rows = genInfoCards(gen).map((card) => {
    const row = el('div', 'info-card fr fr-slot r-' + card.rarity);
    const icon = el('span', 'info-card-pic');
    icon.append(cardArt(card, 48));
    const text = el('div', 'info-card-text');
    const nm = el('span', 'info-card-name', card.name);
    const lvl = el('span', 'info-card-lv');
    text.append(nm, lvl);
    const eff = el('span', 'info-card-eff');
    row.append(icon, text, eff);
    return { card, row, lvl, eff };
  });
  u.list.replaceChildren(...u.rows.map((r) => r.row));
  u.layer.hidden = false;
  document.documentElement.style.overflow = 'hidden'; // a página não rola por trás
  renderGenInfo();
  u.close.focus();
}

function closeGenInfo() {
  const u = ui.info;
  if (!u || u.layer.hidden) return;
  u.layer.hidden = true;
  document.documentElement.style.overflow = '';
  if (u.from) u.from.focus();
  u.gen = null;
}

function renderGenInfo() {
  const u = ui.info;
  if (!u || !u.gen) return;
  const gen = u.gen;
  const g = state.gens[gen.id];
  const cyc = cycleOf(gen);
  setText(u.count, `Você tem ${fmt(g.count)}`);
  setText(u.st.perCycle.value, '+' + fmt(g.count.mul(amountOf(gen))));
  setText(u.st.cycle.value, fmtCycle(cyc));
  setText(u.st.perSec.value, fmtRate(g.count.mul(avgAmount(gen)).div(cyc)) + '/s');
  setText(u.st.total.value, fmt(g.made));
  setText(u.st.bought.value, fmt(g.bought));
  setText(u.st.marks.value, String(g.ms));

  const luck = luckOf(gen);
  setText(u.sm.power.value, '×' + dec(EFFECT.fartura(lv('fart:' + gen.id)) * EFFECT.rfartura(lv('reino:fartura'))));
  setText(u.sm.speed.value, '×' + dec(EFFECT.ritmo(lv('ritmo:' + gen.line))));
  setText(u.sm.luck.value, luck ? `${pct(luck)} · ×${dec(bonusOf(gen))}` : 'nenhuma');
  setText(u.sm.price.value, '÷' + dec(discountOf(gen.line)));

  for (const r of u.rows) {
    const now = lv(r.card.id);
    const max = RARITIES[r.card.rarity].max;
    setClass(r.row, 'none', now === 0);
    setText(r.lvl, now ? `${RARITIES[r.card.rarity].name} · nível ${now}/${max}` : `${RARITIES[r.card.rarity].name} · ainda não tem`);
    setText(r.eff, now ? KINDS[r.card.kind].eff(now) : '');
  }
}

// O retrato do painel anima junto com os do cartão (chamado por paintArt).
function paintGenInfo(t) {
  const u = ui.info;
  if (!u || !u.gen) return;
  const gen = u.gen;
  ART.portraits[gen.portrait](u.pic.ctx, t, { angle: millAngle, working: state.gens[gen.id].count.sign > 0 });
}

// ---------------------------------------------------------------------------
// Topo: coroas, servos, Renome e as missões da vez

function renderHud() {
  const crowns = Math.floor(state.coroas);
  setText(ui.crownNum, fmt(crowns));
  setTitle(ui.crowns, `Coroas: ${fullNum(crowns)}\nVêm dos marcos dos geradores e dos baús.`);
  const servos = state.res.servos.floor();
  const rate = state.servoOn ? fmtRate(servoRate()) : '0';
  setText(ui.servoNum, fmt(servos));
  setText(ui.servoRate, `+${rate}/s`);
  setTitle(ui.servos, `Servos: ${fullNum(servos)} (+${rate} por segundo)\nTodo gerador comprado custa servos. Nascem sozinhos depois da primeira compra.`);
  const ms = state.mission;
  const done = Math.min(ms.done, ms.need);
  setText(ui.renomeNum, String(state.renome));
  setTitle(ui.renome, `Renome ${state.renome} · ${done} de ${ms.need} missões feitas\nSobe quando você cumpre as missões dele.`);
  renderRankTrack();
  renderHudMissions();
  const line = LINE[state.line];
  const ready = state.lines[line.id] ? promotableCount(line.id) : 0;
  setText(ui.cardBadge, ready ? String(ready) : '');
  setClass(ui.cardBadge, 'on', ready > 0);
  const mready = missionsReady();
  setText(ui.misBadge, mready ? String(mready) : '');
  setClass(ui.misBadge, 'on', mready > 0);
}

// Trilha do Renome, entre o topo e a cena: um bloco por missão exigida
// (feitas em ouro, prontas para coletar em verde) e, no fim, o baú que vem
// ao subir de nível.
function buildRankTrack() {
  const node = document.getElementById('rank-track');
  const from = el('span', 'rank-end');
  const fromNum = el('span');
  from.append(ART.iconCanvas('banner', 2), fromNum);
  const blocks = el('div', 'rank-blocks');
  const to = el('span', 'rank-end rank-to');
  const toNum = el('span');
  const chest = el('span', 'rank-chest');
  to.append(toNum, chest);
  node.append(from, blocks, to);
  ui.rank = { node, fromNum, toNum, blocks, chest, need: -1, done: -1, ready: -1, renome: -1 };
}

function renderRankTrack() {
  const r = ui.rank;
  const ms = state.mission;
  const done = Math.min(ms.done, ms.need);
  const ready = Math.min(missionsReady(), ms.need - done);
  if (r.need !== ms.need) {
    r.need = ms.need;
    r.blocks.replaceChildren(...Array.from({ length: ms.need }, () => el('span', 'rank-block')));
    r.blocks.style.setProperty('--n', ms.need);
    r.done = -1;
  }
  if (r.done !== done || r.ready !== ready) {
    r.done = done;
    r.ready = ready;
    [...r.blocks.children].forEach((b, i) => {
      setClass(b, 'done', i < done);
      setClass(b, 'ready', i >= done && i < done + ready);
    });
  }
  if (r.renome !== state.renome) {
    r.renome = state.renome;
    setText(r.fromNum, 'Renome ' + state.renome);
    setText(r.toNum, 'Nível ' + (state.renome + 1));
    const type = (state.renome + 1) % 5 === 0 ? 'ouro' : 'prata';
    r.chest.replaceChildren(ART.iconCanvas('chest-' + type, 2));
    r.node.title = `Cumpra ${ms.need} missões para chegar ao Renome ${state.renome + 1} e ganhar um ${CHESTS[type].name}`;
  }
}

// Liga a parte nova da tela; chamada por init() em game.js.
function initMeta() {
  ui.servos = document.getElementById('servos');
  const sv = buildHudStat(ui.servos, 'servo', 'Servos');
  ui.servoNum = sv.num;
  ui.servoRate = sv.sub;
  ui.servoRate.classList.add('servo-rate');
  // perfil do jogador: o retrato numa moldura e o nível de Renome
  ui.renome = document.getElementById('renome');
  const avatar = el('span', 'avatar');
  const face = ART.icons.avatar ? 'avatar' : 'banner';
  // dois tamanhos em escala inteira: o grande no computador, o pequeno no celular
  const big = ART.iconCanvas(face, 2);
  const small = ART.iconCanvas(face, 1);
  big.classList.add('avatar-big');
  small.classList.add('avatar-small');
  avatar.append(big, small);
  ui.renomeNum = buildHudStat(ui.renome, avatar, 'Renome').num;
  ui.renomeNum.before(el('span', 'lv-word', 'Nível '));
  buildRankTrack();
  buildHudMissions();
  ui.cardBadge = document.getElementById('card-badge');
  ui.misBadge = document.getElementById('mis-badge');
  document.getElementById('gens').append(buildMissions());
  buildChestLayer();
  buildGenInfo();
  checkMissionNotices(true);
  // baús coletados e ainda não vistos (a página fechou no meio da animação)
  for (const c of state.chests) chestQueue.push(c);
  if (chestQueue.length) showNextChest();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
