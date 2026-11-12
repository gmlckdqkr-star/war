// Generates the app icons (PNG) with headless Chromium. Run: npm run icons
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync } from 'node:fs';

const draw = (size) => `
const c = document.createElement('canvas'); c.width = c.height = ${size};
const g = c.getContext('2d'); const s = ${size} / 512;
g.scale(s, s);
const bg = g.createRadialGradient(256, 200, 40, 256, 256, 360);
bg.addColorStop(0, '#5a3a1a'); bg.addColorStop(1, '#16130f');
g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
// ember sky
g.fillStyle = 'rgba(255,140,50,0.25)'; g.beginPath(); g.arc(256, 150, 150, 0, Math.PI*2); g.fill();
// castle silhouette
g.fillStyle = '#b8b2a4';
g.fillRect(96, 250, 320, 170);
for (let x = 96; x < 416; x += 40) g.fillRect(x, 226, 24, 30);
g.fillRect(70, 190, 80, 230); g.fillRect(362, 190, 80, 230);
for (const x of [70, 362]) for (let k = 0; k < 3; k++) g.fillRect(x + k * 30, 168, 20, 26);
g.fillRect(206, 150, 100, 270);
for (let k = 0; k < 3; k++) g.fillRect(206 + k * 40, 128, 22, 26);
// gate
g.fillStyle = '#3a2614'; g.beginPath(); g.moveTo(222, 420); g.lineTo(222, 340); g.arc(256, 340, 34, Math.PI, 0); g.lineTo(290, 420); g.fill();
// banner
g.strokeStyle = '#2a2016'; g.lineWidth = 6; g.beginPath(); g.moveTo(256, 150); g.lineTo(256, 70); g.stroke();
g.fillStyle = '#2f5fc4'; g.beginPath(); g.moveTo(256, 72); g.lineTo(330, 84); g.lineTo(256, 112); g.fill();
// ground
g.fillStyle = '#2a2219'; g.fillRect(0, 420, 512, 92);
c.toDataURL('image/png');
`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [192, 512]) {
  const url = await page.evaluate(draw(size));
  writeFileSync(`public/icon-${size}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', size);
}
await browser.close();
