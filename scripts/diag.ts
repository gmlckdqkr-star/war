/**
 * Battle timeline for debugging balance/AI: prints squads, enemies and supplies every 10 s.
 * Usage: npx tsx scripts/diag.ts [stageId=s4] [seed=7]
 */
declare const process: { argv: string[] };
import { GW, TILE } from '../src/sim/defs';
import { STAGES } from '../src/sim/stages';
import { World } from '../src/sim/world';
import { newSave, newSquad } from '../src/meta/save';
import { battleConfig, defaultLineup } from '../src/meta/progression';

const sid = process.argv[2] ?? 's4';
const seed = Number(process.argv[3] ?? 7);
const st = STAGES.find((s) => s.id === sid);
if (!st) throw new Error('unknown stage ' + sid);
// a typical mid-progress army for the stage
const s = newSave(0);
for (let i = 1; i < st.index; i++) s.stars['s' + i] = 2;
s.upgrades = { drill: 2, logistics: 2, medicine: 1, masonry: 2, fletching: 1, smithing: 2 };
s.roster.push(newSquad(s, 'engineer'), newSquad(s, 'archer'), newSquad(s, 'spear'));
const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, seed));
w.start();
let next = 0;
while ((w.state === 'battle' || w.state === 'intermission') && w.t < 900) {
  w.step();
  if (w.t >= next) {
    next += 10;
    const sq = w.squads.map((q) => `${q.type.short}${q.alive}${q.routing ? '!' : ''}@${Math.round(q.cx / TILE)},${Math.round(q.cy / TILE)}m${Math.round(q.morale)}`).join(' ');
    const inside = w.activeEnemies.filter((e) => w.grid.inside[Math.floor(e.y / TILE) * GW + Math.floor(e.x / TILE)]).length;
    console.log(`t${Math.round(w.t)} w${w.waveIdx + 1} ${w.state} keep${Math.round(w.keepHp)} en${w.activeEnemies.length} in${inside} lad${w.ladders.length} arrows${Math.round(w.supplies.arrows)} | ${sq}`);
    for (const e of w.events.splice(0)) console.log('   ·', e.text);
  }
}
console.log(JSON.stringify({ won: w.result?.won, stars: w.result?.stars, dead: w.result?.dead, waves: w.result?.wavesCleared }));
