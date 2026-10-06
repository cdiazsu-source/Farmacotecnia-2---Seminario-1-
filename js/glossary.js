/* =========================================================
   glossary.js — Glosario con búsqueda en tiempo real,
   filtros por categoría y enlaces entre términos.
   Expone: window.Sem.Glossary
   ========================================================= */
(function () {
  'use strict';
  const Sem = (window.Sem = window.Sem || {});

  /** Normaliza texto: minúsculas y sin tildes (búsqueda tolerante) */
  const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = (s) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Resalta las coincidencias de la consulta dentro de un texto plano */
  function highlight(text, q) {
    const safe = esc(text);
    if (!q) return safe;
    const nText = norm(text);
    const nq = norm(q);
    let out = '';
    let i = 0;
    let idx = nText.indexOf(nq);
    // La normalización NFD + remoción de diacríticos conserva la longitud en caracteres precompuestos del español
    if (nText.length !== text.length) return safe;
    while (idx !== -1) {
      out += esc(text.slice(i, idx)) + '<mark>' + esc(text.slice(idx, idx + nq.length)) + '</mark>';
      i = idx + nq.length;
      idx = nText.indexOf(nq, i);
    }
    return out + esc(text.slice(i));
  }

  const Glossary = {
    data: null,
    state: { q: '', cat: 'all' },

    init(glossary) {
      this.data = glossary;
      this.data.terms.sort((a, b) => a.term.localeCompare(b.term, 'es'));
      this.renderFilters();
      this.bind();
      this.render();
    },

    catLabel(id) {
      const c = this.data.categories.find((x) => x.id === id);
      return c ? c.label : id;
    },

    renderFilters() {
      const host = document.getElementById('glossary-filters');
      if (!host) return;
      const count = (id) => this.data.terms.filter((t) => id === 'all' || t.category === id).length;
      const btn = (id, label, icon) =>
        `<button type="button" class="chip ${this.state.cat === id ? 'is-active' : ''}" data-cat="${id}" aria-pressed="${this.state.cat === id}">
          ${icon ? `<i data-lucide="${icon}"></i>` : ''}${label} <span class="chip__n">${count(id)}</span>
        </button>`;
      host.innerHTML = btn('all', 'Todas', 'layers') + this.data.categories.map((c) => btn(c.id, c.label, c.icon)).join('');
      if (window.lucide) window.lucide.createIcons({ attrs: {}, nameAttr: 'data-lucide' });
    },

    bind() {
      const input = document.getElementById('glossary-search');
      if (input) {
        let t;
        input.addEventListener('input', () => {
          clearTimeout(t);
          t = setTimeout(() => { this.state.q = input.value.trim(); this.render(); }, 90);
        });
        input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; this.state.q = ''; this.render(); } });
      }
      const filters = document.getElementById('glossary-filters');
      if (filters) filters.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cat]');
        if (!b) return;
        this.state.cat = b.dataset.cat;
        filters.querySelectorAll('[data-cat]').forEach((x) => {
          const on = x === b;
          x.classList.toggle('is-active', on);
          x.setAttribute('aria-pressed', on);
        });
        this.render();
      });
      const grid = document.getElementById('glossary-grid');
      if (grid) grid.addEventListener('click', (e) => {
        const rel = e.target.closest('[data-goto]');
        if (rel) { e.preventDefault(); this.goTo(rel.dataset.goto); }
      });
    },

    /** Navega a un término relacionado (limpia filtros y lo abre) */
    goTo(name) {
      const input = document.getElementById('glossary-search');
      this.state.cat = 'all';
      this.state.q = '';
      if (input) input.value = '';
      document.querySelectorAll('#glossary-filters [data-cat]').forEach((x) => x.classList.toggle('is-active', x.dataset.cat === 'all'));
      this.render();
      const el = Array.from(document.querySelectorAll('.term')).find((d) => d.dataset.term === name);
      if (el) {
        el.open = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.animate([{ boxShadow: '0 0 0 4px rgba(212,163,115,.7)' }, { boxShadow: '0 0 0 0 rgba(212,163,115,0)' }], { duration: 1200 });
      }
    },

    filtered() {
      const q = norm(this.state.q);
      return this.data.terms.filter((t) => {
        if (this.state.cat !== 'all' && t.category !== this.state.cat) return false;
        if (!q) return true;
        return norm(t.term).includes(q) || norm(t.short).includes(q) || norm(t.long).includes(q);
      });
    },

    render() {
      const grid = document.getElementById('glossary-grid');
      if (!grid) return;
      const list = this.filtered();
      const q = this.state.q;
      const names = new Set(this.data.terms.map((t) => t.term));
      const counter = document.getElementById('glossary-count');
      if (counter) counter.textContent = `${list.length} de ${this.data.terms.length} términos`;

      if (!list.length) {
        grid.innerHTML = `<div class="empty">No hay términos que coincidan con «${esc(q)}». Pruebe con otra palabra o categoría.</div>`;
        return;
      }

      grid.innerHTML = list.map((t) => {
        // Abre automáticamente la tarjeta si la coincidencia está solo en la descripción larga
        const autoOpen = q && !norm(t.term).includes(norm(q)) && !norm(t.short).includes(norm(q)) && norm(t.long).includes(norm(q));
        const rel = (t.related || []).filter((r) => names.has(r));
        return `<details class="term" data-term="${esc(t.term)}" ${autoOpen ? 'open' : ''}>
          <summary>
            <span class="term__top"><span class="term__t">${highlight(t.term, q)}</span><span class="term__cat" data-cat="${t.category}">${esc(this.catLabel(t.category))}</span></span>
            <p class="term__s">${highlight(t.short, q)}</p>
            ${t.week ? `<span class="term__week">Programa · Semana ${esc(t.week)}</span>` : ''}
            <span class="term__more">Ver más <i data-lucide="chevron-down"></i></span>
          </summary>
          <div class="term__body">
            <p>${highlight(t.long, q)}</p>
            ${t.formula ? `<div class="formula" data-tex="${esc(t.formula)}"></div>` : ''}
            ${rel.length ? `<div class="term__rel"><span class="muted small">Relacionados:</span>${rel.map((r) => `<button type="button" class="chip" data-goto="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}
          </div>
        </details>`;
      }).join('');

      // Fórmulas con KaTeX
      if (window.katex) {
        grid.querySelectorAll('[data-tex]').forEach((el) => {
          try { window.katex.render(el.dataset.tex, el, { displayMode: true, throwOnError: false }); }
          catch (e) { el.textContent = el.dataset.tex; }
        });
      } else {
        grid.querySelectorAll('[data-tex]').forEach((el) => { el.textContent = el.dataset.tex; });
      }
      if (window.lucide) window.lucide.createIcons();
    }
  };

  Sem.Glossary = Glossary;
})();
