// Mermaid diagrams: render, then make each one pannable and zoomable in place,
// with an Expand button that opens it full-screen in a modal dialog.
//
// Inline, the mouse wheel and touch stay with the page, so scrolling a long
// post (or swiping on a phone) never gets captured by a diagram. Zoom with the
// toolbar, a double-click, or the keyboard. In the dialog, wheel zoom, drag,
// and touch pan/pinch are all enabled.
//
// Keyboard: every control is a real button, and each diagram is focusable.
// Arrow keys pan (Shift pans further), + and - zoom, 0 fits the diagram.
(() => {
  'use strict';

  const THEME = {
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      darkMode: true,
      background: '#131b2e',
      primaryColor: '#1e3a5f',
      primaryTextColor: '#e2e8f0',
      primaryBorderColor: '#22d3ee',
      lineColor: '#475569',
      secondaryColor: '#1a2332',
      tertiaryColor: '#0f172a'
    }
  };

  const KEY_HINT = 'Arrow keys pan, plus and minus zoom, 0 fits the diagram.';
  const PAN_STEP = 60;
  const TOUCH_EVENTS = ['touchstart', 'touchmove', 'touchend', 'touchleave', 'touchcancel'];

  const inline = [];
  let dialog = null;
  let dialogStage = null;
  let dialogTitle = null;
  let dialogInstance = null;
  let hintCounter = 0;

  // Inline diagrams: stop svg-pan-zoom's own touch handling so a swipe over a
  // diagram scrolls the page instead of panning it.
  const inlineEvents = {
    haltEventListeners: TOUCH_EVENTS,
    init() {},
    destroy() {}
  };

  // Dialog: this handler owns touch input. svg-pan-zoom's own touch listeners
  // are halted, so a gesture is never processed twice; the library keeps
  // handling the mouse. One finger pans; two fingers pan with their midpoint
  // and zoom around it.
  function dialogEvents() {
    return {
      haltEventListeners: TOUCH_EVENTS,
      init(options) {
        const instance = options.instance;
        const svg = options.svgElement;
        const points = new Map();
        let lastDistance = 0;
        let lastMid = null;

        const pair = () => [...points.values()];
        const distance = () => { const [a, b] = pair(); return Math.hypot(a.x - b.x, a.y - b.y); };
        const midpoint = () => {
          const [a, b] = pair();
          const rect = svg.getBoundingClientRect();
          return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
        };
        const resetPinch = () => {
          if (points.size === 2) { lastDistance = distance(); lastMid = midpoint(); }
          else { lastDistance = 0; lastMid = null; }
        };

        this.down = (e) => {
          if (e.pointerType !== 'touch') return;
          svg.setPointerCapture(e.pointerId);
          points.set(e.pointerId, { x: e.clientX, y: e.clientY });
          resetPinch();
        };
        this.move = (e) => {
          if (e.pointerType !== 'touch' || !points.has(e.pointerId)) return;
          const prev = points.get(e.pointerId);
          const next = { x: e.clientX, y: e.clientY };
          points.set(e.pointerId, next);
          if (points.size === 1) {
            instance.panBy({ x: next.x - prev.x, y: next.y - prev.y });
          } else if (points.size === 2 && lastMid) {
            const mid = midpoint();
            const d = distance();
            instance.panBy({ x: mid.x - lastMid.x, y: mid.y - lastMid.y });
            if (lastDistance > 0) instance.zoomAtPointBy(d / lastDistance, mid);
            lastMid = mid;
            lastDistance = d;
          }
          e.preventDefault();
        };
        this.up = (e) => {
          points.delete(e.pointerId);
          resetPinch();
        };

        svg.style.touchAction = 'none';
        svg.addEventListener('pointerdown', this.down);
        svg.addEventListener('pointermove', this.move);
        svg.addEventListener('pointerup', this.up);
        svg.addEventListener('pointercancel', this.up);
        this.svg = svg;
      },
      destroy() {
        if (!this.svg) return;
        this.svg.removeEventListener('pointerdown', this.down);
        this.svg.removeEventListener('pointermove', this.move);
        this.svg.removeEventListener('pointerup', this.up);
        this.svg.removeEventListener('pointercancel', this.up);
        this.svg = null;
      }
    };
  }

  // svg-pan-zoom removes the SVG's viewBox when it initializes, so read the
  // diagram's real proportions first and keep them for every later resize.
  function aspectOf(svg) {
    const box = svg.viewBox && svg.viewBox.baseVal;
    if (box && box.width > 0 && box.height > 0) return box.height / box.width;
    const rect = svg.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect.height / rect.width : 0.6;
  }

  function fitHeight(target, aspect) {
    const width = target.clientWidth > 0 ? target.clientWidth : 720;
    const height = Math.min(width * aspect, window.innerHeight * 0.7);
    target.style.height = `${Math.max(Math.round(height), 280)}px`;
  }

  function fit(instance) {
    instance.resize();
    instance.fit();
    instance.center();
  }

  function refit(instance) {
    window.requestAnimationFrame(() => fit(instance));
  }

  function button(label, text, className) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = text;
    b.setAttribute('aria-label', label);
    b.title = label;
    return b;
  }

  // Zoom out, fit, zoom in. getInstance is called on click so the buttons
  // always drive whichever instance is live.
  function zoomButtons(getInstance) {
    const group = document.createElement('div');
    group.className = 'diagram-zoom';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Zoom');
    const out = button('Zoom out', '−', 'diagram-btn');
    const reset = button('Fit diagram', 'Fit', 'diagram-btn');
    const zin = button('Zoom in', '+', 'diagram-btn');
    out.addEventListener('click', () => { const i = getInstance(); if (i) i.zoomOut(); });
    reset.addEventListener('click', () => { const i = getInstance(); if (i) fit(i); });
    zin.addEventListener('click', () => { const i = getInstance(); if (i) i.zoomIn(); });
    group.append(out, reset, zin);
    return group;
  }

  // Keyboard control for a focused diagram.
  function keyboard(target, getInstance) {
    target.addEventListener('keydown', (e) => {
      const instance = getInstance();
      if (!instance || e.altKey || e.ctrlKey || e.metaKey) return;
      const step = e.shiftKey ? PAN_STEP * 3 : PAN_STEP;
      const moves = {
        ArrowLeft: { x: step, y: 0 },
        ArrowRight: { x: -step, y: 0 },
        ArrowUp: { x: 0, y: step },
        ArrowDown: { x: 0, y: -step }
      };
      if (moves[e.key]) instance.panBy(moves[e.key]);
      else if (e.key === '+' || e.key === '=') instance.zoomIn();
      else if (e.key === '-' || e.key === '_') instance.zoomOut();
      else if (e.key === '0') fit(instance);
      else return;
      e.preventDefault();
    });
  }

  function hintElement() {
    const hint = document.createElement('span');
    hint.className = 'visually-hidden';
    hint.id = `diagram-hint-${++hintCounter}`;
    hint.textContent = KEY_HINT;
    return hint;
  }

  function nearestHeading(el) {
    let node = el.closest('.mermaid-container');
    while (node) {
      node = node.previousElementSibling;
      if (node && /^H[1-4]$/.test(node.tagName)) return node.textContent.trim();
    }
    return 'Diagram';
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'diagram-dialog';
    dialog.setAttribute('aria-labelledby', 'diagram-dialog-title');

    const bar = document.createElement('div');
    bar.className = 'diagram-dialog__bar';
    dialogTitle = document.createElement('p');
    dialogTitle.className = 'diagram-dialog__title';
    dialogTitle.id = 'diagram-dialog-title';
    const hint = document.createElement('p');
    hint.className = 'diagram-dialog__hint';
    hint.textContent = 'Scroll or pinch to zoom · drag or arrow keys to pan · Esc to close';
    const close = button('Close diagram', 'Close', 'diagram-dialog__close');
    close.addEventListener('click', () => dialog.close());
    bar.append(dialogTitle, hint, zoomButtons(() => dialogInstance), close);

    dialogStage = document.createElement('div');
    dialogStage.className = 'diagram-dialog__stage';
    dialogStage.tabIndex = 0;
    dialogStage.setAttribute('role', 'group');
    const keys = hintElement();
    dialogStage.setAttribute('aria-describedby', keys.id);
    keyboard(dialogStage, () => dialogInstance);

    dialog.append(bar, dialogStage, keys);
    document.body.appendChild(dialog);

    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      if (dialogInstance) { dialogInstance.destroy(); dialogInstance = null; }
      dialogStage.replaceChildren();
      document.documentElement.classList.remove('has-diagram-dialog');
    });
    return dialog;
  }

  function openDialog(markup, svgId, title) {
    ensureDialog();
    // Give the copy its own IDs so its styles and arrow markers never collide
    // with the inline diagram's.
    const copyId = `${svgId}-expanded`;
    dialogStage.innerHTML = svgId ? markup.split(svgId).join(copyId) : markup;
    dialogTitle.textContent = title;
    dialogStage.setAttribute('aria-label', `${title} diagram`);
    const svg = dialogStage.querySelector('svg');
    // Mermaid leaves a few IDs unprefixed (self-loop edges, for one). Nothing
    // references them, so suffix them too and keep every ID on the page unique.
    for (const el of svg.querySelectorAll('[id]')) {
      if (!el.id.includes(copyId)) el.id = `${el.id}-expanded`;
    }
    svg.removeAttribute('style');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    document.documentElement.classList.add('has-diagram-dialog');
    dialog.showModal();
    dialogStage.focus();
    if (typeof svgPanZoom === 'function') {
      dialogInstance = svgPanZoom(svg, {
        zoomEnabled: true,
        mouseWheelZoomEnabled: true,
        dblClickZoomEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom: 0.25,
        maxZoom: 20,
        zoomScaleSensitivity: 0.3,
        customEventsHandler: dialogEvents()
      });
      refit(dialogInstance);
    }
  }

  function enhance(container) {
    const pre = container.querySelector('.mermaid');
    const svg = pre && pre.querySelector('svg');
    if (!svg || container.dataset.enhanced === 'true') return;
    container.dataset.enhanced = 'true';

    // Keep an untouched copy for the dialog, and the diagram's proportions,
    // before pan-zoom rewrites the SVG.
    const markup = svg.outerHTML;
    const svgId = svg.id || '';
    const aspect = aspectOf(svg);
    const title = nearestHeading(container);

    const tools = document.createElement('div');
    tools.className = 'diagram-tools';
    const expand = button(`Expand diagram: ${title}`, 'Expand', 'diagram-btn diagram-btn--expand');
    expand.addEventListener('click', () => openDialog(markup, svgId, title));

    if (typeof svgPanZoom !== 'function') {
      tools.append(expand);
      container.appendChild(tools);
      return;
    }

    const entry = { instance: null, pre, aspect };
    tools.append(zoomButtons(() => entry.instance), expand);
    container.appendChild(tools);

    svg.removeAttribute('style');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    pre.classList.add('is-zoomable');
    pre.tabIndex = 0;
    pre.setAttribute('role', 'group');
    pre.setAttribute('aria-label', `${title} diagram`);
    const keys = hintElement();
    container.appendChild(keys);
    pre.setAttribute('aria-describedby', keys.id);
    fitHeight(pre, aspect);

    try {
      entry.instance = svgPanZoom(svg, {
        zoomEnabled: true,
        mouseWheelZoomEnabled: false,
        dblClickZoomEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom: 0.5,
        maxZoom: 10,
        zoomScaleSensitivity: 0.3,
        customEventsHandler: inlineEvents
      });
      keyboard(pre, () => entry.instance);
      inline.push(entry);
      refit(entry.instance);
    } catch (err) {
      pre.classList.remove('is-zoomable');
      pre.removeAttribute('tabindex');
      tools.querySelector('.diagram-zoom').remove();
      console.error('diagram pan/zoom failed', err);
    }
  }

  async function start() {
    if (typeof mermaid === 'undefined' || !document.querySelector('.mermaid')) return;
    mermaid.initialize(THEME);
    try {
      await mermaid.run({ querySelector: '.mermaid' });
    } catch (err) {
      console.error('Mermaid render failed', err);
    }
    document.querySelectorAll('.mermaid-container').forEach(enhance);
  }

  let pending = false;
  window.addEventListener('resize', () => {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(() => {
      pending = false;
      for (const { instance, pre, aspect } of inline) { fitHeight(pre, aspect); refit(instance); }
      if (dialogInstance) refit(dialogInstance);
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
