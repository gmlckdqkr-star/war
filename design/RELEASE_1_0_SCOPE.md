# Release 1.0 content scope — 잿빛 성벽: 최후의 수비

Role: game director, read-only. Base: `claude/project-thread-jkwbzh @ 5f5eaad`. Nothing here is committed.
Sources read: `docs/PLAYTEST_REPORT.md`, `docs/RELEASE_CHECKLIST.md`, `docs/GAME_DESIGN.md`, `docs/MONETIZATION.md`,
`design/DESIGN_BIBLE.md` §0–7, §9, §12–13, `design/ROADMAP.md` P3/P4/P5, `src/sim/{stages,world,warcouncil,defs}.ts`,
`src/ui/{audio,resume,battle}.ts`, `src/meta/save.ts`, and the file list of `design/realistic` on `wp-real-proto` (not modified).
Measured here: one balance-bot campaign (seed 1, normal, auto) takes 28 s of wall time on this host.

> **프로젝트 조정 (2026-11-13)**
> - 그림은 실사 3D로 바뀌었다. 그래서 이 문서의 2D 그림 항목(R1)은 '2D 예비 화면 + 3D 렌더러 계약'으로 읽는다.
> - 오너는 직접 문장을 고치지 않는다. 그래서 '서명'은 독립된 한국어 문장 편집 에이전트가 검토해서 한다(`signer: 'editor'`). 오너는 나중에 어떤 줄이든 거부할 수 있다.
> - F1(불 회피, 회의 기본 선택)은 wp-gameplay에서 이미 끝났다(91641c3).

## 요약 (오너용)

- 지금 게임은 **전투 시뮬은 탄탄하지만 이야기와 전투 종류는 거의 비어 있다.** 성마다 이야기는 브리핑 한 문장(`StageDef.story`)뿐이고, 10개 성 중 9개가 "동쪽 직사각형 성 + 서문" 배치다. 전투 유형은 사실상 하나(물결 막기)이고, 공성 장치(갱도, 사다리, 투석기, 용)가 각 성의 색을 대신하고 있다.
- 1.0에서는 바이블 전부가 아니라 **"성마다 다른 압박 한 가지 + 그 압박에 맞는 이야기"**를 만든다. 전투 유형 7가지(갱도전, 갈대·숲 은폐와 불, 출격, 다리 끊기, 용의 밤(축소판), 내성 후퇴(축소판)와 생존자 민병, 새벽까지)를 넣고, 어둠 속 싸움은 2주 차 여유가 있을 때만 한다.
- 이야기는 **사관 여울의 한 줄과 분대 외침(트리거 약 20종), 성별 브리핑·결과 세 갈래, 적장의 편지와 '기억하는 적', 선택 4개(갈대 불·다리·빚·한뫼), 노병 이름과 별호**까지 넣는다. 한국어 약 400줄. 에이전트는 초안만 쓰고(`draft: true`), 오너가 고치고 서명한 줄만 출시된다(약 8시간 분량).
- 소리는 파일 없이 합성으로: 세력별 접근음, 성문 압박과 사기로 바뀌는 음악, 성별 환경음.
- **빼는 것**: 사관 교체와 손글씨 글꼴, 전투 판화, 휴전의 밤, 서고 화재, 피난 엄호와 '잃은 장', 무한 모드 성 이동, 새 적 병종 3종, 새 타일 4종(하나만 추가), 영웅 영구 사망, 900줄 → 400줄. 이유는 §6.
- 플레이테스트의 숙제 셋을 첫 주에 함께 푼다: **수동 플레이 격차(30전 vs 14전), 9성 정체(불 회피 없음), 4성(갱도에 대응 수단 없음).**

---

## 1. Diff: what exists today vs bible §4–7 and ROADMAP P3/P4

Legend: **have** = in code and tested, **partial** = a mechanical version exists without the bible's framing or verb, **none**.

### 1.1 Battle types (bible §7.2, P3)

| Bible type | Today | Evidence |
|---|---|---|
| 1 새벽까지 (dawn rule) | partial | `BATTLE_HARD_CAP` 900 s + `liftSiege()` with a state verdict (`CAP_HOLD_N`, `CAP_KEEP_MIN`). No `dawnAfter`, no 'dawn' event, no sun clock |
| 2 사다리의 밤 (escalade) | partial | ladders planted/climbed (`ACT.SET`, `ST.CLIMB`); defenders hack ladders down (`removeLadder(best, true)` at world.ts:1805), oil removes them. No shove rule, no star, s2 has no reeds |
| 3 다리 끊기 | none | s3 river (`WATER`, x 28–30) is wadeable everywhere at speed 0.35, so a cut would change little; the N/S lanes are east of the river |
| 4 갱도전 | partial | sappers dig (`ACT.DIG`, `SAPPER_DIG_T` 12 s, `mineProg`, mantlet cover 0.6). **No rumble signal, no countermine** → playtest: manual s4 first-try 0/6 |
| 5 어둠 속 싸움 | none | no vis grid, no lanterns, no night |
| 6 출격 | partial | knights can be ordered outside; `gateShut` bars a gate when an enemy is within 3 tiles and then blocks allies too. No hold-open input, no objective, no star |
| 7 피난 엄호 | none | no civilian units; a loss is a retry, not a lost chapter |
| 8 내성 후퇴 | partial | s4, s8, s10 already have inner rings (`wallRect(..., floor:false)`); preset `fallback` pulls squads to the keep ring. No inner-gate closing, no trapped units |
| 9 용의 밤 | partial | dragon with damage-based retreat (`DRAGON_FLEE_HP`, `DRAGON_PAIN_*`, 240 s reserve rule). No breath telegraph, no defender fire avoidance (the s9 manual stall), no ballista aim, no library |
| 10 휴전의 밤 | none | |
| §7.4 allied AI bands | none | `side` is 0/1 only |
| §5.4 enemy adaptation | none | no per-source kill tally, no counter bands |
| §5.5 night decisions | partial | war council: 8 options, 3 offered per intermission (`warcouncil.ts`). **An untaken offer lapses unless the auto commander is on** (`closeCouncil`) — part of the manual gap |
| P3-12 daily/endless rotation | partial | daily = date seed → castle × 6 modifiers; endless = one castle per run from 8, 60 generated waves. No mode variants, no segments, no night |

### 1.2 Maps (bible §6)

| Castle | Layout today | Bible §6.5 change |
|---|---|---|
| s1 | palisade x=38, stream x 18–19 | none (first contact pull is optional; the 3× auto-speed already fixed the 20 s wait) |
| s2 | `wallRect(36,8,56,26)` W+N gates | hill fort along the slope + reed band |
| s3 | rect fort, wadeable river, one bridge | deep river, southern ford, bridge meets the west gate |
| s4 | two straight wall lines (x 30, x 42), canyon cliffs | none |
| s5 | rect fort, two west gates, rough patches | living forest east / stumps west |
| s6 | rect fort, 3 gates, cliff east | none |
| s7 | rect fort ringed by moat, water patches | one 2-tile causeway, the rest marsh |
| s8 | rect fort + inner ring | none (forge cut) |
| s9 | rect fort, 3 gates | jagged crown wall line (+ library, cut) |
| s10 | two rings, 3 gates each | east cliff; allied bands |

Result: 7 of 10 castles read as the same "east rectangle with a west gate". The 3D renderer builds walls from the grid (`castle.ts` reads `Tile.WALL/TOWER/GATE`), so a grid change is a free silhouette change there.

### 1.3 Story (bible §4–5, P4)

| Bible feature | Today |
|---|---|
| Chapter structure (7 books, 10 chapters, first record vs replay) | none; campaign is a stage list with stars |
| Story text | one `story` sentence + `subtitle` per stage (plus tips and daily-modifier text in `stages.ts`), shown once on the pre-battle screen (`app.ts:636`) |
| Event log / 34 triggers | none, but `world.event(type, text)` already emits 26 typed events (`wave`, `cleared`, `breach`, `rout`, `rallied`, `leader`, `dragon*`, `keep`, `starving`, `siegeend`, …) as functional alerts in 합니다체. A UI-side story engine can be driven by these plus ~12 new emit points without reading the sim back |
| Letters, enemy memory | none |
| Choices (6 branches) | none |
| Veterans, names, epithets | none; soldiers are `{id, xp, wounded}`, squads are "창병대 II" |
| Outcome three ways | none; stars only |
| Narrator change, battle print | none |
| Save memory (`SaveData.chronicle`) | none; `SAVE_VERSION = 2`, `sanitize()` whitelists fields, so any new block needs sanitize code |
| Naming collision | the season pass is already called "전쟁 연대기 / 프리미엄 연대기" in the UI, store copy and product ids (`chronicle_sNN`) |

### 1.4 Audio (bible §9, P5)

`src/ui/audio.ts`: ~25 procedural cues (clash, arrow, bolt, thud, collapse, boom, treb, fire, roar, horn, volley, hammer, wood, UI clicks, victory/defeat, coin), stereo pan by x, rate gating. Music is one static drone + a drum every 2.4 s, not driven by the battle. No faction grammar, no ambience, no music states.

---

## 2. Principles for the 1.0 scope

1. **Every new verb earns stars, story or speed — never the win.** An idle player (auto squads, no verbs) must still be able to win every castle on normal. This is what keeps the manual gap from widening when we add verbs. Each item's bot acceptance includes an idle-bot floor.
2. **Squad-level automation before commander-level automation.** Where a verb has an obvious default (countermine, knight sortie against a lone trebuchet, stepping out of fire), the auto squads do it, so a manual player gets it too. The auto commander only gets verbs that are real decisions (bridge cut timing, inner retreat).
3. **Reuse tiles and kinds.** One new tile (`DEEP`). Reeds and forest are stage-scoped rules on `ROUGH`; counter-bands are band-level modifiers on existing kinds. Both renderers must draw every tile, and the 3D one is built elsewhere.
4. **Additive sim API only.** The 3D prototype reads `w.units`, `w.ladders`, `w.fx`, `w.fire`, `w.projectiles`, grid tiles and unit fields (`x,y,px,py,fx,fy,state,act,actTile,elev,fleeing,side,def,target,timer,hitFlash,cd,id`). No renames or removals; new fields and fx kinds are listed in `docs/RENDER_CONTRACT.md` with a fallback ("draw `DEEP` as `WATER`", "ignore unknown fx").
5. **Human-signed text only ships.** Agents draft every line with `draft: true`; `scripts/check-draft.mjs` fails the release build while any remains.
6. **Owner constraints**: no server, no new store products, no audio or image files, all content free, no paid UI on the briefing → battle → results path, save size and save-code length capped.

---

## 3. The 1.0 scope, ranked by player value per cost

Effort is agent-days (one agent in one worktree). Tier A = week 1, Tier B = week 2, Tier C = only if A and B are green by day 8.

| Rank | ID | Item | Tier | Effort | Why it ranks here |
|---|---|---|---|---|---|
| — | F0 | Seams: per-stage goldens, stages split, mode hooks, `w.input`, story event ring, UI hook registry, stage bot, render contract | A, serial | 2.0 | everything below depends on it |
| — | F2 | Save schema v3 (`chronicle` block) | A, serial | 0.5 | C6, C8, C14 share it |
| 1 | F1 | Playtest blockers: defender hazard avoidance, council default pick | A, serial | 1.0 | fixes the s9 stall and part of the manual gap for every player |
| 2 | C1 | 갱도전: rumble + countermine (s4) and the debt choice | A | 2.0 | fixes s4 (manual first try 0%), adds a verb and a choice |
| 3 | C2 | Story engine + ~20 triggers + briefings + outcomes | A | 3.0 + drafting 2.0 | the largest single answer to "a story that fits each situation" |
| 4 | C5 | Night council as story slips (3 categories, 3 new options) | A | 1.0 | cheap reframe of an existing system; the between-wave beat |
| 5 | C3 | 갈대·숲 은폐와 불 (s2, s5) + escalade star + s2 hill-fort layout | A | 2.5 | two castles gain identity from one system |
| 6 | C12 | 새벽까지: dawn rule + sun clock | A | 0.5 | gives every battle a visible end and the dawn line |
| 7 | C14 | Chapter structure, campaign memory, choices plumbing, app screens | A→B | 3.0 | turns stages into chapters; carries the 4 choices |
| 8 | C4 | 출격 (s8 objective, s6 optional) + gate hold-open API | B | 3.0 | a new kind of play (leaving the walls); unlocks C10 |
| 9 | C7 | 다리 끊기 (s3) + deep river + ford layout | B | 2.5 | the most legible "decision with a cost" in the campaign |
| 10 | C6 | 기억하는 적 + 적장의 편지 | B | 2.5 | the signature "enemy quotes my record"; uses existing kinds |
| 11 | A1 | Audio: faction cues, music driven by pressure and morale, castle ambience | B | 3.0 | big immersion per cost, zero sim risk |
| 12 | C8 | Veterans, names, squad names, epithets, obituaries | B | 2.5 | the "nothing mass-produced" proof: real names, real deeds |
| 13 | R1 | 2D render additions + generic mode-verb buttons | A→B | 2.0 | without it no item is playable in the shipping renderer |
| 14 | C11 | 용의 밤 (lite): breath telegraph, ballista aim, crown layout (s9) | C | 2.5 | finishes the s9 fix and gives s9 a silhouette |
| 15 | C10 | 내성 후퇴 (lite) + 생존자 민병 (s10) | C | 2.5 | the finale's "your record becomes an army" |
| 16 | C13 | Daily mode variants, endless night pages, rumours | C | 1.0 | reuses C1/C3/C4/C7 in the repeatable modes |
| 17 | C9 | 어둠 속 싸움 (s7 night, causeway) | C | 4.0 + render | high value, but needs night rendering in both renderers |
| — | I | Integrator / seam keeper / balance owner | standing | 0.5/day | merges, sweeps, final tuning |

Tier A ≈ 17 agent-days, Tier B ≈ 16, Tier C ≈ 10. With 3–4 agents in parallel and the serial seams, A+B fit in two weeks; C is stretch.

### Castle → main pressure in 1.0 (bible T1 asks ≥ 6 distinct pressures)

| s1 | s2 | s3 | s4 | s5 | s6 | s7 | s8 | s9 | s10 |
|---|---|---|---|---|---|---|---|---|---|
| 새벽까지 (intro) | 사다리 + 갈대 은폐/불 | 다리 끊기 | 갱도전 + 빚 | 숲 은폐/불 + 한뫼 | 세 성문 + 출격(선택) | 늪 둑길 (C9 if done) | 출격 | 용의 밤(lite) | 내성 후퇴(lite) + 민병 |

Eight distinct pressures without C9.

---

## 4. Work packages

Common definition of done for every package: `npm run build && npm test` green; `E2E_PORT=<not 4190> npm run e2e` green; the package's tests pass; goldens of stages it does not own are byte-identical; architecture test passes; WIP commits about every 20 minutes on its own worktree branch (never on `claude/project-thread-jkwbzh`), messages ending with the two attribution lines; nothing pushed.

**Global balance gates** (run by I after every merge into the integration branch, not per commit; 20 seeds each, max 2 bot processes at once via `scripts/sweep.ts`, ≈ 30 min):
- G1 normal·auto: every seed completes; mean 13–20 battles; no battle reaches 900 s.
- G2 normal·manual (= idle: auto squads, no abilities, no verbs; council default applies after F1): every seed completes within 40 battles; **mean ≤ 24** (baseline 30.0, n=6); manual/auto ratio ≤ 1.7 (baseline 2.1); no stage mean tries > 3.5.
- G3 hard·auto: every seed completes; max tries per stage ≤ 8.
- G4 easy·auto: every seed 10 battles.
- G5 per-stage first-try curve (normal·auto): no stage more than 25 points below both neighbours (with n=20 this is a real signal, not the ±20-point noise of n=6).

### F0 · Seams — serial, 2.0 d
- **Owns**: `src/sim/world.ts` (hook points and emit lines only), `src/sim/stages.ts` (becomes a re-export shim), `src/sim/stages/{types,index,s1…s10,daily,endless,inputs}.ts` (split, behaviour-identical; `inputs.ts` is a stub owned later by C14), `src/sim/modes/{types,index}.ts`, `src/sim/input.ts`, `src/sim/chron.ts`, `src/sim/defs.ts` (adds `Tile.DEEP` with `epass:false, dpass:false`, unused until C7), `src/ui/resume.ts` (adds `'input'` to `COMMAND_METHODS`; records `cfg.inputs`), `src/ui/battle/hooks.ts` + ≤ 25 lines in `src/ui/battle.ts`, `scripts/stagebot.ts`, `scripts/sweep.ts`, `tests/golden/*.json`, `tests/det.test.ts`, `tests/arch.test.ts`, `docs/RENDER_CONTRACT.md`.
- **Delivers**:
  - Goldens first, before any refactor: 10 stages × 6 seeds, `stateHash` at steps 300/1,800/5,400 with a fixed mid-campaign army (the 3D prototype's `createWorld` recipe).
  - `StageDef.rules?` (per-stage rule bag) and `StageDef.modes?: string[]`; `ModeHooks { init, step, onEvent, outcome, inputs, verbs }`; composition of several modes per stage.
  - `w.input(kind, payload)` validated by the owning mode's registry; `BattleConfig.inputs?: StageInputs` (campaign choices, counter-band, allies) applied by `stages/inputs.ts` before `new World`, stored in the resume record.
  - `w.chron`: write-only ring (4,096) of story kinds `{t,k,a,b,x,y,sq,sid}` and `w.stats.killsBy {oil,archers,ballista,knights,melee}`. Emit points: ladder set/felled, first ram hit, gate HP quarter steps, enemy on wall ≥ 3 s, oil kills (2 s window), engine burning/down, tower docked, squad first death/half/last stand/wiped, soldier death with roster soldier id, evacuation, arrows below 20%/5%.
  - UI hook registry: `onFrame(w, realDt)`, `onEvent(e)`, `onEnd(result)`, `suppressAlert(type)`.
  - `scripts/stagebot.ts <stage> <seeds> <idle|default|aware> [inputs.json]`: one battle per seed with a fixed army per stage tier, JSON line per battle (win, stars, time, killsBy, mode stats).
  - `scripts/sweep.ts`: runs the G1–G5 sweep with a lockfile so no more than 2 bot processes run on the host; writes `artifacts/sweep/<label>.json`.
  - Baseline sweep recorded as `artifacts/sweep/baseline.json` (20 seeds; replaces the n=6 table).
- **Tests**: goldens identical after the split and after hooks; with an empty mode registry every hash is identical; arch test (no `src/sim` import of `ui|render|story|audio`, no read of `w.chron` inside `src/sim`); a recorded `w.input` replays to the same `stateHash` through `resume.ts`; `cfg.inputs` round-trips through the resume record.
- **Bot acceptance**: baseline recorded; G1–G4 numbers equal the pre-split numbers exactly (pure refactor).
- **Conflicts**: owns every hot sim file; nothing else touching `world.ts`, `stages*`, `resume.ts` or `battle.ts` may start before it merges. Run it in an announced quiet window.

### F2 · Save schema v3 — serial, 0.5 d (after F0)
- **Owns**: `src/meta/save.ts`, `tests/save-v3.test.ts`.
- **Delivers**: `SAVE_VERSION = 3`; `chronicle: { castles: Record<id,{state:'unwritten'|'kept'|'costly'|'lost'|'retaken', fallen:number}>, choices: {reeds?,bridge?,debt?,hanmoe?}, heroes:{hanmoe:'alive'|'given'}, veterans ≤ 160 {sid,name,squad,deeds[],battles,fell?}, epithets: Record<rosterId,string[]>, lastTactic, seen: string[] ≤ 400, log ≤ 120 }`; `Soldier.name?: number`; `RosterSquad.nameId?: number`; sanitize for every field; v2 → v3 migration.
- **Tests**: migration on 6 fixture saves (incl. the corrupt/backup fixtures); round trip; junk rejection; a full simulated campaign keeps JSON ≤ 48 KB and **the clipboard save code grows by ≤ 600 characters** (support: the code must still fit one message).
- **Conflicts**: no other package edits `save.ts`; C6/C8/C14 use `src/story/memory.ts` (C14).

### F1 · Playtest blockers — serial after F0, 1.0 d
- **Owns**: `src/sim/systems/hazard.ts` (new), the hazard hook line in `world.ts` `updateDefender`, `src/sim/warcouncil.ts` `closeCouncil` only (handed to C5 afterwards), `tests/hazard.test.ts`.
- **Delivers**: (a) a defender whose tile is burning, or who stands in a telegraphed breath cone (C11 adds the telegraph; F1 reads `w.hazard[]`), moves to the nearest non-burning deployable tile of the same post for the burn's duration, then returns; (b) an untaken council offer is decided by the advisor rule at wave start **whether or not the auto commander is on** (the advisor already exists).
- **Tests**: a unit on a burning tile leaves within 1.5 s and returns after the fire; no oscillation (≤ 2 moves per fire); council default applied with `autoCommand=false`; determinism.
- **Bot acceptance**: s9 manual (stage bot, 20 seeds) first-try ≥ 45% and campaign s9 manual mean tries ≤ 2.5, max ≤ 6 (baseline 5.0 / 16); defender fire-seconds in s9 −50%; G1 still 13–20; G2 mean ≤ 27 after this package alone.
- **Conflicts**: changes balance everywhere (fire also comes from enemy fire arrows and the dragon). Must merge before any castle owner tunes levels.

### C1 · 갱도전: rumble, countermine, debt (s4) — Tier A, 2.0 d
- **Owns**: `src/sim/systems/sappers.ts` (extracted sapper logic), `src/sim/systems/engineers.ts` (extracted `engineerAI`), `src/sim/modes/mines.ts`, `src/sim/stages/s4.ts`, `tests/modes/mines.test.ts`, `tests/golden/det-s4.json`.
- **Rules**: every digging sapper emits `rumble` fx + chron every 4 s at its target wall tile; an engineer within 2 tiles of a rumble tile for 6 s (cumulative) collapses the tunnel (the sapper dies, `mineProg` resets); auto engineers take rumble tiles after fires and before repairs (so manual players get it); verb `countermine(tile)` sends a chosen engineer squad. Debt choice (StageInputs `debt`): `accept` → the clan withdraws after wave 3 (waves 4–5 removed, gold reward ×0.7, 3★ still possible); `refuse` → all 5 waves, `chronicle.choices.debt='refuse'` (Urda's shield wall becomes an ally in C10).
- **Tests**: rumble cadence 4 s ± 1 step; collapse after 6 s; interruption keeps progress; auto engineer priority order; debt accept ends with a win after wave 3; determinism and resume with a countermine input.
- **Bot acceptance**: s4 stage bot idle first-try **≥ 40%** (manual baseline 0%), default ≥ 75%; mines completed per s4 battle (default) −30% or more; campaign s4 manual mean tries ≤ 2.0 (baseline 4.0); debt-accept idle win ≥ 80%; G1–G5.
- **Render needs**: `rumble` fx (2D: ring + ripple at tile; 3D contract: dust puff at wall foot).
- **Conflicts**: owns engineer AI, so C7's bridge charge must not use engineers (it is a fuse, see C7). s8 and s10 also have sappers: their balance shifts → re-check by I.

### C2 · Story engine, triggers, briefings, outcomes — Tier A, 3.0 d engine + 2.0 d drafting
- **Owns**: `src/story/{types,engine,triggers,korean,replay,outcome}.ts`, `src/story/lines/{common,s1…s10}.ts`, `src/story/places/{s1…s10}.ts`, `src/ui/battle/story.ts` (hook), `src/ui/hud/chronline.ts`, `src/ui/story.css`, `scripts/lint-ko.ts`, `scripts/check-draft.mjs` (release build gate), `tests/story/*.test.ts`.
- **Delivers**: the UI-side engine (never imports into sim, never uses sim RNG; story RNG seeded from battle seed + line id). ~20 triggers: wave_start, wave_cleared, ram_first_hit, gate_damaged, gate_break, gate_hold, wall_breach, ladder_felled, on_wall, oil_used, engine_down, sq_first_blood, sq_half, sq_rout, sq_rally, sq_last_stand, sq_wiped, leader_slain, dragon_arrive, dragon_leave, keep_hit, arrows_low, food_out, dawn, battle_end. One bark at a time (3.2 s) and one chronicler line (6 s) in **real time** at every speed; priority queue (gate/hero > ladder/oil > squad state > supply); same line once per battle; same trigger ≥ 6 s apart; a 20 s idle summary line; resume fast-forward is silent and rebuilds state; the functional alert toast for an event the engine just voiced is suppressed (edge markers stay). Outcome classifier (bible §5.6: clean / costly / loss). Briefing panel: Yeoul's journal 2 lines + Garam's margin note 1 line. Results: the outcome paragraph. Counter helpers `{n:명}`, `{n:째}`, `{n:수}` with native numerals ≤ 99 and `josa()`.
- **Tests**: synthetic chron/event streams → expected lines; no repeat; cooldowns; display 3.2 s ± 1 frame at 1×/3×/4× on a fake clock; replay of a 600 s battle emits 0 lines and rebuilds a state equal to the stored one; every line × every counter 0–120 × josa passes; `lint-ko` bans 'A가 아니라 B', "~하는 것이다", double passives, 3+ repeats of a frame per screen; `check-draft` fails a release build with any `draft:true`; running the hook does not change `stateHash` over 600 steps on 8 battles.
- **Bot acceptance (story bot)**: stage bot with a headless engine, 20 seeds × 10 castles: median distinct lines per battle ≥ 8; ≥ 1 castle-specific line in ≥ 90% of battles; 0 repeats; ≤ 6 lines per minute of battle; every trigger fires somewhere in the sweep.
- **Lines**: ≈ 210 of the 400 (§5).
- **Conflicts**: needs F0's emitters; `battle.ts` only through the hook; zone names in `places/` are used by C8 obituaries.

### C5 · Night council as story slips — Tier A, 1.0 d (after F1)
- **Owns**: `src/sim/warcouncil.ts`, `src/ui/council.ts` (the modal moved out of `battle.ts` through the hook), `src/story/lines/council.ts`, tests.
- **Delivers**: options grouped as 사람 / 성 / 적, one from each when possible; existing 8 kept with their exact effects; new: `refugees` (repair and carry speed +15%, food −10), `palisade` (each rubble tile of the worst breach gets a wooden barrier at 40% wall HP), `prisoners` (next wave enemy morale −10). Each slip shows its exact effect and one signed flavour line; the pick is echoed by a chronicler line next wave.
- **Tests**: each option's numeric effect; offer determinism per seed and wave; default pick; resume.
- **Bot acceptance**: counterfactual run on s6 (20 seeds × each option forced): every option is the best choice in ≥ 10% of seeds (no dead options) and none in > 50%; G1–G2.
- **Conflicts**: balance-wide; merges before castle tuning.

### C3 · 갈대·숲 은폐와 불 (s2, s5) + escalade star — Tier A, 2.5 d
- **Owns**: `src/sim/systems/cover.ts`, `src/sim/modes/{escalade,conceal}.ts`, `src/sim/stages/{s2,s5}.ts`, `tests/modes/conceal.test.ts`, goldens s2/s5.
- **Rules**: stage rule `conceal: { tile: ROUGH, who: 'ladder' (s2) | 'kite' (s5), range: 2 }` — such enemies on `ROUGH` cannot be targeted from more than 2 tiles. Burn input (one-shot): s2 as a council slip before wave 3, s5 as an in-battle verb; ignites the band's `ROUGH` tiles on a fixed west→east schedule (wind from the stage rule, no RNG), burnt tiles become `GRASS` with `w.scorched[i]=1`; records `choices.reeds` / a `forest_burned` mark. s2 layout: the fort's west wall follows the hill as a 3-segment polyline, north gate kept, dense reed band x 4–28. s5: stumps west (sparse), living forest edge x 20–31 as `ROUGH`. Escalade star: ladders felled ≥ 6 (s2).
- **Tests**: targeting refused at 3 tiles, allowed at 2; burn order deterministic and follows the wind; burnt tiles do not conceal; every lane reachable after the layout change; 20-seed check that `patches()` never covers a wall/gate/depot.
- **Bot acceptance**: s2 burn vs no-burn changes ladder crews reaching the wall by ≥ 20%; neither choice is better in > 70% of seeds; s2 and s5 idle first-try ≥ baseline − 10 points; s5 manual mean tries ≤ 2.5.
- **Render needs**: `ROUGH` drawn as reeds in s2 and forest in s5 (render reads stage id), `w.scorched` (fallback: draw as `GRASS`).
- **Conflicts**: s5 also receives the Hanmoe choice through `stages/inputs.ts` (C14) — C3 exposes `s5Variant(st, hanmoe)`; C14 only calls it.

### C12 · 새벽까지 — Tier A, 0.5 d
- **Owns**: `src/sim/modes/dawn.ts`, `src/ui/hud/sunclock.ts`, test.
- **Rules**: `rules.dawnAfter` (s after the last wave starts); when it passes, the existing `liftSiege()` path runs early and a `dawn` event fires. Values set above each castle's p95 battle length so dawn is a story beat and a safety net, not a lever. HUD: a small sun mark moving toward dawn.
- **Tests**: dawn fires at the exact step; verdict equals the hard-cap verdict.
- **Bot acceptance**: win rates per castle unchanged ± 5 points; no battle longer than `dawnAfter + 60 s`.

### C14 · Chapter structure, campaign memory, choice plumbing — Tier A→B, 3.0 d
- **Owns**: `src/story/{campaign,memory}.ts`, `src/sim/stages/inputs.ts`, `src/ui/app.ts` (campaign, briefing, results screens; mounts components from C6/C8), `src/ui/story/briefing.ts`, tests.
- **Delivers**: 7 books / 10 chapters with human titles; **first record vs replay** (bible §4.4): choices appear only in a chapter's first record; replays (retries after a win, daily, endless, sweep) add a margin note and a "다시 읽음" stamp and change no memory except `log`; castle states `kept / costly / lost → retaken` (a lost first record stays retry-based; the later win is "다시 쓴 장"). Choice UI: s4 debt and s5 Hanmoe as briefing slips, s2 reeds as a council slip (C3), s3 bridge in battle (C7). Hanmoe: `given` → s5 elf waves halved, the first spear squad (named 회색매 창병대) −10 base morale for the rest of the campaign and Dodam-free (no extra lines; Hanmoe's barks go to the squad); `kept` → elf morale +20. The story log page is called **사관의 일지** (the pass keeps the name 연대기; renaming store copy creates support work).
- **Tests**: every branch path reachable; `inputs.ts` transform deterministic and stored in the resume record (a resumed debt-accepted battle hashes identically); a replay changes no `chronicle` field except `log`; DOM test: no shop/pass/medal-shop selector inside briefing, letter, council or results components.
- **Bot acceptance**: campaign bot with a random branch per seed (20 seeds): all complete; no branch raises mean campaign battles by > 3; G2 holds with branches on.
- **Conflicts**: the only owner of `app.ts` in this scope; C6 and C8 deliver components, not app edits.

### C4 · 출격 (s8, s6 optional) + gate API — Tier B, 3.0 d
- **Owns**: `src/sim/systems/gates.ts` (hold-open/close API on top of today's `gateShut`), `src/sim/modes/sortie.ts`, `src/sim/stages/{s6,s8}.ts`, the knight-squad sortie rule in `src/sim/systems/squadai.ts` (new, extracted), tests, goldens s6/s8.
- **Rules**: input `gate {tile, hold:boolean}`; opening and closing take 3 s; a held gate admits allies even with enemies near; enemy bands within 10 tiles retarget a held gate; auto-close after 25 s. Auto knight squads sortie against a trebuchet when it is firing, no enemy band is within 8 tiles of the gate and the squad is ≥ 60% strength, then return (so idle players get it). Objective: trebuchets destroyed → s8 3★ needs all destroyed; s6 bonus medal + line. Win condition unchanged.
- **Tests**: held gate passes allies with an enemy within 3 tiles; an unheld gate keeps today's rule; retargeting; auto-close; knights return; determinism; resume.
- **Bot acceptance**: s8 aware beats default by ≥ 15 points of 3★ rate; idle s8 first-try ≥ baseline − 5; default destroys ≥ 1.5 of 3 trebuchets per battle; G1–G5.
- **Render needs**: gate held-open state (`g.gateHeld[]`; 2D: open doors; 3D contract: open leaves; fallback: draw as broken gate).
- **Conflicts**: C10 uses this API (C10 after C4); knights also exist in s6, s9, s10 → I re-checks those castles.

### C7 · 다리 끊기 (s3) — Tier B, 2.5 d
- **Owns**: `src/sim/modes/bridge.ts`, `src/sim/stages/s3.ts`, tests, golden s3.
- **Rules / layout**: river x 28–30 becomes `DEEP` except a 3-tile `WATER` ford at y 29–31 and the bridge y 16–18; the bridge road meets the west gate. Input `cutBridge` (once): an 8 s fuse (no unit needed), then `BRIDGE → DEEP`; ground units on the bridge die (`fell` counts: enemies, defenders); flow fields recompute and W-lane bands reroute through the ford. The auto commander cuts when ≥ 25 enemies are on or within 3 tiles of the bridge, no defenders are on it and wave ≥ 2. Star: cut with ≥ 30 enemies on it.
- **Tests**: `DEEP` blocks ground paths; the ford path exists from the W lane; post-cut path length grows ≥ 2 tiles; counts; input recorded; resume across the cut.
- **Bot acceptance**: cut-timing sweep (never, w1…w4, heuristic) shows a peak at least 15 points above "never"; idle s3 first-try ≥ baseline − 10 (manual 66%); default s3 first-try ≥ 80%.
- **Render needs**: `DEEP` (fallback `WATER`), `bridgefall` fx with splash; units removed by the fall leave no corpse.
- **Cut from bible**: the refugee column on the bridge (civilians); the story line counts enemies and our soldiers only.

### C6 · 기억하는 적 + 적장의 편지 — Tier B, 2.5 d
- **Owns**: `src/sim/adapt.ts`, `src/story/letters.ts`, `src/story/lines/letters.ts`, `src/ui/story/letter.ts`, tests.
- **Rules**: after a first-record battle, `lastTactic` = the largest share of `killsBy`. The next first-record battle (s3 onward) adds one announced counter-band built from **existing kinds with band modifiers**: oil → wet-hide ram (fire and oil damage to the ram and crew ×0.5); archers → pavise company (`h_maa` band, ranged damage taken ×0.6; dwarves: `w_wall`); ballista → one ladder band instead of a tower; knights → pike levies (`h_levy` band with `antiCav: 2`); melee → javelins (`o_javelins`, or `h_archers` for the Concord). Faction mapping per castle; none for s1–s2, daily, endless or replays. The letter (briefing) names the counter in the faction's voice; the briefing footnote states the exact effect.
- **Tests**: tally picks the max share; exactly one counter applied; each modifier in a duel test; determinism with a fixed memory input; replays never adapt.
- **Bot acceptance**: the counter cuts the targeted tactic's kill share by 25–50% while the default win rate at that castle stays ≥ baseline − 10; G1 ≤ 20 battles; G2 ≤ 24.
- **Conflicts**: adds a band to waves of every castle from s3 → the castle owners' bot runs must include a counter variant; transform lives in `stages/inputs.ts` (C14 calls `applyCounter`).

### A1 · Audio (WebAudio synthesis only) — Tier B, 3.0 d
- **Owns**: `src/audio/{engine,music,grammar,events,ambience}.ts`, `src/ui/audio.ts` (becomes a shim), `src/ui/battle/audio.ts` (hook), `tests/audio/*.test.ts`, `scripts/checks/audio.mjs` (Playwright `OfflineAudioContext` render; called by I from e2e).
- **Delivers**: voice pool ≤ 24 with lowest-gain stealing, pitch/gain ±5–10%; faction approach cues (Concord horn, dwarf hammer 2-beat, Sylvan whistle pair, Horde accelerating skin drum, kobold chirps, dragon 30–45 Hz rumble + reverse wind); event cues for the new verbs (rumble, countermine collapse, bridge fall + splash, gate bar/open, reed fire, letter drop, chronicler brush tick, red-line low bell); music state machine: per-castle drone root (10), drum layers 0–4 from enemies within 6 tiles of any gate (0/8/20/40), scale from average morale (< 50 → dark mode), rout drops a layer, rally rings the bell, dragon shifts the drone down a semitone and stops the drums, pause = low-pass + wind only, dawn = major third + three bells; 10 ambience beds from filtered noise and FM (stream, reed wind, rain, blizzard, ash wind, snow hush, marsh frogs, forge hammers, fire, surf).
- **Tests**: music state machine as a pure function over (pressure, morale, dragon, paused, dawn); every fx and event kind in the game maps to a cue or an explicit silence; voice cap with a mock context; arch test (no `src/sim` import; audio never touches sim RNG); build check: `dist/` contains 0 audio files and 0 images except the generated app icons (and, later, the 3D renderer's licensed CC0 textures).
- **Acceptance (e2e)**: offline renders of the 6 faction cues have pairwise spectral-centroid differences ≥ 15%; all cues within a 12 LU loudness window; peak < 0.99; 60 s battle at 4× keeps ≤ 24 voices.
- **Conflicts**: none in sim; `battle.ts` only through the F0 hook.

### C8 · Veterans, names, squad names, epithets, obituaries — Tier B, 2.5 d
- **Owns**: `src/story/{names,namepool,squadnames,veterans,epithets}.ts`, `src/story/lines/epithets.ts`, `src/ui/story/ledger.ts` (results obituary and barracks name component), tests.
- **Delivers**: a closed pool of **300** human-curated 순우리말 personal names (KS X 1001, story names excluded), assigned on recruit in save-seed order, never reused while alive or remembered; **40** human-written squad names (회색매 창병대, 갈대피리 궁수대 …) for new squads (existing default "창병대 II" names migrate once); veterans after 3 battles (name shown on death and in the ledger); obituaries "{이름}, {부대}. {장소}에서." with a deed tail in 30% of lines; 8 epithets in two forms (attributive and title) from per-squad battle stats.
- **Tests**: 10,000 random recruit/death operations → 0 duplicate living or remembered names; every attributive × every squad name and every title × josa passes `lint-ko`; epithet conditions on fixture stats; save growth within F2's caps.
- **Bot acceptance**: normal·auto campaign (20 seeds, story memory on): median ≥ 5 named veterans and ≥ 2 epithets per campaign; ≤ 1 epithet per squad per 3 battles.

### R1 · 2D render additions and generic verb buttons — Tier A→B, 2.0 d
- **Owns**: additions in `src/render/renderer.ts`, `src/ui/modeverbs.ts`, `src/ui/modeverbs.css`, `docs/RENDER_CONTRACT.md` (after F0).
- **Delivers**: `DEEP`, `w.scorched`, s2/s5 `ROUGH` looks, rumble ring, bridge fall, held gate, ally sash (C10), lanterns and night overlay (only if C9); verb buttons generated from each mode's `verbs` metadata (label, glyph, target kind, cooldown), so no mode edits UI files.
- **Tests**: render isolation (`stateHash` unchanged with the renderer drawing); e2e screenshot per new mode; verb row fits 844×390 and 640×360 without covering the squad cards.
- **Conflicts**: `renderer.ts` has one owner. **The 3D renderer is not touched**; its team receives the contract.

### C11 · 용의 밤 (lite), s9 — Tier C, 2.5 d
- **Owns**: `src/sim/systems/flyers.ts` (extracted), `src/sim/modes/dragon.ts`, `src/sim/stages/s9.ts`, tests, golden s9.
- **Rules**: a 2 s breath wind-up (sim state `act=BREATH_WINDUP`, writes the cone into `w.hazard[]` that F1's avoidance reads); ballista aim-point input (ballista squads prefer the dragon within 4 tiles of the point); crown layout: the west wall as a sawtooth of bastions (diagonal `g.line` segments), 3 gates kept. The 240 s reserve rule stays as the last safety net.
- **Tests**: every breath preceded by a 2 s wind-up; ≥ 70% of defenders in a telegraphed cone leave it; all lanes reachable.
- **Bot acceptance**: dragon driven off or slain in ≥ 70% of default runs; s9 manual mean tries ≤ 2.0; s9 first-try (normal·auto) within the curve (G5).

### C10 · 내성 후퇴 (lite) + 생존자 민병, s10 — Tier C, 2.5 d (after C4)
- **Owns**: `src/sim/systems/allies.ts`, `src/sim/modes/fallback.ts`, `src/sim/stages/s10.ts`, tests, golden s10.
- **Rules**: verb "내성으로": squads move to the inner ring (today's preset) and the inner gates are held shut for 20 s through the C4 API; squads outside are left outside. Allies: one survivor militia squad (`d_militia` ×10, auto-only, not in the roster, no roster casualties, flag `u.ally`) per castle **kept on its first record**, max 3, arriving at wave 4 at the keep; Urda's shield wall (`d_sword` ×10 under her name) if the debt was refused. No extra enemy bands for lost castles (it would punish exactly the players the manual gap already hurts).
- **Tests**: ally cap 3; allies excluded from results and roster; determinism with and without allies; inner gates close on the verb.
- **Bot acceptance**: with 3 allies the default s10 win rate rises 10–25 points (help, not a carry); with 0 allies s10 is unchanged; retreat-timing bot shows a measurable optimum.

### C13 · Daily variants, endless nights, rumours — Tier C, 1.0 d
- **Owns**: `src/sim/stages/{daily,endless}.ts`, `src/story/lines/rumors.ts`, tests.
- **Rules**: daily date seed picks castle × modifier × a compatible mode variant from the mode registry (s2 reeds, s3 bridge, s4 mines, s8 sortie objective…); one rumour line per day from 24 whole lines (no half-line combinations); endless: every 5th wave is a night page only if C9 shipped, otherwise a weather page (snow −15% range, rain halves fire) from existing rules.
- **Tests**: date determinism; 30 consecutive days → ≥ 5 distinct castle × mode pairs.
- **Bot acceptance**: default win ≥ 60% over 30 dates; endless reaches 15–20 waves on normal (unchanged ±2).

### C9 · 어둠 속 싸움, s7 night and causeway — Tier C, 4.0 d + render
- **Owns**: `src/sim/vis.ts`, `src/sim/modes/dark.ts`, `src/sim/stages/s7.ts`, tests, golden s7.
- **Rules**: 60×34 light grid 0–3 from wall torches, ≤ 6 lanterns (input), burning tiles and fire-arrow impacts (volley lights 12 s), recomputed only on change; defenders' ranged fire targets only enemies on light ≥ 1 or within 3 tiles; bell verb (morale −8 within 6 tiles, 40 s cooldown). Layout: one 2-tile causeway road to the west gate; the western field is `WATER` marsh.
- **Tests**: recompute ≤ 0.2 ms; targeting rule; recorded inputs; the causeway is the only ground path from the W lane.
- **Bot acceptance**: lantern-aware beats default by ≥ 10 points; idle s7 first-try ≥ 30% (manual baseline 16%); s7 normal·auto first-try ≥ 50% (it is today's 33% dip — retune `level` as needed).
- **Why last**: the night must be drawn in both renderers; the 3D team owns its lighting and is not in this plan.

### I · Integrator, seam keeper, balance owner — standing
- Owns the integration branch, `docs/RENDER_CONTRACT.md` after R1, `scripts/e2e.mjs` additions, the `level` numbers of castles whose owner has finished, and the final tuning day. Runs the G1–G5 sweep after each merge (≈ 30 min on 2 slots) and keeps a one-page `artifacts/sweep/trend.md`.

### Order and conflicts at a glance

```
day 1-2   F0 (serial)                       ∥ C2 engine on synthetic streams, A1 engine, line drafting
day 2-3   F2 (serial) → F1 (serial)          ∥ C2, A1, R1 contract
day 3-5   C1, C3, C5, C12, C14 (start)       ∥ C2 wiring, R1
day 5     sweep, tune, gate A
day 6-8   C4, C7, C6, C8, A1 wiring, C14     ∥ R1
day 8     gate B → start C11, C10, C13, (C9) only if A+B green
day 9-10  integration, final sweep, owner signs lines, e2e
```

| Hot spot | Packages | Resolution |
|---|---|---|
| `world.ts` | F0, F1, C1, C4, C7, C10, C11 | F0 extracts `systems/*`; later packages own their system file; `world.ts` edits ≤ 30 lines each, merged serially by I with goldens of other stages unchanged |
| `stages/sN.ts` | one owner each: s2/s5 C3, s3 C7, s4 C1, s6/s8 C4, s9 C11, s10 C10, s7 C9, daily/endless C13, s1 I | variants needed by story (debt, Hanmoe, counters, allies) are functions in the castle file, applied only by `stages/inputs.ts` (C14) |
| engineer AI | C1 | C7 uses a fuse, not engineers |
| gates | C4 | C10 depends on C4 |
| `warcouncil.ts` | F1 then C5 | sequential |
| `save.ts` | F2 | others go through `story/memory.ts` |
| `app.ts` | C14 | C6, C8 deliver components |
| `battle.ts` | F0 | everyone else through hooks |
| `renderer.ts` | R1 | — |
| balance | every sim package | castle owners tune their own `level`; I tunes globals; F1 and C5 merge before any castle tuning |
| 3D renderer | — | never edited; `RENDER_CONTRACT.md` lists every new tile, field, fx and flag with its fallback |

---

## 5. Korean text: how many lines, in what voice

About **400 lines**, plus labels and names that are lists rather than sentences.

| Bundle | Lines | Speaker and register (bible §3.3) | Package |
|---|---|---|---|
| Briefings: 10 castles × (journal 2 + margin 1) | 30 | 여울 한다체 문어; 가람 해요체 여백 | C2 |
| Castle-specific battle lines, 10 × 5 (자갈목, 빗장, 둑길, 서고 계단 …) | 50 | 여울 한 줄; barks by 한뫼 (해라체), 마루 (보고 하십시오체 / 병사에게 해요체, one register per bark), 아라 (반말, short) | C2 |
| Outcome paragraphs, 10 × 3 (clean / costly / loss) | 30 | 여울; costly adds 가람's margin | C2 |
| Common trigger lines (~20 triggers: frequent 6 × 6, normal 8 × 3, rare 6 × 2 ≈ 72 variants × 1.4 surfaces) | 100 | barks by the squad or officer; lines by 여울 | C2 |
| Choices: s2 reeds, s3 bridge, s4 debt, s5 Hanmoe (prompt, 2 options, 2 consequences, 3 later callbacks) | 32 | 여울; 우르다 하십시오체; 엘라레스 하오체; 한뫼 | C14 |
| Council slips: 11 options × (flavour + next-wave echo) | 22 | 여울 / 마루 | C5 |
| Letters: 5 factions × 3 situations + 5 counter announcements × 2 | 25 | 카시안 하게체 (dates and papers); 고르마그 반말 + 속담; 우르다 하십시오체 (ledgers); 엘라레스 하오체 (no lying about directions); 회백의 사제 반말, verse-like, "수호관" for deeds and "사관" for the book | C6 |
| Epithets 8 × 2 forms, obituary deed tails 8 | 24 | — | C8 |
| s10 roll call and ending, dawn lines, allied chief barks | 20 | 여울; 우르다; militia chiefs | C2/C10 |
| Daily rumours 24, endless page headings 10 | 34 | 가람 (장터에서 들은 말) | C13 |
| 다솔 (one line per battle at most) | 10 | 해체 | C2 |
| **Total** | **≈ 400** | | |

Lists, not counted as lines: 7 book titles, 10 chapter titles, 10–12 place names per castle (≈ 110), 40 squad names, 300 personal names.

Voice rules (enforced by `lint-ko` and review): template slots only for numbers, names and places; counters with native numerals ≤ 99; no 'A가 아니라 B', no "~하는 것이다", no double passives; castle objects instead of generic heroics; faction-variable slots (`{적기}`) wherever the enemy can change. The existing 26 functional alerts stay in neutral 합니다체 as UI, distinct from the story voices.

Who writes: agents draft everything with `draft: true` and a context note (trigger, speaker, max length). The owner edits and signs; at about 50 lines an hour that is ≈ 8 hours. **If the owner cannot sign all 400, ship fewer**: the release gate counts drafts, so the fallback is to drop variants (frequent triggers 6 → 3) and rumours, never to ship unsigned text. The bible's own sample lines are drafts too and get no exemption.

---

## 6. What I cut from the bible for 1.0, and why

| Cut | Bible / roadmap | Why |
|---|---|---|
| Narrator change (여울's death, 가람's handwriting font, ~140 Garam variants), "글씨가 바뀌는 날" | §5.7, §12.4, P4-08, part of P4-12 | needs the library-fire system, a second OFL font with a licence check, and 140 extra signed lines; the ink-and-paper look it was designed for is obsolete. 여울 narrates throughout; 가람 stays as margin notes |
| Battle print (event snapshot, posterised PNG, 200 stored) | §5.8, P4-07 | built for the woodcut renderer; a 3D snapshot belongs to the 3D team; IndexedDB storage and export add support cases |
| 휴전의 밤 and its choice | §7.2-10, P3-09 | bespoke mode, a new spy kind, an unruly-militia flag and a non-hostile column, all seen only by players who accept the truce |
| Library target, roof fire grid, bucket chain | P3-08 (half) | L-size system whose main payoff was the narrator change; s9 keeps the dragon telegraph, ballista aim and the crown layout |
| Escort, civilians, lost chapters ("게임 오버 없음") | §4.2, §7.2-7, P3-03 | a new unit class for both renderers, and unlocking the next castle on a loss rewrites the balance curve and invites "졌는데 왜 열렸나요" questions. Losses stay retries; a lost first record is remembered as lost → 다시 쓴 장 |
| Full fallback with trapped units | P3-07 (L) | replaced by fallback-lite on the C4 gate API |
| Endless segments (move to the next castle every 10 waves) | §6.4, P3-12 (half) | resume across separate `World` segments is the riskiest change to the most fragile system (resume); endless already rotates castles per run |
| Tile fire grid with random spread; new tiles REED, FOREST, MARSH, BUILDING | §7.1-9, P3-00 merge 3 | each new tile is work in two renderers and churns every golden; stage-scoped `ROUGH` rules and a fixed burn schedule give the same play. One new tile (`DEEP`) |
| New enemy kinds `h_pike`, `h_bigshield`, `h_spy` | P3-18, P3-09 | band modifiers on existing kinds give the same counters without new 3D kits |
| s8 forge | P3-16 (half) | small effect, no story weight; s8's identity is the sortie |
| Persistent scars, map hatching, beacons, woodcut campaign map | §4.4, §8, P6-02 | art direction is obsolete; the 3D team can bring castle damage later |
| Hanmoe's permanent battle death and the lieutenant 도담 (~30 lines) | §4.3 note, P4-14 | punishes a struggling player and costs lines; the give/keep choice remains |
| Extra enemy bands at s10 for lost castles | §4.1 ch.10 | punishes the players the manual gap already hurts; allies stay (help, capped at 3) |
| Sylvan letters that lie about the next direction | §5.3 | contradicts the scout arrows and would produce "화살표가 틀렸어요" reports |
| 1,600-pair market rumours, 40 endless headings, 600-name pool, 900 + 140 lines | §5.9, P4-13/14 | sized to what the owner can sign: 24 rumours, 10 headings, 300 names, ~400 lines |
| Art bible §8, P1/P2, P6 woodcut reskin, 44 brush icons, s1 opening camera and fog lift | §8, §12.6, P1, P2, P6 | obsolete by the owner's choice of realistic 3D. Note: the current HUD still uses OS glyphs (⚙ ⛨ ✋ ⇲); that is a UI task outside this content scope |
| Tester panel, photo checks §13 (visual items) | §13, P7-01 | visual acceptance belongs to the renderer track; the gameplay items here are accepted by tests and bots |

Kept from the bible in reduced form: dawn rule, escalade, bridge, mines, sortie, dragon (lite), fallback (lite), allied bands (lite), darkness (stretch), enemy adaptation, night decisions, 4 of 6 choices, veterans, epithets, chapter structure with first record vs replay, faction sound grammar, music driven by morale.

---

## 7. Owner constraints check

- **No server**: every rotation is date-seeded; letters, adaptation and memory live in the save; no new network code.
- **Minimal maintenance and support**: no new store products and no store-copy changes (the story log is 사관의 일지, so "연대기" keeps meaning the pass); save v3 migration and size caps tested; resume refuses old records cleanly (`RESUME_VER` already hashes `src/sim`); no lying letters; no game-over rule change.
- **No error management**: all new UI code wraps audio and story like `audio.ts` does (a failure silences, never throws into the loop); story and audio never write to the sim.
- **Ethical F2P**: all chapters, modes, choices, letters and names are free; no paid UI inside briefing, letter, council or results (DOM test in C14); the paid sweep records nothing in the story; adaptation and allies never make a paid item relevant.
- **No external audio or image files**: build check in A1 (`dist/` has 0 audio files and only generated icons; the 3D renderer's CC0 textures are its own exception).

## 8. Risks

1. Balance churn from many sim packages at once → castle owners tune only their castle; F1 and C5 (global effects) merge first; I runs a 20-seed sweep after every merge.
2. The 3D renderer lags the sim (new tile, fx, flags) → contract with fallbacks; the 2D renderer must show every item, so 1.0 can ship either way.
3. Owner time for signing text → the release gate counts drafts; the fallback is fewer lines, never unsigned lines.
4. Host CPU (4 shared cores, max 2 bots) → stage bots (seconds per battle) for item acceptance, full sweeps only at merges; the lockfile in `scripts/sweep.ts` enforces the limit.
5. Container restarts → WIP commits every ~20 minutes on worktree branches.
