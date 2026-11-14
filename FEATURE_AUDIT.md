# Feature-Gap Audit — Low Poly Mario

Audit performed after the game was playable, against the design brief (World 1-1 principles, voxel presentation, movement/physics contracts, secrets, scoring chains, finish flow, audio, UI, records). Every selected item was implemented and re-verified before final delivery. Verification evidence refers to `node tests/sim.test.js` (99 checks, all passing) unless noted otherwise.

## A. Findings and decisions

| Feature or defect | Current state and evidence | Player benefit | Priority | Decision | Acceptance check | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| Player collision used thin probe slivers; head hits and floor landings could miss tiles (question blocks not activating in early runs) | Broken — reproduced headless: first question block never activated | Reliable block hits and landings are core | P0 | Implement | Body-overlap resolution for floor/ceiling; block tests pass (`question block becomes used once`, `falls onto and stands on tallest pipe`) | Done — `js/sim.js` `movePlayer` |
| Above-cap easing accelerated instead of decelerating (vx grew unbounded after respawn) | Broken — vx reached 36.9 in trace | Predictable movement, no speed exploits | P0 | Implement | Walk caps at 6.0, run at 9.8 (`symmetric acceleration`, `run cap 9.8`) | Done — `js/sim.js` `playerControl` |
| Coyote time not armed on the very first frame (first jump fired late) | Partial — buffered first jump delayed one frame | Responsive feel from frame one | P1 | Implement | Jump condition accepts `grounded || coyote` (`held jump rises ~5.4`, `tap jump rises 2.4-2.8`) | Done — `js/sim.js` jump condition |
| Jump-cut threshold made very short taps rise ~4.4 instead of 2.4–2.8 | Partial — measured 4.41 | Spec-required tap height so Small Mario can hit lowest blocks | P1 | Implement | Tap (2-frame hold) rises 2.4–2.8; held rises ~5.43 | Done — cut at vy > 14 |
| Fireballs spawned at waist height and passed over Goombas (0.8 tall) | Broken — fireball kill test delta 0 | Fire Mario must be able to defend himself | P0 | Implement | `fireball kills enemy once for 100` passes | Done — spawn at y+0.6 |
| Sliding shell reversed after breaking a brick instead of continuing through the gap | Partial — shell chain test stopped at the brick | Shells become a discovery/reward tool | P1 | Implement | `sliding shell breaks brick from side` + shell continues; chain 500→800 verified | Done — `js/sim.js` slide branch |
| Hidden blocks were skipped by solid queries even for ceiling hits (never revealable) | Broken — reveal test failed | Secret 1-Up must be discoverable | P0 | Implement | `hidden block reveals on hit`, `unrevealed hidden block is not a side wall` | Done — `tilesInBox` includeHidden + reveal sets solid |
| Pipe heights produced non-integer tops (2.8-tall pipe was 3 tiles) so warp-pipe top checks mismatched | Broken — warp test failed | Down-entering the cellar must work | P0 | Implement | `down on warp pipe starts warp`, `mario arrives in cellar`, `cellar exit returns to surface` | Done — integral pipe heights 2/3/4 in `js/level.js` |
| Goombas spawned inside pipe tiles (invalid spawn) | Partial — level data inspection | Predictable, fair enemy placement | P1 | Implement | Level data audit; no enemy box intersects solid tiles | Done — `js/level.js` enemy list |
| Shell could wake into a low ceiling and embed in solid | Missing — code review finding | No unfair embedded enemies | P1 | Implement | Wake requires headroom; otherwise re-warns | Done — `js/sim.js` wake branch |
| Stale floating-score sprites were never removed (Map iterated with for-in) | Partial — code review finding | Bounded effects over long sessions | P1 | Implement | Popup sprites dispose when their popup expires | Done — `js/render.js` `syncEntities` |
| Flag finish did not trigger from a standstill start; fireworks used a missing captured digit | Broken — finish tests failed | Complete, exact finish flow | P0 | Implement | `flag contact starts finish`, digit 3 → 3 fireworks, digit 5 → 0, digit 1 → 1; time bonus = captured units × 50 | Done — `js/sim.js` `startFinish`/`finishStep` |
| Mandatory route completion for Small and Big Mario | Verified — scripted bots complete the course | Playability gate | P0 | Verify | Both bots reach `win` at the castle (x≈142) | Done — `tests/sim.test.js` route bots |
| Adaptive power blocks, multi-coin brick, star brick, emergence protection, flower-after-damage | Working | Teaching and rewards | — | Verify | All item/block tests pass (mushroom for small, flower for big, 10-coin payout, no early collection, flower grows small Mario to big) | Done |
| Airborne stomp chain and per-shell chains | Working | Rewarding skilled play | — | Verify | 100→200 chain; 500→800 shell chain; chains reset on landing/stop | Done |
| Cellar re-entry must not re-award coins or repeat the secret | Working | Secrets stay meaningful | — | Verify | `cellar coins not re-awarded`, `secret count does not repeat` | Done |
| Records (score/time) with validation and storage-failure fallback | Working (code path) | Replay value | — | Verify | Code review; localStorage path cannot execute in this sandbox (see limitations) | Done — `js/main.js` |
| Audio lifecycle (gesture gate, hurry tempo, pause/hidden mute, bounded scheduling) | Working (code path) | Clear feedback | — | Verify | Code review; Web Audio cannot execute in this sandbox (see limitations) | Done — `js/audio.js` |
| Rendering, animations, touch controls, mobile layout | Working (code path) | Presentation | — | Verify | Code review + syntax checks; no browser exists in the build sandbox (see limitations) | Done — `js/render.js`, `js/input.js`, `index.html` |

## B. Intentional departures from NES behavior

- **Pipe heights 2 / 3 / 4** instead of 2.0 / 2.8 / 3.4: collision tiles are integral 1-unit cubes; a 5.4-unit held jump clears the tallest pipe with margin (verified).
- **Jump cut at vy > 14**: models variable jump height with the required 2.4–2.8 tap rise instead of NES's frame-based tables.
- **Red Koopa** is a deliberate extension with a floor-ahead ledge check (verified); the course otherwise uses Goombas and a green Koopa like the original.
- **Cellar exit** is a "stand on the exit pipe and press Down" mirror of the entry mechanic, instead of a side-entry pipe, for consistency and readability.
- **Timer** uses 0.4 s per unit (300 units ≈ 2 minutes), matching NES pacing closely enough for the hurry warning at 100.

## C. Deliberately deferred (not presented as complete)

- **Piranha Plants, bosses, moving platforms, additional worlds** — out of scope for this first course per the brief; the feature set of World 1-1 is complete without them.
- **In-browser automated checks** (puppeteer-style): no browser exists in the delivery sandbox, so rendering/audio/touch were verified by code review and syntax checks only. This is a material verification limitation, disclosed here and in the README.

## D. Re-test summary

After the last gameplay change (shell wake headroom, popup sprite cleanup): full regression run — 99/99 checks pass, including both route bots, all block/item/enemy/shell/fireball suites, progression (cellar, checkpoint, timeout), finish flow (bonuses, fireworks digit rule), and lifecycle (reset, no accumulation, popup expiry).
