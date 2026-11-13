// Assembles src/* into one self-contained proto.html (inline CSS + JS, no network).
const fs = require('fs');
const path = require('path');
const D = __dirname;
const head = fs.readFileSync(path.join(D, 'src/head.html'), 'utf8');
const order = ['core.js', 'sprites.js', 'world.js', 'sim.js', 'render.js', 'land.js', 'draw.js', 'hud.js', 'sheet.js', 'uimode.js', 'main.js'];
let js = '';
for (const f of order) {
  const p = path.join(D, 'src', f);
  if (fs.existsSync(p)) js += `\n// ---- ${f} ----\n` + fs.readFileSync(p, 'utf8');
}
const out = head.replace('/*__SCRIPT__*/', () => js);
fs.writeFileSync(path.join(D, 'proto.html'), out);
console.log('proto.html', out.length, 'bytes');
