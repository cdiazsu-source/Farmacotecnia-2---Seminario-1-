/* =========================================================
   main.js — Orquestador del sitio
   · Carga de datos (JSON con respaldo embebido para file://)
   · Navegación, tema, pestañas, animaciones
   · Render de secciones dinámicas (métricas, tablas, plantas…)
   · Esquema molecular, laboratorio de Young y diagrama capilar
   Expone: window.Sem.App
   ========================================================= */
(function () {
  'use strict';
  const Sem = (window.Sem = window.Sem || {});
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FACTOR_COLORS = { A: '#40916c', B: '#d4a373', C: '#6c8ead', D: '#8a5a44' };

  /* -------------------------------------------------------
     1. Carga de datos
     ------------------------------------------------------- */
  async function loadData() {
    const fallback = window.__SEM_DATA__ || {};
    async function get(url, key) {
      try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) throw new Error(r.status);
        return await r.json();
      } catch (e) {
        if (fallback[key]) return fallback[key];
        throw new Error(`No se pudo cargar ${url}. Abra el sitio con un servidor local o regenere data-bundle.js.`);
      }
    }
    // En file:// fetch falla siempre: se usa directamente el respaldo
    if (location.protocol === 'file:' && fallback.paper && fallback.glossary) {
      return { paper: fallback.paper, glossary: fallback.glossary };
    }
    const [paper, glossary] = await Promise.all([get('assets/data/paper-data.json', 'paper'), get('assets/data/glossary.json', 'glossary')]);
    return { paper, glossary };
  }

  /* -------------------------------------------------------
     2. Utilidades de interfaz
     ------------------------------------------------------- */
  function icons() { if (window.lucide) window.lucide.createIcons(); }

  function renderMath(root) {
    if (!window.renderMathInElement) return;
    window.renderMathInElement(root || document.body, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false,
      ignoredClasses: ['term', 'sim__eq']
    });
  }

  /** Obtiene un valor anidado: get(obj, 'a.b.c') */
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);

  /* -------------------------------------------------------
     3. Tema claro / oscuro
     ------------------------------------------------------- */
  function initTheme() {
    const btn = $('#theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('sem-theme', next); } catch (e) {}
      // Los gráficos leen variables CSS: se reconstruyen tras aplicar el tema
      requestAnimationFrame(() => Sem.Charts && Sem.Charts.refresh());
    });
  }

  /* -------------------------------------------------------
     4. Navegación: menú móvil, scrollspy y barra de progreso
     ------------------------------------------------------- */
  function initNav() {
    const nav = $('#nav');
    const toggle = $('#nav-toggle');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open);
      });
      nav.addEventListener('click', (e) => {
        if (e.target.closest('a')) { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
      });
    }

    // Scrollspy
    const links = $$('#nav a');
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((a) => a.classList.remove('is-active'));
          const a = map.get(en.target.id);
          if (a) {
            a.classList.add('is-active');
            // Mantiene visible el enlace activo moviendo SOLO la barra horizontal del menú.
            // (scrollIntoView movería también la página e interrumpiría el desplazamiento suave.)
            if (nav && window.innerWidth > 1080) {
              const left = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
              nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
            }
          }
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });

    // Desplazamiento suave y controlado hacia las anclas internas
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const id = link.getAttribute('href').slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      smoothScrollTo(target);
      history.replaceState(null, '', `#${id}`);
    });
  }

  /**
   * Desplaza la página hasta un elemento con una curva de aceleración suave,
   * compensando la barra fija. Se cancela si el usuario usa la rueda o el táctil.
   */
  let scrollAnim = null;
  function smoothScrollTo(el) {
    const topbar = $('#topbar');
    const offset = el.id === 'portada' ? 0 : (topbar ? topbar.offsetHeight : 0) + 8;
    const start = window.scrollY;
    const end = Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset);
    const dist = end - start;
    if (Math.abs(dist) < 2) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { window.scrollTo(0, end); return; }
    const duration = Math.min(1100, Math.max(420, Math.abs(dist) * 0.35));
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const t0 = performance.now();
    if (scrollAnim) cancelAnimationFrame(scrollAnim);
    const stop = () => { if (scrollAnim) cancelAnimationFrame(scrollAnim); scrollAnim = null; cleanup(); };
    const cleanup = () => ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.removeEventListener(ev, stop));
    ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, stop, { passive: true, once: true }));
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      window.scrollTo(0, start + dist * ease(t));
      if (t < 1) scrollAnim = requestAnimationFrame(step);
      else { scrollAnim = null; cleanup(); }
    };
    scrollAnim = requestAnimationFrame(step);
    // Respaldo: si la pestaña no pinta cuadros (en segundo plano), llega al destino igualmente
    setTimeout(() => { if (scrollAnim && performance.now() - t0 > duration + 250) { stop(); window.scrollTo(0, end); } }, duration + 300);
  }
  Sem.smoothScrollTo = smoothScrollTo;

  function initProgress() {

    // Progreso de lectura
    const bar = $('#progress-bar');
    const onScroll = () => {
      const h = document.documentElement;
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      if (bar) bar.style.width = `${(p * 100).toFixed(2)}%`;
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Ampliar las figuras originales del artículo
  function initFigZoom() {
    const dlg = document.createElement('dialog');
    dlg.className = 'fig-lightbox';
    dlg.innerHTML = '<button type="button" class="fig-lightbox__close" aria-label="Cerrar">×</button><img alt=""><p></p>';
    document.body.appendChild(dlg);
    const img = dlg.querySelector('img');
    const cap = dlg.querySelector('p');
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('.fig-lightbox__close')) dlg.close(); });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-zoom]');
      if (!btn) return;
      const src = btn.querySelector('img');
      img.src = src.src;
      img.alt = src.alt;
      cap.textContent = src.alt;
      if (typeof dlg.showModal === 'function') dlg.showModal(); else window.open(src.src, '_blank');
    });
  }

  /* -------------------------------------------------------
     5. Animación de aparición
     ------------------------------------------------------- */
  function initReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-visible')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    els.forEach((e) => io.observe(e));
  }

  /* -------------------------------------------------------
     6. Pestañas accesibles (teclado con flechas)
     ------------------------------------------------------- */
  function initTabs() {
    $$('[data-tabs]').forEach((root) => {
      const tabs = $$('[role="tab"]', root);
      const select = (tab) => {
        tabs.forEach((t) => {
          const on = t === tab;
          t.setAttribute('aria-selected', on);
          t.tabIndex = on ? 0 : -1;
          const panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
        // Los gráficos dentro de paneles ocultos necesitan recalcular tamaño
        requestAnimationFrame(() => Sem.Charts && Sem.Charts.resizeAll());
      };
      tabs.forEach((t, i) => {
        t.addEventListener('click', () => select(t));
        t.addEventListener('keydown', (e) => {
          let j = null;
          if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
          if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
          if (e.key === 'Home') j = 0;
          if (e.key === 'End') j = tabs.length - 1;
          if (j !== null) { e.preventDefault(); tabs[j].focus(); select(tabs[j]); }
        });
      });
    });
  }

  /* -------------------------------------------------------
     7. Render de contenido dinámico
     ------------------------------------------------------- */
  const App = {
    paper: null,

    bindText(d) {
      $$('[data-bind]').forEach((el) => { const v = getPath(d, el.dataset.bind); if (v != null) el.textContent = v; });
      $$('[data-bind-list]').forEach((el) => { const v = getPath(d, el.dataset.bindList); if (Array.isArray(v)) el.textContent = v.join(', '); });
      const ml = $('#members-list');
      if (ml && d.seminar && d.seminar.members) ml.innerHTML = d.seminar.members.map((m) => `<li>${esc(m)}</li>`).join('');
    },

    metrics(d) {
      const host = $('#metrics');
      if (!host) return;
      host.innerHTML = d.keyMetrics.map((m, i) => `
        <article class="metric ${i === 0 ? 'metric--feature' : ''}">
          <span class="metric__v">${esc(m.value)}</span>
          <span class="metric__l">${esc(m.label)}</span>
          <span class="metric__s">${esc(m.sub)}</span>
        </article>`).join('');
    },

    /* ---------- Mapa del programa (syllabus) ---------- */
    syllabus(d) {
      const weeks = $('#syllabus-weeks');
      const detail = $('#syllabus-detail');
      if (!weeks || !detail || !d.conceptMap) return;
      weeks.innerHTML = d.conceptMap.map((s, i) => `
        <button type="button" role="tab" class="week ${i === 0 ? 'is-active' : ''}" data-i="${i}" aria-selected="${i === 0}">
          <span class="week__n">${String(i + 1).padStart(2, '0')}</span>
          <span class="week__t">${esc(s.title)}</span>
        </button>`).join('');
      const show = (i) => {
        const s = d.conceptMap[i];
        $$('.week', weeks).forEach((b, j) => { b.classList.toggle('is-active', j === i); b.setAttribute('aria-selected', j === i); });
        detail.innerHTML = `
          <p class="eyebrow">Concepto ${i + 1} de ${d.conceptMap.length}</p>
          <h3>${esc(s.title)}</h3>
          <div class="syl-cols">
            <div><h4><i data-lucide="book-open"></i> Conceptos en juego</h4><ul class="topic-list">${s.topics.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
            <div><h4><i data-lucide="file-text"></i> Qué aporta el artículo</h4><p>${esc(s.article)}</p>
              <p class="syl-evidence"><i data-lucide="bar-chart-3"></i> ${esc(s.evidence)}</p></div>
          </div>
          <a class="btn" href="#${esc(s.anchor)}">Ver en la presentación <i data-lucide="arrow-right"></i></a>`;
        icons();
      };
      weeks.addEventListener('click', (e) => { const b = e.target.closest('.week'); if (b) show(+b.dataset.i); });
      show(0);
    },

    /* ---------- Calculadora de HLB requerido ---------- */
    hlbCalc(d) {
      const oil = $('#hlb-oil'), a = $('#hlb-a'), b = $('#hlb-b'), out = $('#hlb-out');
      if (!oil || !d.hlb) return;
      const E = d.hlb.emulsifiers;
      oil.innerHTML = d.hlb.oils.map((o, i) => `<option value="${i}">${esc(o.name)} — ${o.req}</option>`).join('');
      const opt = (list) => list.map((e) => `<option value="${E.indexOf(e)}">${esc(e.name)} (${e.hlb})</option>`).join('');
      a.innerHTML = opt(E.filter((e) => e.hlb >= 10));
      b.innerHTML = opt(E.filter((e) => e.hlb < 10));
      a.value = String(E.findIndex((e) => e.name.startsWith('Saponina')));
      b.value = String(E.findIndex((e) => e.name.includes('Span 80')));
      const calc = () => {
        const req = d.hlb.oils[+oil.value].req;
        const A = E[+a.value], B = E[+b.value];
        let xa = (req - B.hlb) / (A.hlb - B.hlb);
        const outOfRange = xa < 0 || xa > 1;
        xa = Math.min(1, Math.max(0, xa));
        const pa = xa * 100, pb = 100 - pa;
        $('#hlb-bar-a').style.width = `${pa}%`;
        $('#hlb-bar-b').style.width = `${pb}%`;
        out.innerHTML = `
          <div><span>${esc(A.name)}</span><b>${pa.toFixed(1)} %</b></div>
          <div><span>${esc(B.name)}</span><b>${pb.toFixed(1)} %</b></div>
          <p class="small">${outOfRange
            ? 'El balance que pide este aceite queda fuera del rango de estos dos emulgentes: elija otra pareja.'
            : `Por cada 10 g de mezcla emulgente: <b>${(xa * 10).toFixed(2)} g</b> del primero y <b>${((1 - xa) * 10).toFixed(2)} g</b> del segundo → balance de la mezcla = ${(xa * A.hlb + (1 - xa) * B.hlb).toFixed(1)}.`}</p>
          ${A.name.startsWith('Lauril') ? '<p class="small muted">Ojo: el valor de 40 del lauril sulfato de sodio viene de una escala extendida (método de grupos de Davies); en la práctica no se usa como emulgente principal.</p>' : ''}`;
      };
      [oil, a, b].forEach((el) => el.addEventListener('change', calc));
      calc();
    },

    /* ---------- Catálogo botánico ---------- */
    plants(d) {
      const host = $('#plant-grid');
      if (!host) return;
      const leaf = '<svg class="plant__leaf" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
      host.innerHTML = d.plants.map((p) => `
        <article class="plant reveal" style="--plant-color:${p.color}">
          ${leaf}
          <span class="plant__fam">${esc(p.family)}</span>
          <h3 class="plant__name">${esc(p.species)}</h3>
          <p class="plant__auth">${esc(p.authority)} · ${esc(p.common)}</p>
          <p class="plant__note">${esc(p.note)}</p>
          <div class="plant__parts" role="group" aria-label="Órganos evaluados de ${esc(p.species)}">
            ${p.parts.map((pt) => `
              <button type="button" class="part-btn ${pt.excluded ? 'part-btn--excluded' : ''}" data-code="${pt.code}" title="${pt.excluded ? 'No entró al diseño de la mezcla' : `Grupo ${pt.factor} del diseño de la mezcla`}">
                <b>${esc(pt.part)}</b><span>${pt.factor ? `Grupo ${pt.factor}` : 'No entró a la mezcla'}</span>
              </button>`).join('')}
          </div>
        </article>`).join('');
      host.addEventListener('click', (e) => {
        const b = e.target.closest('.part-btn');
        if (b) this.showExtract(b.dataset.code, false);
      });
    },

    /** Muestra el perfil completo de un extracto */
    showExtract(code, scroll = true) {
      const d = this.paper;
      const ex = d.extracts;
      const host = $('#extract-detail');
      if (!host || !ex.names[code]) return;
      $$('.part-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.code === code));
      const plant = d.plants.find((p) => p.parts.some((pt) => pt.code === code));
      const part = plant.parts.find((pt) => pt.code === code);
      const rank = (obj, asc) => Object.keys(obj).sort((a, b) => (asc ? obj[a] - obj[b] : obj[b] - obj[a])).indexOf(code) + 1;
      const n = Object.keys(ex.cmc).length;
      const kv = (label, val, unit, sub, pct) => `
        <div class="kv"><span>${label}</span><b>${val}${unit}</b><small>${sub}</small>
        ${pct != null ? `<div class="bar"><i style="width:${Math.max(4, Math.min(100, pct))}%"></i></div>` : ''}</div>`;
      host.style.setProperty('--plant-color', plant.color);
      host.innerHTML = `
        <div class="extract-detail__head">
          <h3><em>${esc(plant.species)}</em> · ${esc(part.part)}</h3>
          <span class="muted small">${part.factor ? `Grupo ${part.factor} del diseño de la mezcla` : 'No entró al diseño de la mezcla (pocas saponinas, espuma pobre y ángulo alto)'}</span>
        </div>
        <div class="kv-grid">
          ${kv('Saponinas totales', ex.saponin[code].toFixed(1), ' %', `#${rank(ex.saponin)} de ${n} (mayor es mejor)`, (ex.saponin[code] / 18.4) * 100)}
          ${kv('Concentración micelar crítica', ex.cmc[code].toFixed(3), ' %', `#${rank(ex.cmc, true)} de ${n} · lauril sulfato 0.24 %`, (0.011 / ex.cmc[code]) * 100)}
          ${kv('Ángulo de contacto', ex.contactAngle[code].toFixed(1), '°', `#${rank(ex.contactAngle, true)} de ${n} (1 %, Teflón)`, ((95 - ex.contactAngle[code]) / 31) * 100)}
          ${kv('Tensión superficial', ex.surfaceTension[code].toFixed(1), ' mN/m', `#${rank(ex.surfaceTension, true)} de ${n} · lauril sulfato 38`, ((72 - ex.surfaceTension[code]) / 34) * 100)}
          ${kv('Espuma inicial', ex.foam0[code].toFixed(1), ' cm', `a 10 min: ${ex.foam10[code].toFixed(1)} cm`, (ex.foam0[code] / 6.3) * 100)}
          ${kv('Estabilidad espuma', ex.foamStability[code], ' %', `#${rank(ex.foamStability)} de ${n}`, ex.foamStability[code])}
        </div>`;
      if (scroll) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    /* ---------- Taguchi ---------- */
    taguchi(d) {
      const tg = d.taguchi;
      const T = Sem.Taguchi;
      const names = d.extracts.names;

      const legend = $('#factor-legend');
      if (legend) legend.innerHTML = tg.factors.map((f) => `
        <div class="factor" style="--f-color:${FACTOR_COLORS[f.id]}">
          <span class="factor__id">GRUPO ${f.id} · ${f.levels.length} opciones</span>
          <span class="factor__n">${esc(f.name)}</span>
          <div class="factor__lv">${f.levels.map((lv) => `<span class="pill-code pill-code--name" data-factor="${f.id}">${esc((names[lv] || lv))}</span>`).join('')}</div>
        </div>`).join('');

      // Matriz L8
      const t = $('#l8-table');
      if (t) {
        const min = Math.min(...tg.trials.map((r) => r.ca));
        const max = Math.max(...tg.trials.map((r) => r.ca));
        t.insertAdjacentHTML('beforeend', `
          <thead><tr><th class="num">Mezcla</th>${tg.factors.map((f) => `<th>Grupo ${f.id}</th>`).join('')}<th class="num">Ángulo (°)</th><th class="num">Señal/ruido</th></tr></thead>
          <tbody>${tg.trials.map((r) => `
            <tr data-run="${r.run}" class="${r.ca === min ? 'is-best' : ''} ${r.ca === max ? 'is-worst' : ''}" tabindex="0" title="Cargar en el simulador">
              <td class="num">${r.run}</td>
              ${tg.factors.map((f) => `<td><span class="pill-code pill-code--name" data-factor="${f.id}">${esc(names[r[f.id]] || r[f.id])}</span></td>`).join('')}
              <td class="num"><span class="pill-ca">${r.ca.toFixed(1)}</span></td>
              <td class="num">${T.snSmaller(r.ca).toFixed(2)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="${tg.factors.length + 1}" class="muted small">Promedio de las 8 mezclas = ${T.grandMean(tg.trials).toFixed(2)}° · verde: mejor mezcla · rojo: peor mezcla · señal/ruido en decibelios (mayor es mejor)</td><td></td><td></td></tr></tfoot>`);
        const pick = (tr) => {
          $$('tbody tr', t).forEach((x) => x.classList.toggle('is-selected', x === tr));
          const run = tg.trials.find((x) => x.run === +tr.dataset.run);
          if (Sem.Simulator) Sem.Simulator.setSelection({ A: run.A, B: run.B, C: run.C, D: run.D });
        };
        t.addEventListener('click', (e) => { const tr = e.target.closest('tbody tr'); if (tr) pick(tr); });
        t.addEventListener('keydown', (e) => { const tr = e.target.closest('tbody tr'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(tr); } });
      }

      // ANOVA (calculada en vivo y contrastada con lo reportado)
      const a = T.anova(tg);
      const reported = Object.fromEntries(tg.anova.rows.map((r) => [r.source, r]));
      const sig = (p) => (p == null ? '' : p < 0.05 ? '<span class="sig sig--yes">significativo</span>' : p < 0.1 ? '<span class="sig sig--mid">marginal</span>' : '<span class="sig sig--no">no significativo</span>');
      const at = $('#anova-table');
      if (at) at.insertAdjacentHTML('beforeend', `
        <thead><tr><th>Fuente</th><th class="num">Grados de libertad</th><th class="num">Suma de cuadrados</th><th class="num">Cuadrado medio</th><th class="num">Estadístico F</th><th class="num">Valor p</th><th class="num">% de la variación</th></tr></thead>
        <tbody>
          ${a.rows.map((r) => `<tr>
            <td><b style="color:${FACTOR_COLORS[r.source]}">Grupo ${r.source}</b>${sig(reported[r.source].p)}</td>
            <td class="num">${r.df}</td><td class="num">${r.ss.toFixed(2)}</td><td class="num">${r.ms.toFixed(2)}</td>
            <td class="num">${r.f.toFixed(2)}</td><td class="num">${reported[r.source].p.toFixed(3)}</td><td class="num">${r.pct.toFixed(1)}</td></tr>`).join('')}
          <tr><td>Error</td><td class="num">${a.error.df}</td><td class="num">${a.error.ss.toFixed(2)}</td><td class="num">${a.error.ms.toFixed(2)}</td><td></td><td></td><td class="num">${a.error.pct.toFixed(1)}</td></tr>
          <tr><td><b>Total</b></td><td class="num">${a.total.df}</td><td class="num">${a.total.ss.toFixed(2)}</td><td></td><td></td><td></td><td class="num">100</td></tr>
        </tbody>
        <tfoot><tr><td colspan="7" class="muted small">Coeficiente de determinación R² = ${a.r2.toFixed(1)} % · ajustado = ${a.r2adj.toFixed(1)} % (coinciden con los del artículo). Con un solo grado de libertad para el error, las pruebas tienen poca potencia.</td></tr></tfoot>`);

      const oc = $('#optimum-combo');
      if (oc) oc.innerHTML = tg.factors.map((f) => {
        const lv = tg.optimum.levels[f.id];
        return `<span class="pill-code pill-code--name" data-factor="${f.id}">${esc(names[lv] || lv)} <small class="muted">(−${tg.optimum.contributions[f.id]}°)</small></span>`;
      }).join('');
    },

    critique(d) {
      const host = $('#critique');
      if (!host) return;
      host.innerHTML = d.critique.map((c) => `
        <article class="crit crit--${c.type}">
          <i data-lucide="${c.type === 'warn' ? 'alert-circle' : 'info'}"></i>
          <div><b>${esc(c.title)}</b><p>${esc(c.text)}</p></div>
        </article>`).join('');
    }
  };
  Sem.App = App;

  /* -------------------------------------------------------
     8. Esquema molecular (saponina triterpénica vs esteroidal)
     ------------------------------------------------------- */
  const Mol = {
    L: 26,
    rad: (deg) => (deg * Math.PI) / 180,
    center(v) { return [v.reduce((s, p) => s + p[0], 0) / v.length, v.reduce((s, p) => s + p[1], 0) / v.length]; },
    path(v) { return 'M' + v.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + ' Z'; },

    /** Hexágono regular "punta arriba" de lado L centrado en c */
    hex(c, L) {
      return [-90, -30, 30, 90, 150, 210].map((a) => [c[0] + L * Math.cos(this.rad(a)), c[1] + L * Math.sin(this.rad(a))]);
    },

    /** Arista del polígono cuya dirección (centro → punto medio) es la más cercana a dirDeg */
    edgeToward(v, dirDeg) {
      const c = this.center(v);
      let best = 0, bestD = Infinity;
      for (let i = 0; i < v.length; i++) {
        const p = v[i], q = v[(i + 1) % v.length];
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        const ang = (Math.atan2(m[1] - c[1], m[0] - c[0]) * 180) / Math.PI;
        const d = Math.abs(((ang - dirDeg + 540) % 360) - 180);
        if (d < bestD) { bestD = d; best = i; }
      }
      return [v[best], v[(best + 1) % v.length]];
    },

    /** Polígono regular de n lados que comparte la arista (p, q), del lado opuesto a 'away' */
    onEdge(p, q, n, away) {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const nx = -(q[1] - p[1]) / L, ny = (q[0] - p[0]) / L;
      const ap = L / (2 * Math.tan(Math.PI / n));
      const c1 = [m[0] + nx * ap, m[1] + ny * ap], c2 = [m[0] - nx * ap, m[1] - ny * ap];
      const c = Math.hypot(c1[0] - away[0], c1[1] - away[1]) > Math.hypot(c2[0] - away[0], c2[1] - away[1]) ? c1 : c2;
      const R = L / (2 * Math.sin(Math.PI / n));
      const a0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
      const aq = Math.atan2(q[1] - c[1], q[0] - c[0]);
      const step = (2 * Math.PI) / n;
      const dir = Math.abs(Math.atan2(Math.sin(a0 + step - aq), Math.cos(a0 + step - aq))) < 1e-3 ? 1 : -1;
      return Array.from({ length: n }, (_, k) => [c[0] + R * Math.cos(a0 + dir * k * step), c[1] + R * Math.sin(a0 + dir * k * step)]);
    },

    /** Fusiona un anillo de n lados sobre la arista de 'prev' orientada hacia dirDeg */
    fuse(prev, dirDeg, n) {
      const [p, q] = this.edgeToward(prev, dirDeg);
      return this.onEdge(p, q, n, this.center(prev));
    },

    /** Vértice del polígono más alineado con la dirección dirDeg desde su centro */
    vertexToward(v, dirDeg) {
      const c = this.center(v);
      const u = [Math.cos(this.rad(dirDeg)), Math.sin(this.rad(dirDeg))];
      const dot = (p) => (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1];
      return v.reduce((b, p) => (dot(p) > dot(b) ? p : b), v[0]);
    },

    sugar(c, label) {
      return '<path class="sugar" d="' + this.path(this.hex(c, 17)) + '"/><text class="lbl lbl--b" x="' + c[0].toFixed(1) + '" y="' + (c[1] + 4).toFixed(1) + '" text-anchor="middle">' + label + '</text>';
    },
    bond(a, b) { return '<path class="bond" d="M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' L ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) + '"/>'; },
    txt(x, y, t, style) { return '<text class="lbl" x="' + x.toFixed(0) + '" y="' + y.toFixed(0) + '"' + (style ? ' style="' + style + '"' : '') + '>' + t + '</text>'; },

    render(type) {
      const L = this.L;
      const A = this.hex([0, 0], L);
      const B = this.fuse(A, 0, 6);
      const C = this.fuse(B, -60, 6);
      let rings;
      if (type === 'tri') {
        // Oleanano: A–B–C–D–E, cinco anillos de seis miembros en escalera
        const D = this.fuse(C, 0, 6);
        const E = this.fuse(D, -60, 6);
        rings = [['A', A], ['B', B], ['C', C], ['D', D], ['E', E]];
      } else {
        // Espirostano: A–B–C (6) + D (5) + E (5, con O) + F (6, con O) unido en espiro por C-22
        const D = this.fuse(C, 0, 5);
        const E = this.fuse(D, -36, 5);
        const cE = this.center(E);
        const spiro = this.vertexToward(E, -10);
        const u = [spiro[0] - cE[0], spiro[1] - cE[1]];
        const ul = Math.hypot(u[0], u[1]);
        const cF = [spiro[0] + (u[0] / ul) * L, spiro[1] + (u[1] / ul) * L];
        const a0 = Math.atan2(spiro[1] - cF[1], spiro[0] - cF[0]);
        const F = Array.from({ length: 6 }, (_, k) => [cF[0] + L * Math.cos(a0 + (k * Math.PI) / 3), cF[1] + L * Math.sin(a0 + (k * Math.PI) / 3)]);
        rings = [['A', A], ['B', B], ['C', C], ['D', D], ['E', E, true, spiro], ['F', F, true, spiro]];
      }

      // Traslada el esqueleto para dejar margen a la izquierda (azúcares en C-3)
      const all = rings.flatMap((r) => r[1]);
      const minX = Math.min(...all.map((p) => p[0])), minY = Math.min(...all.map((p) => p[1]));
      const maxX = Math.max(...all.map((p) => p[0])), maxY = Math.max(...all.map((p) => p[1]));
      const ox = 150 - minX, oy = 62 - minY;
      const T = (p) => [p[0] + ox, p[1] + oy];
      rings = rings.map((r) => [r[0], r[1].map(T), r[2], r[3] ? T(r[3]) : null]);
      const W = maxX - minX, H = maxY - minY;
      const ring = (k) => rings.find((r) => r[0] === k)[1];

      let svg = '<rect class="zone zone--h" x="138" y="50" width="' + (W + 24).toFixed(0) + '" height="' + (H + 24).toFixed(0) + '" rx="14"/>' +
        '<text class="lbl lbl--b" x="140" y="40" style="fill:var(--gold)">Aglicona · hidrofóbica (' + (type === 'tri' ? '30 carbonos, oleanano' : '27 carbonos, espirostano') + ')</text>';

      rings.forEach(([name, v, hetero]) => {
        const c = this.center(v);
        svg += '<path class="ring ' + (hetero ? 'ring--o' : '') + '" d="' + this.path(v) + '"/>';
        svg += '<text class="ring-letter" x="' + c[0].toFixed(1) + '" y="' + c[1].toFixed(1) + '">' + name + '</text>';
      });

      // Doble enlace: Δ12 (anillo C, triterpeno) o Δ5 (anillo B, esteroide)
      const dr = ring(type === 'tri' ? 'C' : 'B');
      const [e1, e2] = this.edgeToward(dr, type === 'tri' ? 60 : 120);
      const dc = this.center(dr);
      const sh = (p) => [p[0] + (dc[0] - p[0]) * 0.22, p[1] + (dc[1] - p[1]) * 0.22];
      const s1 = sh(e1), s2 = sh(e2);
      svg += '<line class="dbl" x1="' + s1[0].toFixed(1) + '" y1="' + s1[1].toFixed(1) + '" x2="' + s2[0].toFixed(1) + '" y2="' + s2[1].toFixed(1) + '"/>';
      const mid = [(e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2];
      svg += this.txt(mid[0] + (mid[0] - dc[0]) * 0.6 - 8, mid[1] + (mid[1] - dc[1]) * 0.6 + 4, type === 'tri' ? 'Δ12' : 'Δ5', 'fill:var(--danger);font-weight:700');

      // Oxígenos del espirocetal (vecinos del carbono espiro C-22)
      if (type === 'ste') {
        ['E', 'F'].forEach((k) => {
          const r = rings.find((x) => x[0] === k);
          const v = r[1], sp = r[3];
          const i = v.findIndex((p) => Math.hypot(p[0] - sp[0], p[1] - sp[1]) < 0.5);
          const o = v[(i + (k === 'E' ? v.length - 1 : 1)) % v.length];
          svg += '<circle cx="' + o[0].toFixed(1) + '" cy="' + o[1].toFixed(1) + '" r="8" fill="var(--surface)" stroke="var(--danger)" stroke-width="1.5"/>' +
            '<text class="lbl" x="' + o[0].toFixed(1) + '" y="' + (o[1] + 4).toFixed(1) + '" text-anchor="middle" style="fill:var(--danger);font-weight:700">O</text>';
        });
        const sp = rings[4][3];
        svg += this.txt(sp[0] + 6, sp[1] + 40, 'C-22 (espiro)');
      }

      // C-3: vértice inferior izquierdo del anillo A → cadena de azúcares
      const c3 = this.vertexToward(ring('A'), 150);
      const g1 = [c3[0] - 44, c3[1] + 48];
      const g2 = [g1[0] - 34, g1[1] + 32], g3 = [g1[0] + 32, g1[1] + 34];
      svg += this.bond(c3, [g1[0] + 10, g1[1] - 14]);
      svg += this.txt(c3[0] - 34, c3[1] + 2, 'C-3');
      svg += this.txt(c3[0] - 18, c3[1] + 30, '–O–');
      svg += this.bond([g1[0] - 10, g1[1] + 12], [g2[0] + 10, g2[1] - 12]);
      svg += this.bond([g1[0] + 10, g1[1] + 12], [g3[0] - 10, g3[1] - 12]);
      svg += this.sugar(g1, 'Glc') + this.sugar(g2, type === 'tri' ? 'GlcA' : 'Rha') + this.sugar(g3, type === 'tri' ? 'Gal' : 'Glc');
      let maxY2 = g3[1] + 18, maxX2 = 0;

      // C-28 (triterpénica bidesmosídica): éster de azúcares en C-17 (unión D/E)
      if (type === 'tri') {
        const c28 = this.vertexToward(ring('E'), 90);
        const k1 = [c28[0] + 44, c28[1] + 46];
        const k2 = [k1[0] + 36, k1[1] + 32];
        svg += this.bond(c28, [k1[0] - 12, k1[1] - 12]);
        svg += this.bond([k1[0] + 10, k1[1] + 12], [k2[0] - 10, k2[1] - 12]);
        svg += this.txt(c28[0] + 30, c28[1] + 24, 'C-28 –COO–');
        svg += this.sugar(k1, 'Xyl') + this.sugar(k2, 'Rha');
        maxY2 = Math.max(maxY2, k2[1] + 18);
        maxX2 = k2[0] + 24;
      }

      const vbH = Math.max(maxY2, 62 + H + 24) + 28;
      svg += '<text class="lbl lbl--b" x="' + Math.max(4, g2[0] - 18).toFixed(0) + '" y="' + (vbH - 8).toFixed(0) + '" style="fill:#6c8ead">Glicona · hidrofílica</text>';
      const vbW = Math.max(150 + W + 30, maxX2 + 10, 420);
      return '<svg viewBox="0 0 ' + vbW.toFixed(0) + ' ' + vbH.toFixed(0) + '" role="img" aria-label="Esquema de saponina ' + (type === 'tri' ? 'triterpénica' : 'esteroidal') + '">' + svg + '</svg>';
    }
  };

  function initMolecule() {
    const host = $('#mol-svg');
    const cap = $('#mol-caption');
    if (!host) return;
    const captions = {
      tri: 'Saponina triterpénica bidesmosídica (esquema): aglicona pentacíclica de 30 carbonos tipo oleanano (anillos A–E, doble enlace Δ12 en rojo) con oligosacáridos en C-3 (éter) y C-28 (éster). Es el tipo que se encontró en estos extractos.',
      ste: 'Saponina esteroidal monodesmosídica (esquema): aglicona de 27 carbonos tipo espirostano (anillos A–D del esteroide + espirocetal E/F con dos oxígenos, Δ5 en rojo) con azúcares solo en C-3.'
    };
    const show = (t) => {
      host.innerHTML = Mol.render(t);
      if (cap) cap.textContent = captions[t];
      $$('[data-mol]').forEach((b) => b.classList.toggle('is-active', b.dataset.mol === t));
    };
    $$('[data-mol]').forEach((b) => b.addEventListener('click', () => show(b.dataset.mol)));
    show('tri');
  }

  /* -------------------------------------------------------
     9. Laboratorio de la ecuación de Young
     ------------------------------------------------------- */
  function initYoung() {
    const sv = $('#r-sv'), sl = $('#r-sl'), lv = $('#r-lv');
    if (!sv) return;
    const update = () => {
      const gSV = +sv.value, gSL = +sl.value, gLV = +lv.value;
      $('#o-sv').textContent = gSV; $('#o-sl').textContent = gSL; $('#o-lv').textContent = gLV;
      const cos = (gSV - gSL) / gLV;
      let theta, note = '';
      if (cos >= 1) { theta = 0; note = ' (extensión total)'; }
      else if (cos <= -1) { theta = 180; note = ' (no moja)'; }
      else theta = Math.acos(cos) * 180 / Math.PI;
      const g = Sem.dropGeometry(Math.max(theta, 6), 160, 130, { volume: 3800, maxHalf: 140, arcR: 24 });
      $('#young-drop').setAttribute('d', g.path);
      $('#young-angle').setAttribute('d', g.arc);
      const tg = $('#young-tangent');
      tg.setAttribute('x1', g.tangent.x1); tg.setAttribute('y1', g.tangent.y1);
      tg.setAttribute('x2', g.tangent.x2); tg.setAttribute('y2', g.tangent.y2);
      $('#young-label').textContent = `θ = ${theta.toFixed(1)}°${note}`;
      $('#young-theta').textContent = `${theta.toFixed(1)}°`;
      $('#young-wa').textContent = `${(gLV * (1 + Math.cos(theta * Math.PI / 180))).toFixed(1)}`;
      const S = gSV - gSL - gLV;
      $('#young-s').textContent = `${S >= 0 ? '+' : ''}${S.toFixed(0)}`;
    };
    [sv, sl, lv].forEach((r) => r.addEventListener('input', update));
    $$('[data-young]').forEach((b) => b.addEventListener('click', () => {
      const [l, s, x] = b.dataset.young.split(',').map(Number);
      lv.value = l; sv.value = s; sl.value = x;
      update();
    }));
    update();
  }

  /* -------------------------------------------------------
     10. Diagrama de la cutícula capilar (virgen vs decolorado)
     ------------------------------------------------------- */
  function initHair(d) {
    const svg = $('#hair-svg');
    if (!svg) return;
    const scales = $('#hair-scales'), mea = $('#hair-mea'), cys = $('#hair-cys');
    const baseY = 170;

    // Escamas cuticulares superpuestas
    let s = '';
    for (let x = -30; x < 660; x += 90) {
      s += `<path class="scale" data-x="${x}" d="M ${x} ${baseY + 22} L ${x + 104} ${baseY + 2} L ${x + 104} ${baseY + 14} L ${x} ${baseY + 34} Z" />`;
    }
    scales.innerHTML = `<rect x="0" y="${baseY}" width="640" height="26" fill="var(--hair-cuticle)" />` + s;

    // Cadenas de 18-MEA (ancladas por tioéster) y grupos ácido cisteico
    let m = '', c = '';
    const removed = new Set();
    // Remoción determinista del ~85 % de las cadenas
    for (let i = 0, x = 12; x < 640; x += 14, i++) { if (i % 7 !== 0) removed.add(i); }
    for (let i = 0, x = 12; x < 640; x += 14, i++) {
      const gone = removed.has(i);
      m += `<g class="mea-g" data-gone="${gone}">
        <line class="mea" x1="${x}" y1="${baseY}" x2="${x + 3}" y2="${baseY - 18}" />
        <circle class="mea-head" cx="${x}" cy="${baseY}" r="2.6" />
      </g>`;
      if (gone && i % 3 === 0) c += `<g class="cys-g"><circle class="cys" cx="${x}" cy="${baseY - 3}" r="3.2" /><text class="cys-t" x="${x - 9}" y="${baseY - 9}">SO₃⁻</text></g>`;
    }
    mea.innerHTML = m;
    cys.innerHTML = c;

    const states = {
      virgin: {
        theta: d.hair.water.virgin, label: `Agua ${d.hair.water.virgin}° → mezcla ${d.hair.blend.virgin}°`,
        layer: 'Capa lipídica F (unida por enlaces tioéster)',
        items: [
          'La capa F, de ácido 18-metileicosanoico, forma una monocapa grasa continua sobre la superficie del cabello.',
          `El agua no moja: θ = ${d.hair.water.virgin} ± ${d.hair.water.virginSD}° (literatura: ${d.hair.literature.virgin}).`,
          `La mezcla de saponinas baja θ a ${d.hair.blend.virgin}° en 1 s y a ≈ ${d.hair.spreading.virgin[6]}° a los 60 s: las agliconas se adsorben sobre las cadenas lipídicas y exponen sus azúcares al agua.`
        ]
      },
      bleached: {
        theta: d.hair.water.bleached, label: `Agua ${d.hair.water.bleached}° → mezcla ${d.hair.blend.bleached}°`,
        layer: `Capa F removida ≈ ${d.hair.fLayerRemoved} % · ácido cisteico expuesto`,
        items: [
          'El agua oxigenada en medio alcalino (con amoníaco, pH cercano a 9–10) rompe los enlaces tioéster y libera el ácido 18-metileicosanoico; la cistina se oxida a ácido cisteico (–SO₃⁻).',
          `La superficie queda aniónica, más polar, rugosa y porosa: θ con agua baja a ${d.hair.water.bleached}° (literatura: ${d.hair.literature.bleached}).`,
          `La rugosidad amplifica la humectación (modelo de Wenzel: cos θ* = r·cos θ) y la mezcla alcanza ${d.hair.blend.bleached}° en 1 s y ≈ ${d.hair.spreading.bleached[6]}° a los 60 s.`
        ]
      }
    };

    const set = (k) => {
      const st = states[k];
      const bleached = k === 'bleached';
      $$('.mea-g', mea).forEach((g) => { g.style.opacity = bleached && g.dataset.gone === 'true' ? 0 : 1; });
      $$('.cys-g', cys).forEach((g) => { g.style.opacity = bleached ? 1 : 0; });
      $$('.scale', scales).forEach((p, i) => {
        p.style.transformOrigin = `${+p.dataset.x}px ${baseY + 30}px`;
        p.style.transformBox = 'view-box';
        p.style.transform = bleached ? `rotate(${i % 2 ? -4 : -6}deg)` : 'none';
      });
      const g = Sem.dropGeometry(st.theta, 330, baseY - 18, { volume: 7600, maxHalf: 150, arcR: 26 });
      $('#hair-drop').setAttribute('d', g.path);
      $('#hair-theta').textContent = `θ ≈ ${Math.round(st.theta)}°`;
      $('#hair-layer-label').textContent = st.layer;
      const ex = $('#hair-explain');
      ex.innerHTML = `<li><b>${st.label}</b></li>` + st.items.map((t) => `<li>${esc(t)}</li>`).join('');
      $$('[data-hair]').forEach((b) => b.classList.toggle('is-active', b.dataset.hair === k));
    };
    $$('[data-hair]').forEach((b) => b.addEventListener('click', () => set(b.dataset.hair)));
    set('virgin');
  }

  /* -------------------------------------------------------
     11. Arranque
     ------------------------------------------------------- */
  async function boot() {
    initTheme();
    initNav();
    initProgress();
    initFigZoom();
    initTabs();

    let data;
    try {
      data = await loadData();
    } catch (err) {
      console.error(err);
      const m = $('#main');
      if (m) m.insertAdjacentHTML('afterbegin', `<div class="container"><div class="callout" style="margin-top:24px"><p><b>Error al cargar datos.</b> ${esc(err.message)}</p></div></div>`);
      initReveal(); icons(); renderMath();
      return;
    }
    const d = data.paper;
    App.paper = d;

    App.bindText(d);
    App.metrics(d);
    App.syllabus(d);
    App.hlbCalc(d);
    App.plants(d);
    App.taguchi(d);
    App.critique(d);
    initMolecule();
    initYoung();
    initHair(d);

    if (Sem.Simulator) Sem.Simulator.init(d);
    if (Sem.Charts) Sem.Charts.init(d);
    if (Sem.Glossary) Sem.Glossary.init(data.glossary);
    App.showExtract('APB', false);
    if (Sem.Simulator) Sem.Simulator.update();

    initReveal();
    icons();
    renderMath();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
