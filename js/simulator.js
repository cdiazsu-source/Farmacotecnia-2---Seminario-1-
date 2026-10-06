/* =========================================================
   simulator.js — Motor Taguchi (modelo aditivo, S/N, ANOVA)
   y simulador interactivo de mezclas.
   Expone: window.Sem.Taguchi y window.Sem.Simulator
   ========================================================= */
(function () {
  'use strict';
  const Sem = (window.Sem = window.Sem || {});

  /* -------------------------------------------------------
     Motor de cálculo Taguchi
     ------------------------------------------------------- */
  const Taguchi = {
    /** Relación S/N "menor es mejor": −10·log10(Σy²/n) */
    snSmaller(values) {
      const arr = Array.isArray(values) ? values : [values];
      const msd = arr.reduce((s, y) => s + y * y, 0) / arr.length;
      return -10 * Math.log10(msd);
    },

    /** Media global de las corridas */
    grandMean(trials) {
      return trials.reduce((s, t) => s + t.ca, 0) / trials.length;
    },

    /**
     * Medias por nivel para cada factor.
     * Devuelve { A: { ALP: {mean, sn, n}, ... }, B: {...}, ... }
     */
    levelStats(tg) {
      const out = {};
      tg.factors.forEach((f) => {
        out[f.id] = {};
        f.levels.forEach((lv) => {
          const ys = tg.trials.filter((t) => t[f.id] === lv).map((t) => t.ca);
          const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
          const sn = ys.map((y) => this.snSmaller(y)).reduce((a, b) => a + b, 0) / ys.length;
          out[f.id][lv] = { mean, sn, n: ys.length };
        });
      });
      return out;
    },

    /** Predicción aditiva: T̄ + Σ(ȳ_nivel − T̄) */
    predict(tg, selection, stats) {
      const T = this.grandMean(tg.trials);
      const s = stats || this.levelStats(tg);
      const deltas = {};
      let y = T;
      tg.factors.forEach((f) => {
        const d = s[f.id][selection[f.id]].mean - T;
        deltas[f.id] = d;
        y += d;
      });
      return { value: y, grand: T, deltas };
    },

    /** ANOVA de efectos principales (sumas de cuadrados exactas) */
    anova(tg) {
      const T = this.grandMean(tg.trials);
      const s = this.levelStats(tg);
      const rows = tg.factors.map((f) => {
        const ss = f.levels.reduce((acc, lv) => acc + s[f.id][lv].n * Math.pow(s[f.id][lv].mean - T, 2), 0);
        return { source: f.id, df: f.levels.length - 1, ss };
      });
      const ssT = tg.trials.reduce((acc, t) => acc + Math.pow(t.ca - T, 2), 0);
      const dfT = tg.trials.length - 1;
      const ssE = ssT - rows.reduce((a, r) => a + r.ss, 0);
      const dfE = dfT - rows.reduce((a, r) => a + r.df, 0);
      const msE = dfE > 0 ? ssE / dfE : NaN;
      rows.forEach((r) => {
        r.ms = r.ss / r.df;
        r.f = r.ms / msE;
        r.pct = (r.ss / ssT) * 100;
      });
      return {
        rows,
        error: { df: dfE, ss: ssE, ms: msE, pct: (ssE / ssT) * 100 },
        total: { df: dfT, ss: ssT },
        r2: (1 - ssE / ssT) * 100,
        r2adj: (1 - (ssE / dfE) / (ssT / dfT)) * 100
      };
    },

    /** Todas las combinaciones posibles (producto cartesiano de niveles) */
    allCombos(tg) {
      return tg.factors.reduce(
        (acc, f) => acc.flatMap((c) => f.levels.map((lv) => Object.assign({}, c, { [f.id]: lv }))),
        [{}]
      );
    },

    comboKey(sel, tg) {
      return tg.factors.map((f) => sel[f.id]).join('+');
    }
  };
  Sem.Taguchi = Taguchi;

  /* -------------------------------------------------------
     Geometría de la gota (casquete esférico) para un ángulo θ
     Devuelve el path SVG y el arco del ángulo en el borde izquierdo.
     ------------------------------------------------------- */
  function dropGeometry(thetaDeg, cx, baseY, opts) {
    const o = Object.assign({ volume: 3600, maxHalf: 120, arcR: 22 }, opts || {});
    const th = Math.max(5, Math.min(175, thetaDeg)) * Math.PI / 180;
    // Área 2D de un segmento circular con semiancho a: A = R²(θ − sinθcosθ), a = R sinθ
    const R = Math.sqrt(o.volume / (th - Math.sin(th) * Math.cos(th)));
    let a = R * Math.sin(th);
    let scale = 1;
    if (a > o.maxHalf) { scale = o.maxHalf / a; a = o.maxHalf; }
    const Rs = R * scale;
    const h = Rs * (1 - Math.cos(th));
    const large = th > Math.PI / 2 ? 1 : 0;
    const x1 = cx - a, x2 = cx + a;
    const path = `M ${x1.toFixed(2)} ${baseY} A ${Rs.toFixed(2)} ${Rs.toFixed(2)} 0 ${large} 1 ${x2.toFixed(2)} ${baseY} Z`;
    // Arco del ángulo de contacto en el punto triple izquierdo (desde la superficie hacia la tangente)
    const r = o.arcR;
    const ax = x1 + r, ay = baseY;
    const bx = x1 + r * Math.cos(th), by = baseY - r * Math.sin(th);
    const arc = `M ${ax.toFixed(2)} ${ay} A ${r} ${r} 0 0 0 ${bx.toFixed(2)} ${by.toFixed(2)}`;
    const tangent = { x1, y1: baseY, x2: x1 + 60 * Math.cos(th), y2: baseY - 60 * Math.sin(th) };
    return { path, arc, a, h, x1, tangent };
  }
  Sem.dropGeometry = dropGeometry;

  /* -------------------------------------------------------
     Simulador interactivo
     ------------------------------------------------------- */
  const FACTOR_COLORS = { A: '#40916c', B: '#d4a373', C: '#6c8ead', D: '#8a5a44' };

  const Simulator = {
    data: null,
    stats: null,
    selection: null,
    ranking: null,

    init(data) {
      this.data = data;
      const tg = data.taguchi;
      this.stats = Taguchi.levelStats(tg);
      this.grand = Taguchi.grandMean(tg.trials);

      // Ranking de las 32 combinaciones
      this.ranking = Taguchi.allCombos(tg)
        .map((c) => ({ combo: c, key: Taguchi.comboKey(c, tg), y: Taguchi.predict(tg, c, this.stats).value }))
        .sort((p, q) => p.y - q.y);

      this.selection = Object.assign({}, tg.trials[0]);
      delete this.selection.run; delete this.selection.ca;

      this.renderControls();
      this.bindActions();
      this.update();
    },

    renderControls() {
      const tg = this.data.taguchi;
      const names = this.data.extracts.names;
      const host = document.getElementById('sim-controls');
      if (!host) return;
      host.innerHTML = tg.factors.map((f) => `
        <fieldset class="sim-factor" style="--f-color:${FACTOR_COLORS[f.id]}">
          <div class="sim-factor__h"><b>Grupo ${f.id} · ${f.name}</b><span>${f.levels.length} opciones</span></div>
          <div class="sim-opts">
            ${f.levels.map((lv, i) => {
              const d = this.stats[f.id][lv].mean - this.grand;
              const cls = d < 0 ? 'neg' : 'pos';
              const id = `sim-${f.id}-${lv}`;
              return `<div class="sim-opt">
                <input type="radio" name="sim-${f.id}" id="${id}" value="${lv}" ${this.selection[f.id] === lv ? 'checked' : ''} />
                <label for="${id}">
                  <b>${(names[lv] || lv).split(' · ')[1] || lv}</b>
                  <span>${(names[lv] || '').split(' · ')[0]}</span>
                  <i class="${cls}">${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}°</i>
                </label>
              </div>`;
            }).join('')}
          </div>
        </fieldset>`).join('');

      host.addEventListener('change', (e) => {
        const t = e.target;
        if (t.name && t.name.startsWith('sim-')) {
          this.selection[t.name.slice(4)] = t.value;
          this.update();
        }
      });
    },

    setSelection(sel) {
      this.selection = Object.assign({}, sel);
      Object.keys(sel).forEach((k) => {
        const el = document.getElementById(`sim-${k}-${sel[k]}`);
        if (el) el.checked = true;
      });
      this.update();
    },

    bindActions() {
      const best = this.ranking[0].combo;
      const worst = this.ranking[this.ranking.length - 1].combo;
      const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
      on('sim-optimum', () => this.setSelection(best));
      on('sim-worst', () => this.setSelection(worst));
      on('sim-random', () => {
        const r = this.ranking[Math.floor(Math.random() * this.ranking.length)].combo;
        this.setSelection(r);
      });
    },

    update() {
      const tg = this.data.taguchi;
      const res = Taguchi.predict(tg, this.selection, this.stats);
      const y = res.value;

      // Valor y gota
      const thetaEl = document.getElementById('sim-theta');
      if (thetaEl) thetaEl.textContent = `${y.toFixed(1)}°`;
      const g = dropGeometry(y, 150, 118, { volume: 4200, maxHalf: 130, arcR: 26 });
      const dp = document.getElementById('sim-drop');
      const ar = document.getElementById('sim-arc');
      if (dp) dp.setAttribute('d', g.path);
      if (ar) ar.setAttribute('d', g.arc);

      // Ecuación del modelo con los valores actuales
      const eq = document.getElementById('sim-eq');
      if (eq) {
        const parts = tg.factors.map((f) => {
          const d = res.deltas[f.id];
          return `${d < 0 ? '-' : '+'} \\underbrace{${Math.abs(d).toFixed(2)}}_{\\text{${f.id}}}`;
        }).join(' ');
        const tex = `\\hat{\\theta} = \\underbrace{${res.grand.toFixed(2)}}_{\\text{promedio}} ${parts} = \\mathbf{${y.toFixed(2)}^\\circ}`;
        if (window.katex) {
          try { window.katex.render(tex, eq, { throwOnError: false, displayMode: true }); }
          catch (e) { eq.textContent = `θ = ${y.toFixed(2)}°`; }
        } else {
          eq.textContent = `θ = ${res.grand.toFixed(1)} ${tg.factors.map((f) => (res.deltas[f.id] < 0 ? '− ' : '+ ') + Math.abs(res.deltas[f.id]).toFixed(1)).join(' ')} = ${y.toFixed(1)}°`;
        }
      }

      // Barras de desviación por factor (centro = media global; izquierda = reduce θ)
      const bars = document.getElementById('sim-bars');
      if (bars) {
        const maxAbs = 4; // escala ±4°
        bars.innerHTML = tg.factors.map((f) => {
          const d = res.deltas[f.id];
          const w = Math.min(Math.abs(d) / maxAbs, 1) * 50;
          const left = d < 0 ? 50 - w : 50;
          const col = d < 0 ? 'var(--accent)' : 'var(--danger)';
          return `<div class="sbar">
            <span class="sbar__lbl" style="color:${FACTOR_COLORS[f.id]}">Grupo ${f.id}</span>
            <span class="sbar__track"><span class="sbar__fill" style="left:${left}%;width:${w}%;background:${col}"></span></span>
            <span class="sbar__v">${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}°</span>
          </div>`;
        }).join('');
      }

      // Metadatos: S/N, ranking y si existe dato experimental
      const key = Taguchi.comboKey(this.selection, tg);
      const rank = this.ranking.findIndex((r) => r.key === key) + 1;
      const trial = tg.trials.find((t) => Taguchi.comboKey(t, tg) === key);
      const opt = tg.optimum.levels;
      const isOpt = Taguchi.comboKey(opt, tg) === key;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('sim-sn', Taguchi.snSmaller(y).toFixed(2));
      set('sim-rank', `${rank} / ${this.ranking.length}`);
      set('sim-exp', trial ? `${trial.ca.toFixed(1)}° (mezcla ${trial.run})` : isOpt ? `${tg.optimum.experimental.toFixed(1)}° (confirmado)` : 'No se preparó');

      // Notifica a los gráficos
      if (Sem.Charts && Sem.Charts.highlightCombo) Sem.Charts.highlightCombo(key);
    }
  };
  Sem.Simulator = Simulator;
})();
