# Seminario Farmacotecnia II — Saponinas multiplanta

Sitio web estático e interactivo (HTML/CSS/JS sin frameworks) para el seminario
**"Nuevos agentes tensioactivos o sistemas emulsificantes aplicables a sistemas heterodispersos"**,
basado en Viswam et al. (2026), *Next Materials* 12, 102197 — doi:10.1016/j.nxmate.2026.102197.

## Cómo abrirlo

- **Doble clic en `index.html`**: funciona sin servidor (los datos se cargan desde `assets/data/data-bundle.js`).
  Requiere internet para las fuentes, Chart.js, KaTeX y los iconos (CDN).
- **Con servidor local** (recomendado al editar los JSON): `node tools/serve.js` → http://localhost:5500

## Escudo de la universidad

Incluido en **`assets/img/escudo-unal.svg`** (Wikimedia Commons, «Escudo de la Universidad Nacional de Colombia (2016).svg»).
Es una insignia institucional: úselo solo en contexto académico de la UNAL.

## Estructura

```
index.html                 Portada + secciones A–H + discusión
styles/main.css            Tokens de diseño (claro/oscuro), layout, portada, navegación
styles/components.css      Tarjetas, pestañas, tablas, glosario, simulador
js/main.js                 Carga de datos, navegación, render, esquema molecular, Young, cabello
js/charts.js               16 gráficos Chart.js (se recolorean al cambiar de tema)
js/glossary.js             Buscador en tiempo real + filtros por categoría
js/simulator.js            Motor Taguchi (S/N, ANOVA, modelo aditivo) y simulador
assets/data/paper-data.json  Datos del artículo (tablas y valores leídos de las figuras)
assets/data/glossary.json    44 términos del glosario
assets/data/data-bundle.js   Copia generada de los JSON para uso con file://
tools/build-data-bundle.js   Regenera data-bundle.js
tools/serve.js               Servidor estático mínimo
```

## Si edita los datos

Los JSON son la fuente de verdad. Después de modificarlos ejecute:

```
node tools/build-data-bundle.js
```

## Notas sobre los datos

- Tablas 1–3 (diseño L8, ángulos de contacto, óptimo) transcritas del artículo.
- ANOVA, R² y S/N **recalculados** desde la Tabla 2: reproducen exactamente R² = 99.7 %, R² aj. = 97.9 % y el óptimo de 72.8°.
- Espuma, CMC, saponinas, tensión superficial, ángulos por extracto y cinética en cabello: **leídos de las figuras** (±0.1 unidades aprox.).
- Espectros FTIR y UV-Vis: **esquemáticos** (posiciones de bandas reales, curvas ilustrativas).
- El rendimiento de extracción (Sección S3 del suplementario) no está en el artículo principal y no se incluye.
