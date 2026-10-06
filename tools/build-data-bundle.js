/* Regenera assets/data/data-bundle.js a partir de los JSON.
   Permite abrir index.html con doble clic (file://), donde fetch() está bloqueado.
   Uso:  node tools/build-data-bundle.js */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'assets', 'data');
const paper = JSON.parse(fs.readFileSync(path.join(dir, 'paper-data.json'), 'utf8'));
const glossary = JSON.parse(fs.readFileSync(path.join(dir, 'glossary.json'), 'utf8'));

const out =
  '/* Archivo generado por tools/build-data-bundle.js — no editar a mano.\n' +
  '   Fuente de verdad: paper-data.json y glossary.json */\n' +
  'window.__SEM_DATA__ = ' + JSON.stringify({ paper, glossary }) + ';\n';

fs.writeFileSync(path.join(dir, 'data-bundle.js'), out, 'utf8');
console.log('data-bundle.js generado (' + out.length + ' bytes)');
