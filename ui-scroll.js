'use strict';
// Barra de rolagem própria do jogo. A do navegador fica escondida (style.css) e
// esta acompanha a rolagem nativa: dá para arrastar o pegador, clicar no trilho
// para pular uma tela e segurar as setas, e arrastar a própria página com o
// mouse. A rolagem pela roda do mouse, teclado e toque continua a do
// navegador. O trilho fica sempre na tela, mesmo quando não há o que rolar
// (aí só o pegador some), para o layout não pular de largura ao trocar de
// linha.

const SCROLLBAR = (() => {
  const STEP = 70;      // pixels por clique nas setas
  const REPEAT = 45;    // intervalo da repetição ao segurar a seta (ms)
  let root, track, thumb, up, down;
  let drag = null;
  let hold = null;

  function el(tag, cls) {
    const e = document.createElement(tag);
    e.className = cls;
    return e;
  }

  function metrics() {
    const view = window.innerHeight;
    const total = document.documentElement.scrollHeight;
    const trackH = track.clientHeight;
    const thumbH = Math.min(trackH, Math.max(54, Math.round(trackH * view / total)));
    return { view, max: total - view, trackH, thumbH };
  }

  function update() {
    const m = metrics();
    const show = m.max > 1;
    if (root.classList.contains('idle') === show) {
      root.classList.toggle('idle', !show);
      if (show) requestAnimationFrame(update);
    }
    if (!show) return;
    thumb.style.height = m.thumbH + 'px';
    const y = Math.round((Math.min(window.scrollY, m.max) / m.max) * (m.trackH - m.thumbH));
    thumb.style.transform = `translateY(${y}px)`;
  }

  function startHold(dir) {
    stopHold();
    window.scrollBy({ top: dir * STEP, behavior: 'smooth' });
    hold = { timer: setTimeout(function tick() {
      window.scrollBy(0, dir * STEP / 3);
      hold.timer = setTimeout(tick, REPEAT);
    }, 320) };
  }

  function stopHold() {
    if (hold) clearTimeout(hold.timer);
    hold = null;
  }

  // Arrastar com o mouse (pedido do usuário): clicar, segurar e puxar rola a
  // página, ou a área rolável sob o mouse, como pegar o conteúdo com a mão; ao
  // soltar, ela segue no embalo e vai parando. Só vale depois de 6px, para um
  // clique comum continuar sendo clique; depois de um arrasto, o clique que o
  // navegador manda no fim é engolido.
  function initGrab() {
    const SLOP = 6;
    let g = null;
    let fling = 0;
    // a área rolável mais próxima; null é a própria página
    const scroller = (node) => {
      for (let n = node; n && n !== document.body; n = n.parentElement) {
        const oy = getComputedStyle(n).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
      }
      return null;
    };
    const pos = (s) => (s ? s.scrollTop : window.scrollY);
    const go = (s, y) => (s ? (s.scrollTop = y) : window.scrollTo({ top: y, behavior: 'instant' }));

    window.addEventListener('pointerdown', (e) => {
      cancelAnimationFrame(fling);
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (e.target.closest('.sb, input, textarea, select')) return;
      const s = scroller(e.target);
      // camada por cima da página (baú, painel) sem nada para rolar: não mexe no fundo
      if (!s && e.target.closest('.chest-layer, .info-layer')) return;
      g = { s, id: e.pointerId, x: e.clientX, y: e.clientY, start: pos(s), on: false, v: 0, t: e.timeStamp, ly: e.clientY };
    }, true);

    window.addEventListener('pointermove', (e) => {
      if (!g || e.pointerId !== g.id) return;
      if (!g.on) {
        if (Math.abs(e.clientY - g.y) < SLOP && Math.abs(e.clientX - g.x) < SLOP) return;
        g.on = true;
        document.documentElement.classList.add('grabbing');
      }
      go(g.s, g.start - (e.clientY - g.y));
      // velocidade em px/ms, suavizada, para o embalo ao soltar
      const dt = Math.max(1, e.timeStamp - g.t);
      g.v = 0.7 * ((g.ly - e.clientY) / dt) + 0.3 * g.v;
      g.t = e.timeStamp;
      g.ly = e.clientY;
    }, true);

    const end = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const was = g;
      g = null;
      if (!was.on) return;
      document.documentElement.classList.remove('grabbing');
      const eat = (c) => { c.stopPropagation(); c.preventDefault(); };
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, true), 0);
      // parado antes de soltar: sem embalo
      let v = e.timeStamp - was.t > 80 ? 0 : was.v;
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min(50, now - last);
        last = now;
        v *= Math.pow(0.994, dt);
        if (Math.abs(v) < 0.03) return;
        go(was.s, pos(was.s) + v * dt);
        fling = requestAnimationFrame(step);
      };
      fling = requestAnimationFrame(step);
    };
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
    window.addEventListener('wheel', () => cancelAnimationFrame(fling), { passive: true });
    window.addEventListener('dragstart', (e) => e.preventDefault());
  }

  function init() {
    root = el('div', 'sb');
    root.setAttribute('aria-hidden', 'true');
    up = el('button', 'sb-btn sb-up');
    down = el('button', 'sb-btn sb-down');
    for (const b of [up, down]) { b.type = 'button'; b.tabIndex = -1; }
    track = el('div', 'sb-track');
    thumb = el('div', 'sb-thumb');
    thumb.append(el('span', 'sb-grip'));
    track.append(thumb);
    root.append(up, track, down);
    root.classList.add('idle');
    document.body.append(root);
    document.body.classList.add('has-sb');

    thumb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      thumb.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, scroll: window.scrollY };
      root.classList.add('dragging');
    });
    thumb.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const m = metrics();
      const ratio = m.max / Math.max(1, m.trackH - m.thumbH);
      window.scrollTo(0, drag.scroll + (e.clientY - drag.y) * ratio);
    });
    const endDrag = () => { drag = null; root.classList.remove('dragging'); };
    thumb.addEventListener('pointerup', endDrag);
    thumb.addEventListener('pointercancel', endDrag);

    // clique no trilho: pula quase uma tela na direção do clique
    track.addEventListener('pointerdown', (e) => {
      if (e.target !== track) return;
      e.preventDefault();
      const box = thumb.getBoundingClientRect();
      const dir = e.clientY < box.top ? -1 : 1;
      window.scrollBy({ top: dir * window.innerHeight * 0.85, behavior: 'smooth' });
    });

    for (const [btn, dir] of [[up, -1], [down, 1]]) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        btn.classList.add('held');
        startHold(dir);
      });
      const release = () => { btn.classList.remove('held'); stopHold(); };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    }

    initGrab();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    new ResizeObserver(update).observe(document.body);
    update();
  }

  return { init, update };
})();
