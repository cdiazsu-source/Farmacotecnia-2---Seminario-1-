/* =========================================================
   charts.js — Gráficos interactivos (Chart.js 4)
   Lee colores de las variables CSS para respetar el tema.
   Los extractos se muestran con su nombre (especie · órgano),
   nunca con códigos abreviados.
   Expone: window.Sem.Charts
   ========================================================= */
(function () {
  'use strict';
  const Sem = (window.Sem = window.Sem || {});

  const FACTOR_COLORS = { A: '#40916c', B: '#d4a373', C: '#6c8ead', D: '#8a5a44' };
  // Color por especie (prefijo del código interno)
  const SPECIES_COLOR = { AL: '#40916c', AC: '#1b4332', AA: '#d4a373', AP: '#2d6a4f', GA: '#8a5a44' };
  const speciesColor = (code) => SPECIES_COLOR[code.slice(0, 2)] || '#40916c';
  const REF = 'Lauril sulfato de sodio';
  const REF_COLOR = '#6b6f80';

  /** Lee un token CSS */
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  /** Color con alfa a partir de hex */
  const alpha = (hex, a) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  // En oscuro, el verde esmeralda profundo se aclara para mantener contraste
  const adapt = (hex) => (isDark() && hex === '#1b4332' ? '#52b788' : hex);

  /** Ordena las claves de un objeto {código: valor} de forma ascendente/descendente */
  const sortedKeys = (obj, desc) => Object.keys(obj).sort((a, b) => (desc ? obj[b] - obj[a] : obj[a] - obj[b]));

  /** Plugin: línea de referencia (vertical u horizontal) con etiqueta */
  const refLine = (id, value, label, color, axis) => ({
    id,
    afterDraw(chart) {
      const { ctx, chartArea: { left, right, top, bottom } } = chart;
      const col = color.startsWith('--') ? css(color) : color;
      ctx.save();
      ctx.strokeStyle = col; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
      ctx.fillStyle = col; ctx.font = "600 11px 'Inter', sans-serif";
      if (axis === 'x') {
        const x = chart.scales.x.getPixelForValue(value);
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
        ctx.textAlign = 'right'; ctx.fillText(label, x - 4, top + 12);
      } else {
        const y = chart.scales.y.getPixelForValue(value);
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
        ctx.fillText(label, left + 6, y - 6);
      }
      ctx.restore();
    }
  });

  const Charts = {
    data: null,
    instances: {},
    state: { cmcScale: 'log', meMetric: 'mean', comboKey: null },

    init(data) {
      if (!window.Chart) { console.warn('Chart.js no disponible'); return; }
      this.data = data;
      this.applyDefaults();
      this.buildAll();
      this.bindControls();
    },

    applyDefaults() {
      const C = window.Chart;
      C.defaults.font.family = "'Inter', system-ui, sans-serif";
      C.defaults.font.size = 12;
      C.defaults.color = css('--chart-text');
      C.defaults.borderColor = css('--chart-grid');
      C.defaults.maintainAspectRatio = false;
      C.defaults.animation.duration = 700;
      C.defaults.plugins.legend.labels.usePointStyle = true;
      C.defaults.plugins.legend.labels.boxWidth = 8;
      C.defaults.plugins.tooltip.backgroundColor = isDark() ? '#0b1511' : '#1b4332';
      C.defaults.plugins.tooltip.titleColor = '#fff';
      C.defaults.plugins.tooltip.bodyColor = '#e3ebe6';
      C.defaults.plugins.tooltip.padding = 10;
      C.defaults.plugins.tooltip.cornerRadius = 8;
      C.defaults.plugins.tooltip.titleFont = { weight: '700' };
    },

    /** Crea o recrea un gráfico en el canvas indicado */
    make(id, config) {
      const el = document.getElementById(id);
      if (!el) return null;
      if (this.instances[id]) this.instances[id].destroy();
      this.instances[id] = new window.Chart(el.getContext('2d'), config);
      return this.instances[id];
    },

    buildAll() {
      this.saponin();
      this.sapVsCmc();
      this.foam();
      this.foamStability();
      this.cmc();
      this.surfaceTension();
      this.contactAngle();
      this.mainEffects();
      this.anova();
      this.validation();
      this.e24();
      this.hair();
      this.spreading();
      this.allCombos();
    },

    /** Reconstruye todo (cambio de tema) */
    refresh() {
      if (!this.data || !window.Chart) return;
      this.applyDefaults();
      this.buildAll();
      if (this.state.comboKey) this.highlightCombo(this.state.comboKey);
    },

    /** Redimensiona los gráficos visibles (al cambiar de pestaña) */
    resizeAll() {
      Object.values(this.instances).forEach((c) => c && c.resize());
    },

    /** Nombre legible de un extracto: "A. pennata · corteza" */
    name(code) { return this.data.extracts.names[code] || code; },
    /** Nombre en dos líneas para ejes estrechos: ["pennata", "corteza"] */
    short(code) {
      const [sp, part] = this.name(code).split(' · ');
      return [sp.replace(/^A\.\s|^G\.\s/, ''), part];
    },

    /** Configuración común de barras horizontales para comparar extractos */
    hbar(id, { labels, values, colors, axisTitle, tooltip, min, max, extra, onPick, xType }) {
      return this.make(id, {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 4, maxBarThickness: 22 }] },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: tooltip } } },
          scales: {
            x: Object.assign({ min, max, title: { display: true, text: axisTitle } }, xType || {}),
            y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } }
          },
          onClick: onPick ? (e, els) => { if (els.length) onPick(els[0].index); } : undefined
        },
        plugins: extra || []
      });
    },

    /* ---------------- Plantas ---------------- */
    saponin() {
      const d = this.data.extracts.saponin;
      const keys = sortedKeys(d, true);
      this.hbar('ch-saponin', {
        labels: keys.map((k) => this.name(k)),
        values: keys.map((k) => d[k]),
        colors: keys.map((k) => alpha(adapt(speciesColor(k)), 0.85)),
        axisTitle: 'Saponinas totales (% peso/peso)', min: 0,
        tooltip: (c) => ` ${c.parsed.x.toFixed(1)} % de saponinas`,
        onPick: (i) => Sem.App && Sem.App.showExtract(keys[i])
      });
    },

    sapVsCmc() {
      const ex = this.data.extracts;
      const pts = Object.keys(ex.saponin).map((k) => ({ x: ex.saponin[k], y: ex.cmc[k], code: k }));
      const self = this;
      this.make('ch-sap-cmc', {
        type: 'scatter',
        data: {
          datasets: [{
            label: 'Extractos', data: pts, pointRadius: 7, pointHoverRadius: 10,
            backgroundColor: pts.map((p) => alpha(adapt(speciesColor(p.code)), 0.85)),
            borderColor: css('--surface'), borderWidth: 2
          }]
        },
        options: {
          layout: { padding: { right: 70 } },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { title: (it) => this.name(it[0].raw.code), label: (c) => [` Saponinas: ${c.raw.x} %`, ` Concentración micelar crítica: ${c.raw.y.toFixed(3)} %`] } }
          },
          scales: {
            x: { title: { display: true, text: 'Saponinas totales (% peso/peso)' }, beginAtZero: true },
            y: { title: { display: true, text: 'Concentración micelar crítica (%)' }, min: 0.008, max: 0.026, ticks: { callback: (v) => v.toFixed(3) } }
          }
        },
        plugins: [{
          // Etiqueta cada punto con el nombre corto del extracto
          id: 'pointLabels',
          afterDatasetsDraw(chart) {
            const { ctx } = chart;
            ctx.save();
            ctx.font = "600 10px 'Inter', sans-serif";
            ctx.fillStyle = css('--chart-text');
            chart.getDatasetMeta(0).data.forEach((pt, i) => {
              const raw = chart.data.datasets[0].data[i];
              ctx.fillText(self.short(raw.code).join(' '), pt.x + 9, pt.y - 7);
            });
            ctx.restore();
          }
        }]
      });
    },

    /* ---------------- Espuma ---------------- */
    foam() {
      const ex = this.data.extracts;
      const keys = sortedKeys(ex.foam0, true);
      this.make('ch-foam', {
        type: 'bar',
        data: {
          labels: keys.map((k) => this.name(k)),
          datasets: [
            { label: 'Al inicio', data: keys.map((k) => ex.foam0[k]), backgroundColor: alpha('#40916c', 0.85), borderRadius: 4, maxBarThickness: 12 },
            { label: 'A los 10 minutos', data: keys.map((k) => ex.foam10[k]), backgroundColor: alpha('#d4a373', 0.9), borderRadius: 4, maxBarThickness: 12 }
          ]
        },
        options: {
          indexAxis: 'y',
          interaction: { mode: 'index', axis: 'y', intersect: false },
          plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.x.toFixed(1)} cm` } } },
          scales: { x: { beginAtZero: true, title: { display: true, text: 'Altura de espuma (cm)' } }, y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } } }
        }
      });
    },

    foamStability() {
      const d = this.data.extracts.foamStability;
      const keys = sortedKeys(d, true);
      this.hbar('ch-foamstab', {
        labels: keys.map((k) => this.name(k)),
        values: keys.map((k) => d[k]),
        colors: keys.map((k) => (d[k] >= 90 ? alpha('#40916c', 0.9) : d[k] >= 50 ? alpha('#74c69d', 0.75) : alpha('#b5482f', 0.6))),
        axisTitle: 'Espuma que queda a los 10 minutos (%)', min: 0, max: 100,
        tooltip: (c) => ` ${c.parsed.x} % de la espuma inicial`,
        extra: [refLine('threshold', 90, '90 %', '--gold', 'x')]
      });
    },

    /* ---------------- Concentración micelar crítica, tensión y ángulo ---------------- */
    cmc() {
      const ex = this.data.extracts;
      const keys = sortedKeys(ex.cmc, false);
      const log = this.state.cmcScale === 'log';
      this.hbar('ch-cmc', {
        labels: keys.map((k) => this.name(k)).concat(REF),
        values: keys.map((k) => ex.cmc[k]).concat(ex.sls.cmc),
        colors: keys.map((k) => (ex.cmc[k] <= 0.011 ? alpha('#40916c', 0.95) : alpha('#74c69d', 0.7))).concat(alpha(REF_COLOR, 0.85)),
        axisTitle: log ? 'Concentración micelar crítica (%, escala logarítmica)' : 'Concentración micelar crítica (%)',
        xType: log
          ? { type: 'logarithmic', min: 0.005, max: 0.4, ticks: { callback: (v) => ([0.01, 0.02, 0.05, 0.1, 0.2].includes(+(+v).toFixed(3)) ? v : '') } }
          : { type: 'linear', min: 0 },
        tooltip: (c) => {
          const v = c.parsed.x;
          return c.label === REF ? ` ${v.toFixed(2)} %` : [` ${v.toFixed(3)} %`, ` ${(ex.sls.cmc / v).toFixed(0)} veces menor que el lauril sulfato`];
        },
        onPick: (i) => keys[i] && Sem.App && Sem.App.showExtract(keys[i])
      });
    },

    surfaceTension() {
      const ex = this.data.extracts;
      const keys = sortedKeys(ex.surfaceTension, false);
      this.hbar('ch-st', {
        labels: [REF].concat(keys.map((k) => this.name(k))),
        values: [ex.sls.surfaceTension].concat(keys.map((k) => ex.surfaceTension[k])),
        colors: [alpha(REF_COLOR, 0.85)].concat(keys.map(() => alpha('#d4a373', 0.85))),
        axisTitle: 'Tensión superficial (mN/m)', min: 0, max: 80,
        tooltip: (c) => ` ${c.parsed.x.toFixed(1)} mN/m`,
        extra: [refLine('water', 72, 'Agua ≈ 72', '#4ea8de', 'x')],
        onPick: (i) => i > 0 && Sem.App && Sem.App.showExtract(keys[i - 1])
      });
    },

    contactAngle() {
      const d = this.data.extracts.contactAngle;
      const keys = sortedKeys(d, false);
      this.hbar('ch-ca', {
        labels: keys.map((k) => this.name(k)),
        values: keys.map((k) => d[k]),
        colors: keys.map((k) => (d[k] < 70 ? alpha('#40916c', 0.95) : alpha('#74c69d', 0.65))),
        axisTitle: 'Ángulo de contacto (°)', min: 0, max: 100,
        tooltip: (c) => ` θ = ${c.parsed.x.toFixed(1)}°`,
        extra: [refLine('ninetyCa', 90, '90°', '--gold', 'x')],
        onPick: (i) => Sem.App && Sem.App.showExtract(keys[i])
      });
    },

    /* ---------------- Diseño de la mezcla ---------------- */
    mainEffects() {
      const tg = this.data.taguchi;
      const T = Sem.Taguchi;
      const stats = T.levelStats(tg);
      const sn = this.state.meMetric === 'sn';
      const grand = sn
        ? tg.trials.reduce((s, t) => s + T.snSmaller(t.ca), 0) / tg.trials.length
        : T.grandMean(tg.trials);

      // Eje X compartido: extractos de todos los grupos en secuencia, con un hueco entre grupos
      const labels = [];
      const codes = [];
      const datasets = [];
      tg.factors.forEach((f, fi) => {
        const start = labels.length;
        f.levels.forEach((lv) => { labels.push(this.short(lv)); codes.push(lv); });
        const data = new Array(start).fill(null).concat(f.levels.map((lv) => (sn ? stats[f.id][lv].sn : stats[f.id][lv].mean)));
        datasets.push({
          label: `Grupo ${f.id}`, data, borderColor: FACTOR_COLORS[f.id], backgroundColor: FACTOR_COLORS[f.id],
          borderWidth: 2.5, borderDash: [6, 4], pointRadius: 6, pointHoverRadius: 8, spanGaps: false, tension: 0
        });
        if (fi < tg.factors.length - 1) { labels.push(''); codes.push(null); }
      });
      datasets.forEach((d) => { while (d.data.length < labels.length) d.data.push(null); });
      datasets.push({ label: sn ? 'Promedio' : 'Promedio de las 8 mezclas', data: labels.map(() => grand), borderColor: css('--text-muted'), borderWidth: 1, borderDash: [2, 3], pointRadius: 0, fill: false });

      this.make('ch-main', {
        type: 'line',
        data: { labels, datasets },
        options: {
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              filter: (c) => c.raw !== null && c.dataset.label.startsWith('Grupo'),
              callbacks: {
                title: (it) => this.name(codes[it[0].dataIndex]),
                label: (c) => sn ? ` Relación señal/ruido: ${c.parsed.y.toFixed(3)} decibelios` : ` Ángulo promedio: ${c.parsed.y.toFixed(2)}°`
              }
            }
          },
          scales: {
            y: sn ? { title: { display: true, text: 'Señal/ruido (decibelios) · mayor es mejor' } } : { min: 75, max: 84, title: { display: true, text: 'Ángulo promedio (°) · menor es mejor' } },
            x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, font: { size: 10 } } }
          }
        }
      });
    },

    anova() {
      const a = Sem.Taguchi.anova(this.data.taguchi);
      const labels = a.rows.map((r) => `Grupo ${r.source}`).concat('Error');
      const vals = a.rows.map((r) => r.pct).concat(a.error.pct);
      const colors = a.rows.map((r) => FACTOR_COLORS[r.source]).concat('#9aa3ad');
      this.make('ch-anova', {
        type: 'bar',
        data: { labels, datasets: [{ label: '% de la variación', data: vals, backgroundColor: colors, borderRadius: 6, maxBarThickness: 46 }] },
        options: {
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (c) => {
                  const r = a.rows[c.dataIndex];
                  return r ? [` ${c.parsed.x.toFixed(1)} % de la variación`, ` Suma de cuadrados: ${r.ss.toFixed(2)}`, ` Estadístico F: ${r.f.toFixed(2)}`] : ` ${c.parsed.x.toFixed(1)} % (suma de cuadrados: ${a.error.ss.toFixed(2)})`;
                }
              }
            }
          },
          scales: { x: { min: 0, max: 65, title: { display: true, text: '% de la variación total del ángulo' } }, y: { grid: { display: false } } }
        },
        plugins: [{
          id: 'valueLabels',
          afterDatasetsDraw(chart) {
            const { ctx } = chart; ctx.save();
            ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.fillStyle = css('--chart-text'); ctx.textBaseline = 'middle';
            chart.getDatasetMeta(0).data.forEach((bar, i) => ctx.fillText(`${vals[i].toFixed(1)} %`, bar.x + 6, bar.y));
            ctx.restore();
          }
        }]
      });
    },

    validation() {
      const o = this.data.taguchi.optimum;
      this.make('ch-valid', {
        type: 'bar',
        data: {
          labels: ['Promedio de las 8', 'Mejor de las 8', 'Predicho', 'Experimental'],
          datasets: [{ data: [o.grandMean, 75.0, o.predicted, o.experimental], backgroundColor: ['#9aa3ad', alpha('#74c69d', 0.8), alpha('#d4a373', 0.9), adapt('#1b4332')], borderRadius: 6, maxBarThickness: 26 }]
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` θ = ${c.parsed.x.toFixed(1)}°` } } },
          scales: { x: { min: 65, max: 82 }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } }
        }
      });
    },

    /* ---------------- Aplicaciones ---------------- */
    e24() {
      const e = this.data.emulsification;
      this.make('ch-e24', {
        type: 'bar',
        data: { labels: [REF, 'Mezcla óptima de saponinas'], datasets: [{ data: [e.sls, e.blend], backgroundColor: [alpha(REF_COLOR, 0.85), alpha('#40916c', 0.95)], borderRadius: 8, maxBarThickness: 70 }] },
        options: {
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.y.toFixed(1)} % emulsionado` } } },
          scales: { y: { min: 0, max: 100, title: { display: true, text: 'Índice de emulsificación (%)' } }, x: { grid: { display: false } } }
        }
      });
    },

    hair() {
      const h = this.data.hair;
      this.make('ch-hair', {
        type: 'bar',
        data: {
          labels: ['Virgen', 'Decolorado'],
          datasets: [
            { label: 'Agua ultrapura', data: [h.water.virgin, h.water.bleached], backgroundColor: alpha('#4ea8de', 0.75), borderRadius: 6, maxBarThickness: 46 },
            { label: 'Mezcla óptima', data: [h.blend.virgin, h.blend.bleached], backgroundColor: alpha('#40916c', 0.95), borderRadius: 6, maxBarThickness: 46 }
          ]
        },
        options: {
          plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}°` } } },
          scales: { y: { min: 0, max: 120, title: { display: true, text: 'Ángulo de contacto (°)' } }, x: { grid: { display: false } } }
        },
        plugins: [refLine('ninety', 90, '90° (límite: por encima no moja)', '--gold', 'y')]
      });
    },

    spreading() {
      const s = this.data.hair.spreading;
      this.make('ch-spread', {
        type: 'line',
        data: {
          labels: s.t.map((t) => `${t} s`),
          datasets: [
            { label: 'Virgen', data: s.virgin, borderColor: adapt('#1b4332'), backgroundColor: alpha('#40916c', 0.12), fill: true, tension: 0.3, pointRadius: 4 },
            { label: 'Decolorado', data: s.bleached, borderColor: '#b5482f', backgroundColor: alpha('#b5482f', 0.1), fill: true, tension: 0.3, pointRadius: 4 }
          ]
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}°` } } },
          scales: { y: { min: 0, max: 80, title: { display: true, text: 'Ángulo de contacto (°)' } }, x: { title: { display: true, text: 'Tiempo (segundos)' } } }
        }
      });
    },

    /* ---------------- Simulador: 32 mezclas ---------------- */
    allCombos() {
      const sim = Sem.Simulator;
      if (!sim || !sim.ranking) return;
      const tg = this.data.taguchi;
      const runKeys = tg.trials.map((t) => Sem.Taguchi.comboKey(t, tg));
      const r = sim.ranking;
      this.make('ch-all', {
        type: 'bar',
        data: {
          labels: r.map((x, i) => `Mezcla ${i + 1}`),
          datasets: [{
            data: r.map((x) => x.y),
            backgroundColor: r.map((x) => (runKeys.includes(x.key) ? adapt('#1b4332') : alpha('#74c69d', 0.55))),
            borderRadius: 3
          }]
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (it) => tg.factors.map((f) => this.name(r[it[0].dataIndex].combo[f.id])),
                label: (c) => {
                  const k = r[c.dataIndex].key;
                  const tr = tg.trials.find((t) => Sem.Taguchi.comboKey(t, tg) === k);
                  return [` Predicho: ${c.parsed.y.toFixed(1)}°`].concat(tr ? [` Medido (mezcla ${tr.run} del diseño): ${tr.ca}°`] : []);
                }
              }
            }
          },
          scales: {
            y: { min: 70, max: 88, title: { display: true, text: 'Ángulo predicho (°)' } },
            x: { ticks: { display: false }, grid: { display: false }, title: { display: true, text: 'Mezclas ordenadas de menor a mayor ángulo' } }
          },
          onClick: (e, els) => { if (els.length) sim.setSelection(r[els[0].index].combo); }
        }
      });
    },

    highlightCombo(key) {
      this.state.comboKey = key;
      const ch = this.instances['ch-all'];
      const sim = Sem.Simulator;
      if (!ch || !sim) return;
      const tg = this.data.taguchi;
      const runKeys = tg.trials.map((t) => Sem.Taguchi.comboKey(t, tg));
      ch.data.datasets[0].backgroundColor = sim.ranking.map((x) =>
        x.key === key ? '#d4a373' : runKeys.includes(x.key) ? adapt('#1b4332') : alpha('#74c69d', 0.55)
      );
      ch.update('none');
    },

    bindControls() {
      document.querySelectorAll('[data-cmc-scale]').forEach((b) => b.addEventListener('click', () => {
        this.state.cmcScale = b.dataset.cmcScale;
        document.querySelectorAll('[data-cmc-scale]').forEach((x) => x.classList.toggle('is-active', x === b));
        this.cmc();
      }));
      document.querySelectorAll('[data-me]').forEach((b) => b.addEventListener('click', () => {
        this.state.meMetric = b.dataset.me;
        document.querySelectorAll('[data-me]').forEach((x) => x.classList.toggle('is-active', x === b));
        this.mainEffects();
      }));
    }
  };

  Sem.Charts = Charts;
})();
