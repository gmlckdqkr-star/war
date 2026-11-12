import { describe, expect, it } from 'vitest';
import { STAGES } from '../src/sim/stages';
import type { BattleResult } from '../src/sim/world';
import { exportCode, importCode, loadSave, memoryKV, newSave, sanitize, writeSave } from '../src/meta/save';
import {
  UPGRADES,
  applyBattle,
  buySquad,
  buyUpgrade,
  defaultLineup,
  refillSquad,
  squadCap,
  sweepStage,
  sweepsLeft,
  treatSquad,
  upgradeCost,
} from '../src/meta/progression';
import { buyWithMedals, grantPurchase, hasFlag, paidCosmeticIds, weeklyStall, PRODUCTS } from '../src/meta/shop';
import { MAX_REGISTERED_SEASONS, PASS_TIERS, XP_PER_TIER, addPassXp, claimAll, claimReward, passRewards, premiumAvailable, seasonAt, seasonProductId, syncSeason } from '../src/meta/season';
import { MockIAP } from '../src/meta/iap';

const D = (s: string) => new Date(s + 'T12:00:00');

function result(over: Partial<BattleResult> = {}): BattleResult {
  return { won: true, stars: 3, keepPct: 1, wavesCleared: 3, totalWaves: 3, kills: 50, routed: 2, dead: 0, wounded: 0, evacuated: 0, deployed: 40, bounty: 100, time: 200, dragons: 0, squads: [], ...over };
}

describe('save', () => {
  it('round-trips and falls back to backup on corruption', () => {
    const kv = memoryKV();
    const s = newSave(1);
    s.gold = 777;
    writeSave(kv, s);
    s.gold = 888;
    writeSave(kv, s);
    expect(loadSave(kv).save.gold).toBe(888);
    kv.set('ashen.save', 'garbage{');
    const lr = loadSave(kv);
    expect(lr.source).toBe('backup');
    expect(lr.save.gold).toBe(777);
    expect(kv.get('ashen.save.corrupt')).toBe('garbage{');
  });

  it('starts fresh when nothing is readable, never throws', () => {
    const kv = memoryKV();
    kv.set('ashen.save', '###');
    kv.set('ashen.save.bak', '{"c":"x","b":"{}"}');
    const lr = loadSave(kv);
    expect(lr.source).toBe('new');
    expect(lr.save.roster.length).toBe(4);
  });

  it('sanitizes hostile or broken data', () => {
    const s = sanitize({ gold: 'lots', medals: -5, roster: [{ type: 'dragon' }, { type: 'spear', soldiers: [{ id: 1, wounded: 99 }, null] }], stars: { s1: 99 }, settings: { difficulty: 'nightmare', sound: 'yes' }, upgrades: { masonry: 1e9 } });
    expect(s.gold).toBe(150);
    expect(s.medals).toBe(0);
    expect(s.roster.length).toBe(1);
    expect(s.roster[0].soldiers[0].wounded).toBe(5);
    expect(s.stars.s1).toBe(3);
    expect(s.settings.difficulty).toBe('normal');
    expect(s.settings.sound).toBe(true);
    expect(s.upgrades.masonry).toBe(10);
    expect(sanitize(null).roster.length).toBe(4);
  });

  it('export/import works but never carries purchases', () => {
    const s = newSave(1);
    s.gold = 4321;
    grantPurchase(s, 'supporter_large', 'tx1', D('2027-01-01'));
    s.equipped.dye = 'dye_gold';
    const code = exportCode(s);
    const back = importCode(code + '\n', paidCosmeticIds())!;
    expect(back.gold).toBe(4321);
    expect(back.entitlements).toEqual([]);
    expect(back.owned).not.toContain('dye_gold');
    expect(back.equipped.dye).toBe('dye_azure');
    expect(importCode('AR1.not-base64!!')).toBeNull();
    expect(importCode('hello')).toBeNull();
  });
});

describe('progression', () => {
  it('applies a first win: gold, stars, unlocks, pass xp', () => {
    const s = newSave(1);
    const g0 = s.gold;
    const rw = applyBattle(s, STAGES[0], result(), 'campaign', D('2027-01-01'));
    expect(rw.firstClear).toBe(true);
    expect(s.stars.s1).toBe(3);
    expect(s.gold).toBeGreaterThan(g0 + STAGES[0].reward);
    expect(s.pass.xp).toBeGreaterThan(0);
    expect(s.achievements).toContain('first_win');
    // replay pays less
    const rw2 = applyBattle(s, STAGES[0], result(), 'campaign', D('2027-01-01'));
    expect(rw2.gold).toBeLessThan(rw.gold);
  });

  it('removes the dead, wounds the wounded, heals over battles', () => {
    const s = newSave(1);
    const r = s.roster[0];
    const [a, b] = r.soldiers;
    applyBattle(s, STAGES[0], result({ won: false, stars: 0, squads: [{ rosterId: r.id, dead: [a.id], wounded: [b.id], survivors: [], kills: 3 }] }), 'campaign', D('2027-01-01'));
    expect(r.soldiers.find((x) => x.id === a.id)).toBeUndefined();
    expect(r.soldiers.find((x) => x.id === b.id)!.wounded).toBe(1);
    applyBattle(s, STAGES[0], result(), 'campaign', D('2027-01-02'));
    expect(r.soldiers.find((x) => x.id === b.id)!.wounded).toBe(0);
    s.gold = 1000;
    expect(refillSquad(s, r)).toBeNull();
    expect(r.soldiers.length).toBe(12);
  });

  it('shop functions validate gold and limits', () => {
    const s = newSave(1);
    s.gold = 0;
    expect(buyUpgrade(s, 'masonry')).not.toBeNull();
    s.gold = 100000;
    for (let i = 0; i < 10; i++) buyUpgrade(s, 'barracks');
    expect(s.upgrades.barracks).toBe(UPGRADES.find((u) => u.id === 'barracks')!.max);
    expect(upgradeCost(UPGRADES[0], 1)).toBeGreaterThan(upgradeCost(UPGRADES[0], 0));
    expect(buySquad(s, 'knight')).not.toBeNull(); // locked
    expect(buySquad(s, 'spear')).toBeNull();
    expect(treatSquad(s, s.roster[0])).not.toBeNull(); // nobody wounded
    expect(squadCap(s, STAGES[0])).toBe(STAGES[0].squadCap + 2);
    expect(defaultLineup(s, STAGES[0]).length).toBeLessThanOrEqual(squadCap(s, STAGES[0]));
  });

  it('daily reward once per day, streak counts consecutive days', () => {
    const s = newSave(1);
    const st = STAGES[0];
    const a = applyBattle(s, st, result(), 'daily', D('2027-01-01'));
    const b = applyBattle(s, st, result(), 'daily', D('2027-01-01'));
    expect(a.medals).toBeGreaterThan(0);
    expect(b.medals).toBe(0);
    applyBattle(s, st, result(), 'daily', D('2027-01-02'));
    expect(s.daily.streak).toBe(2);
    applyBattle(s, st, result(), 'daily', D('2027-01-05'));
    expect(s.daily.streak).toBe(1);
  });

  it('quick sweep needs 3 stars and is limited per day', () => {
    const s = newSave(1);
    const st = STAGES[0];
    expect(typeof sweepStage(s, st, D('2027-01-01'))).toBe('string');
    s.stars.s1 = 3;
    for (let i = 0; i < 3; i++) expect(typeof sweepStage(s, st, D('2027-01-01'))).toBe('object');
    expect(sweepsLeft(s, D('2027-01-01'))).toBe(0);
    expect(typeof sweepStage(s, st, D('2027-01-01'))).toBe('string');
    expect(sweepsLeft(s, D('2027-01-02'))).toBe(3);
  });
});

describe('store & season', () => {
  it('purchases are idempotent and restorable', () => {
    const s = newSave(1);
    expect(grantPurchase(s, 'commander_kit', 'tx-1', D('2027-01-01'))).toBe(true);
    expect(grantPurchase(s, 'commander_kit', 'tx-1', D('2027-01-01'))).toBe(false);
    expect(grantPurchase(s, 'commander_kit', 'restore-commander_kit', D('2027-01-01'))).toBe(false);
    expect(s.entitlements.filter((x) => x === 'commander_kit').length).toBe(1);
    expect(hasFlag(s, 'sweep')).toBe(true);
    expect(grantPurchase(s, 'unknown_product', 'tx-2', D('2027-01-01'))).toBe(false);
  });

  it('nothing sold changes combat stats', () => {
    for (const p of PRODUCTS) {
      for (const f of p.flags ?? []) expect(['sweep', 'presets', 'speed4']).toContain(f);
    }
  });

  it('medal stall rotates weekly and validates purchases', () => {
    const now = D('2027-03-03');
    const stall = weeklyStall(now);
    expect(stall.length).toBe(5);
    expect(weeklyStall(D('2027-03-04')).map((c) => c.id)).toEqual(stall.map((c) => c.id));
    const s = newSave(1);
    expect(buyWithMedals(s, stall[0].id, now)).not.toBeNull();
    s.medals = 10000;
    expect(buyWithMedals(s, stall[0].id, now)).toBeNull();
    expect(buyWithMedals(s, stall[0].id, now)).not.toBeNull();
  });

  it('seasons rotate from local date without a server', () => {
    expect(seasonAt(new Date(Date.UTC(2026, 11, 1)))).toBe(1);
    expect(seasonAt(new Date(Date.UTC(2027, 0, 11, 12)))).toBe(1);
    expect(seasonAt(new Date(Date.UTC(2027, 0, 12, 12)))).toBe(2);
    expect(seasonAt(new Date(Date.UTC(2020, 0, 1)))).toBe(1);
    expect(seasonProductId(3)).toBe('chronicle_s03');
    expect(premiumAvailable(MAX_REGISTERED_SEASONS)).toBe(true);
    expect(premiumAvailable(MAX_REGISTERED_SEASONS + 1)).toBe(false);
    const r = passRewards(4);
    expect(r.free.length).toBe(PASS_TIERS);
    expect(r.prem.length).toBe(PASS_TIERS);
  });

  it('season pass claims, premium gating and rollover; clock rollback does not reset', () => {
    const s = newSave(1);
    const t1 = new Date(Date.UTC(2027, 0, 1));
    addPassXp(s, XP_PER_TIER * 3 + 10, t1);
    expect(claimReward(s, 1, 'free')).toBeNull();
    expect(claimReward(s, 1, 'free')).not.toBeNull();
    expect(claimReward(s, 5, 'free')).not.toBeNull();
    expect(claimReward(s, 1, 'prem')).not.toBeNull();
    grantPurchase(s, seasonProductId(s.pass.season), 'tx', t1);
    expect(claimAll(s)).toBe(2 + 3);
    const season = s.pass.season;
    syncSeason(s, new Date(Date.UTC(2026, 0, 1))); // clock moved back
    expect(s.pass.season).toBe(season);
    expect(s.pass.claimedFree.length).toBe(3);
    syncSeason(s, new Date(Date.UTC(2027, 6, 1))); // next season
    expect(s.pass.season).toBeGreaterThan(season);
    expect(s.pass.xp).toBe(0);
  });

  it('mock IAP grants through the callback and supports cancel', async () => {
    const iap = new MockIAP();
    const owned: string[] = [];
    await iap.init((p) => owned.push(p));
    iap.confirm = async () => false;
    expect((await iap.purchase('supporter_small')).ok).toBe(false);
    iap.confirm = async () => true;
    expect((await iap.purchase('supporter_small')).ok).toBe(true);
    expect(owned).toEqual(['supporter_small']);
    expect(await iap.restore()).toEqual(['supporter_small']);
  });
});
