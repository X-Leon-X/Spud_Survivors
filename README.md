# Spud Survivors (Brotato-Style Standalone Prototype)

Open `index.html` in a browser to play, or double-click `PLAY_GAME.bat`.

## Controls

- Move: WASD or arrow keys (aim is automatic)
- `ESC`: pause menu (resume, abandon run, volume / mute / screen-shake settings)
- `M`: mute toggle anytime
- `R`: restart after a run ends
- Click shop cards between waves to buy upgrades

## Code layout

The game is plain JavaScript with no build step, split into modules loaded in
order by `index.html`:

| File | What lives there |
|---|---|
| `js/01-core.js` | Canvas/DOM references, helpers, constants, enemy + character data |
| `js/00-audio.js` | Settings (persisted to localStorage) + procedural WebAudio sound effects |
| `js/00-fx.js` | Screen shake, hit feedback, pause flag, run statistics tracking |
| `js/02-stats.js` | Stat math, item effect scaling, player damage/dodge/armor |
| `js/03-data.js` | Upgrade pool, lore profiles, weapon stat tables |
| `js/04-flow.js` | Run state, wave flow, shop rolls, mutation + crate rewards |
| `js/05-icons.js` | Item/mutation icon painting + pixel sprites |
| `js/06-shop.js` | Shop UI, detail panel, loadout, stat sheets |
| `js/07-combat.js` | Simulation update loop: enemies, weapons, projectiles, pickups |
| `js/08-render.js` | Canvas drawing: arena, entities, projectiles, feedback overlays |
| `js/09-main.js` | Game loop, pause menu, run summary, input wiring, boot |

`game.js.bak` is the pre-refactor single-file version, kept as a backup.

## Feel systems

- Screen shake (toggleable), enemy hit flash, kill pop rings, muzzle flashes
- Low-HP red vignette pulse and damage flash
- Procedural sound effects for shooting, hits, crits, kills, coins, shop actions
- End-of-run summary screen with per-weapon damage breakdown

This is intentionally separate from the Unity project.
