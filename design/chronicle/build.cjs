// Assemble proto.html from src/*, subset + embed the OFL font (Gowun Batang) as base64 woff2.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const D = __dirname, S = path.join(D, 'src');
const order = ['core.js', 'sprites.js', 'world.js', 'sim.js', 'render.js', 'hud.js', 'sheet.js', 'ui.js', 'main.js'];
let html = fs.readFileSync(path.join(S, 'head.html'), 'utf8');
html += order.map((f) => `// ---- ${f} ----\n` + fs.readFileSync(path.join(S, f), 'utf8')).join('\n') + '\n</script>\n</body>\n</html>\n';
const chars = new Set();
for (const ch of html) if (ch.codePointAt(0) > 126) chars.add(ch);
for (let c = 32; c < 127; c++) chars.add(String.fromCharCode(c));
'0123456789%/·—–…“”‘’「」『』《》'.split('').forEach((c) => chars.add(c));
const txt = path.join(D, 'font', 'chars.txt');
fs.writeFileSync(txt, [...chars].join(''));
let face = '/* Gowun Batang (c) 2021 The Gowun Batang Project Authors — SIL Open Font License 1.1 (font/OFL.txt). Subset embedded. */\n';
for (const [w, file] of [[400, 'GowunBatang-Regular.ttf'], [700, 'GowunBatang-Bold.ttf']]) {
  const out = path.join(D, 'font', `sub-${w}.woff2`);
  execFileSync('pyftsubset', [path.join(D, 'font', file), `--text-file=${txt}`, '--flavor=woff2', `--output-file=${out}`, '--layout-features=*']);
  const b64 = fs.readFileSync(out).toString('base64');
  face += `@font-face{font-family:'Gowun Batang';font-weight:${w};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}\n`;
}
html = html.replace('/*FONTFACE*/', face);
fs.writeFileSync(path.join(D, 'proto.html'), html);
console.log('proto.html', (html.length / 1024).toFixed(0) + ' KB,', chars.size, 'glyphs');
