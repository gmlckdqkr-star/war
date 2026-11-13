# 잿빛 성벽: 최후의 수비 — 제작 로드맵

## 요약 (오너용)

- **방향**: '잿빛 연대기'로 간다. 종이 위의 살아 있는 목판화, 지금 이 전투를 적는 사관, 결정적 순간을 찍어 내는 전투 판화가 바탕이다. 여기에 다른 두 시안의 장점을 접붙인다. 땅이 전투를 기억하고, 빛이 시계가 되고, 성안에 사람이 살고, 적이 내 기록을 인용한다. 무엇을 왜 만드는지는 `DESIGN_BIBLE.md`에 있고, 이 문서는 **어떤 순서로, 누가, 어떤 파일을 맡아, 무엇으로 합격을 판정하는지**를 정한다.
- **P1 수직 단면 (가장 중요)**: 쌍둥이탑 성(s6) 하나를 출시 품질로 끝까지 만든다. 다음이 모두 들어간다.
  - 첫눈 오는 저녁에서 푸른 새벽까지(해와 금빛 하늘은 마지막 성에서만 나온다)
  - 성문 셋, 그리고 다섯째 물결에 무리 둘을 더해 화면 위 180명 이상
  - 투석기, 충차, 공성탑, 트롤
  - 성안의 삶
  - 성문이 터지는 이야기 장면 하나와 결과 장부(은전은 보급 장부 칸 안에서만 보인다)
  - 새 전투 HUD(128×44 분대 꼬리표, 적이 진입로에 들어오면 문장 칩으로 접힘)
  - 첫 10분의 큰 순간(개울목 초소, 안개가 걷히며 깃발 행렬이 드러나는 장면)
  - 사람이 쓰고 서명한 s6 원고 약 60줄
  
  합격은 사진 검사, CPU 4배 감속 성능 수치, 테스터 패널 5명, 오너 평가표로 판정한다. 성능 기준은 그리기 평균 6.0 ms 이하, p95 9 ms 이하다. 다른 생물군 3곳(검은늪, 철모루, 불탄왕관)도 증명 판으로 미리 찍는다. 여기에는 하늘을 나는 고룡 전신과 기사 돌격이 들어간다. 렌더러가 눈 덮인 성 하나와 작은 사람 모양에만 맞춰진 것이 아님을 보이기 위해서다. 2주차에 오너가 폰에서 화풍을 한 번 점검한다(R-0).
- **P0 (P1 전, 약 1주)**: 네 가지를 먼저 정한다.
  - 프로토타입에서 기능별 그리기 비용을 실측해 삭감표를 채운다.
  - 공용 파일(`package.json`, `index.html`, `sw.js` 등)과 레지스트리의 담당자를 정하고, 지금 저장소의 타입 검사 실패를 해당 담당자와 고친다.
  - 지금 시뮬과 설계 문서의 차이표를 만들어 균형 담당 엔지니어와 맞춘다.
  - 작가(기본은 오너 본인), 외부 작가를 쓸 때의 비용, 테스터 패널 5명, 오너 평가표를 정한다.
- **P2–P7**:
  - P2: 모든 종족과 성 10곳의 그림, 새 병종과 아군 무리의 그림
  - P3: 새 전투 유형 9종과 성 고유 장치(갈대, 대장간), 아군 AI 무리, 대응 무리 병종의 시뮬. 테스트와 균형 봇을 거치고 결정론을 지킨다
  - P4: 이야기 시스템과 약 900줄의 사람이 쓴 문장(여울판·공통 약 750, 가람판 약 140)
  - P5: 합성 사운드
  - P6: 모든 화면의 새 옷, 상점 문구와 후원 상품 정리
  - P7: 검수, 실기기 성능, 연령 등급, 이름·상표 검색
- **병렬 작업**:
  - 각 단계는 서로 파일이 겹치지 않는 작업 단위(WP)로 쪼갰다. 여러 git worktree에서 동시에 진행할 수 있다.
  - 겹치기 쉬운 큰 파일(`world.ts`, `stages.ts`, `app.ts`, `renderer.ts`, `battle.ts`, `style.css`)은 먼저 이음매로 나눈다. P1에서는 2일 이하의 직렬 WP 셋(P1-00a 시뮬, P1-00b 렌더, P1-00c UI)이, P3에서는 P3-00이 맡는다. 그 뒤로는 WP마다 자기 파일만 고친다.
  - 단계마다 '이음매 관리' WP(P1-SK … P7-SK)가 레지스트리와 공용 파일을 맡고, 다른 WP의 이음매 요청을 처리한다.
  - 겹침은 자동 검사가 막는다.
- **순서**: P0 → P1 → (P2와 P3 동시) → (P4, P5, P6 동시) → P7. 모두 111개 WP(이음매 관리 7개 포함)다.
- **달력은 두 가지로 적는다**(부록 B):
  - 엔지니어와 에이전트가 4–6개 worktree를 동시에 돌리는 경우: P1 약 5–6주, 전체 약 4–5개월.
  - **오너 혼자 에이전트와 일하는 경우**: 동시에 돌릴 수 있는 worktree가 하나나 둘이고 검토도 혼자 하므로 약 3배, 전체 약 11–13개월. 문장 900줄은 P1부터 주 60줄씩 함께 쓴다.
- **재사용**: 프로토타입 코드(붓 함수, 병사 리그, 판화 후처리, 구조물 띠, 데칼, HUD 종이)는 TypeScript로 옮겨 다시 쓴다. 반드시 고칠 것은 셋이다. 기기 배율로 굽던 지면을 세계 좌표로 바꾸고, 원경을 따로 넓게 굽고, 프로토타입의 단순한 조사 처리를 버린다.
- **비용과 원칙**:
  - 서버 없음, 런타임 의존성 0, 외부 그림·소리 파일 0을 유지한다.
  - 글꼴은 SIL OFL 1.1 글꼴 둘만 넣는다. 본문은 고운바탕, 두 번째 사관 가람의 문장은 OFL 손글씨 글꼴 하나(라이선스 파일을 직접 확인한 경우에만).
  - 돈으로는 힘을 팔지 않는다. 유료 경로에서 닿는 보상에 은전·연구·보급이 없음을 테스트가 지킨다.
  - 외부 작가를 쓰면 약 1,000만 원(추정, 견적 필요)이 든다. 기본안은 오너가 직접 쓰는 것이다.

---

## 0. How to read this document

- **Phases** run in this order: `P0 → P1 → (P2 ∥ P3) → (P4 ∥ P5 ∥ P6) → P7`. Inside a phase, every work package (WP) marked *parallel* can run in its own git worktree at the same time as the others in that phase.
- **Serial WPs** own the shared seams. They run alone, one at a time, and are protected by golden hashes:
  - P1: `P1-00a` (sim seams), `P1-00b` (render orchestrator), `P1-00c` (UI split). Each is S (≤ 2 days of work) and runs in its own announced quiet window.
  - Integration: `P1-20`, `P2-15`, `P3-14`, `P7-00`.
  - Schema and sim: `P3-00`, `P4-01`.
- **Seam keepers.** Every phase has a standing WP `Pn-SK` (P1-SK … P7-SK; about half a day per week; the owner or one engineer). It owns that phase's registries and the shared files that the P0-02 manifest assigns to the phase. It applies seam requests within 2 working days, runs `check-owned.mjs` on all open branches every day, and hands its files to the next phase's keeper at the phase gate. Serial WPs create seams; the keeper maintains them between serial WPs.
- **Ownership is exclusive.** A WP may create or modify only the files listed under *Owns*. It may read anything. If it needs a change in someone else's file, it files a *seam request* (an issue with the exact diff) to the phase's seam keeper. It never edits that file itself.
- Each WP ships a manifest `docs/wp/<WP-ID>.json` listing its owned globs. `scripts/check-owned.mjs` (created in P0-02) fails CI if a WP branch touches a path outside its manifest. Manifests are one file per WP, so they never conflict. Shared files (`package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `public/sw.js`, `public/manifest.webmanifest`, `capacitor.config.json`, the existing `tests/*.test.ts`, `scripts/e2e.mjs`, `src/ui/{preview,orders,dom,native}.ts`, `src/ui/shop.css`, `src/main.ts`) are listed in `docs/wp/shared.json` with one owner per phase (P0-02).
- **Every WP's definition of done**:
  - `npm run typecheck && npm test && npm run e2e` pass.
  - Its own tests pass.
  - The architecture tests pass.
  - The determinism suite passes unchanged, unless the WP owns the stage whose golden it updates and the PR says why.
  - Its acceptance items are demonstrated with artifacts in `artifacts/<WP-ID>/` (screenshots, perf JSON, bot reports).
- **Effort sizes**: S = 1–2 days, M = 3–5 days, L = 6–10 days (one engineer plus agents). For the owner working alone, multiply by about 3 (Appendix B).
- The ground rules from the design bible apply to every WP:
  - Deterministic sim at 1/30 s.
  - The renderer reads `Readonly<World>` and never writes to it.
  - No downloaded or AI-generated art or sound.
  - No emoji.
  - Korean player text is written by people. Every sample line in the bible is a draft and enters code with `draft: true` until the writer signs it.
  - No paid currency, pass, discount, timer or shop link on the briefing → battle → results path. Battle-earned 은전 appears only inside the supply ledger (bible §10.4).
  - Every dye and faction colour passes the palette check (bible §8.2, D14).
- Repository: `/home/claude/war` (vite 8, vitest 5, tsx, TypeScript 5.9, no runtime dependencies). Other engineers are active there, including the balance engineer who is changing `world.ts` and the stage data (the hard cap verdict and the damage-based dragon retreat that bible §7.1–7.2 build on). P0-02 and P0-03 agree the quiet windows and the sim diff with them before any serial WP starts. Each serial WP is announced 2 days ahead and merged the day it passes.

### 0.1 Target module layout (created as stubs by P1-00a/b/c and P3-00)

```
src/sim/
  world.ts            (existing, 3,030 lines; gains hook points only)
  stages.ts           (becomes a re-export shim)
  stages/types.ts  stages/index.ts  stages/s1.ts … s10.ts  stages/daily.ts  stages/endless.ts
  stages/lost.ts  stages/side.ts  stages/s7truce.ts  stages/inputs.ts
  modes/types.ts  modes/index.ts  modes/{dawn,escalade,bridge,mines,dark,sortie,escort,fallback,dragon,truce}.ts
  systems/{ladders,rams,sappers,flyers,gates,projectiles,civ}.ts   (P3-00 extraction)
  systems/{decisions,tilefire}.ts   (P3-00: the night-decision code moved out of world.ts; the existing fire logic generalised to a tile fire grid)
  systems/{reeds,forge,allies}.ts   (P3-00 stubs for P3-15, P3-16, P3-17)
  kinds/{spy,counter}.ts   (stats of h_spy, h_pike, h_bigshield; P3-09, P3-18)
  input.ts            (P3-00: the generic input channel w.input(kind, payload) and its registry)
  chronlog.ts  chronstats.ts  weather.ts  vis.ts  zones.ts  adapt.ts  bands_adapt.ts
  council.ts  grid.ts  defs.ts   (existing; council.ts becomes a shim over systems/decisions.ts)
src/meta/
  save.ts  progression.ts  cosmetics.ts  shop.ts  season.ts  iap.ts  legal.ts   (existing)
  prints.ts  (P4-07)
src/render/
  renderer.ts  (orchestrator: calls layer modules in the fixed order of bible §8.18)
  view.ts  proj.ts  camera.ts
  ink/{palette,noise,brush,hatch}.ts
  sprites/{bank,atlas,worker,lod,zoomprint,anim,variation,overlays,budget}.ts
  rigs/{body,gear,post,human,mounted,civ,dwarf,elf,orc,kobold,levies2,allyband}.ts
  big/{partrig,troll,ancient,dragon,drake}.ts
  engines/{ram,treb,tower,ladder,ballista}.ts
  ground/{ground,props,backdrop}.ts  ground/biomes/{ford,reeds,river,canyon,birch,snowfield,marsh,mine,ashhill,seacliff}.ts
  arch/{strips,heightmap,damage,shadows,banners}.ts  arch/kits/{common,palisade,earthfort,gatehouse,canyon,timber,stone,abbey,ironclad,crown,layered}.ts
  occlusion/{ghost,cutaway}.ts
  fx/{intake,decals,particles,fire,projectiles,camerafx}.ts
  light/{mood,lights,nightmap,sunrise}.ts   weather/{weather,snow,rain,ash,fog,blizzard}.ts
  life/{folk,goose}.ts   modes/{bridge,lanterns,rumble,roofs,gates,civ,tilefire,forge}.ts   cosmetic/preview.ts
  looks/<sN>/{index,ground,arch,mood,life}.ts   looks/s1/parade.ts   looks/{daily,endless}.ts
  print/{snapshot,printer}.ts   access/{bright,colorblind,gore}.ts   perf/{stats,tiers,cuts}.ts   dev/sheet.ts
src/story/
  types.ts engine.ts triggers.ts korean.ts names.ts namepool.ts outcome.ts memory.ts veterans.ts epithets.ts scars.ts
  letters.ts campaign.ts narrator.ts decisive.ts replay.ts
  lines/{common,s1…s10,letters,extra,dodam,rumors,garam}.ts   places/{s1…s10}.ts   fixtures/*.ts (test-only lines)
src/audio/  engine.ts voices.ts pan.ts grammar.ts events.ts music.ts ambience.ts ui.ts opening.ts beds/*.ts
src/ui/
  app.ts (router only)   battle.ts (controller; story, audio and HUD plug in through battle/hooks/*)
  battle/hooks/{story,audio,hud}.ts
  screens/{cover,desk,map,briefing,battle,ledger,barracks,workshop,chronicle,market,settings,help,printview}.ts
  prebattle.ts (existing: supply ledger, 은전 prices)   resume.ts (existing: input replay)   opening.ts (s1 opening patrol)   firstrun.ts
  shot.ts  fonts.ts  debug/modes.ts   (dev entry points)
  hud/{hud,layout,slip,squadtags,chips,protect,seals,hints,chronline,barks}.ts  hud/modes/*.ts
  paper/{paper,frame,hand}.ts   icons/{ink,set,stub}.ts   components/{letter,decisions}.ts
  styles/{base,<screen>,hud,motion}.css
public/fonts/GowunBatang-{Regular,Bold}.subset.woff2  public/fonts/OFL.txt
public/fonts/garam-hand.subset.woff2  public/fonts/garam-hand.OFL.txt   (P4-08; only if the licence check passes)
tests/arch.test.ts tests/render-isolation.test.ts tests/det/*.test.ts tests/golden/det-<stage>.json tests/{render,sim,modes,story,audio,ui}/*.test.ts
tests/render/palette.test.ts
scripts/check-owned.mjs scripts/shots/*.cjs scripts/checks/*.cjs scripts/checks/palette.mjs scripts/perf/*.cjs scripts/balance/*.ts scripts/lint-ko.ts
docs/wp/<WP-ID>.json  docs/wp/shared.json  docs/wp/registries.md  docs/sim-diff.md  docs/script/{plan,s6}.md  docs/review/panel.md  docs/release/{rating,names}.md
```

### 0.2 Shared test and measurement tools (built in P0-02, P1-00a/b, P1-01 and P1-19, used by every WP)

| Tool | What it does |
|---|---|
| `scripts/check-owned.mjs` | (P0-02) Fails CI if a branch touches a path outside its `docs/wp/<WP-ID>.json` globs or a shared file it does not own in `docs/wp/shared.json`. |
| `tests/arch.test.ts` | (P1-00a) Parses `import` statements without any new dependency. Fails if `src/sim/**` imports `src/render`, `src/ui`, `src/story` or `src/audio`, or imports render-only look data. Also fails if any file reads from `chronlog` inside `src/sim`. |
| `tests/render-isolation.test.ts` | (P1-00b) Runs 600 sim steps of s6 twice: once with the full renderer drawing into a no-op 2D context, once with no renderer. The `World` hash and chronlog hash must be identical. It runs again with tier `low` and with every in-battle cut from the cut table switched off. |
| `tests/det/*.test.ts` | (P1-00a) Per-stage goldens in `tests/golden/det-<stage>.json`. Each covers 10 seeds and hashes at steps 300, 1,800 and 5,400. A golden may only be updated by the WP that owns that stage's sim file. |
| `?shot=<scene>` | (P1-19) Freezes seed, sim time, camera and tier for reproducible screenshots. Each scene also writes a mask PNG of units, structures and props, so "paper region" means the pixels outside the mask (bible §13). Scenes are listed per WP. |
| `scripts/perf/bench.cjs` | (P1-19) Uses Playwright Chromium (`const { chromium } = require('playwright')`, `file://` URL, no server). Sets CDP `Emulation.setCPUThrottlingRate({rate:4})`, runs a scene for 10 s, and writes `artifacts/<WP>/perf.json` with render ms (avg, p95), per-layer ms, sim ms per step, frames over 33 ms, estimated canvas bytes and JS heap. |
| `scripts/checks/*.cjs` | (P1-19) Image checks on screenshots: ΔE2000 on paper regions, shadow length and direction, ink-mark empty-cell ratio (bible §13 definition), grid autocorrelation at a 16 px period (< 0.15), saturated-area ratio, HUD area from DOM rects, enemies drawn under HUD rects, grayscale separability, colour-blind simulation (Brettel/Viénot matrices, no dependency), silhouette height and path bend from the flow field. |
| `scripts/checks/palette.mjs` + `tests/render/palette.test.ts` | (P1-01) The palette check from bible §8.2 and D14: every dye × 10 faction swatches + 먹, 피, 진사 ΔE2000 ≥ 20; dye L* 25–78.8; faction swatch L* ≤ 78.8; 잿불 primary L* ≥ 35. It reads the colour constants from `render/ink/palette.ts` and `meta/cosmetics.ts`, so a new dye or season colour cannot merge without passing. The reference numbers are in bible Appendix B (prototype: `design/rev2/final_palette.py`). |
| `docs/review/panel.md` | (P0-04) The 5-person tester panel, the fixed questionnaire per check and the owner rubric (8 items, 1–5, pass = every item ≥ 3 and mean ≥ 3.5). |

---

## 1. Prototype code reuse

The three prototypes are plain JS under `design/<direction>/`. Port to TypeScript with the same behaviour unless noted.

| Source | Function(s) | Target | Notes |
|---|---|---|---|
| `chronicle/src/core.js` | `P` palette, `RNG`, `hash2`, `vnoise`, `fbm` | `render/ink/palette.ts`, `ink/noise.ts` | Render-only RNG. Never imported by sim. |
| `chronicle/src/core.js` | `brush`, `taper`, `swell`, `nib`, `inkBlob`, `splat`, `hatch`, `poly`, `wobLine`, `qpts` | `render/ink/brush.ts`, `ink/hatch.ts` | Also used by `ui/icons/ink.ts`, which keeps one drawing hand. |
| `chronicle/src/core.js` | `josa` | **drop** | Use `src/sim/josa.ts`. The story layer adds native numerals in `story/korean.ts`. |
| `chronicle/src/sprites.js` | `BODY`, `ik`, `makePose`, `drawFigure`, `drawHead` | `render/rigs/body.ts` | Add dwarf, elf, kobold, civ and mounted body plans. Add N/S facings. |
| `chronicle/src/sprites.js` | `drawWeapon`, `drawBow`, `drawShield`, `drawLadderCarry` | `render/rigs/gear.ts` | |
| `chronicle/src/sprites.js` | `lightPass`, `shadowPost`, `inkPost`, `flashPost`, `corpseFrame` | `render/rigs/post.ts` | The woodcut light pass and double-print misregistration are kept exactly. |
| `chronicle/src/sprites.js` | `Atlas` (+ `freeze` to ImageBitmap) | `render/sprites/atlas.ts` | Add trimmed-rect packing into 1024² pages, LOD1/LOD2 and Worker baking. |
| `chronicle/src/sprites.js` | `drawRamShed`, `drawRamLog` | `render/engines/ram.ts` | Add crew swap and wet-hide roof. |
| `chronicle/src/sprites.js` | `EMBLEMS`, `drawEmblem`, `drawBanner`, `drawTotem` | `render/arch/banners.ts`, `ui/icons/set.ts` | Banner patterns map to `cosmetics.ts` `BannerPattern`. |
| `chronicle/src/world.js` | `bakeGround` | `render/ground/ground.ts`, `ground/backdrop.ts` | **Must change**: from a device-scale bake to a world-space canvas at 2 tex/px (high) or 1 tex/px (low) that carries the paper grain, plus a separate 0.5 tex/px backdrop canvas covering 320 world px left and right and 96 top and bottom (bible §8.6). |
| `chronicle/src/world.js` | `pine`, `props` | `render/ground/props.ts` | |
| `chronicle/src/world.js` | `structSprite`, `faceStones`, `shadeFaceS`, `topFace`, `merlon`, `wallRow`, `towerSprite`, `gateSprite`, `timberFace`, `hallSprite`, `keepSprite` | `render/arch/kits/*.ts` | Keep height ≤ 40. No round towers. |
| `chronicle/src/world.js` | `buildStructures` | `render/arch/strips.ts` | Merged to ≤ 29 strips. |
| `chronicle/src/world.js` | `cutaway` | `render/occlusion/cutaway.ts` | Add the phantom outline, section hatching and section mark. Only used at zoom ≥ 2. |
| `chronicle/src/render.js` | `stampCorpse`, `stampBlood`, `stampArrow`, `stampScorch`, `stampOil`, `stampFoot`, `flushDecals` | `render/fx/decals.ts` | Add caps of 24/8 per frame and 6 per tile per kind. Arrows that hit wall faces are baked into the wall strips (P1-07), not drawn as overlays. |
| `chronicle/src/render.js` | `intake(fx)` | `render/fx/intake.ts` | Read the real `Fx` kinds plus the new output-only `die`, `land`, `ramhit`, `gatebreak`. |
| `chronicle/src/render.js` | `part`, `burst`, `emit`, `stepParts`, `drawParts` | `render/fx/particles.ts` | Cap of 250/120 and 4 alpha buckets. |
| `chronicle/src/render.js` | `advanceDying` | `render/sprites/anim.ts` | Driven by `die` fx, not by a `hitT` guess. |
| `chronicle/src/render.js` | `folkNow` | `render/life/folk.ts` | |
| `chronicle/src/render.js` | `drawLadder` | `render/engines/ladder.ts` | |
| `chronicle/src/render.js` | `drawBanners` | `render/arch/banners.ts` | |
| `chronicle/src/render.js` | `drawSnow` | `render/weather/snow.ts` | |
| `chronicle/src/hud.js` | `UIART.paper`, `frame`, `tornClip`, `drawBar` | `ui/paper/paper.ts`, `ui/paper/frame.ts` | |
| `chronicle/src/hud.js` | icons (`keep`, `sun`, `oil`, `tally`, `emblem`) | `ui/icons/set.ts` | |
| `chronicle/src/hud.js` | `BARKS`, `chronicleNow` | **rewrite** in `story/engine.ts` (P1-15) and `story/lines/common.ts` (P1-22) | The prototype hard-codes the squad name in `gate_break`. |
| `chronicle/src/sheet.js` | sheet page (`?sheet=1`) | `render/dev/sheet.ts` | The sheet becomes the review artefact for every rig WP. |
| `chronicle/font/` | GowunBatang TTF, `OFL.txt` | `public/fonts/` | Re-subset to KS X 1001 (2,350 syllables) + punctuation + Latin, 400 and 700, ≤ 1.6 MB total. The Garam handwriting font is added by P4-08 (≤ 300 KB, both fonts ≤ 1.9 MB). |
| `chronicle/src/ui.js` | briefing with currency and pass plug | **do not port the plugs** | The 은전 supply ledger comes from the existing `ui/prebattle.ts`, not from the prototype. |
| `ember/proto.html` | `buildHeight`, `renderStrip`, `renderAllStrips`, `carve` | `render/arch/heightmap.ts`, `arch/strips.ts` | |
| `ember/proto.html` | `stampDecal`, `processDecalQ` | `render/fx/decals.ts` | The queue with deferral. |
| `ember/proto.html` | `mood` | `render/light/mood.ts` | Merged with diorama `moodAt` key-curve evaluation. |
| `ember/proto.html` | ghost pass | `render/occlusion/ghost.ts` | Team-pigment silhouettes, never grey. |
| `ember/proto.html` | `setGateState`, `stepRam`, `stepLadders`, `stepOil` | reference for `sim/systems/{gates,rams,ladders}.ts` | Re-implement deterministically in sim. The prototype logic is render-side and not trusted. |
| `ember/det.cjs` | — | `scripts/perf/det.cjs` | |
| `diorama/src/render.js` | `moodAt` | `render/light/mood.ts` | |
| `diorama/src/render.js` | `flameTex`, `smokeTex`, `puffTex`, `glowTex` | `render/fx/fire.ts`, `render/light/lights.ts` | Restyle to three-layer brush flames. |
| `diorama/src/render.js` | folk and goose code | `render/life/folk.ts`, `life/goose.ts` | |
| `diorama/src/land.js` | — | ideas for `render/ground/props.ts` | Ruts, trampled crops. |
| `judge_feas/*.cjs` | `rafbench`, `drawbench`, `chrprof`, `det`, `shot250` | `scripts/perf/*.cjs` | Bench harness base. |

---

## P0 — Before the slice: measure, assign, agree (about 1 week)

**Goal.** Settle the four things that every later estimate depends on: real per-feature render costs, who owns every shared file, what the sim already does, and who writes and who reviews. P0 writes no game code except `scripts/check-owned.mjs` and the typecheck fix agreed with its owner.

| WP | Owns | Delivers | Acceptance |
|---|---|---|---|
| **P0-01** Perf cut table in the prototype · S | `design/chronicle/bench/**` (prototype copy only), `artifacts/P0-01/` | Measures in the prototype at CPU ×4, 250 units, with `scripts/perf/bench.cjs`'s method: (1) the current draw (6.83–7.08 ms baseline); (2) each planned feature switched on alone: ghost pass, footprint sampling at 0.4/0.8/1.2 s, wall-arrow overlays vs arrows baked into strips, flag flutter, multiply pass, folk, weather; (3) the zoom print for 2 kinds vs 15 kinds (bake ms and MB). Writes the measured ms into the cut table (bible §8.18) and sets the cut order. | Every "추정" cell in bible §8.18 is replaced by a measured number with its scene; the sum of always-on features fits 6.0 ms avg, or the table says which cuts are needed to fit and P1-20 starts from that order |
| **P0-02** Shared files, registries, typecheck · S | `docs/wp/shared.json`, `docs/wp/P0-02.json`, `scripts/check-owned.mjs`, `docs/wp/registries.md` | The shared-files manifest (§0) with one owner per phase; the registry list (`sim/modes/index.ts`, `sim/stages/index.ts`, `sim/input.ts`, `render/ground/biomes/index.ts`, `render/arch/kits/index.ts`, `render/looks/index.ts`, `story/lines/index.ts`, `ui/hud/modes/index.ts`, the screen router list, `ui/icons/set.ts` names) with the seam keeper of each phase; the quiet-window calendar for P1-00a/b/c agreed with the other engineers; the current `npm run typecheck` failure in `src/ui/resume.ts` reported to and fixed by that file's current owner (P0-02 does not edit it) | `npm run typecheck` is green on the main branch; `check-owned.mjs` rejects a dummy branch that edits a foreign file and one that edits `package.json` without owning it |
| **P0-03** Sim diff and balance agreement · S | `docs/sim-diff.md` | A table of bible §5, §6 and §7 sim rules against the current code: already present (`BATTLE_HARD_CAP`/`liftSiege` = the dawn rule, `gateShut`, `Unit.crew`, `escortIdx`, `DRAGON_FLEE_HP`, `DRAGON_PAIN_MAX`, `councilOptions`/`chooseCouncil` in `world.ts`), to change (`DRAGON_MAX_STAY` removed; dawn calls `liftSiege` early; s6 wave 5 +2 bands; s1 first-wave spawn), and new (tiles, input channel, modes, kinds `h_pike`, `h_bigshield`, `h_spy`, the drunk-militia flag, allied bands). Each row names its WP and whether the balance engineer's in-flight work touches it | The balance engineer signs the table; no P1 or P3 WP rebuilds a mechanism the table lists as present |
| **P0-04** Writer, panel, rubric · S | `docs/review/panel.md`, `docs/script/plan.md` | Writer decision: the owner by default (60 lines a week from P1 week 1, about 15 weeks for ~900 lines); the outside-writer option priced (draft about 18 days + revision about 7 days, about ₩10M at about ₩400k a day, an estimate that needs a quote). The 5-person tester panel (no one who built the game; at least two strategy players), its remote questionnaire per reviewer check and its four dates (P1 week 4, P2, P5, P7). The owner rubric: reference stills and clips side by side with ours, 8 items scored 1–5 (bible §13) | The panel has 5 confirmed names; the rubric sheet and questionnaire are fixed before P1 starts |

---

## P1 — Vertical slice: 쌍둥이탑 성 (s6), finished in the new style

**Goal.** One castle at release quality:
- Snowfield biome, stone twin-tower kit and courtyard village.
- Dusk → night → blue dawn as the clock (no sun and no gold; the sun appears only in s10).
- All s6 enemies: Concord levies, men-at-arms, archers, ladders, knights, trebuchet and siege tower; Horde goblins, warband, berserkers, ram and troll. Wave 5 gains two bands so that ≥ 180 units are drawn.
- Ghost pass and cutaway.
- Field memory.
- New battle HUD with per-castle protection rects.
- One complete reactive story sequence: the west-gate break → the threshold hold → the costly or clean outcome page with obituaries, in signed (not draft) Korean.
- Briefing and results in the new skin, with the 은전 supply ledger.
- The s1 first ten minutes (opening patrol, first contact ≤ 8 s, the fog lift).
- Three proof stills of other biomes, including a flying dragon and a knight charge.

**Order.** `P1-00a → P1-00b → P1-00c` (serial, each S, each in its own quiet window) → `P1-01 … P1-19`, `P1-21`, `P1-22` (parallel; P1-05 and P1-08 start against interfaces and finish after their deps merge) → `P1-20` (serial integration and tuning). `P1-SK` runs throughout. **R-0** (owner style check on a phone) happens at the end of parallel week 2.

### P1-00a · Sim seams — *serial, S*
- **Owns**:
  - `src/sim/world.ts` (hook points only)
  - `src/sim/stages.ts` → shim
  - `src/sim/stages/**` (mechanical split, identical data)
  - `src/sim/modes/types.ts`, `modes/index.ts` and stub files for all 10 modes
  - `src/sim/chronlog.ts` (types, `STORY_KINDS`, 4,096-entry ring buffer and `record()` only)
  - `tests/arch.test.ts`, `tests/det/*.test.ts`, `tests/golden/*`
  - `docs/wp/P1-00a.json`
- **Sim hook points added to `world.ts`** (no behaviour change):
  - `w.modeState`
  - `w.weather` (default values)
  - `w.vis` (null unless a mode allocates it)
  - `w.chron` (chronlog instance) and `chronlog.record()` calls inside `event()` for `STORY_KINDS` only (bible §5.1; fx are not logged)
  - output-only fx kinds `die`, `land`, `ramhit`, `gatebreak`
  - `Gate` state field (`open|closed|broken`) that mirrors the existing `gateShut` behaviour; nothing changes how gates block
  - `swingT` read-only output field (sim never reads it)
- **Depends on**: P0-02 (quiet window), P0-03 (diff table).
- **Tests**: golden hashes recorded *before* the refactor on 10 seeds × 10 stages and identical after; existing `tests/*.test.ts` and `scripts/e2e.mjs` pass; `arch.test.ts` passes.
- **Acceptance**: zero gameplay change; every sim module in §0.1 exists with its signature and a doc comment.

### P1-00b · Render orchestrator — *serial, S*
- **Owns**:
  - `src/render/view.ts`, `src/render/proj.ts`
  - `src/render/renderer.ts` (restructured into the layer orchestrator of bible §8.18, layer 0 backdrop first, calling stub modules)
  - stub files for every module in §0.1 `src/render/**` with frozen exported signatures, including `camera.ts`'s scripted-move API (used by P1-21 and the s10 sunrise) and `perf/cuts.ts`'s cut-switch API
  - `src/render/looks/s6/index.ts`, the render registries (§0)
  - `tests/render-isolation.test.ts`, `docs/wp/P1-00b.json`
- **Dev entry point**: `?sheet=1` calls `render/dev/sheet.ts`.
- **Depends on**: P1-00a.
- **Acceptance**: pixel diff of the existing e2e screenshots ≤ 0.5%; `render-isolation.test.ts` passes.

### P1-00c · UI split and glyph stubs — *serial, S*
- **Owns**:
  - `src/ui/app.ts` → router, plus `src/ui/screens/*.ts` (mechanical move of existing screens, plus stubs for `cover`, `ledger`, `printview`)
  - `src/ui/battle.ts` (adds `battle/hooks/{story,audio,hud}.ts` registration points; extracts the HUD into `ui/hud/hud.ts` unchanged)
  - `src/style.css` → `src/ui/styles/*.css` (mechanical split)
  - **Glyph → icon stubs**: every emoji and OS glyph in `src/ui/**` (☰ ⚙ ⛨ ➶ ♨ ⚑ ✚ 📱 ✕ 🍞 ⚒ ✝ ✔ 💡 ⚠ ◉ ⛫ 🔒 and the rest) is replaced mechanically by `icon('<name>')` from `ui/icons/stub.ts`, which draws a plain labelled box. The names are the icon list of bible §8.17. P1-13 (26 battle icons) and P6-01 (the rest) replace the stub drawings.
  - `src/story/types.ts`, `src/audio/types.ts`
  - stubs `ui/shot.ts`, `ui/fonts.ts`, `ui/opening.ts`; the battle start awaits `ui/fonts.ts`
  - `docs/wp/P1-00c.json`
- **Depends on**: P1-00b.
- **Tests**: existing UI tests and e2e pass; a regex test finds 0 emoji code points in `src/ui/**` (from now on, every WP that owns a UI file keeps it at 0).
- **Acceptance**: every screen still works; the e2e screenshot diff is limited to the icon boxes.

### P1-SK · Seam keeper, P1 — *standing*
- **Owns** (after P1-00c merges): the registries listed in P0-02 for P1, the P1 rows of `docs/wp/shared.json` (`package.json`, `vite.config.ts`, `index.html`, `public/sw.js`, `tsconfig.json`, the existing `tests/*.test.ts`, `src/main.ts`).
- **Delivers**: seam requests applied within 2 working days; a daily `check-owned.mjs` run on all open P1 branches; the list of open seam requests in the weekly owner note.

### P1-01 · Ink core and atlas pipeline — *parallel, L*
- **Owns**: `src/render/ink/**`, `src/render/sprites/{bank,atlas,worker,lod,zoomprint}.ts`, `scripts/checks/palette.mjs`, `tests/render/{atlas,palette}.test.ts`, `docs/wp/P1-01.json`.
- **Reuses**: `core.js` brush and noise; `sprites.js` `Atlas`; the ΔE2000 code of `design/rev2/de2000.py` ported to JS.
- **Delivers**:
  - `SpriteBank` keyed `unitId/anim/facing/i`. A key can be overwritten only by another code-generated frame (a newer generator version, dev use). There is no path for hand-drawn or commissioned frames (bible §1.4-6, §8.4).
  - Trimmed-rect packing into 1024² pages.
  - Worker baking with OffscreenCanvas → `ImageBitmap`, with a main-thread fallback.
  - LOD1 first, then LOD2 in ≤ 4 ms slices.
  - A second LOD1 set per mood for the low tier (bible §8.10): API to bake a mood variant in the background and swap at a wave boundary, at most 2 sets in memory.
  - Zoom print, narrowed (bible §8.4): at zoom ≥ 2.2, stable for 300 ms, at 1× speed or paused, re-print **only the selected squad's kinds (at most 2)** and only idle, walk and attack frames for E and W (about 30 frames) at 4 tex/px, in ≤ 2 ms slices, into a ≤ 4 MB LRU, freed on zoom-out. Off on the low tier. Structure strips are never re-printed.
  - Byte accounting API.
  - The palette module (`ink/palette.ts`) with the 2nd-edition values of bible §8.2 and the palette check (§0.2) wired into `npm test`.
- **Depends on**: P1-00b.
- **Tests**:
  - Packing has no overlaps and stays within pages.
  - Key contract; a non-generated frame source is rejected.
  - The zoom-print LRU evicts at 4 MB and never holds more than 2 kinds.
  - Byte accounting matches `w*h*4`.
  - Palette check: all values in bible Appendix B reproduce within ±0.2 ΔE; a deliberately failing dye (the old 석청 `#2F6E73`) fails the test.
- **Acceptance**:
  - The s6 kinds' LOD1 bake is ready in ≤ 1.6 s at CPU ×4.
  - The LOD2 bake completes in the background without any frame > 20 ms.
  - A zoom print of 2 kinds bakes without any frame > 20 ms at ×4 (number from P0-01).
  - C-1 (palette check) is green in CI.

### P1-02 · Human, mounted and civilian rigs — *parallel, L*
- **Owns**: `src/render/rigs/{body,gear,post,human,mounted,civ}.ts`, `tests/render/rigs-human.test.ts`, `artifacts/P1-02/`.
- **Delivers**:
  - Body plans for human, mounted and civ, with E, W, S and N facings drawn separately.
  - The 49-frame set × 2 variants for `d_spear`, `d_sword`, `d_archer`, `d_xbow`, `d_engineer`, `d_surgeon`, `d_ballista` crew, `d_militia`, `h_levy`, `h_maa`, `h_bow`, `h_ladder` and `h_captain`.
  - Mounted plans for `d_knight` and `h_knight`.
  - Townsfolk, Dasol and the goose Som.
  - The extra animations listed in bible §8.5.
  - White band and bright helm on all allies. The 상아 dye recolours sleeves and cloak only; the coat stays 쪽빛 and the band stays white (bible §10.2).
  - The knight charge (gallop 4 + lance lowering 2) at full quality, because P1-18 shows it in a proof still.
- **Depends on**: P1-01 (interface; can draw to plain canvases until the merge).
- **Tests**:
  - Every key in the s6 manifest renders a non-empty frame.
  - The W facing is not a mirror of E (pixel-diff test).
  - Allied frames contain the white-band luminance stripe for every dye in the palette module.
- **Acceptance**:
  - `?sheet=1` shows every kind and frame.
  - In grayscale, allies vs Concord are separable by band and silhouette (tester panel, 4 of 5).
  - Silhouette ≥ 6 CSS px at fit zoom (0.62 at 844×390, 0.57 at 800×360 and 740×360).

### P1-03 · Horde rigs and troll part rig — *parallel, M*
- **Owns**: `src/render/rigs/orc.ts`, `src/render/big/{partrig,troll}.ts`, `tests/render/rigs-orc.test.ts`, `artifacts/P1-03/`.
- **Delivers**:
  - `o_grunt`, `o_goblin`, `o_gob_ladder`, `o_berserk`, `o_spear` and `o_warboss`, with red handprint, fur cloak and totem.
  - A generic part-rig compositor (baked parts + bone angles at draw time).
  - `o_troll`: walk 4, smash 3 with a 0.6 s wind-up, roar 2, hit 1, regen shimmer, die 4 → stone-mound decal id.
- **Depends on**: P1-01, P1-02 (`body.ts` and `post.ts` read-only).
- **Tests**:
  - The part rig is deterministic for the same angles.
  - The troll's frame budget is ≤ 0.25 ms per draw at ×4.
- **Acceptance**:
  - The sheet shows all Horde kinds.
  - The troll reads at fit zoom as a stone giant, not a grey blob (tester panel, 4 of 5). The troll is one of the four R-0 subjects.

### P1-04 · Siege engines for s6 — *parallel, M*
- **Owns**: `src/render/engines/{ram,treb,tower,ladder,ballista}.ts`, `tests/render/engines.test.ts`, `artifacts/P1-04/`.
- **Delivers**, as in bible §8.5:
  - `o_ram` (push 4, strike 3, crew swap 2, dry and wet-hide roofs, burn 3, wreck).
  - `h_treb` (crew wind 4, release 3, reload 4, burn, collapse).
  - `h_tower` (roll 4, dock 3, burn, collapse).
  - Human and goblin ladders (rise 3, standing, shoved fall 4).
  - Our ballista (wind 3, loose 2, rotated arm).
  - Engine animation is driven by the sim fields `cd`, `act` (`DOCKED`, `SET`, `PLANT`), `hp` and fx `ramhit`/`treb`/`ladderfall`.
- **Depends on**: P1-01.
- **Acceptance**:
  - Clip T2: trebuchet launch and impact, tower docking and the ram hitting the gate all happen in a 90 s s6 run (`?shot=s6-w3`, `s6-w5`).

### P1-05 · Animation mapping and per-soldier variation — *parallel, M*
- **Owns**: `src/render/sprites/{anim,variation,overlays}.ts`, `tests/render/anim.test.ts`.
- **Delivers**:
  - Facing from `fx/fy` with 15° hysteresis.
  - Walk phase from distance travelled.
  - Attack start on an upward jump of `cd` (or `swingT` when present).
  - Hurt from `hitFlash`: a 1-frame paper flash and a 2–3 px push.
  - State frames for DOWN, CARRIED, CLIMB, EVAC and FLED.
  - Routing walk.
  - Variation: scale 0.94–1.06, idle phase and ±1 px jitter, all hashed from `soldierId`; variant = hash % 2; a fidget every 3–6 loops.
  - Morale < 50 → spacing +2 px and a slumped fidget.
  - Overlays: veteran plume (≤ 20), bandage (≤ 10), epithet tassel.
- **Depends on**: P1-00a (frozen fields).
- **Tests**:
  - A table-driven test from synthetic `Unit` snapshots to `(anim, facing, frame)`.
  - The `cd` reset during a target switch does **not** start an attack.
  - Neighbour same-frame ratio < 50% over 300 steps for a 12-unit idle squad.
- **Acceptance**: checklist M3, M4, M5, M7 and D4 pass on s6 clips.

### P1-06 · World-space ground, snowfield biome, backdrop — *parallel, M*
- **Owns**: `src/render/ground/{ground,props,backdrop}.ts`, `src/render/ground/biomes/snowfield.ts`, `src/render/looks/s6/ground.ts`, `tests/render/ground.test.ts`, `artifacts/P1-06/`.
- **Delivers**:
  - One merged ground canvas (terrain + decals + paper grain) in world space, exactly the map (960×544 world px): 2 tex/px on high, 1 on low. The paper grain lives here and nowhere in screen space (bible §8.6, §8.10).
  - A separate backdrop canvas at 0.5 tex/px covering 320 world px left and right and 96 top and bottom (1,600×736 world px): ridges, the mill road, distant smoke, enemy camp lights. It is drawn first and replaces the screen clear.
  - Bake order as in bible §8.6.
  - The s6 story props (mill with a frozen wheel, buried plough, arrow-marked waystone, enemy campfires and banners in the west 25%). Hand-placed props are checked against the seeded terrain patches (`rng.patches`) on 20 seeds.
  - Footprint and rut layers. Footprint sampling interval from the P0-01 cut table (0.4 s default, 0.8–1.2 s when cut).
- **Depends on**: P1-01.
- **Tests**:
  - The bake is deterministic for a seed (hash of a downscaled readback in a test-only offscreen canvas, never the GPU canvas in game).
  - Memory: ground = 960×544×4×tex² bytes (high 8.4 MB, low 2.1 MB); backdrop = 1,600×736×4×0.25 ≈ 1.2 MB.
  - Coverage: at the minimum zoom (fit) on 844×390, 800×360 and 740×360, and at the widest pan, the backdrop covers every screen pixel outside the map (formula test on the camera bounds).
  - No prop overlaps a seeded patch on 20 seeds.
- **Acceptance**:
  - B1 (no square motif repeats over 3 tiles; grid autocorrelation peak < 0.15), B5 (no flat band > 8 px at any screen edge at max zoom-out on all three viewports), B-2/D3 (≤ 35% of 32×32 cells in the west field without an ink mark, bible §13 definition) and P3 (approach direction readable from props in `?shot=s6-deploy`).

### P1-07 · Architecture: strips, stone kit, village, damage, banners — *parallel, L*
- **Owns**: `src/render/arch/{strips,heightmap,damage,shadows,banners}.ts`, `src/render/arch/kits/{common,stone}.ts`, `src/render/looks/s6/arch.ts`, `tests/render/arch.test.ts`, `artifacts/P1-07/`.
- **Delivers**:
  - Wall row strips (≤ 29 merged) carved from a heightmap.
  - Only changed tiles are re-baked on damage.
  - Corbel stripes and melt stains.
  - Twin west towers and N/S gate towers in one projection.
  - Keep with height ≤ 40 and its full footprint on screen.
  - 2×2 gable houses facing south, the library with its bell, the well, the smithy and the infirmary.
  - Damage states: wall 3 stages + scar variants; gate 4 stages + open/close 3 frames; tower 3 stages; keep 3 stages.
  - Skewable cached strip shadows (length factor L, alpha a, hatched tips).
  - Squad banners and the tower hanging (the equipped banner pattern, large) with morale droop. Flutter has a static fallback frame for the cut table.
  - Arrows stuck in wall faces are **baked into the strip** at the next idle slice (≤ 30 per strip), not drawn as overlays (P0-01 measured overlays at 3–5 ms). The cut table can only stop new bakes.
  - Shadow skew API that can rotate the shadow direction without re-baking (used by the s10 sunrise in P2-09).
  - Every courtyard building stands on sim `BUILDING` tiles (positions read from the stage grid; until P3-00 adds the tile, a render-side list checked against the grid).
- **Depends on**: P1-01.
- **Tests**:
  - Strip count ≤ 29 for every stage grid.
  - A damage change re-bakes ≤ 2 strips.
  - An arrow bake re-bakes 1 strip in ≤ 2 ms slices.
  - Shadow length stays within 0.6–1.5 × height; a rotated skew keeps the hatched tips.
- **Acceptance**:
  - B2 (shadow direction ±15°).
  - P4 (inner lanes, well, smithy, infirmary visible after the west gate falls).
  - P5 (≥ 8 courtyard prop kinds; with P1-12).
  - No round towers (owner check in R-1).

### P1-08 · Occlusion: ghost pass and cutaway — *parallel, M*
- **Owns**: `src/render/occlusion/{ghost,cutaway}.ts`, `tests/render/occlusion.test.ts`, `artifacts/P1-08/`.
- **Delivers**:
  - Ghost silhouettes in team pigment at 60% with a 1 px paper rim, only for units under a structure's occluder rect.
  - Cutaway at zoom ≥ 2 with a dashed phantom outline, 45° section hatching, a heavy cut line and a section mark, with a 0.2 s transition.
- **Depends on**: P1-07 (occluder rect interface frozen in P1-00b).
- **Tests**:
  - Ghost draw count = units under occluders (synthetic world).
  - No ghost is drawn for units in the open.
- **Acceptance**:
  - D6 (north-gate fight readable at 1×).
  - D7 (tester panel: 4 of 5 read the zoom-2.5 gate as "cut open", not "destroyed").
  - The ghost pass has a "gate passage only" mode for the cut table; its cost is in `perf.json`.

### P1-09 · FX: decals, particles, fire, projectiles, camera fx — *parallel, M*
- **Owns**: `src/render/fx/{intake,decals,particles,fire,projectiles,camerafx}.ts`, `tests/render/fx.test.ts`.
- **Delivers**:
  - Decal queue with caps of 24/8 per frame and 6 per tile per kind; the full decal list from bible §8.7.
  - Particles capped at 250/120 with 4 alpha buckets.
  - Three-layer brush flames (6-frame loop, per-instance phase), with smoke from the flame tips bent by `w.weather` wind.
  - Arrows on arcs with ground shadows; volley shadow sheaves.
  - Stone impact dust and shards.
  - Slash crescents and ink bursts.
  - Corpse ink-drain over the 2 die frames.
  - Gore-reduced variant hooks.
  - Camera fx: 3.5% punch-in and ≤ 2 px shake only for gate break, troll smash, stone impact and dragon events; all disabled by `reduceMotion`.
- **Depends on**: P1-00b, P1-06 (ground canvas API).
- **Tests**:
  - The cap unit test.
  - Deferred decals drain within 10 frames.
  - The particle cap is respected under a 1,000-emit burst.
- **Acceptance**: B7, M8, D2 (saturated area ≤ 15% after 2 min) and the fire close-up (tester panel, 4 of 5).

### P1-10 · Light, time and snow (render) — *parallel, M*
- **Owns**: `src/render/light/{mood,lights}.ts`, `src/render/weather/{weather,snow}.ts`, `src/render/looks/s6/mood.ts`, `tests/render/light.test.ts`.
- **Delivers**:
  - The mood key curve evaluated on sim time (s6 table in bible §8.10). The s6 dawn key is the **blue dawn** (`#B9C3D6→#D6DCE4`, no gold). No sun disc and no gold sky in any castle except s10 (P2-09).
  - High tier: one screen-space multiply pass with **tint and edge darkening only** (the paper grain is in the world-space ground, P1-06), plus additive cached glow sprites.
  - Low tier: mood re-baked into ground and strips at wave boundaries in time slices, with no full-screen composite. Units get the mood through **two pre-baked LOD1 mood atlases** (dusk/overcast day and night, about 2.6 MB each for s6) via the P1-01 API: one in use, one baking for the next wave, swapped at the wave boundary. Blue dawn and red night are made by changing the additive light colour over the night set.
  - Torch lighting order: west wall → gate towers → courtyard → keep.
  - Window lights.
  - Ice and puddle sky tint.
  - Snow in 2 layers (160/60 flakes) with deep footprints on snow; roof and merlon snow bands.
  - The bright-mode floor of 0.75.
- **Depends on**: P1-00b, P1-01, P1-11 (dawn time is read from `w.modeState`; a stub is available).
- **Tests**: curve interpolation; low tier issues zero `globalCompositeOperation` changes per frame (spy context); the low tier never holds more than 2 mood atlases and stays ≤ 10 MB in total; the multiply pass has no texture input (no grain in screen space).
- **Acceptance**:
  - D1: ΔE2000 ≥ 12 on paper regions (outside the shot mask) between `?shot=s6-deploy` and `?shot=s6-w4`; shadow length ratio ≥ 1.8; torches 0 → all.
  - Low tier: in `?shot=s6-w4&tier=low` the mean L* of allied units is at least 15 lower than in `s6-deploy` (units visibly in the night).
  - `s6-dawn` has no pixel with the gold hue band of the s10 sunrise (hue 35–55°, chroma > 30) in the sky gradient.
  - B4 for snow.
  - B6.

### P1-11 · Sim: dawn rule, s6 wave 5, sim weather — *parallel, M*
- **Owns**: `src/sim/modes/dawn.ts`, `src/sim/weather.ts`, `src/sim/stages/s6.ts` (rules and wave 5 only), `tests/modes/dawn.test.ts`, `tests/golden/det-s6.json`, `artifacts/P1-11/`.
- **Delivers**:
  - The dawn rule **is the existing hard cap** (bible §7.1-2, P0-03): `rules.dawnAfter` calls the same `liftSiege()` path that `BATTLE_HARD_CAP` (900 s) already uses, earlier, and emits a `'dawn'` event. The win/loss verdict is the hard cap's state verdict as the balance engineer leaves it. Castles without `dawnAfter` keep the hard cap as the safety net. No second mechanism.
  - Sun-clock data for the HUD.
  - **s6 wave 5 gains two bands** (one Concord levy band from the north, one Horde goblin ladder band from the south) so that ≥ 180 units are drawn at its peak (bible §6.2 target 190; envelope measured 149–160 today).
  - `w.weather` for s6: snow; `rangeMul` 1, `fireMul` 0.8; wind WSW→ENE light.
- **Depends on**: P1-00a, P0-03.
- **Tests**:
  - Dawn fires at the exact step and goes through `liftSiege()` (spy test); no other withdrawal code exists (grep test for a second `withdraw` path).
  - A stalemate seed now ends.
  - Determinism and resume hash.
  - Balance bot on s6 (20 seeds): with the two new bands, the default bot's win rate on normal is within ±5 points of before, or the band sizes are reduced until it is; the idle bot gets no 3-star win.
  - A counting test: drawn-unit peak in wave 5 ≥ 180 on 18 of 20 seeds.
- **Acceptance**: T5 (the HUD shows time to dawn in the last wave); M-2 data half.

### P1-12 · Courtyard life — *parallel, S*
- **Owns**: `src/render/life/{folk,goose}.ts`, `src/render/looks/s6/life.ts`, `tests/render/life.test.ts`.
- **Delivers**:
  - ≤ 20 townsfolk on a render-only RNG seeded by stage id.
  - Routines tied to sim state (between waves; during waves; low food; low arrows; gate broken → flee to keep).
  - Dasol chasing the goose Som; the goose scatters when arrows land within 3 tiles.
  - The child is never hurt.
  - A cut-table switch that reduces folk from 20 to 6 (Dasol and Som stay).
- **Depends on**: P1-02 (civ sprites), P1-07 (prop positions).
- **Tests**:
  - Same stage and sim snapshot → same folk positions.
  - The render-isolation test still passes.
- **Acceptance**: B6 (≥ 4 kinds of non-combat motion between waves) and P5 together with P1-07.

### P1-13 · Battle HUD reskin — *parallel, L*
- **Owns**: `src/ui/hud/{hud,layout,slip,squadtags,chips,protect,seals}.ts`, `src/ui/battle/hooks/hud.ts`, `src/ui/paper/{paper,frame}.ts`, `src/ui/icons/{ink,set}.ts` (battle subset: 26 icons drawn; the other names stay stubs until P6-01), `src/ui/styles/hud.css`, `tests/ui/hud.test.ts`, `artifacts/P1-13/`.
- **Delivers**:
  - The layout from bible §8.14 at 844×390, 800×360 and 740×360.
  - **Squad tags 128×44** (emblem 32×32, short name ≤ 4 characters at 15 px, count/capacity in 13 px tabular figures, morale bar 48×4, a two-character state word): 4 visible at 844 px wide, 3 at 800 and 740, the rest by swipe. The name-shortening rule and the duplicate suffix (회색매²). The full name and the epithet's attributive form only in the 240×96 expansion.
  - **Protection rects** computed per castle from the `StageDef` wave entry edges and spans (s6: west, `NORTH` x 6–34 top band, `SOUTH` x 6–34 bottom band including the south road y 29–33), moved to screen space on every camera change. When any on-screen enemy is inside a rect that overlaps the tag row, the tags **fold into 44×44 emblem chips** standing in a column beside the seal column; they unfold 3 s after the rect is clear.
  - The fit zoom accounts for the 52 px tag band: `(H − 52) / 544` (the camera constant itself is set by P1-20).
  - Top-left and west 25% kept clear.
  - **Left-hand mode**: the four seals go horizontally into the bottom band at 30–56% of the width, tags shrink to 2 visible to their right; seals are never in the west 25%; when zoomed in and a protection rect overlaps them, seals fade to 0.45 opacity and still take touches.
  - The s10 sunrise hook: seals and tags hide while the sunrise plays (called by P2-09).
  - The 26 battle icons replace the P1-00c stubs in the files P1-13 owns.
  - Torn-paper slips and brush frames.
  - The ensō cooldown on seals.
  - 44 pt minimum targets.
  - The flag hit radius shrinks while a squad is selected.
- **Depends on**: P1-00c.
- **Tests**:
  - The layout solver produces no overlap at 844×390, 800×360, 740×360 and 932×430, in both hands.
  - HUD area from DOM rects: always-on ≤ 13.3%, with one chronicle line and one bark ≤ 19.5%, folded ≤ 9.8% (bible §8.14 table, ±0.5).
  - Protection rects: for s6, a synthetic world with an enemy at (20, 32) folds the tags at zoom 1.0; the same enemy at fit zoom does not overlap the tag row.
  - No emoji code points in the files P1-13 owns and in `src/ui/battle.ts` (regex test; the rest of `src/ui/**` is covered by the P1-00c test and later by P6-01).
- **Acceptance**: U1, U2 and U3 on `?shot=s6-w4`, `?shot=s6-w2-south` and `?shot=s6-w4-north` at all three sizes; H-1 to H-3.

### P1-14 · Sim: chronlog emission and battle stats — *parallel, M*
- **Owns**: `src/sim/chronstats.ts`, the body of `src/sim/chronlog.ts` (beyond P1-00a's types), `tests/sim/chronlog.test.ts`.
- **Delivers**:
  - A `chronlog.step(w)` derivation of the extra kinds from bible §5.2: `ladder_up`, `on_wall`, `sq_first_blood`, `sq_half`, `sq_last_stand`, `sq_wiped`, `gate_damaged` buckets, `gate_hold` timer, `arrows_low`, `refugees_in`.
  - Only `STORY_KINDS` enter the ring (about 2 per second, so 4,096 entries hold over 30 minutes); `die` only for allies and named enemies. Kills, deaths and the other counts go to `ChronStats`, not the ring.
  - `ChronStats` per squad and per battle, handed over with `BattleResult`.
  - Last-position tile per soldier.
  - Decisive-moment weights and the event coordinates the print snapshot needs (P4-07).
- **Depends on**: P1-00a.
- **Tests**:
  - The log hash is deterministic.
  - A synthetic scenario produces the exact expected log sequence.
  - A 900 s s6 run at 4× speed never wraps the ring.
  - The sim never reads the log (`arch.test.ts`).
- **Acceptance**:
  - Every chronicle-line number in the s6 sequence equals the chronstats value (D9 data half).
  - Sim cost ≤ 0.05 ms per step at ×4.

### P1-15 · Story engine core and the s6 reactive sequence — *parallel, M*
- **Owns**: `src/story/{engine,korean,names,outcome,decisive}.ts`, `src/story/fixtures/**` (test-only draft lines), `src/ui/hud/{chronline,barks}.ts`, `src/ui/battle/hooks/story.ts`, `tests/story/*.test.ts`.
- **Delivers**:
  - A trigger table engine with conditions, speaker, weight, cooldown, once-flags and a priority queue on a story RNG separate from the sim.
  - **Counter-aware numerals** (bible §8.16): helpers `{n:명}`, `{n:째}`, `{n:수}` and friends; native Korean numerals for 명·마리·발·째 up to 99 (열둘, 셋째, 스무 명), Arabic numerals for 초·분·년·쪽 and large numbers; josa wrappers on top of `sim/josa.ts`.
  - **Unique soldier names**: a closed pool of **600+ human-picked names** (all in KS X 1001; story characters and place names excluded). A soldier gets the next name, in save-seed order, that is not used by the living roster or the veterans list, and keeps it (`Soldier.name`, written through the P4-01 schema; until P4-01, held in a side map keyed by soldier id). Fallen names are not reused in that campaign; after 600, the squad name is added. The sim RNG is never used. The pool file is written by the writer (P1-22 delivers the first 600).
  - The outcome classifier (bible §5.6).
  - Bark placement that avoids the west 25%, the gate passage and the HUD protection rects (P1-13 API).
  - **One bark at a time.** Bark 3.2 s, chronicle line 6 s, the minimum gap and the 20 s idle summary are measured in **real time**, so 3× and 4× speed do not shorten them; when the queue overflows, the lowest priority drops first.
  - The 20 s idle summary line.
  - Lines are loaded from `story/lines/*` (P1-22) through `story/lines/index.ts`; a line with `draft: true` is shown with a dev-only marker.
- **Depends on**: P1-14 (log API frozen in P1-00a), P1-13 (protection rects).
- **Tests**:
  - Name pool × all templates → 0 josa errors; every counter helper on 0–120.
  - 80-soldier roster plus 160 veterans: 0 duplicate names on 100 save seeds.
  - No line repeats within a battle.
  - The cooldown and queue order hold; at 4× speed the bark on-screen time is still 3.2 s ± 1 frame.
  - The outcome classifier on 12 fixtures.
- **Acceptance**: the bible §12.1 sequence plays exactly in a recorded s6 clip (with P1-22's lines); S2 passes; ≤ 1 bark on screen in every captured frame.

### P1-16 · Briefing, supply ledger and results ledger for s6 — *parallel, M*
- **Owns**: `src/ui/screens/{briefing,ledger}.ts`, `src/ui/prebattle.ts`, `src/ui/styles/{briefing,ledger}.css`, `tests/ui/briefing.test.ts`, `artifacts/P1-16/`.
- **Delivers**:
  - Book-spread briefing: speaker name plus at most 2 sentences, one tap to skip, Garam's margin note, the deployment page and the cinnabar 출정 seal.
  - **The supply ledger** (bible §10.4-2): the existing `prebattle.ts` logic (`planCost`, `SUPPLY_PRICE`, `refillCost`, `treatCost`) stays as it is; the battle-earned money is shown as **은전** with a code-drawn silver coin, and its balance and prices appear only inside the one supply-ledger cell on the right page. The save field stays `gold`. The results ledger shows the 은전 earned as one line.
  - **No paid currency (훈장), pass, discount, timer or shop link** anywhere on the path.
  - Results ledger: the outcome paragraph (clean, costly or defeat), obituary list with red-rubric names and place names, sequential star stamps and count-ups.
  - A placeholder frame for the print (filled in P4-07).
- **Depends on**: P1-13 (paper and icons), P1-15 (outcome), P1-22 (lines).
- **Tests**:
  - A DOM test asserts that no element on the briefing → battle → results path matches the **paid** selectors (`[data-currency=medal]`, pass, sale, timer, shop route), and that `[data-currency=silver]` appears only inside `.supply-ledger` and the one results line.
  - The ledger lists ≥ 2 real events from fixture stats.
  - Supply purchase, refill and treatment still change the save exactly as before (existing `tests/ui.test.ts` cases pass unchanged).
- **Acceptance**: S1, S3 and D8.

### P1-17 · Font — *parallel, S*
- **Owns**: `public/fonts/**`, `src/ui/fonts.ts`, `scripts/fonts/subset.md` (recipe; the subset is generated once with fonttools offline and committed), `tests/ui/fonts.test.ts`.
- **Delivers**:
  - Gowun Batang 400 and 700, subset to KS X 1001 + punctuation + Latin.
  - `OFL.txt` shipped.
  - `document.fonts.load` before battle.
  - Offline: a seam request to P1-SK adds the font files to the `public/sw.js` precache list in P1 (not in P7), so an installed PWA never falls back to a system font.
  - A slot in `ui/fonts.ts` for the second (Garam) font, filled by P4-08.
  - A license line on the settings → licenses screen (added in P6-09; P1 adds the text constant).
- **Tests**:
  - Every character used in `src/story/**`, `src/ui/**` and `src/meta/**` strings is inside the subset (scanner test).
  - Total ≤ 1.6 MB.
  - Offline e2e: with the network off after first load, the battle renders in Gowun Batang.
- **Acceptance**: every P1 screen renders in Gowun Batang with no fallback glyphs (visual check plus a `document.fonts.check` test).

### P1-18 · Biome proof frames, flying dragon, knight charge — *parallel, L*
- **Owns** (draft versions; ownership passes to the P2 WPs afterwards):
  - `src/render/ground/biomes/{marsh,mine,ashhill}.ts`
  - `src/render/rigs/dwarf.ts`
  - `src/render/big/dragon.ts`
  - `src/render/arch/kits/{abbey,ironclad,crown}.ts`
  - `src/render/looks/{s7,s8,s9}/**`
  - `artifacts/P1-18/`
- **Delivers** three stills from the same renderer, plus two clips:
  1. 검은늪 rainy night with orcs and a troll on the causeway (lantern circles).
  2. 철모루 smoky day with a dwarf shield wall and an iron ram.
  3. 불탄왕관 red night with the **full flying dragon** over the library: the part rig at release quality (wingspan 110 world px, glide 6 frames, bank 2), its altitude-scaled ground shadow and the breath ribbon. A shadow-only proof is not accepted (bible §8.19).
  4. A clip of the **Concord knight charge** (gallop 4 + lance lowering, from P1-02's mounted rig) across the s6 west field.
  5. A clip of the dragon gliding 6 s at zoom 1.0 and 2.5.
  The dragon rig is a draft that P2-04 finishes (dive, breath, hit, flee, shot down), not a placeholder to be redrawn.
- **Depends on**: P1-01, P1-02, P1-06, P1-07, P1-10 (interfaces).
- **R-0 owner style check (end of parallel week 2)**: the owner looks at the rig sheet, the dragon, the knight charge and the troll on a phone and scores items ③ ④ ⑤ of the owner rubric. A score below 3 on any of them switches the big units to the "먹판" fallback (mass and strong hatching instead of detail, still code-drawn) for the rest of P1. No commissioned-art path exists.
- **Acceptance**:
  - The three stills plus s6 pass a 4-image **grayscale** thumbnail test (tester panel, 4 of 5 tell all four apart).
  - Dragon draw ≤ 0.4 ms at ×4; memory per still ≤ 40 MB.
  - R-0 recorded in `artifacts/P1-18/r0.md`.

### P1-19 · Acceptance and perf harness — *parallel, M*
- **Owns**: `scripts/shots/**`, `scripts/checks/**`, `scripts/perf/**`, `src/ui/shot.ts` (the `?shot=` scene fixer, dev builds only), `tests/ui/shot.test.ts`.
- **Delivers**:
  - Scenes `s6-deploy`, `s6-w2`, `s6-w2-south` (a south-road band at zoom 1.0 under the tag row), `s6-w3`, `s6-gatebreak`, `s6-w4`, `s6-w4-north` (a north-gate assault at zoom 1.0), `s6-w5` (the real wave 5 peak, ≥ 180 units), `s6-cutaway`, `s6-dawn`, `s6-ledger`, `s6-briefing`, `s6-maxout`, `s1-first10` (opening patrol through wave 3, 1× speed) and **`perf-250`**, a synthetic performance scene: s6 terrain with 250 units, about 130 projectiles, about 30 down, troll + tower + trebuchet and about 650 corpses, used only for timing (no real stage reaches 250 until s10).
  - Every check in §0.2, with the numeric definitions of bible §13 (shot masks for paper regions, ink-mark cells, grid autocorrelation, path bend).
  - `bench.cjs` at CPU ×4 for tiers high and low, plus an in-battle downgrade run (perf-250 with the frame budget forced over 20 ms).
  - `npm run accept:p1` produces `artifacts/P1/report.json`, a contact sheet and pass/fail per criterion; reviewer items produce the panel questionnaire pack (`docs/review/panel.md` format).
- **Depends on**: P1-00b, P1-00c, P0-04.
- **Acceptance**: the report runs headless in < 6 min and is reproducible (two runs → identical image hashes for frozen scenes).

### P1-20 · Integration, tiers and tuning — *serial, M*
- **Owns**: `src/render/renderer.ts`, `src/render/camera.ts`, `src/render/perf/{stats,tiers,cuts}.ts`, `src/ui/battle.ts`, `docs/wp/P1-20.json`.
- **Delivers**:
  - Wires all P1 modules in the bible §8.18 order (layer 0 backdrop first).
  - Camera values in CSS px per world px: **fit `(H − 52) / 544`** (0.62 at 844×390, 0.57 at 800×360 and 740×360), opening 1.0, max 3.2. Pan bounds keep the screen inside map + backdrop.
  - The 5 s gate nudge; the scripted-move API used by P1-21.
  - Catch-up capped at 4 steps.
  - View culling.
  - Automatic tier detection at deploy (p75 > 20 ms → low).
  - **In-battle downgrade** (bible §8.18): when p75 > 20 ms for 2 s, switch off the next row of the cut table; when p75 < 12 ms for 10 s, switch one back on. Nothing is re-baked (atlases, ground and strips untouched). A full tier change (high → low) happens only at the next wave boundary.
  - The cut order fixed from the P0-01 measurements and re-measured here.
  - A debug overlay with per-layer ms and the active cuts.
  - Final tuning: strip merge, static prop y-bands, smoke cap 50, snow 160.
- **Depends on**: all of P1-01 … P1-19, P1-21, P1-22.
- **Tests**: a cut switch never calls a bake function (spy test); `render-isolation.test.ts` with every cut on and off; the fit zoom formula at 5 viewport sizes.

### P1-21 · The first ten minutes (s1 개울목 초소) — *parallel, M*
- **Owns** (draft versions where marked; ownership passes on afterwards):
  - `src/ui/opening.ts` (opening patrol), `src/ui/firstrun.ts` (minimal first run; → P6-05), `src/ui/hud/hints.ts` (three situation hint slips)
  - `src/sim/stages/s1.ts` (first-wave spawn position only; → P3-10), `tests/golden/det-s1.json`
  - `src/render/looks/s1/**` including `looks/s1/parade.ts` (draft; → P2-05), `src/render/ground/biomes/ford.ts` (draft; → P2-05), `src/render/weather/fog.ts` (draft; → P2-10)
  - `src/audio/opening.ts` (one synthesized drum layer for the fog lift; → P5-03)
  - `tests/ui/opening.test.ts`, `artifacts/P1-21/`
- **Delivers** (bible §12.6):
  - **Opening patrol, 0–12 s**: the camera glides from the palisade watch post over the courtyard (Dasol and Som, the water wheel) to the western fog; two horn notes beyond the fog; Yeoul's first line. One tap skips it. With reduced motion it is one cut.
  - **First contact ≤ 8 s** after the patrol ends or is skipped: the first wave's spawn is pulled toward the 자갈목 ford. This is a sim change: the s1 golden is updated in its own commit and the s1 balance bot (20 seeds) stays within ±5 points of the default bot's previous win rate on normal.
  - Three hint slips in waves 1–2 (gate, squad drag, volley).
  - **The fog lift at the start of wave 3**: over 2 s the fog layer drains and the Concord sun-banner column (dozens of banners) appears all at once at the west edge of the field; the drum layer enters and the camera pulls back 3.5%. These 2 s may exceed the saturation budget (bible §8.1-2).
  - A minimal first run: cover stub → chapter-1 briefing → battle.
- **Depends on**: P1-00a/b/c, P1-06, P1-10, P1-13, P1-20 (camera API stub from P1-00b), P1-22 (lines).
- **Tests**: on 20 seeds, the first arrow or first melee damage lands ≤ 8 s after the patrol ends (1× speed); skip and reduced-motion paths; the fog lift completes in 2.0 ± 0.1 s; the render-isolation test still passes.
- **Acceptance**: F1–F4 on `?shot=s1-first10`; F3's panel question.

### P1-22 · The s6 script, signed — *parallel, M (writer time: about 1 week at 60 lines)*
- **Owns**: `src/story/lines/{common,s6,s1}.ts` (content; the common file grows later in P4-13), `src/story/places/s6.ts`, `src/story/namepool.ts` (600+ names), `docs/script/s6.md` (the manuscript with the writer's signature and date).
- **Delivers** (bible §5.9):
  - About 60 lines written and signed by the writer (the owner by default, P0-04): s6 briefing 5, s6-specific barks and lines 12, s6 outcome paragraphs 6, and the first variants of the common triggers that actually fire in s6 (about 37).
  - The s1 first-ten-minutes lines: Yeoul's first line and the three hint slips.
  - The 600+ name pool, chosen by a person (KS X 1001 only; story characters and place names excluded).
  - Every bible sample line used here is rewritten, not copied; it enters as `draft: true` and loses the flag only when the writer signs it in `docs/script/s6.md`.
  - Faction-specific objects appear as placeholders (`{적기}`), never hard-coded.
- **Depends on**: P0-04 (writer), P1-15 (line format; the writer can start from bible §5 before it merges).
- **Tests**: `lint-ko` on every line (the banned frames: 'A가 아니라 B', double passives, "~하는 것이다", 3+ repeats of a sentence frame per screen); josa and counter tests over the name pool; coverage: every trigger that fires in a recorded s6 run on 5 seeds has at least one signed line.
- **Acceptance**: S-2 (0 `draft: true` lines on screen in the s6 scenes and `s1-first10`); the owner reads the s6 run on a phone and signs.

### P1 acceptance criteria (the gate to P2/P3)

All are produced by `npm run accept:p1` unless marked *panel* (the 5-person tester panel of P0-04, questionnaire fixed in advance) or *owner*. Viewports 844×390, 800×360 and 740×360 at DPR 2 (the A-items use 844×390 only). Scenes are frozen with `?shot=`. "Paper region", "ink mark" and "grid" follow the definitions in bible §13.

| # | Check | Scene | Threshold |
|---|---|---|---|
| A1 | Render time, high tier, CPU ×4 | `perf-250` (synthetic: 250 units, ~130 projectiles, ~30 down, troll + tower + treb, ~650 corpses), 10 s | avg ≤ 6.0 ms, p95 ≤ 9.0 ms with no cuts active |
| A2 | Render time, low tier, CPU ×4 | same | avg ≤ 3.5 ms; software raster ≤ 16 ms; 0 full-screen composites |
| A3 | Sim time | same | ≤ 1.6 ms per step avg; catch-up never > 4 steps |
| A4 | Long frames | same | frames > 33 ms ≤ 2% (headless proxy for M10; device check in P7-02) |
| A5 | Memory | `perf-250` and `s6-w5` | canvases + atlases ≤ 40 MB high, ≤ 10 MB low (including 2 mood atlases); zoom-print LRU ≤ 4 MB; backdrop ≤ 1.3 MB |
| A6 | Time to first battle frame | cold start into s6, ×4 | ≤ 1.6 s with LOD1 atlas ready; no frame > 20 ms during the LOD2 background bake |
| A7 | Pan/pinch | scripted pan and pinch, ×4 | p95 ≤ 12 ms |
| A8 | Determinism | test suite | `World` and chronlog hashes identical with renderer on/off, high/low and every cut on/off; resume hash identical |
| A9 | In-battle downgrade | `perf-250` with a forced 24 ms frame load | cuts switch on within 2.5 s, 0 bake calls, p75 back under 20 ms within 5 s; cuts switch off after 10 s under 12 ms |
| B-1 | Light is the clock (D1) | `s6-deploy` vs `s6-w4` | paper-region (outside the shot mask) mean ΔE2000 ≥ 12; shadow length ratio ≥ 1.8; lit torches 0 → all |
| B-2 | Field not empty (D3) | `s6-w2` | ≤ 35% of 32×32 px cells in the west quarter have no ink mark (cell mean ≥ 6/255 darker than the scene's empty-paper reference, or cell std ≥ 6/255) |
| B-3 | Pigment discipline (D2) | `s6-w4` + 2 min | saturated (chroma > 40) area ≤ 15%; corpses are ink; blood stays red |
| B-4 | Single light (B2) | `s6-w3` | all measured shadow directions ENE within ±15° |
| B-5 | No grid (B1) | `s6-deploy` | ground autocorrelation peak at a 16 px period < 0.15; no square motif repeated over 3 tiles |
| B-6 | Battle written on the ground (B7) | `s6-w2` vs `s6-w3` | blood, corpses, scorch, arrows and debris present; image diff in the field ≥ 8% |
| B-7 | No empty margins (B5) | `s6-maxout` at all three viewports | backdrop visible; no flat-colour band > 8 px at any screen edge |
| B-8 | Blue dawn | `s6-dawn` | no gold sky: 0 sky-gradient pixels in hue 35–55° with chroma > 30 |
| C-1 | Palette check (D14) | CI | every dye × 10 faction swatches + 먹, 피, 진사 ΔE2000 ≥ 20; dye L* 25–78.8; swatch L* ≤ 78.8; 잿불 primary L* ≥ 35 |
| M-1 | Soldiers visible (M1) | fit zoom (0.62 / 0.57) | infantry silhouette ≥ 6 CSS px; every in-view unit drawn |
| M-2 | Scale (D5) | `s6-w5` (the real wave 5, not the synthetic scene) | ≥ 180 drawn units; ≥ 3 simultaneous wall contacts (ladder, gate, tower) |
| M-3 | No clones (D4, M3) | idle squad zoom 2 | ≥ 3 silhouettes in 12; neighbour same-frame < 50% |
| M-4 | Motion clips (M4, M5, M7, M8, M9) | clips | *panel* 4 of 5: attack 3-beat, hit flash + push, slumped ranks + stretcher evac, arrow arcs with shadows, troll and tower announced ≥ 2 s ahead |
| O-1 | Ghost pass (D6) | north-gate fight at 1× | occluded units visible in team pigment; 0 grey ghosts |
| O-2 | Cutaway (D7) | `s6-cutaway` at zoom 2.5 | *panel*: 4 of 5 read it as a section |
| H-1 | HUD area and approaches (U2) | `s6-w4`, `s6-w2-south`, `s6-w4-north` at the three viewports | always-on ≤ 13.3%, with line and bark ≤ 19.5%; ≤ 1 bark on screen; top-left 25% × 30% empty; 0 enemy units drawn under a HUD rect (tags fold to chips) |
| H-2 | Targets (U1) | same, both hands | all controls ≥ 44 pt; left-hand seals never in the west 25% |
| H-3 | Icons (U3) | all P1 screens | 0 emoji or OS glyphs in the P1-owned UI files and in `battle.ts`; the remaining screens show only `icon()` stubs (no glyphs) |
| H-4 | Clean path (D8) | briefing → battle → ledger | 0 paid-currency (훈장), pass, sale, timer or shop elements; 은전 only inside the supply ledger and the one results line |
| S-1 | Reactive sequence | recorded `s6-gatebreak` run | ram first hit → stage lines → gate-break bark + chronicle line → 20 s hold line with correct numbers → outcome page naming the holding squad and ≥ 2 real events |
| S-2 | Korean (S6, D9) | tests + screens | 0 josa or counter errors across the 600-name pool × templates; `lint-ko` clean; 0 `draft: true` lines on screen in s6 and `s1-first10` |
| S-3 | Briefing (S1) | `s6-briefing` | speaker + ≤ 2 sentences; one tap to skip |
| F-1 … F-4 | First ten minutes (bible §13.9) | `s1-first10` | first contact ≤ 8 s after the patrol; patrol ≤ 12 s and skippable; fog lift 2 s with drums and camera (*panel* 4 of 5 name it the most memorable moment of the first ten minutes); cover → battle ≤ 3 taps, ≤ 1 modal |
| P-1 | Proof frames | P1-18 stills + s6, grayscale | *panel*: 4 of 5 tell all four apart |
| R-0 | Owner style check | P1 parallel week 2, on a phone | *owner*: rubric items ③ ④ ⑤ each ≥ 3 for the rig sheet, dragon, knight charge and troll, or the big units switch to the 먹판 fallback |
| R-1 | Owner review | build on a phone | *owner*: the 8-item rubric with the reference stills and clips side by side; every item ≥ 3 and mean ≥ 3.5. Any item below 3 becomes a P1 hot-fix WP before P2 starts |

---

## P2 — Renderer for every race and every biome

**Goal.** All 41 `UnitDef`s, all siege engines, the dragon, and all ten castles' biome, architecture, mood and weather render at the P1 quality bar and within the P1 budgets. Runs in parallel with P3. P2 never edits sim files; anything a P2 WP needs from the sim must already be in P1-00a/b's frozen view types or in the P3-00 tile and kind definitions (read-only).

**Order.** `P2-01 … P2-14` and `P2-16` parallel → `P2-15` serial integration. `P2-SK` (seam keeper) runs throughout and owns the render registries for P2. Every P2 castle WP checks its looks against the sim layout of bible §6.5 (the P3 WP that owns the castle's layout publishes the grid first; until then a fixture grid).

| WP | Owns | Delivers | Depends on | Tests | Acceptance |
|---|---|---|---|---|---|
| **P2-01** Deephold rigs · M | `render/rigs/dwarf.ts` (from P1-18 draft), `render/engines/ram.ts` iron variant → `render/engines/ironram.ts`, `tests/render/rigs-dwarf.test.ts` | `w_shield` (shield-wall shuffle 4, lock 1), `w_xbow` (kneel, crank), `w_sapper` (dig 3, emerge 3 with a mound decal), `w_thane` (hammer, horn); `w_ram` iron roof with 2 burn stages | P1 | full-key render test; W≠mirror(E) | sheet complete; grayscale: dwarf separable from human by width/height ratio |
| **P2-02** Sylvan rigs and the ancient · L | `render/rigs/elf.ts`, `render/big/ancient.ts`, `render/engines/vine.ts`, tests | `e_skirm` (backstep, hide), `e_blade` (dance chain + spin), `e_ladder` (vine seed, vine grows 3), `e_druid` (sap heal), `e_warden`; ancient part rig (root walk 4, sweep 3, creak 2, burning overlay, topple 4 → stump decal) | P1 | part-rig draw ≤ 0.3 ms at ×4 | sheet complete; T6 elf harassment rhythm readable in a 10 s clip |
| **P2-03** Kobolds and cultists · M | `render/rigs/kobold.ts`, `render/engines/swarmladder.ts`, tests | `c_kobold` (scuttle, tail idle), `c_kob_ladder` swarm ladder, `c_cultist` (ash mask, fire-pot throw, prayer fidget) | P1 | — | grayscale: kobold vs goblin separable (tail, mask) |
| **P2-04** Dragon and drakes · M | `render/big/{dragon,drake}.ts` (from the P1-18 full-body rig), `render/fx/breath.ts`, tests | builds on the P1-18 flying dragon (glide 6, bank 2 already at release quality): adds dive 2, breath 3, hit 1, flee climb 2, shot down 4 → crater and wing wreck; landing warning shadow and rumble 2 s ahead; drake (flap 4, dive 2, lance 2, fall 3) | P1 | shadow precedes the sprite by ≥ 2 s in a scripted approach | M9 and T3 visuals on a `s9-w4` clip; dragon draw ≤ 0.4 ms |
| **P2-05** s1 ford and s2 reeds · M | `render/ground/biomes/{ford,reeds}.ts` (ford from the P1-21 draft), `render/arch/kits/{palisade,earthfort}.ts`, `render/looks/{s1,s2}/**` (s1 from the P1-21 draft) | ford with willows, water wheel and the misty-morning curve (no sun visible); reed field drawn on the sim `REED` tiles (40 strokes/tile, 3-frame wind wave, burnt-half variant); the earth fort's wall line curving along the hill (P3-15 layout) | P1, P1-21 | bake determinism; reeds are drawn on exactly the `REED` tiles of the s2 grid | grayscale thumbnails distinct (P2-14); B4 for fog; P2 path bend: the main approach's flow-field centre line deviates ≥ 2 tiles from the straight spawn → gate line at 자갈목 |
| **P2-06** s3 river and s7 marsh · M | `render/ground/biomes/{river,marsh}.ts`, `render/arch/kits/{gatehouse,abbey}.ts`, `render/looks/{s3,s7}/**` | river with rain puddles reflecting the sky, the south ford and a broken-bridge state; the bridge gatehouse as a two-storey gate tower **in the west gate position** on sim `BUILDING` tiles (no tile exists between river and wall); the single 2-tile causeway over `MARSH` (P3-06 layout), abbey and bell tower, fireflies at night | P1, P1-18 | no structure is drawn on a walkable tile (grid check) | grayscale thumbnails distinct; bridge-collapse frames ready for P3-13; P2 path bend ≥ 2 tiles at the s3 ford reroute |
| **P2-07** s4 canyon and s5 birch · M | `render/ground/biomes/{canyon,birch}.ts`, `render/arch/kits/{canyon,timber}.ts`, `render/looks/{s4,s5}/**` | cliff hatching, double wall, blizzard curve; burnt stumps west and living birches east on the sim `FOREST` tiles, timber fort, ash fall | P1 | canopy drawn on exactly the `FOREST` tiles | grayscale thumbnails distinct; P2 path bend ≥ 2 tiles through the canyon; cover reads: a skirmisher standing in `FOREST` has ≤ 50% of its pixels visible under the canopy, and 0% when the sim marks it unseen |
| **P2-08** s8 mine and s9 crown · M | `render/ground/biomes/{mine,ashhill}.ts`, `render/arch/kits/{ironclad,crown}.ts`, `render/looks/{s8,s9}/**` | slag, rails, three chimneys with smoke columns over the forge `BUILDING`, inner wall, a hazy day where smoke hides the sun; scorched hill with glowing cracks, the jagged crown wall line (P3-08 layout), the 2×2 library tower on `BUILDING` tiles with 4 burn states | P1, P1-18 | library and forge drawn on exactly their `BUILDING` tiles | grayscale thumbnails distinct; the red-sky castle is the only red background |
| **P2-09** s10 sea cliff, the sunrise and mode looks · L | `render/ground/biomes/seacliff.ts`, `render/arch/kits/layered.ts`, `render/looks/{s10,daily,endless}/**`, `render/looks/lost.ts`, `render/light/sunrise.ts` | layered fortress, lighthouse, east cliff; the **east backdrop widened to sea and horizon** (the sea is only in the backdrop, no sea tiles); **the only sunrise** (bible §8.10): over 30 s the multiply gradient goes blue dawn → sunrise, the shadow skew vector rotates from ENE to W (≥ 150°) with L dipping to 0.5 mid-turn and ending at 1.6, unit ground shadows use the same vector, a gold additive rim on the east edge, the camera eases back and right to show sea and sun, and the P1-13 hook hides seals and tags; with reduced motion only the gradient changes. Daily time-of-day variants per castle (never a sun before s10); endless day/night cycle every 5 waves; lost-chapter field variants | P1, P1-07 (skew API) | the rotation never re-bakes a strip (spy) | D13; the B3 sky set reaches ≥ 7 combinations; no sun or gold sky in any s1–s9 or daily still |
| **P2-10** Weather set · M | `render/weather/{weather,rain,ash,fog,blizzard}.ts` (takes over `weather.ts` from P1-10 and `fog.ts` from P1-21), tests | rain (slanted ink, 200/70, puddle ripples, splash), ash (rising, embers, roofs darken at wave boundaries), fog (3 cached bands), blizzard; all read `w.weather` | P1-10 | particle caps; low tier has no composites | B4 per weather clip |
| **P2-11** Night map and canopy · M | `render/light/nightmap.ts`, tests | quarter-resolution light map drawn from the sim `w.vis` grid (fake grid in tests until P3-06 merges); lantern pools; unseen enemies drawn only as dim silhouettes when vis = 0; forest canopy shading | P1-10 | reads `w.vis` only; never writes | `s7-w2` night still: lantern circles read; render-isolation passes |
| **P2-12** Accessibility render modes · S | `render/access/{bright,colorblind,gore}.ts`, tests | bright mode (paper up, outline +0.5 px, dark cap 0.25), gamma, colour-blind enemy outline patterns per faction, gore-reduced decals and particles, optional corpse fade at 40 s | P1 | colour-blind sim check script | U4 on protan/deutan/tritan simulations of `s6-w4` and `s9-w4` |
| **P2-13** Atlas budget for big casts · M | `render/sprites/budget.ts`, `scripts/perf/budget.cjs`, tests | per-stage kind manifest; s10 (31 kinds) LOD plan ≈ 14.6 MB LOD2 + 3.6 MB LOD1; release between battles; low tier: LOD1 in 2 mood sets with at most 2 in memory (bible §8.10) | P1-01 | budget unit test for every stage, both tiers, including the mood sets | D11: s10 high ≤ 40 MB, low ≤ 10 MB |
| **P2-14** Map review pack · S | `scripts/checks/{thumbs,grayscale}.cjs`, `scripts/shots/stages.cjs` | the 10-castle 25% **grayscale** thumbnail sheet (layout silhouette and value masses only, no hue); grayscale faction sheet; per-castle deploy and mid-battle stills; the path-bend measurement per castle | P2-05 … P2-09 (runs as they land) | — | P1 (grayscale thumbnails, tester panel 4 of 5 per castle; a castle that fails goes back to its P3 layout WP, bible §6.5) and M2 |
| **P2-16** New kinds and allied-band looks · M | `render/rigs/{levies2,allyband}.ts`, `tests/render/rigs-new.test.ts`, `artifacts/P2-16/` | rigs for `h_pike` (long pike, braced stance) and `h_bigshield` (tower shield, shuffle 4) for the counter-bands (P3-18); `h_spy` (hood, fire-arrow draw, hide crouch) for the truce night (P3-09); the drunk-militia overlay on `d_militia` (sway idle, unordered shot); the allied-band overlay (bible §7.4): own faction pigment plus the **white band**, a small alliance flag over the band, ghost silhouette in own pigment with one white stripe | P1-02, P1-03, P2-01 | allied-band frames contain the white-band stripe for every faction rig | grayscale: allied orcs vs enemy orcs separable by band (tester panel 4 of 5); pike and big-shield silhouettes distinct from `h_levy` |
| **P2-15** Integration and stage-wide perf · serial, M | `render/renderer.ts`, `render/perf/tiers.ts`, `render/looks/index.ts` | registry wiring; bench every stage at its densest wave, ×4, both tiers, with the cut table | all P2 | `accept:p2` | A1–A5 and A9 hold on all 10 stages; B3 ≥ 7 sky combinations; D13; P1 and M2 pass; the tester panel's P2 session |

---

## P3 — New battle types in the sim (deterministic, tested, bot-balanced)

**Goal.** The nine new battle types from bible §7.2, the castle-specific devices (s2 reeds, s8 forge), the layout changes of bible §6.5, allied AI bands, the counter-band kinds, enemy adaptation, night decisions and the daily/endless rotation. Every WP adds:
- vitest tests: win/loss unit tests, a determinism hash and a resume hash.
- a balance-bot run.
- for a WP that owns a castle: the `BUILDING` tiles of its courtyard (bible §6.5), a 20-seed check that hand-placed props and buildings do not overlap the seeded terrain patches, and the castle's on-screen maximum from bible §6.2 (bands added until the target is reached, then re-balanced with the bot; D5 ≥ 90% of the target).

It never rebuilds what P0-03's diff table lists as present (`liftSiege` hard cap, `gateShut`, `Unit.crew`, `escortIdx`, `DRAGON_FLEE_HP`, `DRAGON_PAIN_MAX`). Runs in parallel with P2.

**Order.** `P3-00` serial (three merges) → `P3-01 … P3-13`, `P3-15 … P3-18` parallel → `P3-14` serial integration. `P3-SK` runs throughout. Inside the parallel batch: P3-18 before P3-11; P3-03 before P3-04; P3-07 before P3-05; P3-01 before P3-16; P3-02 before P3-15.

### P3-00 · Sim seams, round 2 — *serial, L (three merges of ≤ 2 days, each in its own announced quiet window)*
- **Owns**: `src/sim/world.ts`, `src/sim/grid.ts`, `src/sim/defs.ts`, `src/sim/council.ts` (becomes a shim), `src/sim/input.ts`, `src/sim/systems/*.ts` (created by extraction or as stubs), `src/sim/modes/types.ts` (adds composition: a stage can run `[dawn, sortie]`), `src/ui/resume.ts` (one edit, merge 2), `scripts/balance/**` (framework; `scripts/balance.ts` becomes a shim), `tests/golden/*` (must stay identical), `tests/sim/{input,tiles,tilefire}.test.ts`.
- **Merge 1 · extraction** (zero behaviour change):
  - The ladder, ram, sapper, flyer, gate, projectile and fire logic moves out of `world.ts` into `systems/*.ts`.
  - **The night-decision code** (`councilOptions`/`chooseCouncil` and their effects, today inside `world.ts`) moves into `systems/decisions.ts`; `council.ts` re-exports it. The move is agreed with the balance engineer in P0-03 because their work touches the same code.
  - A civilian-unit API stub (`systems/civ.ts`).
- **Merge 2 · generic input channel** (bible §7.1-8):
  - `w.input(kind, payload)` in `sim/input.ts`. A mode registers its input kinds and validators in its own file (`modes/<id>.ts` `inputs`); the registry is filled from the mode registry, so no later WP edits `input.ts`.
  - `ui/resume.ts` records the existing `COMMAND_METHODS` (`placeSquad` … `chooseCouncil`) **plus `input`**, and nothing else. This is the only P3-00 edit to `resume.ts`; P3-12 owns the file afterwards.
- **Merge 3 · tiles, fire, kinds, allies**:
  - New tiles in `defs.ts`: `REED`, `FOREST`, `MARSH`, `BUILDING`, each with path cost, ladder allowed, sight value and flammability. No existing stage uses them yet, so goldens stay identical; each castle's WP places them.
  - The existing fire logic generalised into a **tile fire grid** (`systems/tilefire.ts`): reeds, forest and roofs burn by one rule (neighbour spread chance from `w.weather.windX/windY` and `fireMul`, sim RNG).
  - New kinds in `defs.ts` with stats read from files owned by their WPs: `h_pike`, `h_bigshield` (`sim/kinds/counter.ts`, P3-18), `h_spy` (`sim/kinds/spy.ts`, P3-09); a `unruly` flag on `Unit` for the drunk militia. None spawn until their WP adds them to a wave.
  - Allied-band plumbing: `side: 'ally'` and `band.ai: 'ally'` fields, stub `systems/allies.ts` (P3-17).
  - Stubs `systems/{reeds,forge}.ts` (P3-15, P3-16).
  - **Gates keep today's rule.** The `gateShut` behaviour (bar the gate when enemies come near; a barred gate blocks allies too) is not changed. `systems/gates.ts` only adds the explicit open/close API used by `sortie` and `escort` (P3-01, P3-03).
  - The balance framework: per-mode bots (`idle`, `default`, `mode-aware`), 20 seeds, JSON report into `artifacts/<WP>/balance.json`, ≤ 3 s per seed.
- **Tests**: all goldens identical after each merge; `world.ts` is reduced by ≥ 1,000 lines; a recorded `w.input` replays to the same hash through `resume.ts`; tile path cost, ladder and sight tables; tile fire spread is deterministic and follows the wind on a synthetic grid.

### P3-SK · Seam keeper, P3 — *standing*
- **Owns** (from P3-00 until P3-14 starts): `sim/world.ts`, `sim/grid.ts`, `sim/defs.ts`, `sim/systems/{tilefire,projectiles}.ts`, `sim/modes/index.ts`, `sim/stages/index.ts`, the P3 rows of `docs/wp/shared.json`. P3-14 takes the two registries for integration.
- **Delivers**: seam requests within 2 working days (for example a new path-cost hook for `MARSH`); daily `check-owned.mjs`; hands `world.ts` back to the frozen state at P3-14.

### P3 parallel WPs

| WP | Owns | Rules (bible §6.2, §6.5, §7.2, §7.4) | Tests (vitest) | Balance-bot acceptance |
|---|---|---|---|---|
| **P3-01** Sortie · M | `sim/systems/gates.ts` (open/close API body), `sim/modes/sortie.ts`, `tests/modes/sortie.test.ts` | explicit gate open/close input (3 s) through `w.input`; sortie squad out and back; enemies retarget an open gate; objective hook "burn all trebuchets" used by s8 (P3-16) and the s6 optional objective (P3-10); stars for 0 knights lost and no entry while open | open gate admits enemies; a barred gate still blocks allies (today's rule); return path; determinism and resume, on a test-only stage built from the s8 grid | the mode-aware bot beats the default bot by ≥ 15 points of win rate; the idle bot gets 0 three-star wins |
| **P3-02** Escalade · S | `sim/systems/ladders.ts`, `sim/modes/escalade.ts`, tests | ladder shove: 2.5 s of work when the top segment is clear; climbers −40% hp and down; re-plant 8 s; star for ladders shoved ≥ N | shove timing; interruption; climbers fall | on a test-only stage: the shove bot beats the default bot; ladders shoved per battle 4–12 on normal |
| **P3-03** Escort and carts · M | `sim/systems/civ.ts`, `sim/modes/escort.ts`, `sim/stages/{lost,side}.ts`, tests, `det-lost.json` | civilian units follow a path; scatter for 2 s if an enemy is within 4 tiles (sim RNG); the gate must be opened through the P3-01 API to admit them; cart variant with hp and supply credit; win with N entered; civilians that die leave no corpse sprite (a count only, bible §10.5) | scatter determinism; gate dependency; supply credit | lost chapters are winnable by the default bot ≥ 60% on normal |
| **P3-04** Bridge cut · M | `sim/modes/bridge.ts`, `sim/stages/s3.ts`, tests, `det-s3.json` | **layout** (bible §6.5): a shallow ford downstream to the south and the bridge road meeting the west gate, with the bridge gatehouse on `BUILDING` tiles in the west-gate position; engineer charge (8 s); one-shot irreversible cut input; BRIDGE → WATER; units fall; refugees (P3-03 `civ`) cross the bridge; reroute to the southern ford; counts of enemies and our people on the bridge are logged | tile change; fall resolution; reroute through the ford; the input is recorded for resume | the cut-timing bot shows a measurable optimum (win rate peak vs timing curve); P2 path bend ≥ 2 tiles after the cut |
| **P3-05** Mines · M | `sim/systems/sappers.ts`, `sim/modes/mines.ts`, `sim/stages/s4.ts`, tests, `det-s4.json` | tunnel target and progress; `rumble` fx every 4 s; countermine 6 s by engineers; completion → RUBBLE and sappers emerge inside; outer-wall loss → the inner wall **by composing P3-07's `fallback`** (no second retreat rule); debt-accepted variant ends after wave 3 | rumble cadence; countermine; collapse; composition with `fallback` | the countermine bot beats the default bot by ≥ 10 points |
| **P3-06** Darkness · M | `sim/vis.ts`, `sim/modes/dark.ts`, `sim/stages/{s5,s7}.ts`, tests, `det-s5.json`, `det-s7.json` | `w.vis` 60×34 light 0–3 recomputed only on wave boundaries and light changes; ranged can target only lit or within-3-tile enemies; `FOREST` canopy hides `kite` units unless light ≥ 2; lanterns ≤ 6 (input); bell −8 morale in 6 tiles, 40 s cooldown; fire arrows light 12 s; forest-burn input (s5) through the tile fire grid. **s7 layout**: one 2-tile causeway is the only way to the castle, the rest `MARSH` (slow, no ladders). **s5**: the living birch half on `FOREST` tiles | vis recompute cost ≤ 0.2 ms; targeting rule; recorded inputs; no path to the s7 wall except the causeway | the lantern bot beats the default bot by ≥ 10 points at s7 |
| **P3-07** Fallback · L | `sim/zones.ts`, `sim/modes/fallback.ts`, `sim/stages/s10.ts`, tests, `det-s10.json` | the only inner-retreat rule (used by s4 and s10): outer and inner zones; "to the inner keep" input; inner gate closes after 20 s or when an enemy is within 3 tiles; units left outside are trapped; abandoned outer zone reroutes enemies; composes with `dawn`. **s10 layout**: two rings (outer and inner, three gates each), east cliff, no sea tiles; s10 allied bands come from P3-17 through campaign inputs | trapped units; closing triggers; composition with `dawn` and with allied bands | the retreat-timing bot shows an optimum; s10 is winnable ≥ 50% by the mode-aware bot on normal; s10 peak ≥ 225 drawn units (target 250) |
| **P3-08** Dragon night · L | `sim/systems/flyers.ts`, `sim/modes/dragon.ts`, `sim/stages/s9.ts`, tests, `det-s9.json` | **s9 layout**: the jagged crown wall line and the 2×2 library tower on `BUILDING` tiles; library hp; roof fire through the tile fire grid with wind and weather; bucket chain scales with assigned people; ballista aim-point input; the dragon leaves only through the existing `DRAGON_FLEE_HP` or `DRAGON_PAIN_MAX` (ballista and volley hits accumulate pain); **`DRAGON_MAX_STAY` is removed**; the dawn rule is the last safety net; built on top of the balance engineer's damage-based retreat; 2 s landing warning | fire spread determinism; bucket effect; no timer-based leave remains (grep test for `DRAGON_MAX_STAY`) | the dragon is driven off or slain in ≥ 70% of mode-aware runs; the library survives in 30–60% (a meaningful choice) |
| **P3-09** Truce night · M | `sim/modes/truce.ts`, `sim/stages/s7truce.ts`, `sim/kinds/spy.ts`, tests, `det-s7truce.json` | auto-fire off; three seeded provocations: a Concord spy `h_spy` (fire arrows from the north, hides; find and kill), the drunk militia (`d_militia` with `unruly`: fires without orders unless tapped), and the Horde family column crossing the causeway on a non-hostile path; a break converts to `dark` mode with Horde morale +20 | conversion; provocation timing; spy hide and reveal; the unruly shot and its tap cancel; recorded restrain inputs | the attentive bot keeps the truce ≥ 80%; the idle bot breaks it ≥ 80% |
| **P3-10** Night decisions and dawn castles · M | `sim/systems/decisions.ts`, `sim/council.ts` (shim), `sim/stages/{s1,s6}.ts` (s1 from P1-21, s6 from P1-11), tests, `det-s1.json`, `det-s6.json` | the extracted night-decision code becomes the three decision slips (people, castle, enemy, bible §5.5) with exact effects; the s2 reed-burn slip is registered by P3-15; s6 optional sortie objective (composes `sortie`); changes agreed with the balance engineer (P0-03) | each option's numeric effect; input recorded; resume | no option is dominant: each is chosen best by the bot in ≥ 15% of seeds |
| **P3-11** Enemy adaptation · M | `sim/adapt.ts`, `sim/bands_adapt.ts`, `sim/systems/rams.ts`, tests | last decisive tactic → one announced counter-band per battle (wet-hide ram −50% fire, `h_bigshield` levies, double ladders, `h_pike` band, javelin band from the existing `o_spear`); ram crew swap on the existing `Unit.crew`; inputs flow via `stages/inputs.ts` | each counter's effect; announcement data present; determinism | the counter reduces the targeted tactic's kill share by 25–50% without dropping the default bot's win rate below 45% |
| **P3-12** Daily and endless rotation · M | `sim/stages/{daily,endless}.ts`, `src/ui/resume.ts` (after P3-00's edit), `tests/resume.test.ts` additions, `det-daily.json`, `det-endless.json` | daily: date seed → castle × modifier × compatible mode; endless: retreat to the next castle every 10 waves carrying survivors and supplies (new `World` per segment, seed + segment index), day/night every 5 waves, pages as the score; resume stores `w.input` records per segment | segment hand-off determinism; resume across a segment boundary | T7: 3 consecutive dailies and an endless run of 25 waves produce 3 different castles or times |
| **P3-13** Mode visuals (render companion) · M | `render/modes/{bridge,lanterns,rumble,roofs,gates,civ,tilefire,forge}.ts`, tests | bridge collapse frames and splash; lantern props; rumble ground shake and water-bowl ripple; fire sprites on any burning tile (reeds, forest, roofs) read from the tile fire grid; forge glow; gate open/close frames; civilian columns via civ rigs; civilians vanish in spray, never as corpses. Depends on P2-06 frames and the P3 fx kinds | reads only frozen view fields | render-isolation passes for every mode scene |
| **P3-15** s2 reeds · M | `sim/systems/reeds.ts`, `sim/stages/s2.ts`, tests, `det-s2.json` | **layout**: a `REED` band across the west field and the earth fort's wall line curving along the hill; ladder crews inside reeds cannot be targeted from more than 2 tiles; the reed-burn night decision (registered in P3-10's slips) sets the band alight through the tile fire grid with the wind; composes `escalade` | hide rule; burn spread with wind; composition | the reed-burn choice changes the default bot's ladder losses by ≥ 20%; neither choice wins ≥ 85% of seeds |
| **P3-16** s8 forge and sortie · M | `sim/systems/forge.ts`, `sim/stages/s8.ts`, tests, `det-s8.json` | forge heat: an engineer next to the forge `BUILDING` repairs ×1.5 and adds 40 arrows per wave; composes `sortie` with the objective "burn all trebuchets" (3, or 4 after a truce) | repair and arrow effect; composition | the mode-aware bot beats the default bot by ≥ 15 points; the forge is worth guarding (bot with forge ≥ 10 points above without) |
| **P3-17** Allied AI bands · M | `sim/systems/allies.ts`, tests | bands the player does not command (`side: 'ally'`, `band.ai: 'ally'`): the enemy band AI with the target "nearest threatened gate"; same morale and rout rules; not in the squad tags; at most 3 of each kind (bible §4.1); spawned in s10 and wherever the campaign inputs grant them (P4-04) | ally targeting; rout; determinism with and without allies | with 3 allied bands, s10 win rate rises 10–25 points for the default bot (help, not a carry) |
| **P3-18** Counter-band kinds · S | `sim/kinds/counter.ts`, tests | stats for `h_pike` (long reach, bonus vs mounted) and `h_bigshield` (front arrow damage −60%, slow); no spawn outside the counter-bands of P3-11 | each kind's stat effect in a duel test | `h_pike` cuts the knight charge's kill share by 25–50%; `h_bigshield` cuts archer kill share by 25–50% |
| **P3-14** Integration and debug verbs · serial, S | `src/ui/battle.ts`, `src/ui/debug/modes.ts`, `sim/modes/index.ts`, `sim/stages/index.ts` | registry wiring; a dev-only verb panel to play every mode before the P6 HUD exists; `accept:p3` runs all mode suites and bots. Depends on all P3 | full suite | T1 (≥ 6 distinct pressures in the first 10 s of the 10 castles), T2, T4, T5, T6; D5 for every castle; all goldens stable on 2 consecutive CI runs |

---

## P4 — Story system and content

**Goal.** The full reactive chronicle from bible §4–5:
- 34 triggers, letters, memory, veterans, epithets, scars and the narrator change.
- "첫 기록" (first record) and "다시 읽기" (replay) kept apart (bible §4.4), with one chapter = one night.
- Story that survives resume, input replay and 3–4× speed (bible §5.11).
- The battle print from an event snapshot.
- About 900 human-written lines (bible §5.9): about 750 in Yeoul's voice and common, about 140 Garam variants. About 60 of them already exist from P1-22.

**Writer.** The owner by default (P0-04), 60 lines a week from P1 week 1, so about 15 weeks of writing overlap P1–P4; the content WPs below are the writer's queue, wired and tested by an engineer or agent. With an outside writer the same WPs apply and the owner signs.

Runs in parallel with P5 and P6.

**Order.** `P4-01` serial (save schema) → `P4-02 … P4-14` parallel. Content WPs (`P4-09 … P4-14`) start once P4-02 and P4-03 have merged their APIs (the writing itself started in P1). `P4-SK` runs throughout. P7-00 integrates.

| WP | Owns | Delivers | Tests | Acceptance |
|---|---|---|---|---|
| **P4-01** Save v3 · serial, M | `src/meta/save.ts`, `tests/meta/save-v3.test.ts` | `SAVE_VERSION = 3` with a migration from v2: `chronicle` (bible §5.10: castle states including `unwritten`, choices, heroes, veterans ≤ 160, epithets, banners, `lastTactic`, `seen`, log ≤ 200, prints index ≤ 200 with no auto-delete); **`Soldier.name?: number`** (the name-pool index; the migration gives every existing soldier a unique name in save-seed order, P1-15's rule); `equipped.binding`; settings `bright`, `gamma`, `gore`, `cbAssist`, `cameraNudge`; the **save-file export** format (one file: JSON plus the print images) and the short text save code, which lists print ids only | v2 → v3 migration on 6 fixture saves; 0 duplicate names after migration; round-trip; JSON size ≤ 64 KB for a full campaign; an export with 200 prints re-imports byte-identical | no other WP in P4–P6 edits `save.ts` |
| **P4-02** Korean toolkit and copy lint · M | `src/story/korean.ts` (from P1-15), `scripts/lint-ko.ts`, `scripts/lint-bible.ts`, `tests/story/korean.test.ts`, build hook `scripts/check-draft.mjs` | the **counter table** (bible §8.16): 명·마리·발·째 in native numerals up to 99, 초·분·년·쪽 and large numbers in Arabic numerals, with `{n:명}`, `{n:째}`, `{n:수}` and friends; ordinals; josa wrappers; quoting rules; the lint bans the 'A가 아니라 B' pattern, double passives, "~하는 것이다" endings and 3+ repeats of a sentence frame per screen; `lint-bible.ts` runs the same lint on every sample line quoted in the design bible and lists the hits for the writer (the samples are drafts; the list is not a build gate); a release build fails on any `draft: true` | exhaustive 600-name pool × template test; every counter on 0–120; lint fixtures | S6 machine half passes on all line files |
| **P4-03** Story engine, complete · M | `src/story/{engine,triggers,replay}.ts`, `src/ui/hud/{chronline,barks}.ts`, `src/ui/battle/hooks/story.ts`, `src/ui/resume.ts` (the `story` field only, after P3-12) | all 34 triggers with exact conditions on `STORY_KINDS` and `ChronStats`; the priority queue; one bark at a time; the minimum gap; the 20 s idle summary; red-rubric limits; bark forbidden zones including the HUD protection rects; **display times in real time** (3.2 s bark, 6 s line, gaps and the idle summary use the wall clock at every speed; overflow drops the lowest priority); **replay fast-forward**: while `resume.ts` replays inputs from step 0 the engine advances its state (cooldowns, once-flags, queue) silently and emits nothing; the resume record stores `story: { seen, cooldowns, onceFired, lastLineT }`, and the stored state wins if the rebuilt one differs | trigger fixtures from synthetic chronlogs; no repeats; cooldown; a replay of a 600 s battle emits 0 lines and rebuilds a state equal to the stored one; bark on-screen time 3.2 s ± 1 frame at 1×, 3× and 4× | S2 on clips of every mode |
| **P4-04** Campaign graph, first record and replay · M | `src/story/campaign.ts`, `src/sim/stages/inputs.ts` | 7 books and 10 chapters, **one chapter = one night**; the 6 choices, offered and decided only in a chapter's first record; outcome effects (allied bands at s10 through P3-17, extra enemy bands, narrator, Hanmoe states, s8 faction lines); lost chapter and retake states; **replay rules** (bible §4.4): no branch choices, no hero death or narrator change (a wiped Hanmoe squad counts as "wounded and evacuated"), no scars, map hatching or beacons, margin notes instead of body text, the "다시 읽음" stamp; daily, endless, side volume and sweeps are all replays | every branch path reachable; s10 inputs are capped at 3/3; determinism of the generated stage; a replay changes no `chronicle` field except `log` and the margin notes | the branch table in bible §4.3 and the first-record/replay table in §4.4 are fully covered by tests |
| **P4-05** Memory, veterans, epithets, scars, progression · M | `src/story/{memory,veterans,epithets,scars}.ts`, `src/meta/progression.ts` | veterans after 3 battles with their pool names; **8 epithets, each in two human-written forms** (attributive before a squad name, title form alone; bible §5.10); banners of wiped squads; castle scars only from first records; obituary composer with a 30% deed tail. In `progression.ts`: squad unlocks move from "cleared" to "chapter's first record finished, win or lose"; sweeps stay as they are and leave no record; **the daily-note reward gains the 은전 removed from the free pass track** (P6-08), so the free economy total stays the same | rule fixtures; cap at 160 veterans; every attributive form × every squad name and every title form × josa passes `lint-ko`; unlock after a lost first record; free 은전 over a simulated 30 days within ±5% of today's total (run together with P6-08) | S3 and S4 on fixture campaigns |
| **P4-06** Letters and enemy voices · M | `src/story/letters.ts`, `src/ui/components/letter.ts` | letter picker (most painful record first), faction voice rules, the Sylvan "maybe lying" flag on the story RNG, the arrow-letter drop moment; the priest addresses the warden when speaking of deeds and the chronicler when speaking of the book (bible §5.3) | picker priority fixtures | S5 (6 faction voices distinct by register and length) |
| **P4-07** Battle print · M | `src/render/print/{snapshot,printer}.ts`, `src/meta/prints.ts`, `src/ui/screens/printview.ts` | **the event is printed, not the screen** (bible §5.8): when a decisive moment beats the current best, the renderer records a scene snapshot around the event coordinates (a fixed 400×185 world px area: about 300 draw-list entries of sheet key, position, frame and pigment, plus a copy of that ground region), ≤ 0.5 ms, no readback in battle; on the results screen a Worker redraws it at a fixed zoom of 1.6 and prints it (desaturate except living allies at 30%, 4-level posterise, directional hatch, paper grain, cinnabar blood and names, seal, title signature); stored as a **posterised PNG-8 (16 colours) or lossless WebP**, whichever is smaller (no JPEG); the size target is set from measurement (provisional ≤ 40 KB); **200 stored free for everyone**, no auto-delete (the player chooses what to remove), no paid storage; included in the save-file export (P4-01) | the snapshot never adds a frame > 20 ms; deterministic print for a fixed snapshot; the event lies in the middle third even when the camera looked elsewhere | D12 |
| **P4-08** Narrator change · S | `src/story/narrator.ts`, `src/ui/paper/hand.ts`, `src/ui/fonts.ts` (second-font slot, from P1-17), `public/fonts/garam-hand.*`, `scripts/fonts/garam.md` | the Yeoul/Garam switch; Garam's lines in an **OFL 1.1 Korean handwriting font** (candidates in bible §8.16): the distribution's `OFL.txt` and copyright line checked by a person and shipped, the subset renamed if the font has a Reserved Font Name, subset to the characters of Garam's lines and the name pool (≤ 300 KB; both fonts ≤ 1.9 MB), precached by `sw.js` through a P4-SK seam request; thin brown ink `#4A3A2E` with bleeding stroke ends, rougher paper (fibre density ×1.6), leading 1.4, twice the red rubric; a wounded-hand jitter variant. If the licence cannot be verified, the font is not used: only Garam's signature and heading are brush-drawn and the change is carried by ink and paper | the subset covers every character in `lines/garam.ts` (scanner); licence file present | bible §12.4 scene reproducible from a fixture save and visibly different on a 6-inch phone (tester panel, 4 of 5) |
| **P4-09** Content: books 1–2 (s1–s3) · M | `src/story/lines/{s1,s2,s3}.ts` (s1 from P1-22), `src/story/places/{s1,s2,s3}.ts` | about 70 lines: briefings, castle-specific barks and lines (자갈목 at s1), the three outcome paragraphs, the reed and bridge choice texts | lint, josa, counters, no draft | the writer signs; the editor's pass is in P7-05 |
| **P4-10** Content: books 3–4 (s4–s5) · M | `lines/{s4,s5}.ts`, `places/{s4,s5}.ts` | about 46 lines: debt and Hanmoe choices; Urda and Elares voices | same | same |
| **P4-11** Content: book 5 (s6 full, s7 + truce) · M | `lines/{s6,s7}.ts` (s6 from P1-22), `places/s7.ts` | about 50 new lines: the rest of the s6 script, the s7 night, the truce night script | same | same |
| **P4-12** Content: books 6–7 (s8–s10) + Garam variants · L | `lines/{s8,s9,s10}.ts`, `places/{s8,s9,s10}.ts`, `lines/garam.ts` | about 70 lines for s8–s10 (the library fire, the priest quoting the player, the s10 roll call of kept and lost castles); about 140 Garam variants (briefings 10, castle lines 24, common trigger lines about 95, outcomes 12) | same | same |
| **P4-13** Content: letters, common lines, extra books · L | `src/story/lines/{common,letters,extra}.ts` (common from P1-22) | 36 letters (6 factions × 6 situations); the common trigger lines by frequency class (8, 4 and 2 variants; about 237 in total, about 37 already from P1-22); lost chapters and side-volume margin battles (60); endless page headings (40) | same; variant counts per trigger match the frequency table | the line budget in bible §5.9 is met (counts by script) |
| **P4-14** Content: market rumours and Dodam · M | `src/story/lines/{rumors,dodam}.ts` | the daily market rumour: 40 human-written first halves + 40 second halves written so that any pair reads correctly (1,600 combinations) + 20 whole lines; about 30 lines for the lieutenant Dodam when he stands in for Hanmoe | every first half × every second half passes `lint-ko` and the josa test (all 1,600 pairs) | the writer signs; same budget check |

### P4-SK · Seam keeper, P4 — *standing*
- **Owns**: `story/lines/index.ts`, `story/types.ts`, the P4 rows of `docs/wp/shared.json` (including `public/sw.js` for the Garam font precache).
- **Delivers**: seam requests within 2 working days; daily `check-owned.mjs`.

---

## P5 — Audio (WebAudio synthesis only)

Runs in parallel with P4 and P6. All files live under `src/audio/**`, except the hook in `src/ui/battle/hooks/audio.ts` and the shim `src/ui/audio.ts`. `P5-SK` keeps `audio/types.ts` and the P5 rows of the shared manifest.

| WP | Owns | Delivers | Tests | Acceptance |
|---|---|---|---|---|
| **P5-01** Engine, voice pool, space · M | `audio/{engine,voices,pan}.ts`, `src/ui/audio.ts` (becomes a shim), `src/ui/battle/hooks/audio.ts` | node pools; ≤ 24 voices with lowest-gain stealing; ±5–10% pitch/gain variation; stereo pan from screen x; off-screen pre-announce; low tier without reverb | `OfflineAudioContext` renders: voice cap holds; pan sign matches x | A2, A3 |
| **P5-02** Faction grammar and combat events · M | `audio/{grammar,events}.ts` | the 7 approach voices (bible §9.1); event sounds (§9.2) mapped from fx kinds and chronlog | spectral-centroid tests separate the 6 faction cues | A4 (blind listening test with the tester panel: 4 of 5 identify ≥ 5 of 6) |
| **P5-03** Music · M | `audio/music.ts`, `audio/opening.ts` (from P1-21) | per-castle drone root; drum layers driven by enemies near the gate; mode from average morale; rout drops a layer; rally rings the bell; dragon shift; pause = quietest; dawn resolution (blue dawn in s1–s9, the full resolution only under the s10 sunrise); the s1 fog-lift drum entry kept | state-machine tests on synthetic inputs | A5 (music half) |
| **P5-04** Ambience and weather beds · S | `audio/ambience.ts`, `audio/beds/*.ts` | 10 castle beds; weather filters (snow low-pass muffling, rain hiss, blizzard gusts); smithy hammer synced with the folk animation event | — | A5 (ambience half) |
| **P5-05** UI sounds · S | `audio/ui.ts` | select, command, cancel, invalid, seal, page turn and count-up tick (bible §9.3) | the four core UI sounds are distinct by centroid and length | A1 |
| **P5-06** Audio check harness · S | `scripts/checks/audio.cjs` | renders each cue offline with Playwright and writes spectra and loudness to `artifacts/P5/` | — | loudness of all cues within a 12 LU window; no clipping |

---

## P6 — UI reskin of every screen

Runs in parallel with P4 and P5. `src/ui/app.ts` (router) is frozen after P1-00c. Each screen WP owns its screen file and its CSS file. `P6-SK` keeps the screen router list, `ui/styles/base.css` imports and the P6 rows of the shared manifest (`src/ui/shop.css`, `src/ui/preview.ts`, `src/ui/orders.ts`).

| WP | Owns | Delivers | Tests | Acceptance |
|---|---|---|---|---|
| **P6-01** Paper, frames, full icon set · M | `ui/paper/{paper,frame}.ts`, `ui/icons/{ink,set,stub}.ts`, `ui/styles/base.css`, `scripts/icons.mjs` | all 44 icons (bible §8.17) from one brush, replacing every remaining `icon()` stub drawing from P1-00c (the screen files already call `icon()`, so none of them needs editing); PWA and app icons generated by the same code; the button press motion (98% scale, shadow shift) | icon sheet snapshot; **no emoji or OS glyph anywhere in `src/**`** (the full-scope regex test starts here); no stub box drawn on any screen | U3 |
| **P6-02** Campaign map · L | `ui/screens/map.ts`, `ui/map/{draw,labels,beacons}.ts`, `ui/styles/map.css` | woodcut map: ridge hatching, forest masses, river hatching; ribbon cartouches with a label placer (routes break before labels); 4 castle states; beacons; "잃은 이 N"; hatching and beacons change only from first records (bible §4.4) | label solver: 0 overlaps at 3 viewport sizes | P6 |
| **P6-03** Briefing, deploy, night decisions · M | `ui/screens/briefing.ts`, `ui/prebattle.ts` (from P1-16), `ui/components/decisions.ts`, `ui/styles/briefing.css` | adds letters, footprints preview and decision slips (the three night decisions and the s2 reed-burn slip) to the P1 briefing; the 은전 supply ledger stays the only place with money; 0 paid currency, pass, discount, timer or shop link | DOM test with the **paid** selectors (훈장, pass, sale, timer, shop route) = 0 on the path, and `[data-currency=silver]` only inside `.supply-ledger` | S1, D8 |
| **P6-04** HUD mode verbs · M | `ui/hud/modes/*.ts`, `ui/styles/hud-modes.css` | gate open/close and return flag (sortie), lantern placement, bell, bridge cut seal, countermine order, retreat-to-keep seal, ballista aim drag, bucket-chain assignment, hold-fire, spy tap and militia tap (truce); every verb sends `w.input`; goal sentence per mode in the slip; verbs respect the protection rects and fold with the tags | layout at 800×360 and 740×360 with the busiest mode, both hands; always-on HUD ≤ 13.3% and with line and bark ≤ 19.5% | U1, U2, T1 (goal text differs per mode) |
| **P6-05** Cover, desk, first run · M | `ui/screens/{cover,desk}.ts`, `ui/firstrun.ts` (from P1-21), `ui/styles/{cover,desk}.css` | book cover with binding; desk scene with labelled objects; first run: cover → chapter-1 briefing → opening patrol (P1-21) → battle | first-run e2e: ≤ 3 taps, ≤ 1 modal | U7, F4 |
| **P6-06** Barracks and workshop · M | `ui/screens/{barracks,workshop}.ts`, css | leather ledger with one page per squad (emblem, epithet in its attributive form, veteran names in rubric, battles); hung-banners page; workshop tool board for research | — | U5 |
| **P6-07** Market, cosmetics, supporter products · L | `ui/screens/market.ts`, `src/meta/{cosmetics,shop,iap}.ts`, `src/render/cosmetic/preview.ts`, css | three stalls; "시험 인쇄" preview of every item at 1× in the real renderer (s6 west gate, two squads, dusk); woodcut names and looks (bible §10.2) and the dye table with the 2nd-edition values; new `binding` kind; gold leaf reserved for honour. **Supporter products** (bible §10.1): `supporter_small` and `supporter_large` stop selling and stay restorable; their 4 gold items (`ban_supporter` star, `dye_gold`, `castle_gilded`, `ban_patron`) keep their bought look in gold pigment without the shimmer, written down as the grandfathered exception; new products `supporter_small_v2` (`ban_supporter_v2`) and `supporter_large_v2` (`dye_ultramarine` 군청 근위, `castle_ochre`, `ban_patron_v2`) with new ids and no gold; the shared title ids stay; the old descriptions show only on the restore screen. The owner creates the two new store products and deactivates the two old ones in the store consoles. Medal-bought banners with gold cells (`ban_chevron`, `ban_star`) are drawn in 자황 and 호분. **Generators** (`seasonTheme`, weekly workshop): names only from human-written lists (≥ 24 season names, the title list, 52 weekly names, one more added each year; the build warns 6 months before a list runs out); colours only from the 24-colour woodcut pigment set that passes the palette check; no random hsl; past seasons keep ids, contents and names, and a past dye that fails the palette check moves to the nearest passing colour with its ΔE recorded. All copy generated from grant lists | copy-vs-grants test; the palette check (P1-01) over every dye, every past season colour and the pigment set; no gold in any grant of a product on sale; old products restorable, not purchasable; generator output for the next 24 seasons comes only from the lists | U8 (shop half); C-1 stays green |
| **P6-08** Chronicle book, side volume, pass rewards · M | `ui/screens/chronicle.ts`, `src/meta/season.ts`, css | volumes and chapters with prints (200 free, the player chooses what to remove), outcome paragraphs, lost chapters and margin notes from replays; side-volume (pass) tab last; story and rewards shown before any buy button. **The free track's 은전 steps become medals and story items** (print-frame patterns, bookmarks); the removed 은전 moves to the daily-note reward in P4-05 (merged together) | DOM order test; a reward-graph test: nothing reachable from a paid path (pass purchase, sweep) yields 은전, research or supply; the 30-day free 은전 total within ±5% (with P4-05) | U8 (chronicle half), S4 |
| **P6-09** Settings, help, licenses · S | `ui/screens/{settings,help}.ts`, css | bright mode, gamma, gore, motion, big text, left hand, colour-blind assist, camera nudge, quality tier; the save-file export and import (format from P4-01, prints included) and the short text code (print list only); help as a copybook with the unit print sheet; licenses incl. the Gowun Batang OFL notice and, if shipped, the Garam font's OFL notice | settings persist (via the P4-01 schema); export → import round trip in e2e | U4 |
| **P6-10** Results ledger for all modes · M | `ui/screens/ledger.ts`, `ui/styles/ledger.css` | mode-specific stats rows (bridge counts, refugees in, library state, truce kept); 은전 earned as one line; the "다시 읽음" stamp on replays; print slot filled by P4-07; sequential seals and count-ups | fixture per mode | S3, U6 |
| **P6-11** Motion and transitions · S | `ui/motion.ts`, `ui/styles/motion.css` | page-turn transitions, seal stamps, count-ups, star sequence; all honour `reduceMotion` | — | U6 (≥ 3 micro-animations) |

---

## P7 — Review round, performance and release

`P7-SK` keeps the shared files until P7-07 takes the release files.

| WP | Owns | Delivers | Acceptance |
|---|---|---|---|
| **P7-00** Integration freeze · serial, S | `src/ui/battle.ts`, `src/render/renderer.ts`, `src/ui/app.ts`, `src/ui/resume.ts` | merges P4–P6 hooks; resolves open seam requests; release-candidate branch | the full `accept:all` run is green |
| **P7-01** Full acceptance sweep · M | `scripts/accept/all.cjs`, `artifacts/P7-01/` | runs all 49 quality-bar items plus D1–D14 and F1–F4 across 10 castles, both tiers and the three viewports; the tester panel's last session; the owner rubric on the release candidate | every item passes or has an owner-approved waiver; owner rubric every item ≥ 3, mean ≥ 3.5 |
| **P7-02** Real-device performance · M | `src/render/perf/tiers.ts`, `artifacts/P7-02/` | measure on one mid-range and one low-end Android with the per-layer overlay; tune tier thresholds and the in-battle downgrade (cut order and the 20/12 ms thresholds) | M10 on the mid-range device: ≤ 2% frames > 33 ms in s10's densest wave and in `perf-250`; the low-end device holds 30 fps on the low tier; no bake during a downgrade |
| **P7-03** Memory and bake time · S | `src/render/sprites/budget.ts` | s10 cold start and the endless segment hand-off | ≤ 40 MB high, ≤ 10 MB low (with the mood atlases); first battle frame ≤ 1.6 s at ×4 on every castle |
| **P7-04** Accessibility audit · S | `artifacts/P7-04/` | colour-blind, bright mode, big text and left-hand passes on every screen | U1, U4 everywhere |
| **P7-05** Korean copy edit · M | line files (edit-only window; content WPs closed) | a human editor reads every line in context screenshots; renames from P7-08 applied here | S6; the owner signs off on the voice of the five main characters |
| **P7-06** Review round · M | `docs/review/round1.md` | three lenses (player, craft, feasibility) plus the owner play the release candidate; findings become fix WPs `P7-1x` with exclusive owners | no "must fix" left open |
| **P7-07** Release hardening and rating · S | `public/manifest.webmanifest`, `public/sw.js`, `capacitor.config.json`, `src/meta/legal.ts`, `src/ui/version.ts`, `docs/release/rating.md` | offline PWA (the font precache has existed since P1-17 and P4-08; here it is verified on a clean install), Capacitor build, store copy that matches the actual rewards and leads with the chronicle and the ink, version bump, licenses; **age rating** with the target 12+ (bible §10.5): the IARC questionnaire (Google Play), the App Store age questionnaire and the domestic self-rating procedure for GRAC 12, answered for the default settings | e2e on the PWA and Capacitor builds; U8; the rating answers recorded and consistent with the default gore setting and the civilian rule (deaths as numbers only) |
| **P7-08** Name and trademark search · S | `docs/release/names.md` | searches for the title, the faction names (딥홀드 first, marked provisional in the bible), the main character names and the castle names: the Korean trademark database (KIPRIS), the US and EU trademark databases, Google Play and the App Store, and a general web search; each name gets keep or rename with the reason; renames go to P7-05 | every listed name has a recorded result; a name with a live conflict in game or software classes is renamed before the store listing. This is a search, not legal advice; the owner takes any real conflict to counsel |

---

## Appendix A · Conflict matrix for hot files

| File | Owner by phase |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, existing `tests/*.test.ts`, `scripts/e2e.mjs` | P0-02 manifest → the seam keeper of each phase (P1-SK … P7-SK) |
| `public/sw.js` | P1-SK (font precache for P1-17) → P4-SK (Garam font for P4-08) → P7-07 |
| `src/sim/world.ts`, `grid.ts`, `defs.ts` | P1-00a (hooks) → P3-00 → P3-SK until P3-14 → frozen (mode logic lives in `modes/` and `systems/`; new kinds' stats in `sim/kinds/*`) |
| `src/sim/stages/sN.ts` | P1-00a split → P1-11 (s6), P1-21 (s1) → exactly one P3 WP per file: s1 and s6 P3-10 · s2 P3-15 · s3 P3-04 · s4 P3-05 · s5 and s7 P3-06 · s7truce P3-09 · s8 P3-16 · s9 P3-08 · s10 P3-07 · daily and endless P3-12 · lost and side P3-03 |
| night-decision code (`world.ts` today) → `src/sim/systems/decisions.ts`, `council.ts` | P3-00 (extraction, agreed with the balance engineer in P0-03) → P3-10 |
| `src/sim/input.ts`, `systems/tilefire.ts` | P3-00 → P3-SK |
| `src/sim/kinds/spy.ts`, `kinds/counter.ts` | P3-09, P3-18 |
| `src/ui/resume.ts` | current owner fixes the typecheck failure (P0-02 arranges it) → P3-00 (records `w.input`) → P3-12 (segments) → P4-03 (`story` field) → P7-00 |
| `src/ui/prebattle.ts` | P1-16 → P6-03 |
| `src/meta/progression.ts` | P4-05 only |
| `src/meta/save.ts` | P4-01 only |
| `src/meta/cosmetics.ts`, `shop.ts`, `iap.ts` | P6-07 |
| `src/meta/season.ts` | P6-08 |
| `src/render/renderer.ts` | P1-00b → P1-20 → P2-15 → P7-00 |
| `src/render/camera.ts`, `perf/cuts.ts` | P1-00b (stub API) → P1-20 |
| `src/render/looks/sN/*` | P1-06/07/10/12 (s6 split by concern), P1-21 (s1 draft), P1-18 (s7–s9 drafts) → one P2 WP per castle |
| `src/render/weather/fog.ts`, `ground/biomes/ford.ts` | P1-21 drafts → P2-10, P2-05 |
| `src/ui/battle.ts` | P1-00c → P1-20 → P3-14 → P7-00 (P4–P6 plug in via `battle/hooks/*`) |
| `src/ui/app.ts` | P1-00c → P7-00 |
| `src/ui/icons/set.ts` | P1-00c (stubs) → P1-13 (26 battle icons) → P6-01 (the rest) |
| `src/ui/fonts.ts` | P1-00c (stub) → P1-17 → P4-08 (second font) |
| `src/ui/firstrun.ts`, `audio/opening.ts` | P1-21 → P6-05, P5-03 |
| `src/ui/hud/*` | P1-13 (layout, slip, tags, chips, protect, seals); P1-21 (hints); P1-15 → P4-03 (chronline, barks); P6-04 (`hud/modes/*`) |
| `src/story/korean.ts` | P1-15 → P4-02 |
| `src/story/lines/{common,s1,s6}.ts` | P1-22 → P4-13, P4-09, P4-11 |
| `tests/golden/det-<stage>.json` | the WP that owns that stage's sim file |

## Appendix B · Critical path and calendar (two versions)

**Team version** (engineers plus agents, 4–6 worktrees at once):
- **P0**: 1 week.
- **P1**: about 5–6 weeks.
  - P1-00a, P1-00b and P1-00c: about 1 week (three quiet windows of ≤ 2 days).
  - The parallel batch: about 3 weeks. Its longest items are P1-13, P1-07, P1-02, P1-18 and P1-01. R-0 at the end of its week 2.
  - P1-20, the first panel session and R-1: about 1 week.
- **P2 ∥ P3**: about 5 weeks. P3-00 takes the first 1.5 weeks. The longest items are P2-02, P2-09, P3-07 and P3-08.
- **P4 ∥ P5 ∥ P6**: about 5 weeks. The writing began in P1 week 1, so the content WPs are mostly wiring and signing.
- **P7**: about 3 weeks.
- **Total**: about 19–20 weeks, roughly 4.5 months.

**Owner-solo version** (the owner with agents, 1–2 worktrees, every review by the owner):
- Every effort size is about 3× (§0), and the parallel phases mostly run one after another.
- **P0**: about 2 weeks. **P1**: about 15 weeks. **P2 ∥ P3**: about 14 weeks. **P4 ∥ P5 ∥ P6**: about 14 weeks. **P7**: about 8 weeks.
- **Total**: about 52–56 weeks, roughly 11–13 months.
- The writing (about 900 lines at 60 a week, about 15 weeks of an hour a day) runs alongside from P1 week 1 and finishes inside P3.
- If this is too long, the first deferrals that do not block the campaign are: the endless half of P3-12, the side-volume margin battles in P4-13 and the market rumours of P4-14 (the daily note then shows a fixed line).

## Appendix C · Work package index

P0: P0-01 … P0-04 (4) · P1: P1-00a, P1-00b, P1-00c, P1-01 … P1-22, P1-SK (26) · P2: P2-01 … P2-16, P2-SK (17) · P3: P3-00 … P3-18, P3-SK (20) · P4: P4-01 … P4-14, P4-SK (15) · P5: P5-01 … P5-06, P5-SK (7) · P6: P6-01 … P6-11, P6-SK (12) · P7: P7-00 … P7-08, P7-SK (10) — **111 work packages** (7 of them standing seam keepers), plus the `P7-1x` fix packages created by the review round.

New in the 2nd revision: P0-01 … P0-04, P1-00a/b/c (replacing P1-00), P1-21, P1-22, P2-16, P3-15 … P3-18, P4-14, P7-08 and the seven seam keepers.
