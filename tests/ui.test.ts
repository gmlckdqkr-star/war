import { describe, expect, it } from 'vitest';
import { STAGES } from '../src/sim/stages';
import { newSave } from '../src/meta/save';
import { SUPPLY_PRICE, defaultLineup, squadCap } from '../src/meta/progression';
import { fixParticles } from '../src/ui/battle';
import { fitPlan, planCost, readyLineup, setWantedSize, wantedSize } from '../src/ui/prebattle';

describe('event text particles', () => {
  it('replaces "이(가)" style placeholders by the final consonant of the word before them', () => {
    expect(fixParticles('징집병 무리이(가) 무너져 달아납니다!')).toBe('징집병 무리가 무너져 달아납니다!');
    expect(fixParticles('드워프 방패병이(가) 버팁니다')).toBe('드워프 방패병이 버팁니다');
    expect(fixParticles('장궁대을(를) 보냈습니다')).toBe('장궁대를 보냈습니다');
    expect(fixParticles('성문은(는) 무사합니다')).toBe('성문은 무사합니다');
    expect(fixParticles('본성(으)로 후퇴')).toBe('본성으로 후퇴');
    expect(fixParticles('성벽(으)로 후퇴')).toBe('성벽으로 후퇴');
    expect(fixParticles('보급소(으)로 이동')).toBe('보급소로 이동');
    expect(fixParticles('궁수대와(과) 창병대')).toBe('궁수대와 창병대');
    expect(fixParticles('성문와(과) 성벽')).toBe('성문과 성벽');
    // a roman squad number is read as a Korean number: 궁수대 I → 일 → "이"
    expect(fixParticles('궁수대 I이(가) 도주합니다')).toBe('궁수대 I이 도주합니다');
    expect(fixParticles('궁수대 II이(가) 도주합니다')).toBe('궁수대 II가 도주합니다');
  });
  it('leaves texts without placeholders alone', () => {
    expect(fixParticles('물결을 막아냈습니다! (3/4)')).toBe('물결을 막아냈습니다! (3/4)');
    expect(fixParticles('전장에서 화살 85개를 회수했습니다.')).toBe('전장에서 화살 85개를 회수했습니다.');
  });
});

describe('supply plan that the gold no longer covers', () => {
  it('drops packs until it fits, spreading the cut over the kinds', () => {
    const extra = { arrows: SUPPLY_PRICE.arrows.per * 2, food: SUPPLY_PRICE.food.per * 3 };
    const full = planCost(extra);
    expect(fitPlan(extra, full)).toEqual({ extra, dropped: 0 });
    const r = fitPlan(extra, full - 1);
    expect(planCost(r.extra)).toBeLessThanOrEqual(full - 1);
    expect(r.dropped).toBe(1);
    expect(r.extra.food).toBe(SUPPLY_PRICE.food.per * 2); // the kind with the most packs went first
    const none = fitPlan(extra, 0);
    expect(planCost(none.extra)).toBe(0);
    expect(none.dropped).toBe(5);
    expect(extra.food).toBe(SUPPLY_PRICE.food.per * 3); // input untouched
  });
});

describe('retry lineup', () => {
  it('keeps a deliberately smaller lineup at its size instead of filling every slot', () => {
    const s = newSave();
    const st = STAGES[1];
    const def = defaultLineup(s, st);
    expect(def.length).toBeGreaterThan(2);
    const small = def.slice(0, 2);
    expect(readyLineup(s, st, small).length).toBe(Math.min(squadCap(s, st), s.roster.length));
    expect(readyLineup(s, st, small, small.length)).toEqual(small);
  });
  it('swaps a wiped-out squad for a ready one but keeps the count', () => {
    const s = newSave();
    const st = STAGES[1];
    const def = defaultLineup(s, st);
    const ids = def.slice(0, 2);
    const gone = s.roster.find((r) => r.id === ids[0])!;
    gone.soldiers = [];
    const out = readyLineup(s, st, ids, ids.length);
    expect(out.length).toBe(2);
    expect(out).not.toContain(ids[0]);
    expect(out).toContain(ids[1]);
  });
  it('remembers the wanted size per pre-battle session', () => {
    const pre = {};
    expect(wantedSize(pre, 4)).toBe(4);
    setWantedSize(pre, 2);
    expect(wantedSize(pre, 4)).toBe(2);
  });
});
