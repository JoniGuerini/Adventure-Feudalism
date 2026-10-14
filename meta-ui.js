'use strict';
// Telas das cartas, das missões, do recrutamento e da abertura de baús. As
// regras ficam em meta.js; aqui só se monta e atualiza o DOM. Como no resto
// do jogo, os textos mudam no máximo 15 vezes por segundo e nada lê layout a
// cada quadro.

const RARITY_SOUND = { comum: 'flip', rara: 'flip2', epica: 'flip3', lendaria: 'flip4' };

// ---------------------------------------------------------------------------
// Aba Cartas: uma fileira por carta, a raridade na moldura do ícone

function buildCardRow(card) {
  const row = el('article', 'card-row fr fr-wood r-' + card.rarity);
  const who = el('div', 'card-who');
  const pic = el('span', 'card-pic');
  const icon = ART.iconCanvas(card.icon, 3);
  pic.append(icon);
  const names = el('div', 'card-names');
  const name = el('h3', 'card-name', card.name);
  const sub = el('span', 'card-sub');
  names.append(name, sub);
  who.append(pic, names);

  const mid = el('div', 'card-mid');
  const blurb = el('p', 'card-blurb', card.blurb);
  const eff = el('p', 'card-eff');
  const bar = el('div', 'bar cbar fr fr-slot');
  const fill = el('div', 'fill');
  const barText = el('span', 'bar-text');
  bar.append(fill, barText);
  mid.append(blurb, eff, bar);

  const btn = el('button', 'btn buy card-btn');
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
      upgradeVersion += 1;
      replay(pic, 'pulse');
      toast(`${card.name} subiu para o nível ${lv(card.id)}! ${cardEffect(card).replace(/ →.*/, '')}`);
      renderNow();
    } else {
      btn.sfxResult = 'thud';
      replay(btn, 'nope');
    }
  });
  row.append(who, mid, btn);
  return { card, row, sub, eff, fill, barText, btn, label, chip, num, fillP: -1 };
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
  box.append(section('Linha ' + line.name));
  for (const c of [...lineCards, ...tools]) {
    const r = buildCardRow(c);
    rows.push(r);
    box.append(r.row);
  }
  const teaser = el('div', 'teaser');
  const teaserText = el('span');
  teaser.append(ART.iconCanvas('lock', 2), teaserText);
  box.append(teaser, section('Reino'));
  for (const c of kingdom) {
    const r = buildCardRow(c);
    rows.push(r);
    box.append(r.row);
  }
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
    const rar = RARITIES[card.rarity];
    setText(r.sub, `${rar.name} · ${c.lv ? `nível ${c.lv} de ${rar.max}` : 'ainda não encontrada'}`);
    setText(r.eff, cardEffect(card));
    setClass(r.row, 'missing', c.lv === 0);
    const need = promoteNeed(card);
    let p;
    if (c.lv === 0) {
      setText(r.barText, 'Abra baús para encontrar');
      p = 0;
    } else if (!need) {
      setText(r.barText, 'Nível máximo');
      p = 1;
    } else {
      setText(r.barText, `${fmt(c.n)} / ${fmt(need.copies)} cópias`);
      p = Math.min(1, c.n / need.copies);
    }
    if (p !== r.fillP) {
      r.fillP = p;
      r.fill.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(3)}% 0 0)`;
    }
    const ok = canPromote(card);
    setOk(r.btn, ok);
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
    const pr = missionProgress(slot);
    const icon = missionIcon(pr.m);
    if (r.picKey !== icon) {
      r.picKey = icon;
      r.pic.replaceChildren(ART.iconCanvas(icon, 3));
    }
    setText(r.text, missionText(pr.m));
    const have = Big.min(pr.have, pr.goal);
    setText(r.mtext, `${fmt(have)} / ${fmt(pr.goal)}`);
    const f = pr.done ? 1 : Math.min(1, pr.have.div(pr.goal).toNumber() || 0);
    if (f !== r.fillP) {
      r.fillP = f;
      r.mfill.style.clipPath = `inset(0 ${((1 - f) * 100).toFixed(3)}% 0 0)`;
    }
    const rk = typeof pr.m.r === 'number' ? 'crown' : 'chest-' + pr.m.r;
    if (r.rewardKey !== rk) {
      r.rewardKey = rk;
      r.rewardText.replaceChildren(ART.iconCanvas(rk, 3), el('span', null, rewardName(pr.m.r)));
    }
    setOk(r.btn, pr.done);
    setClass(r.row, 'done', pr.done);
  });
  const left = ms.list.length - ms.next;
  const spare = Math.max(0, ms.list.length - ms.need);
  setText(mu.more, left > 0
    ? `Mais ${left} ${left === 1 ? 'missão' : 'missões'} na fila deste Renome` + (spare ? ` (${spare} de sobra)` : '')
    : 'Nenhuma missão nova na fila deste Renome');
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
    toast(`Missão cumprida: ${missionText(state.mission.list[slot.i])}. Colete em Missões!`);
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
  ui.chest = { layer, title, pic, ctx: pic.getContext('2d'), cards, crowns, hint, stage: '', timers: [] };
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
  const tiles = c.items.map((it) => {
    const card = CARD[it.id];
    const tile = el('div', 'chest-card r-' + card.rarity);
    const pic = el('span', 'card-pic');
    pic.append(ART.iconCanvas(card.icon, 3));
    const name = el('span', 'chest-card-name', card.name);
    const count = el('span', 'chest-card-n', '×' + it.k);
    const tag = el('span', 'chest-card-tag', it.fresh ? 'Nova!' : it.crowns ? `+${fmt(it.crowns)} coroas` : canPromote(card) ? 'Pronta!' : RARITIES[card.rarity].name);
    tile.append(pic, name, count, tag);
    tile.hidden = true;
    ch.cards.append(tile);
    return { tile, rarity: card.rarity };
  });
  const gap = Math.max(90, Math.min(260, 2400 / Math.max(1, tiles.length)));
  tiles.forEach((t, i) => {
    ch.timers.push(setTimeout(() => {
      t.tile.hidden = false;
      t.tile.classList.add('flip');
      SFX.play(RARITY_SOUND[t.rarity]);
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
  for (const tile of ch.cards.children) {
    tile.hidden = false;
    tile.classList.remove('flip');
  }
  ch.stage = 'done';
  setText(ch.crowns, `+${fmt(c.crowns)} coroas · ${c.cards} ${c.cards === 1 ? 'carta' : 'cartas'}`);
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
// Topo: servos

function renderHud() {
  setText(ui.crownNum, fmt(Math.floor(state.coroas)));
  setText(ui.crownLabel, Math.floor(state.coroas) === 1 ? 'coroa' : 'coroas');
  const servos = state.res.servos.floor();
  setText(ui.servoNum, fmt(servos));
  setText(ui.servoLabel, servos.eq(1) ? 'servo' : 'servos');
  setText(ui.servoRate, state.servoOn ? `+${fmtRate(servoRate())}/s` : 'nascem após a 1ª compra');
  const line = LINE[state.line];
  const ready = state.lines[line.id] ? promotableCount(line.id) : 0;
  setText(ui.cardBadge, ready ? String(ready) : '');
  setClass(ui.cardBadge, 'on', ready > 0);
  const mready = missionsReady();
  setText(ui.misBadge, mready ? String(mready) : '');
  setClass(ui.misBadge, 'on', mready > 0);
}

// Liga a parte nova da tela; chamada por init() em game.js.
function initMeta() {
  ui.servos = document.getElementById('servos');
  ui.servoNum = el('span', 'crown-num');
  ui.servoLabel = el('span', 'crown-label', 'servos');
  ui.servoRate = el('span', 'servo-rate');
  ui.servos.append(ART.iconCanvas('servo', 2), ui.servoNum, ui.servoLabel, ui.servoRate);
  ui.cardBadge = document.getElementById('card-badge');
  ui.misBadge = document.getElementById('mis-badge');
  document.getElementById('gens').append(buildMissions());
  buildChestLayer();
  checkMissionNotices(true);
  // baús coletados e ainda não vistos (a página fechou no meio da animação)
  for (const c of state.chests) chestQueue.push(c);
  if (chestQueue.length) showNextChest();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
