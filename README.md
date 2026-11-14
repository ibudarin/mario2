# Low Poly Mario

A complete, polished browser platformer inspired by the design of Super Mario Bros. World 1-1, presented as a Minecraft-inspired voxel world rendered in 3D with Three.js. All gameplay runs on one horizontal plane; the authoritative simulation is fully separate from rendering.

## Launch

No build step, account, backend, or external service is required. The rendering library is vendored locally (`js/vendor/three.min.js`, Three.js r128), so the game works fully offline.

1. Download or clone this repository.
2. Open `index.html` in any modern desktop or mobile browser — that is the single playable entry point.

If your browser restricts `file://` pages, serve the folder locally instead (example: `npx serve .` or `python3 -m http.server`) and open the listed URL.

## Controls

| Input | Action |
| --- | --- |
| `A / D` or `Left / Right` | Walk |
| `Space`, `W`, or `Up` | Jump (hold for a higher jump — in every power state) |
| `Shift` / `X` | Run; as Fire Mario, hold to throw fireballs (with a cooldown) |
| `Down` / `S` | Duck (powered Mario); enter the secret warp pipe while standing on it |
| `P` / `Escape` | Pause / resume |
| `R` | Restart the entire run |
| `Enter` | Start, replay, or resume from an overlay |
| `M` | Mute / unmute music and effects |

On touch devices, on-screen buttons provide left, right, down, run/fire, and jump.

## Course

A teachable World 1-1-style course from `x = -60` to `x = 148`: a safe opening (coin block, adaptive power block, first Goomba), a pipe sequence with a hidden 1-Up block and a secret warp pipe, a forgiving first gap and brick route (multi-coin brick, star brick, elevated coins), a middle stretch with the cellar exit pipe and a halfway checkpoint, staircase practice around a real gap, a final approach, and the staircase, flagpole, and castle finale.

Secrets (tracked once per run, shown as `Secrets x / 3` in the HUD):

1. A hidden block containing a moving green 1-Up Mushroom (between the first pipes).
2. A Star hidden in an ordinary brick on the brick route.
3. A warp pipe leading to a secret coin cellar — stand on the marked pipe top and press Down; return by standing on the cellar's exit pipe and pressing Down.

## Scoring

Coins and block coins 200 · power-ups 1,000 · broken bricks 50 · enemy defeats 100 · each firework 500 · each remaining timer unit 50 at the finish. Airborne stomp chains run 100 → 200 → 400 → … → 1-UP; each sliding shell owns an independent 500 → 800 → 1,000 → … → 1-UP chain. Flag bonuses by contact height: 5,000 / 2,000 / 800 / 400 / 100. If the last digit of the displayed timer at flag contact is 1, 3, or 6, that many fireworks launch above the castle.

## Validation

The simulation modules are plain JavaScript that run identically in the browser and under Node.js. Deterministic gameplay checks live in `tests/sim.test.js` and cover movement, jumping, the main route, blocks, items, enemies, shells, fireballs, progression, the finish flow, and lifecycle.

```bash
node tests/sim.test.js
```

Current result: **99 passed, 0 failed** (includes scripted Small- and Big-Mario completions of the full surface route; for the route bots enemies are cleared — enemy interactions are verified by the dedicated enemy/shell/fireball suites; see `FEATURE_AUDIT.md`).

A small inspection API is exposed at `window.__lpm` (`__lpm.game.world`, `__lpm.config`) for deterministic in-browser checks.

## Project structure

```
index.html          entry point (HUD, overlays, touch controls)
js/config.js        tuned constants (movement, scoring, colors)
js/level.js         explicit level data shared by collision and rendering
js/sim.js           authoritative simulation (player, enemies, shells, items,
                    blocks, warp, finish; no rendering dependencies)
js/textures.js      procedural 16x16 nearest-neighbor textures
js/audio.js         Web Audio chiptune engine (original themes and effects)
js/input.js         keyboard + touch input with edge detection
js/render.js        Three.js voxel renderer, animations, cosmetic effects
js/main.js          bootstrap, fixed-step loop, UI states, records
js/vendor/          vendored Three.js r128 (no CDN dependency)
tests/sim.test.js   deterministic gameplay checks (Node.js)
FEATURE_AUDIT.md    feature-gap audit with verification evidence
```

## Notes

- Personal bests (score, completion time) are stored in `localStorage` under a versioned, validated key; storage failures fall back to in-memory records and never block gameplay.
- Audio is initialized only after a user gesture; music pauses with the game and on hidden tabs.
- If WebGL is unavailable, a clear message is shown instead of a blank page.
