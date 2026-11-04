// Mermaid diagrams: render, then make each one pannable and zoomable in place,
// with an Expand button that opens it full-screen in a modal dialog.
//
// Inline, the mouse wheel is left to the page so scrolling a long post never
// gets captured by a diagram; zoom with the controls or a double-click.
// In the dialog, wheel zoom, drag, and touch pan/pinch are all enabled.
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

  const inline = [];
  let dialog = null;
  let dialogStage = null;
  let dialogTitle = null;
  let dialogInstance = null;

  // Touch pan and pinch for svg-pan-zoom, which handles mouse input itself.
  // Only pointerType "touch" is handled here, so mouse input is never doubled.
  const touchHandler = {
    haltEventListeners: [],
    init(options) {
      const instance = options.instance;
      const svg = options.svgElement;
      const points = new Map();
      let lastDistance = 0;

      const distance = () => {
        const [a, b] = [...points.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
      };
      const midpoint = () => {
        const [a, b] = [...points.values()];
        const rect = svg.getBoundingClientRect();
        return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
      };

      this.down = (e) => {
        if (e.pointerType !== 'touch') return;
        svg.setPointerCapture(e.pointerId);
        points.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (points.size === 2) lastDistance = distance();
      };
      this.move = (e) => {
        if (e.pointerType !== 'touch' || !points.has(e.pointerId)) return;
        const prev = points.get(e.pointerId);
        const next = { x: e.clientX, y: e.clientY };
        if (points.size === 1) {
          instance.panBy({ x: next.x - prev.x, y: next.y - prev.y });
          points.set(e.pointerId, next);
        } else if (points.size === 2) {
          points.set(e.pointerId, next);
          const d = distance();
          if (lastDistance > 0) instance.zoomAtPointBy(d / lastDistance, midpoint());
          lastDistance = d;
        }
        e.preventDefault();
      };
      this.up = (e) => {
        points.delete(e.pointerId);
        if (points.size < 2) lastDistance = 0;
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

  function fitHeight(target, svg) {
    const box = svg.viewBox && svg.viewBox.baseVal;
    const w = box && box.width > 0 ? box.width : 800;
    const h = box && box.height > 0 ? box.height : 480;
    const width = target.clientWidth > 0 ? target.clientWidth : 720;
    const height = Math.min(width * (h / w), window.innerHeight * 0.7);
    target.style.height = `${Math.max(Math.round(height), 280)}px`;
  }

  function refit(instance) {
    window.requestAnimationFrame(() => {
      instance.resize();
      instance.fit();
      instance.center();
    });
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
    dialog.innerHTML =
      '<div class="diagram-dialog__bar">' +
        '<p class="diagram-dialog__title" id="diagram-dialog-title"></p>' +
        '<p class="diagram-dialog__hint">Scroll or pinch to zoom · drag to pan · Esc to close</p>' +
        '<button type="button" class="diagram-dialog__close">Close</button>' +
      '</div>' +
      '<div class="diagram-dialog__stage"></div>';
    document.body.appendChild(dialog);
    dialogStage = dialog.querySelector('.diagram-dialog__stage');
    dialogTitle = dialog.querySelector('.diagram-dialog__title');
    dialog.querySelector('.diagram-dialog__close').addEventListener('click', () => dialog.close());
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
    if (typeof svgPanZoom === 'function') {
      dialogInstance = svgPanZoom(svg, {
        zoomEnabled: true,
        mouseWheelZoomEnabled: true,
        dblClickZoomEnabled: true,
        controlIconsEnabled: true,
        fit: true,
        center: true,
        minZoom: 0.25,
        maxZoom: 20,
        zoomScaleSensitivity: 0.3,
        customEventsHandler: touchHandler
      });
      refit(dialogInstance);
    }
  }

  function enhance(container) {
    const pre = container.querySelector('.mermaid');
    const svg = pre && pre.querySelector('svg');
    if (!svg || container.dataset.enhanced === 'true') return;
    container.dataset.enhanced = 'true';

    // Keep an untouched copy for the dialog before pan-zoom rewrites the SVG.
    const markup = svg.outerHTML;
    const svgId = svg.id || '';
    const title = nearestHeading(container);

    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = 'diagram-expand';
    expand.textContent = 'Expand';
    expand.setAttribute('aria-label', `Expand diagram: ${title}`);
    expand.addEventListener('click', () => openDialog(markup, svgId, title));
    container.appendChild(expand);

    if (typeof svgPanZoom !== 'function') return;
    svg.removeAttribute('style');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    pre.classList.add('is-zoomable');
    fitHeight(pre, svg);
    try {
      const instance = svgPanZoom(svg, {
        zoomEnabled: true,
        mouseWheelZoomEnabled: false,
        dblClickZoomEnabled: true,
        controlIconsEnabled: true,
        fit: true,
        center: true,
        minZoom: 0.5,
        maxZoom: 10,
        zoomScaleSensitivity: 0.3
      });
      inline.push({ instance, pre, svg });
      refit(instance);
    } catch (err) {
      pre.classList.remove('is-zoomable');
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
      for (const { instance, pre, svg } of inline) { fitHeight(pre, svg); refit(instance); }
      if (dialogInstance) refit(dialogInstance);
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
