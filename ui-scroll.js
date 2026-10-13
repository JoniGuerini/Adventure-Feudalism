'use strict';
// Barra de rolagem própria do jogo. A do navegador fica escondida (style.css) e
// esta acompanha a rolagem nativa: dá para arrastar o pegador, clicar no trilho
// para pular uma tela e segurar as setas. A rolagem pela roda do mouse, teclado
// e toque continua a do navegador. O trilho fica sempre na tela, mesmo quando
// não há o que rolar (aí só o pegador some), para o layout não pular de largura
// ao trocar de linha.

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

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    new ResizeObserver(update).observe(document.body);
    update();
  }

  return { init, update };
})();
