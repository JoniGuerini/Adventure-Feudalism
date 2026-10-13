'use strict';
// Sons dos botões. Nada de bipes: cada som é um objeto de verdade modelado em
// código (madeira, ferro, couro). Um toque de ruído excita ressonadores com os
// modos de vibração do material, como um dedo ou um martelo batendo nele, e um
// eco curto põe o som dentro de uma sala. Cada som tem quatro variações e toca
// com afinação e volume levemente diferentes, para nunca soar repetido. Todo
// botão tem um som ao apertar e, ao soltar, uma variação do mesmo som: o mesmo
// objeto, mais agudo e mais leve, como a tecla voltando para o lugar.

const SFX = (() => {
  const SR = 44100;
  const VARIANTS = 4;
  const PREF_KEY = 'jogo-idle:som';
  let ctx = null;
  let master = null;
  const bank = {};
  let muted = false;
  try { muted = localStorage.getItem(PREF_KEY) === 'off'; } catch (_) { /* sem armazenamento */ }

  // ---------------------------------------------------------------- matéria-prima

  function noise(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return ((s >>> 0) / 4294967296) * 2 - 1;
    };
  }

  // Golpe: ruído curto com queda exponencial. soft (0..1) abafa o golpe, como a
  // ponta de um dedo em vez de um martelo.
  function strike(ms, seed, soft = 0) {
    const n = Math.max(2, Math.round(ms * SR / 1000));
    const out = new Float32Array(n);
    const rnd = noise(seed);
    let lp = 0;
    const a = 1 - soft * 0.92;
    for (let i = 0; i < n; i++) {
      lp += a * (rnd() - lp);
      out[i] = lp * Math.exp(-5 * i / n);
    }
    return out;
  }

  // Um modo de vibração: ressonador de dois polos que soa na frequência f e se
  // apaga em `decay` segundos (até cair para ~37%).
  function mode(dst, src, at, f, decay, gain) {
    if (f >= SR / 2.2) return;
    const r = Math.exp(-1 / (decay * SR));
    const th = 2 * Math.PI * f / SR;
    const c = 2 * r * Math.cos(th);
    const r2 = r * r;
    const g = gain * Math.sin(th);
    const start = Math.round(at * SR);
    let y1 = 0, y2 = 0;
    for (let n = start; n < dst.length; n++) {
      const k = n - start;
      const y = (k < src.length ? src[k] : 0) + c * y1 - r2 * y2;
      dst[n] += y * g;
      y2 = y1;
      y1 = y;
      if (k > src.length && Math.abs(y) < 1e-5 && Math.abs(y2) < 1e-5) break;
    }
  }

  // Um objeto inteiro: vários modos com razões de frequência do material.
  function body(dst, at, f0, partials, src) {
    for (const [ratio, gain, decay] of partials) mode(dst, src, at, f0 * ratio, decay, gain);
  }

  // Ruído filtrado somado direto (sopro, couro, papel).
  function rustle(dst, at, ms, seed, color, gain) {
    const rnd = noise(seed);
    const start = Math.round(at * SR), n = Math.round(ms * SR / 1000);
    let lp = 0, hp = 0;
    for (let i = 0; i < n && start + i < dst.length; i++) {
      lp += color * (rnd() - lp);
      hp = lp - hp * 0.6;
      const env = Math.sin(Math.PI * i / n) ** 2;
      dst[start + i] += hp * env * gain;
    }
  }

  // ---------------------------------------------------------------- materiais

  const WOOD = (d) => [[1, 1, d], [2.61, 0.42, d * 0.55], [4.37, 0.2, d * 0.35], [6.2, 0.08, d * 0.25]];
  const IRON = (d) => [[1, 1, d], [2.32, 0.55, d * 0.7], [3.91, 0.32, d * 0.45], [5.68, 0.18, d * 0.3], [7.9, 0.08, d * 0.2]];
  const COIN = (d) => [[1, 1, d], [1.59, 0.7, d * 0.8], [2.31, 0.45, d * 0.6], [3.12, 0.25, d * 0.45]];

  // Cada receita recebe (buffer, sorteio, desafinação) e escreve o som.
  const RECIPES = {
    // botão de madeira afundando ("toc") e voltando ("tic")
    press: { len: 0.12, vol: 0.8, make(b, r, j) {
      body(b, 0, 430 * j, WOOD(0.02), strike(1.6, r(), 0.55));
      body(b, 0, 160 * j, [[1, 0.5, 0.01]], strike(3, r(), 0.9));
    } },
    // trava de madeira com pino de ferro (×1, ×10, Máx)
    latch: { len: 0.14, vol: 0.7, make(b, r, j) {
      body(b, 0, 560 * j, WOOD(0.016), strike(1.2, r(), 0.5));
      body(b, 0.004, 3300 * j, [[1, 0.25, 0.012], [1.63, 0.12, 0.008]], strike(0.3, r()));
    } },
    // aba de couro dobrando (abas das linhas)
    flap: { len: 0.12, vol: 0.55, make(b, r, j) {
      rustle(b, 0, 30, r() * 1e6, 0.22 * j, 1.2);
      body(b, 0.003, 190 * j, [[1, 0.5, 0.009]], strike(4, r(), 0.95));
    } },
    // batida abafada: não deu para pagar
    thud: { len: 0.12, vol: 0.7, make(b, r, j) {
      body(b, 0, 260 * j, WOOD(0.012), strike(3, r(), 0.85));
      body(b, 0, 95, [[1, 0.7, 0.014]], strike(6, r(), 0.97));
    } },
    // recomeçar: pancada pesada numa porta de madeira
    knock: { len: 0.2, vol: 0.85, make(b, r, j) {
      body(b, 0, 215 * j, WOOD(0.03), strike(2.5, r(), 0.75));
      body(b, 0, 90, [[1, 0.6, 0.018]], strike(6, r(), 0.97));
    } },
    // cadeado abrindo: a chave gira em dois estalos e a argola salta
    unlock: { len: 0.6, vol: 0.6, make(b, r, j) {
      body(b, 0, 2600 * j, [[1, 0.5, 0.012], [1.8, 0.25, 0.008]], strike(0.3, r()));
      body(b, 0.07, 2350 * j, [[1, 0.5, 0.012], [1.8, 0.25, 0.008]], strike(0.3, r()));
      body(b, 0.16, 720 * j, IRON(0.22), strike(0.5, r(), 0.1));
      body(b, 0.17, 3400 * j, COIN(0.25).map(([a, g, d]) => [a, g * 0.35, d]), strike(0.2, r()));
    } },
  };

  // Eco curto de sala: três reflexões abafadas.
  function room(buf) {
    const taps = [[0.0071, 0.22], [0.0129, 0.13], [0.0193, 0.08], [0.031, 0.04]];
    const src = buf.slice();
    for (const [t, g] of taps) {
      const d = Math.round(t * SR);
      let lp = 0;
      for (let i = d; i < buf.length; i++) {
        lp += 0.35 * (src[i - d] - lp);
        buf[i] += lp * g;
      }
    }
  }

  // "press:up" é o som de soltar do "press": o mesmo objeto, mais agudo e mais
  // baixo. Os sons de soltar são os mesmos de apertar com esse sufixo.
  const UP = ':up';
  const recipeOf = (name) => RECIPES[name.endsWith(UP) ? name.slice(0, -UP.length) : name];

  // Gera as amostras de uma variação; não precisa do contexto de áudio, então
  // dá para preparar tudo antes do primeiro clique.
  function renderData(name, v) {
    const rc = recipeOf(name);
    const up = name.endsWith(UP);
    const data = new Float32Array(Math.round(rc.len * SR));
    const rnd = noise(1000 + v * 97 + name.length * 13);
    const r = () => (rnd() + 1) / 2;
    rc.make(data, r, (1 + (r() - 0.5) * 0.06) * (up ? 1.17 : 1));
    room(data);
    // tira o deslocamento grave (filtro passa-alta de ~30 Hz) e normaliza
    let prevIn = 0, prevOut = 0, peak = 0;
    const a = Math.exp(-2 * Math.PI * 30 / SR);
    for (let i = 0; i < data.length; i++) {
      const y = a * (prevOut + data[i] - prevIn);
      prevIn = data[i];
      prevOut = y;
      data[i] = y;
      peak = Math.max(peak, Math.abs(y));
    }
    const k = peak > 0 ? rc.vol * (up ? 0.6 : 1) / peak : 0;
    const fade = Math.round(0.006 * SR);
    for (let i = 0; i < data.length; i++) {
      const tail = data.length - i;
      data[i] *= k * (tail < fade ? tail / fade : 1);
    }
    return data;
  }

  const raw = {};
  function samples(name) {
    if (!raw[name]) raw[name] = Array.from({ length: VARIANTS }, (_, v) => renderData(name, v));
    return raw[name];
  }

  // Prepara os sons aos poucos, sem travar a tela.
  function warm() {
    const todo = Object.keys(RECIPES).flatMap((name) => [name, name + UP]);
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 30));
    const next = () => {
      const name = todo.shift();
      if (!name) return;
      samples(name);
      idle(next);
    };
    idle(next);
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC({ latencyHint: 'interactive' });
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function play(name) {
    if (muted || !name || !recipeOf(name) || !ensure()) return;
    if (!bank[name]) {
      bank[name] = samples(name).map((data) => {
        const buf = ctx.createBuffer(1, data.length, SR);
        buf.copyToChannel(data, 0);
        return buf;
      });
    }
    const src = ctx.createBufferSource();
    src.buffer = bank[name][Math.floor(Math.random() * VARIANTS)];
    src.playbackRate.value = 0.97 + Math.random() * 0.06;
    const g = ctx.createGain();
    g.gain.value = 0.88 + Math.random() * 0.24;
    src.connect(g).connect(master);
    src.start();
  }

  // Liga um som ao apertar e a variação dele ao soltar. O de soltar espera o
  // clique ser tratado, para o botão poder trocar o som pelo resultado
  // (el.sfxResult), como a batida abafada de quando falta dinheiro.
  function bind(el, press) {
    const release = press + UP;
    let down = false;
    const releaseNow = (inside) => {
      if (!down) return;
      down = false;
      setTimeout(() => {
        const name = inside && el.sfxResult ? el.sfxResult : release;
        el.sfxResult = null;
        play(name);
      }, 0);
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      down = true;
      play(press);
      const up = (ev) => {
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        releaseNow(ev.type === 'pointerup' && !!hit && el.contains(hit));
      };
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
    });
    el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !down) { down = true; play(press); }
    });
    el.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') releaseNow(true);
    });
  }

  function setMuted(on) {
    muted = on;
    try { localStorage.setItem(PREF_KEY, on ? 'off' : 'on'); } catch (_) { /* sem armazenamento */ }
  }

  return { play, bind, setMuted, warm, get muted() { return muted; }, RECIPES, renderData };
})();
