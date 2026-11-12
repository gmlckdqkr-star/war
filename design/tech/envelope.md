# 잿빛 성벽 — Technical Envelope for the Visual Overhaul

Author role: rendering/performance engineer. Status: measured on 2026-11-12 against a private copy of the repo (`design/tech/repo`, built with `vite build`; `tsc` currently fails on an unused field in `src/ui/resume.ts`, which another engineer owns).
Everything below is **measured** unless marked *(estimate)*. All raw data is in `design/tech/bench/*.json` and `design/tech/census.jsonl`, and the scripts can be rerun (see §9).

---

## 0. TL;DR

| Question | Answer (measured) |
|---|---|
| Biggest battles | Campaign peak **200 drawn units** (s7), s10 **195**, daily "swarm" on s10 **231**, endless **182** at wave 9 (wave 9 was as far as a maxed army got). The design point is 250 units; the stress point is 400. |
| Sim cost | Node unthrottled: 0.09–0.31 ms/step on average, p99 3.6 ms, max 12–20 ms (flow-field recompute is **4.9 ms** by itself). Browser at CPU ×4: **1.1–2.4 ms/step avg**, p95 2.3–6.1 ms. |
| Current render, main thread (JS) | CPU ×4: **2.0–2.8 ms/frame** with a software canvas and **3.0–5.4 ms** with a GPU canvas (~155 units). Unthrottled: 0.4–0.5 ms. |
| Current render, raster (software canvas) | CPU ×4 at DPR 2: **33–45 ms/frame**. 75 % of that is the two full-screen blits (terrain + decals, 29–39 ms). The natural loop runs at **13–20 fps** at ×4 on high and **31–36 fps** on low (DPR 1.25). Unthrottled it holds 60 fps. |
| Is the new look affordable? | Yes, on a GPU-backed canvas. A prototype frame (250 sprite units with LOD and y-sort, 130 projectiles, 400 particles, 11 banners, 20 decal stamps, dusk lighting, rain) costs **5.4 ms JS at ×4** (software canvas) or 6.1 ms p50 (SwiftShader-GPU canvas). The night version costs 4.9–8.1 ms. |
| Where it is not affordable | On a **software-canvas** phone (GPU blocklisted) at DPR 2, the full-screen composites cost too much: the high frame rasterizes in 56 ms at ×4. The low tier (DPR 1.25, mood baked into textures, no full-screen composites) rasterizes in **11–16 ms**, so 30 fps holds even there. |
| Sim changes needed | **No new Unit fields.** Animation state is derived by the renderer from existing fields (`x/px`, `fx/fy`, `cd`, `hitFlash`, `state`, `carrier`, `fleeing`). Two new *render-only fx kinds* (`die`, `land`) are recommended. |

**High-tier budget (main thread, CPU ×4): render ≤ 6.0 ms avg / 9 ms p95, sim ≤ 1.6 ms per step.** At 3× speed (1.5 steps/frame) that totals about 8.5 ms out of 16.7 ms.

---

## 1. Test rig and caveats

* Host: Intel Xeon @ 2.1 GHz, 4 vCPU, 16 GB. Playwright Chromium **153.0.8010.12** headless. Viewport **844×390 CSS, DPR 2, isMobile, touch**, giving a game canvas backing of **1688×780 (1.32 Mpx)**.
* Throttle: CDP `Emulation.setCPUThrottlingRate {rate:4}`. This slows the renderer process main thread. It is the usual "mid-range phone" proxy for JS.
* **Two canvas back-ends** were measured, because the default headless one is unrepresentative:
  * `sw`: the default. `chrome` reports `2d_canvas: unavailable_software`, so Skia rasterizes on the CPU. That makes this a **worst case** for phones whose GPU canvas is blocklisted. A forced readback of one pixel (`getImageData(0,0,1,1)`) after each frame makes raster time measurable.
  * `gpu`: run with `--enable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader --enable-gpu-rasterization --enable-accelerated-2d-canvas`, which reports `2d_canvas: enabled`. This is the **same code path a phone uses** (record on the main thread, raster in the GPU process), but the "GPU" is SwiftShader on the CPU and is not throttled. **Only main-thread JS numbers are meaningful in this mode.** Readbacks are disabled here: a readback stalls SwiftShader for seconds, and a 1024² palette swap that reads from a GPU canvas took 7.2 s. Headless SwiftShader also starves `requestAnimationFrame`, so natural-loop fps in gpu mode is **not** reported.
* Noise: repeated runs differ by ±20–40 % (for example, s10 render JS at ×4 measured 1.96 ms in one run and 2.83 ms in another). Ranges are given where runs differ. Averages and p50 are more trustworthy than max.
* GPU fill-rate on real phones is not measurable here. §6 uses an overdraw budget *(estimate)* instead.
* The renderer bug that hides infantry was fixed **in my private copy only** (`renderer.ts:810`: `key[0]==='#'` → `key==='#down'||key==='#big'`), so that the measurements include unit drawing. `dist-asis` (unfixed) was measured for comparison: its JS is about 0.7 ms lower at ×4 and its raster is the same.

---

## 2. Current renderer anatomy (src/render/renderer.ts, camera.ts)

### 2.1 Space, map, camera

| Item | Value |
|---|---|
| Tile | `TILE = 16` world px |
| Map | **60×34 tiles = 960×544 world px**, the same for every stage, daily and endless |
| Sim step | fixed `DT = 1/30 s`. `battle.ts` uses an accumulator with up to **14 steps per frame** and renders with `alpha = acc/DT` interpolating `px,py → x,y` |
| Zoom (CSS px per world px) at 844×390 | `fitZoom = 0.482`, `minZoom = 0.9·fit = 0.433`, opening `focusCastle = 0.62`, `maxZoom = max(3.2, 4·fit) = 3.2` |
| Screen size of one tile | fit 7.7 CSS / 15.4 device px · opening 9.9 / 19.8 · max 51 / 102 |
| Soldier (r 3.2) diameter | fit 3.1 CSS px, boosted to ≥ 4.6 by `R()` · opening 4.0 · max 20 CSS px |
| DPR | `min(devicePixelRatio, low ? 1.25 : 2)`. The backing store is CSS × DPR and the world transform folds DPR into `setTransform` |
| Letterbox | The map's aspect is 1.76; the play area between HUD bars is about 844×270 (3.1). At the opening zoom the map covers about 595 of 844 CSS px, so **dark bands show at both sides** (see `04_deploy.png`) |

### 2.2 Layers and draw order (one `render(alpha, dt)`)
1. `fillRect` clear (#1b1d1a), then `consumeFx()` (fx queue → particles and decal stamps; `dirtyTiles` → `rebake` 3×3)
2. `drawImage(terrain)` — baked at 2 texels per world px (1920×1088, **8.4 MB**); 1 tex/px on low
3. `drawImage(decals)` — the same size (**8.4 MB**); corpses, blood, scorch accumulate here
4. `drawStructOverlays` — crack strokes for every struct tile below 75 % HP, **redrawn every frame**
5. `drawDeployZones` (deploy only; loops over all 2040 tiles)
6. `drawFires` (loops over all 2040 tiles every frame)
7. `drawLadders`, `drawSelection`
8. `drawUnits(ground)` and `drawUnits(elevated)`. Each call buckets units by the string key `color|trim` (allocated per unit per pass), then draws one batched path per bucket: body arc fill and stroke, a trim arc, and weapon lines. Hit flashes and health bars take two more full passes over `w.units`. That makes **6 passes over all units per frame**
9. `drawProjectiles` (one batched stroke for arrows and bolts; stones and fire individually)
10. `drawParticles` (pool cap 900 on high, 300 on low; arcs or rects, `globalAlpha` changed per particle)
11. `drawFlyers` (per unit: save, rotate, wing paths)
12. `drawBanners` (per squad: pole, flag path, **clip**, heraldic pattern, **strokeText + fillText**, morale bar)
13. `drawPings`, drag line, then screen space `drawEdgeIndicators`

**Cached:** terrain (partial rebake of the 3×3 neighbourhood on `dirtyTiles`) and decals. **Not cached:** banners and their text, crack overlays, units (all procedural paths every frame). **No culling:** every unit and particle is processed regardless of the viewport. Shake uses `Math.random` (render-only, fine).

### 2.3 Sim → render interface today
* The renderer reads `World` directly. Its only "writes" are draining `w.fx` and `w.dirtyTiles`, which the sim never reads back.
* Render-relevant sim fields: `x,y,px,py` (interpolation), `fx,fy` (facing; **the sim reads these for flyers**, so they are sim state), `cd` (attack cooldown), `hitFlash` (sim-decremented, never read by sim logic), `state` (`ACTIVE/DOWN/DEAD/CARRIED/EVAC/FLED/CLIMB`), `elev`, `carrier/carry`, `fleeing`, `squad.routing`, `act` (ladder/dig).
* Determinism matters beyond replays: `ui/resume.ts` rebuilds a killed battle by **replaying inputs**, so any render→sim leak corrupts resumes. (Separately, `council.ts:34` has a module-level `rangedTick` that leaks between battles. It is owned by the sim team but is the same class of bug.)

---

## 3. Measurements

### 3.1 Peak unit counts per stage (headless sim, `scripts/census.ts`, best of 3 seeds)
"Strong" means max research, the full squad cap and a 12-squad roster on normal difficulty. "Weak" means the starter roster on hard (it loses early, so counts stay lower). "Drawn" counts units that are not DEAD, FLED or EVAC.

| army | stage | squads | result | **drawn** | enemies | defenders | down | big | flying | projectiles | fire tiles | ladders | fx/step | corpses |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| strong | s1 | 6 | won 3/3 | **105** | 47 | 58 | 0 | 0 | 0 | 15 | 0 | 0 | 5 | 65 |
| strong | s2 | 7 | won 4/4 | **144** | 82 | 62 | 4 | 0 | 0 | 16 | 0 | 0 | 14 | 160 |
| strong | s3 | 7 | won 4/4 | **162** | 101 | 62 | 1 | 1 | 0 | 92 | 0 | 0 | 5 | 163 |
| strong | s4 | 8 | won 5/5 | **127** | 62 | 65 | 4 | 2 | 0 | 100 | 4 | 0 | 17 | 128 |
| strong | s5 | 8 | won 4/4 | **126** | 62 | 65 | 8 | 2 | 0 | 106 | 7 | 2 | 19 | 83 |
| strong | s6 | 9 | won 5/5 | **149** | 79 | 71 | 3 | 2 | 0 | 104 | 7 | 0 | 23 | 218 |
| strong | s7 | 9 | won 5/5 | **200** | 131 | 71 | 3 | 3 | 0 | 113 | 4 | 1 | 30 | 280 |
| strong | s8 | 10 | won 5/5 | **177** | 87 | 91 | 3 | 4 | 0 | 93 | 7 | 5 | 22 | 222 |
| strong | s9 | 10 | won 4/4 | **174** | 81 | 93 | 0 | 1 | 4 | 70 | 13 | 5 | 15 | 134 |
| strong | **s10** | 11 | won 5/5 | **195** | 100 | 99 | 21 | 4 | 3 | **128** | 14 | 5 | 21 | 279 |
| strong | endless | 10 | lost 9/60 | **182** | 175 | 83 | 17 | 2 | 1 | 94 | 15 | 2 | 33 | 628 |
| strong | daily swarm (s10 ×1.5) | 7 | lost 4/5 | **231** | 184 | 62 | 28 | 8 | 6 | 94 | 28 | 1 | 31 | 446 |
| weak | s1–s10, endless, swarm | 4 | mostly lost | 69–129 | ≤ 94 | ≤ 52 | ≤ 16 | ≤ 3 | ≤ 7 | ≤ 69 | ≤ 14 | ≤ 5 | ≤ 17 | ≤ 169 |

Design numbers derived from this: **250 drawn units, 130 projectiles, 30 down, 8 big, 6 flyers, 30 fire tiles, 5 ladders, about 35 fx events per step, and up to about 650 corpses per battle** (decal stamps). The heaviest stage is **s10** (the in-browser benchmark uses it with seed 22, peak 192–201).

### 3.2 Sim step cost
| Where | avg ms/step | p95 / max |
|---|---|---|
| Node (tsx), all stages | 0.07–0.31 | p99 3.6, max 5–20 |
| `World.recomputeFields()` alone (s10) | **4.9** (p50) | 7.9 |
| Browser, sw, ×1 (s10 / swarm) | 0.26–0.51 | p95 ≤ 1.0 |
| Browser, sw, **×4** | **1.1–2.4** | p95 2.3–6.1, max ≈ 15 |
| Browser, gpu-mode, ×4 | 1.0–2.4 | p95 3.2–5.7 |

Spikes come from the council tick (every 15 steps) and field recomputes. At ×4 one recompute is about 20 ms, so **each wall breach can drop one frame** — this is for the sim team; deterministic time-slicing across steps is possible. At 3× speed the sim runs 1.5 steps per frame, about 2.3 ms/frame at ×4.

### 3.3 Current render cost at the s10 peak window (~155 drawn units)
Phase A: sim step, `render()` (JS) and raster flush, each timed separately over 90 frames.

| view (zoom) | mode | rate | render JS avg / p95 | raster avg / p95 | total avg |
|---|---|---|---|---|---|
| opening (0.62) | sw | ×1 | 0.40 / 0.6 | 7.2 / 9.7 | 7.6 |
| fit (0.48) | sw | ×1 | 0.37 / 0.5 | 4.0 / 4.6 | 4.3 |
| zoom (1.48) | sw | ×1 | 0.50 / 0.7 | 10.8 / 13.6 | 11.3 |
| opening | sw | **×4** | **1.96–2.83 / 3.9–4.7** | **32.6–41.9 / 49–51** | 34.5–44.8 |
| fit | sw | ×4 | 1.74 / 4.1 | 19.3 / 29.4 | 21.0 |
| zoom | sw | ×4 | 2.31 / 5.7 | 41.9 / 68.5 | 44.2 |
| opening | gpu | ×4 | **3.0 / 7.6** (swarm: 5.4 / 18.5) | n/a | n/a |
| opening, **low tier** (DPR 1.25) | sw | ×4 | 1.53 / 2.7 | **15.2 / 22.2** | 16.8 |

Phase B, per layer (sw, ×4, opening, s10). Each pass is wrapped with a flush before and after it, so these numbers include raster:

| layer | ms | | layer | ms |
|---|---|---|---|---|
| clear + terrain + decal blits | **38.5** | | drawBanners (text + clip) | **2.6** |
| drawUnits (both passes) | **6.3** | | drawStructOverlays | 0.69 |
| drawFlyers | 0.60 | | drawSelection | 0.37 |
| drawFires | 0.19 | | drawProjectiles | 0.18 |
| everything else | < 0.15 each | | **total** | **50.2** |

In gpu mode (JS only) the same layers cost: units 0.76, banners 0.57, flyers 0.13, total **2.2 ms**. Isolated costs (sw ×4): one full-screen terrain blit **15.5–21 ms**, terrain + decals **29–39 ms**, a full-screen clear 0.8–2.0 ms, `bakeAll` 28–60 ms, a 3×3 rebake 0.5–0.8 ms.

Natural RAF loop, sw, real game with HUD:

| tier | rate | speed | fps | steps/frame | loop JS avg/p95 | Layout + Style per s |
|---|---|---|---|---|---|---|
| high | ×1 | 1× / 3× | **60 / 60** | 0.5 / 1.5 | 1.0 / 2.3 | 9 ms |
| high | ×4 | 1× | **14–20** | 1.6–2.2 | 5–11 | 30–35 ms |
| high | ×4 | 3× | 13–17 | **5.2–6.7** (catch-up) | 11–16 / 34 | 34 ms |
| low (DPR 1.25) | ×4 | 1× / 3× | **36 / 31** | 0.8 / 2.9 | 5.4 / 8.7 | 34–37 ms |

The as-is build (infantry invisible) gives the same 17–19 fps at ×4, which proves that **full-screen raster, not units, limits the software path today**. `TaskDuration` is about 1030 ms per second at ×4, so the main thread is saturated, while `ScriptDuration` is only 100–225 ms per second.

Phase D, render-only scaling (cloned units, sw):

| drawn | JS ×1 | JS ×4 | total ×4 (incl. raster) |
|---|---|---|---|
| 250 | 0.7–0.8 | 4.6–5.7 | 54–64 |
| 400 | 0.8 | 5.4–5.5 | 55–57 |
| 600 | 1.3 | 7.3–9.6 | 60–65 |

Going from 250 to 600 units, the path renderer adds about **8–11 µs of JS per extra unit at ×4**. Raster barely changes, because the blits dominate.

### 3.4 Prototype of the proposed pipeline (`bench/proto.html`)
Standalone page, same canvas size (1688×780), procedural 3/4-view sprites. Each row adds one feature to a frame that already has a ground blit. Columns: JS ms (main thread) and raster ms (sw only), both avg.

| scenario | sw ×1 JS | sw ×1 raster | **sw ×4 JS** | sw ×4 raster | gpu ×4 JS p50 / avg |
|---|---|---|---|---|---|
| clear + ground blit (one canvas, 2 tex/px) | 0.04 | 3.8 | 0.10 | 16.4 | 0.0 / 0.05 |
| + 20 decal stamps into the ground canvas | 0.26 | 3.5 | 0.76 | 11.5 | 0.1 / 0.29 |
| **+ 250 sprites (LOD, y-sorted, pixel-snapped)** | 0.40 | 3.7 | **1.71** | 15.2 | **1.1** / 3.7 |
| 250 sprites at zoom 1.48 / 3.2 | 0.40 / 0.42 | 4.8 / 5.9 | 1.18 / 1.24 | 23 / 21 | 0.8 / 1.0 |
| 250 sprites, mirrored at draw (setTransform) | 0.48 | 3.9 | 1.91 | 16.7 | 1.6 / 4.4 |
| 250 sprites, no LOD (2 tex/px downscaled) | 0.47 | 4.5 | 1.70 | **21.1** | 2.0 / 5.1 |
| + 400 sprites / + 600 sprites | 0.96 / 0.66 | 5.9 / 3.7 | 2.27 / 2.80 | 19.8 / 21.5 | 2.3 / 2.8 |
| + 130 projectiles (one stroke) | 0.03 | 2.5 | 0.24 | 12.8 | 0.0 |
| + 400 particles (sprites, 4 alpha buckets) | 0.42 | 3.3 | **2.08** | 15.7 | 1.3 / 3.9 |
| + 11 banners (cached sprites) | 0.06 | 3.0 | 0.45 | 17.1 | 0.0 |
| + dusk: multiply tint + 40 additive glows | 0.08 | 10.0 | 0.67 | **39.1** | 0.1 / 0.85 |
| + night light-map at ¼ res, `destination-out`, 40 lights | 0.57 | 8.5 | 3.36* | 48.0 | 0.9 / 1.0 |
| + night light-map at ¼ res, `multiply`, 40 lights | 0.67 | 12.5 | 3.34* | 55.4 | 1.1 / 1.1 |
| + rain, 300 streaks (one stroke) | 0.08 | 4.1 | 0.38 | 18.9 | 0.1 |
| + snow, 300 rects | 0.14 | 3.0 | 0.47 | 11.6 | 0.1 / 0.35 |
| **FULL high, dusk** (250u, 130p, 400fx, 11b, 20 decals, dusk, rain) | 1.10 | 12.0 | **5.36** | 56.0 | **6.1** / 6.0 |
| **FULL high, night** (light-map instead of dusk) | 1.89 | 13.6 | 8.09* | 56.0 | 4.9 / 4.6 |
| FULL high, 400 units, night | 1.60 | 11.1 | 7.87 | 55.7 | 12.7 / 12.3 |
| **LOW** DPR 1.25: 250u, 80p, 150fx, 11b, 8 decals, tint | 0.77 | 3.0 | **3.16** | **11.2** | 3.1 / 3.5 |
| LOW + night-cut (20 lights) + rain 120 | 0.63 | 3.0 | 3.11 | 16.1 | 0.8 / 1.8 |

\* In sw mode, drawing the light-map canvas onto the main canvas forces the light-map to rasterize on the main thread, so that raster lands in "JS". In gpu mode it does not, which is why gpu shows about 1 ms.

Natural loop at ×4, sw: FULL high runs at **18–19 fps** (raster-bound) and the ground-only frame at 48 fps. At ×1 the same frames run at 57–59 fps. In gpu mode the p95 JS spikes (30–48 ms) are command-buffer back-pressure from SwiftShader and should be ignored; use p50.

Boot-time costs (prototype):

| item | ×1 | ×4 sw | ×4 gpu | memory |
|---|---|---|---|---|
| Sprite atlas at 2 tex/px: 31 kinds × 8 facings × 11 frames = 2728 frames, 40 px cells | 208 ms (0.076 ms/frame) | **990 ms** (0.36 ms/frame) | 713 ms | **16.8 MB** (one page, 4080×1080) |
| LOD 1 tex/px by half-size downsample | 19 ms | 81 ms | 1.5 ms | 4.2 MB |
| 4 tex/px for 15 kinds (1320 frames) | 121 ms | 653 ms | 385 ms | 32.4 MB, **too big** |
| Palette swap (key ramp → dye) on a 1024² CPU canvas | 14 ms | 57 ms | **7216 ms** when the source was a GPU canvas | — |
| Ground bake 2 tex/px / 1 tex/px | 17 / 9 ms | 75 / 51 ms | 70 / 37 ms | 8.0 / 2.0 MB |
| y-sort of 250 units | 0.04 ms | 0.18 ms | 0.19 ms | — |

---

## 4. What the numbers say

1. **The main-thread JS budget is comfortable.** Replacing path-drawn circles with atlas sprites costs no more per unit (sprites: about 4–7 µs per unit at ×4; current paths: about 8–11 µs per extra unit). With LOD, y-sort and pixel snapping, 250 units cost 1.1–1.7 ms at ×4.
2. **Text and clips per frame are the worst value for money.** Banners cost 2.0–2.6 ms at ×4 for 11 squads; cached sprites cost 0.45 ms.
3. **Full-screen composites are almost free on a GPU canvas but ruinous on a software canvas.** The current two full-screen blits alone cap a software-canvas phone at about 20 fps. So: **one ground blit, not two**, and **no full-screen tint or light-map on the low tier.**
4. **LOD matters for raster, not JS.** Downscaling a 2 tex/px atlas at the opening zoom costs +40 % raster (21 vs 15 ms in sw ×4) and aliases. Native-resolution LODs fix both.
5. **Mirroring at draw time** costs +0.2 ms JS at ×4 for 250 units (sw) and saves 3/8 of atlas memory. Baking the mirrored facings is the better trade on high; on low, memory is small either way.
6. **Generate sprites on CPU canvases and never read back from GPU canvases.** The palette swap on a GPU-backed source took 7.2 s in SwiftShader. On real GPUs this is still a sync stall.
7. **Catch-up spiral**: on slow frames the loop runs 5–7 sim steps per frame at 3×, which makes frames slower still. Cap catch-up (§5.11).

---

## 5. Recommended architecture

### 5.0 Module layout (all in `src/render`, the sim is untouched except §5.3)
```
render/
  renderer.ts        orchestrator: layer order, culling, tier, budgets, debug HUD (ms per layer)
  camera.ts          + fx: shake, impulse zoom, flash; zoom snapping for pixel crispness
  quality.ts         tier table, auto-detect, runtime downgrade
  sprites/bank.ts    SpriteBank interface, FrameRef, keys, LOD selection   ← the only API the renderer uses
  sprites/gen/*.ts   procedural generators: humanoid rigs per race, beasts, engines, dragon, structures
  sprites/sheet.ts   loader for commissioned PNG+JSON (optional; overrides generator per key)
  sprites/atlas.ts   packing into pages, LOD chain, worker/OffscreenCanvas generation, dye recolour
  anim.ts            render-side animation state (SoA arrays keyed by unit id)
  ground.ts          ground canvas (terrain + structure bases + damage states + decals), backdrop
  structures.ts      wall/tower row strips (3/4 view), damage-state buckets
  fx/particles.ts    pooled sprite particles      fx/decals.ts   decal queue + records
  fx/lighting.ts     mood table, tint, light-map  fx/weather.ts  rain/snow/ash/fog
  overlay.ts         cached banner sprites, health bars, selection, pings, edge arrows
  moods.ts           stage id → { time, weather, palette shift }   (render-only data)
```

### 5.1 Layer stack and draw order (target)
| # | layer | technique | high budget at ×4 |
|---|---|---|---|
| 0 | Backdrop (scenery outside the play area that fills the letterbox) | low-res canvas (0.5 tex/px, ≈1.2k×0.6k, 2.9 MB), one blit, replaces the clear | 0.1 ms |
| 1 | **Ground**: terrain, structure footprints and bases, baked damage states, **persistent decals**, static shadows | **one** canvas at 2 tex/px (low: 1 tex/px); nearest filtering when zoom·dpr ≥ 3, otherwise bilinear | 0.1 ms + decals 0.5 ms |
| 2 | Ground dynamics: deploy and selection tiles, fresh "dying" sprites, downed and carried bodies, fire glow on the ground, ladder feet | sprites | 0.3 ms |
| 3 | **Y-sorted world list**: unit sprites (ground and elevated), wall/tower **row strips**, ladders, siege engines, trebuchet arm | `drawImage` from the atlas, culled to the view + 1 tile, rounded to device px | **2.0 ms** (250 units + ≤ 29 strips) |
| 4 | Projectiles (arc height offset, small ground shadow) | one batched stroke for arrows/bolts; sprites for stones and fire | 0.3 ms |
| 5 | Flyers (dragon, drakes) with ground shadows in layer 2 | part rigs (body, head, 2 wings, tail), ≤ 8 drawImage each | 0.4 ms |
| 6 | Particles | pooled sprite particles, 4 alpha buckets, cap by tier | 1.2 ms (≤ 250) |
| 7 | **Lighting** | dusk: multiply tint + additive glows; night: ¼-res light-map | 0.8 / 1.2 ms |
| 8 | Weather | screen space; one stroke or rects | 0.4 ms |
| 9 | World UI | cached banner sprites, health bars (one path per colour), pings, rings, drag line | 0.4 ms |
| 10 | Screen UI | edge arrows, flash, vignette (cached sprite) | 0.1 ms |
| — | anim state update + sort + cull | typed arrays | 0.4 ms |
| | **Total** | | **≈ 6.0 ms** |

The prototype measured 5.4–6.1 ms (dusk) and 4.9–8.1 ms (night), consistent with this table.

**3/4 view without breaking the 2D sim:** the sim stays top-down. Walls and towers are drawn as **row strips**: each tile row's structures are pre-rendered (top face shifted up by the wall height, front face below it) into one cached sprite per contiguous run. The strip enters the y-sort with key = row bottom. Units on a wall walk get key = row bottom + ε and are drawn raised by the wall height. Measured structure counts: at most 182 struct tiles, **29 rows, 84 runs (s10)**, so the strips use ≤ 1.5 MB at 2 tex/px and cost ≤ 84 extra `drawImage` calls (about 0.5 ms at ×4). Merging runs per row (≤ 29 draws, ≤ 8 MB) is the alternative.

### 5.2 Sprite atlas generated at boot
* **Unit of art:** a 20×20 world-px cell with its anchor at the feet. The figure is about 9×13 world px, so it is drawn larger than the sim radius (overlap is fine because of the y-sort). At the opening zoom one cell is 25 device px; at fit it is 19; at max zoom it is 128.
* **LOD chain:** LOD1 = 1 tex/px (most of the game: 0.86–2.0 device px per world px), LOD2 = 2 tex/px (zoom > ~0.75 CSS). Above 2× the LOD2 scale, upscale with **nearest** for a deliberate pixel look. Optionally snap the zoom after a pinch to multiples where texel:pixel is an integer. **Draw each LOD natively with the generator** rather than downsampling, so silhouettes stay crisp at 9×13 texels. Downsample only commissioned sheets. **No LOD3** (4 tex/px is 32 MB for 15 kinds).
* **Frames per kind:** 8 facings (5 drawn, 3 mirrored and baked) × {idle 1–2, walk 4, attack/shoot 3, down 1, dead 1, climb 2 (N/E only)} ≈ 11–12, so about **88–96 frames per kind**. Hurt is a white-silhouette overlay, not a frame: generate one silhouette page at LOD1 (+4 MB) or use a `source-atop` flash on ≤ 20 units.
* **Per-race variants:** a rig template per body plan (human, dwarf: short and wide, elf: tall and slim, orc: hunched and broad, goblin/kobold: small, large head, kobold tail) × an equipment layer (weapon, shield, helmet, cloak) × a palette. One generator call per `UnitDef` — no per-unit drawing code. Big units (troll, ancient, ram, siege tower, trebuchet, dragon) use **part rigs** (5–8 part sprites, assembled with transforms at draw time; ≤ 10 on screen).
* **Dye cosmetics:** for code-drawn art, the dye is simply a generator parameter (no swap). Defenders are generated with the equipped dye at battle start, and the result is cached in memory by `(kind, dye, mood, lod)` so retries cost nothing.
* **Cost:** about 0.36 ms per 40-px frame at ×4. Worst case (s10, 31 kinds): **≈1.0 s** at ×4 for LOD2, plus 0.08 s for LOD1; a typical stage (≈15 kinds) takes ≈0.5 s. Generate in a **Worker with OffscreenCanvas** where available (Android WebView/Chrome ≥ 69, iOS ≥ 16.4) and transfer as `ImageBitmap`. Otherwise time-slice on the main thread (≤ 4 ms per slice) during the pre-battle screen and the deploy phase. Generate LOD1 first, so the battle can start before LOD2 finishes. Use `willReadFrequently:true` only on generation canvases.
* **Memory (high, worst case):** atlas 16.8 + 4.2 MB, ground 8.4, main canvas 5.3, backdrop 2.9, strips 1.5, light-map 0.3, misc sprites ≈ 1 → **≈ 40 MB** of canvas backing. This compares with 22 MB today. Dropping the separate decal canvas saves 8.4 MB. **Low:** ≈ 10 MB.

### 5.3 Animation state from existing sim state (render-only, no sim fields)
The renderer keeps **struct-of-arrays keyed by `u.id`** (ids are per-world counters; grow a `Float32Array` as needed, reset on `attach`). Nothing is written onto sim objects. Writing onto them would change hidden classes and could deoptimize sim code.

| render state | derived from | rule |
|---|---|---|
| facing (0–7) | `atan2(fy, fx)` | 8 sectors with ±12° hysteresis; flyers use the same |
| moving / walk phase | `hypot(x−px, y−py)` per step | walk if > 0.02 px/step; phase advances **by distance travelled** (no foot sliding; freezes when blocked) |
| attack / shoot start | `cd` jumps **up** since last frame | the sim resets `cd` to `def.cd·rand` on every swing or shot (min `cd` is 0.2 s > one frame at 4×); play 3 frames over min(0.35 s, def.cd) |
| work (engineer, sapper) | `cd` jump + role, or `act === DIG/PLANT` | work cycle |
| hurt | `hitFlash > 0` (sim already sets 0.12 s) | white overlay at alpha ∝ hitFlash |
| down / carried | `state DOWN / CARRIED`, `carrier` | lying frame; carried = lying frame offset onto the carrier, which plays its carry/walk anim |
| climbing | `state CLIMB` | climb frames |
| routing / fleeing | `squad.routing`, `fleeing` | walk at 1.5× rate, flag lowered |
| dead | fx (below) | 0.5 s "die" sprite, then stamped into the ground as a corpse decal |

**Recommended sim additions (output-only, never read by the sim):**
* fx `die {x, y, c: def.id, a: fireDeath, b: facingAngle}` (today's `corpse` carries only a colour);
* fx `land {x, y, c: proj.kind, a: hit ? 1 : 0}` when a projectile ends, for arrows stuck in the ground, boulder craters and dust.

Both are pushed like the existing fx. The sim never consumes `w.fx`, so determinism is unaffected.

**Guard rails:**
1. A vitest "render isolation" test runs a battle headless, then runs it again with the real `Renderer` attached to a **no-op 2D context** (a Proxy whose methods do nothing) calling `render()` every step, and asserts an identical `BattleResult` and final unit positions.
2. A grep/ESLint rule: `src/sim/**` must not import `src/render/**` or `src/ui/**`.
3. The renderer may only *drain* `w.fx` and `w.dirtyTiles`; every other World access is read-only (enforce with a `Readonly<World>` type in `renderer.ts`).

### 5.4 Ground layer with persistent decals
* **One canvas:** terrain, structure bases and decals, merged. This **removes one full-screen blit** (sw ×4: 17–21 ms raster saved; GPU: one fewer full-screen layer).
* **Decal queue:** fx → typed records `{kind, x, y, rot, variant}` in a ring buffer (cap 4096). At most **24 stamps per frame on high, 8 on low**, drawn into the ground canvas *before* it is blitted. Batching stamps (for example every 2nd frame) avoids repeated copy-on-write of the 8 MB canvas. Measured cost of 20 stamps: 0.66 ms (sw ×4) and 0.1–0.3 ms (gpu).
* **Kinds:** blood splat (≈10 % of hits), corpse (the unit's dead frame, darkened), scorch (fire, oil, breath), crater and rubble (boulders, collapses), **arrows stuck in the ground** (`land` misses, 1 in 3), ladder wreck, trampled grass near gates (low alpha).
* **Density cap:** a per-tile counter (`Uint8Array(2040)`); stop stamping a kind above 6 per tile, so 650 corpses do not turn the field into mud.
* **Rebake on damage:** a rebake of tiles (wall → rubble) redraws terrain for the 3×3 region, then **re-stamps the decal records whose bounds intersect it** (a clip rect). This costs 0.5–0.8 ms at ×4 per event; queue at most 2 per frame.
* **No fading within a battle** (it would need full-canvas passes). Ground wetness or snow cover for the stage mood is baked at `attach`.

### 5.5 Lighting
* `moods.ts` maps each stage id to `{time: day|dusk|night|dawn, weather, palette}`. This is render-only, so `StageDef` is untouched. Daily and endless pick deterministically from the date or seed.
* **Dusk/dawn (high):** one full-screen `multiply` fillRect plus additive (`lighter`) glow sprites. Cost: 0.7–0.85 ms JS at ×4; on a GPU it adds one full-screen layer.
* **Night (high):** a light-map canvas at **¼ resolution** (422×195). Fill it with darkness (rgba ~0.7), cut lights with `destination-out` radial sprites (cheaper than `multiply`: 48 vs 55 ms software raster; equal JS), draw it scaled onto the main canvas, then add colour with additive glow sprites. Cost: ≈1.0 ms JS at ×4 (gpu). **≤ 40 lights.** Light sources: fire tiles (`w.fire`), torches at gates, towers and the keep (static, from the grid), braziers, fire projectiles, oil and breath fx, burning siege engines. Flicker is computed render-side.
* **Low tier:** no full-screen pass. **The mood palette is baked into the ground and the atlas** (generator palette shift), and ≤ 12 additive glows remain. The measured low night frame costs 3.1 ms JS and 16 ms raster even on a software canvas.
* Banners, health bars and UI draw **after** lighting so they stay readable at night.

### 5.6 Weather particles
Screen space with `Math.random` (render-only). Rain: one batched stroke of N streaks (0.38 ms at ×4 for 300) plus splash particles from the pool. Snow and ash: rects (0.35–0.47 ms for 300). Fog: one or two large cached gradient sprites drifting. Wind is shared with smoke drift. **High: 300 drops; low: 100–120.** Surface state (wet ground, snow cover) is baked into the ground canvas.

### 5.7 Wall and tower damage states
* A render-side `Uint8Array lastBucket` per struct tile holds `floor(hp/maxHp × 4)` (intact, chipped, cracked, crumbling). Every 0.25 s the renderer compares buckets and **rebakes only tiles whose bucket changed**, into both the ground base and the row strip. This removes today's per-frame crack overlay (0.47–0.69 ms at ×4) and allows richer art (missing merlons, scorch, broken gate planks).
* Collapse (`dirtyTiles` → RUBBLE or GATE_BROKEN): rebake, rubble decals, debris and dust burst, camera impulse (§5.8). The gate has extra states: intact, splintered, broken (`GATE_BROKEN`).
* Ladders and siege towers docked at a wall (`grid.ladders`, `w.ladders`) are drawn as y-sorted sprites anchored to the wall strip.

### 5.8 Camera effects
* **Shake:** keep the existing approach (cap 8 px, decay 20/s), honour `reduceMotion`, and use a smooth noise curve instead of white noise.
* **Impact zoom:** +3–5 % zoom about the event point for 120–180 ms with ease-out. Only for major events (wall collapse, gate broken, dragon roar, trebuchet hit within the view) and rate-limited to one per 1.5 s.
* **Flash:** a full-screen fill at alpha ≤ 0.15 for 80 ms (high only).
* All of these are transform or fill changes, ≈0.1 ms at ×4, and **render-only**. No hit-stop: the sim keeps its fixed clock.

### 5.9 Quality tiers (concrete)
| setting | **HIGH** | **LOW** |
|---|---|---|
| DPR cap | 2, and backing ≤ 1.4 Mpx | 1.25 (1.0 if the auto-detect fails twice) |
| Frame target | 60 fps | 60, falls back to 30 fps (render every 2nd RAF; sim unchanged) |
| Ground | 2 tex/px, decals merged | 1 tex/px, decals merged |
| Backdrop | 0.5 tex/px scenery | flat colour + vignette sprite |
| Atlas | LOD1 + LOD2, 8 baked facings | LOD1 only, 8 baked facings (4 MB) |
| Decal stamps per frame | 24 | 8 |
| Particles cap | 250 | 120 |
| Lighting | dusk tint / night light-map, ≤ 40 lights | mood baked into textures, ≤ 12 glows |
| Weather | 300 | 100–120 |
| Camera fx | shake, impulse, flash | shake only |
| **Render JS budget at ×4** | **≤ 6.0 ms avg, ≤ 9 ms p95** | **≤ 3.5 ms avg, ≤ 6 ms p95** |
| Sim budget at ×4 | ≤ 1.6 ms/step avg (today 1.1–2.4) | same |
| Software-raster ceiling (×4) | n/a (needs a GPU canvas) | **≤ 16 ms** (measured 11–16) |
| GPU overdraw *(estimate)* | ≤ 4 full screens per frame (≈5.3 Mpx/frame ≈ 320 Mpx/s at 60 fps) | ≤ 2.5 screens at 0.51 Mpx |
| Canvas memory | ≈ 40 MB worst case | ≈ 10 MB |

**Auto-detect:** in the **deploy phase** (static scene, perfect for this), measure the frame-interval p75 over 90 frames. If it exceeds 20 ms on high, switch to low. Show a toast such as "화면 품질을 '절약'으로 낮췄습니다." Persist the choice; the player can override it in settings.

### 5.10 Commissioned sprite sheets later, with no code changes elsewhere
* The renderer asks only `bank.frame(kindId, anim, facing, i, lod) → {img, sx, sy, sw, sh, ax, ay}` and `bank.meta(kindId, anim) → {count, fps, loop, hitFrame}`. Keys are `<UnitDef.id>/<anim>/<facing 0-7>/<i>`, with structures, decals, particles and banners under their own namespaces (`struct/wall/intact/...`, `decal/blood/3`).
* `sheet.ts` loads the optional `public/sprites/manifest.json` (TexturePacker "JSON Hash" or Aseprite JSON export: `frames{name:{frame{x,y,w,h}, pivot}}`, `meta{scale: tex per world px, dyeKeys: [...]}`) together with its PNG pages. **Any key found there overrides the generator; missing keys fall back to the procedural generator.** Art can therefore be swapped one unit at a time.
* Dye on commissioned art: a reserved **key ramp** (4 magenta shades, listed in `meta.dyeKeys`), recoloured once per dye **on a CPU canvas** (`willReadFrequently`, measured 14 ms per 1024² at ×1, 57 ms at ×4), or an optional `*_dye.png` mask tinted with `source-in`. The LOD chain is built by downsampling when only one scale is shipped. Mirrored facings are optional; the bank mirrors at draw when they are absent (+0.2 ms per 250 at ×4).
* Bundle size: a commissioned set for all 32 kinds at 2 tex/px is ≈ 3–6 MB of PNG *(estimate)*. It ships inside the PWA cache and the Capacitor bundle, with no server.

### 5.11 Other must-dos found while measuring
1. Fix the infantry sentinel bug (`renderer.ts:810`), which is in progress elsewhere.
2. **Cap the catch-up** in `battle.ts` from 14 to **3–4 steps per frame**, and let game time dilate when the device is too slow. At ×4 the loop ran 5–7 steps per frame and made frames even longer.
3. Cull everything to the view rect + 1 tile. Today units, particles, fires (2040-tile loop) and deploy zones are processed every frame regardless of the view.
4. Banners → cached sprites, re-rendered only when the label, morale bucket or selection changes. This saves ≈2 ms at ×4.
5. No per-frame string keys or `split` in the unit loop (GC churn); use integer kind ids.
6. HUD: `updateHud` rebuilds the supplies `innerHTML` every 120 ms. Update text nodes only when a value changes (Layout + Style ≈ 30–37 ms/s at ×4 today). Never put `backdrop-filter` or blend modes on HUD elements over the canvas (none today; keep it that way).
7. Debug overlay (dev builds): ms per layer, unit count, steps per frame, tier — so regressions show up on real phones.

---

## 6. Budget model for a real mid-range phone *(estimate, anchored on ×4 numbers)*
Frame 16.7 ms = render JS (≤ 6.0) + sim (0.5–1.5 steps × ~1.5 ms ≈ 0.8–2.3) + HUD/DOM (≈ 0.6) + browser and compositor overhead (≈ 2–3) + thermal headroom (25 %). That is ≈ 12–14 ms at 3× speed: tight but inside the frame. Sim spikes (field recompute ≈ 20 ms at ×4) will drop single frames at wall breaches; the sim team can time-slice them deterministically.

GPU side: a mid-range GPU (Mali-G5x/Adreno 6xx class) fills about 1–2 Gpx/s in practice for canvas *(estimate)*. The high tier at ≤ 4 screens of overdraw needs ≈ 320 Mpx/s, which is 15–30 % of the GPU.

---

## 7. Risks
* **Software-canvas devices** (blocklisted GPUs, some old WebViews) cannot run the high tier at DPR 2 at any acceptable rate. The auto-detect in the deploy phase is the mitigation, and it must not be optional.
* Atlas generation (≈1 s at ×4 for s10) must stay off the critical path: use a worker or time slices during the pre-battle and deploy screens.
* iOS canvas memory limits (total canvas memory per page) favour keeping LOD2 only for the kinds in the current battle and releasing atlases between battles (set `width = 0`).
* Headless measurements cannot capture GPU fill-rate. Before freezing the art style, validate once on two real devices (one low-end Android, one mid-range) with the debug overlay from §5.11.7.

---

## 8. Implementation order (each step shippable)
1. Quick wins in the current renderer: sentinel fix, merge decals into the terrain canvas, banner sprites, culling, catch-up cap, HUD text-node updates, tier auto-detect.
2. `SpriteBank` + procedural humanoid generator (LOD1/LOD2) + `anim.ts`; replace circles; y-sort.
3. Row strips for walls and towers + damage buckets; remove the crack overlay.
4. Decal queue (`die` and `land` fx), particle sprites, projectiles with arcs and shadows.
5. Moods: tint, light-map, weather; backdrop for the letterbox.
6. Part rigs for big units and the dragon; camera impulse and flash.
7. `sheet.ts` loader (no art needed yet; test with a generated PNG+JSON round trip).

---

## 9. Reproduce
* Private build: `design/tech/repo` (`npx vite build`; `dist-asis` = original, `dist-fixed` = sentinel fix only).
* Census: `cd design/tech/repo && npx tsx scripts/census.ts` → `design/tech/census.jsonl`. Spike probe: `scripts/spike.ts`; structure counts: `scripts/structs.ts`.
* In-game benchmark: `NODE_PATH=/opt/node22/lib/node_modules MODE=sw|gpu node design/tech/bench/game_bench.cjs <dist> high|low s10|swarm out.json`; summarize with `bench/summarize.cjs`.
* Prototype pipeline: `MODE=sw|gpu node design/tech/bench/proto.cjs out.json` (page: `bench/proto.html`).
* Outputs: `bench/sw_fixed_high_s10.json`, `sw_fixed_high_swarm.json`, `sw_fixed_low_swarm.json`, `gpu_fixed_high_s10.json`, `gpu_fixed_high_swarm.json`, `gpu_fixed_low_swarm.json`, `sw_asis_high_s10.json`, `fixed_high_s10.json` (first run), `proto_sw.json`, `proto_gpu.json`.
