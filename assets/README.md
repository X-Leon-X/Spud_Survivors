# Drop-in art assets

Put redesigned PNGs here with these **exact filenames** and they replace the
code-drawn art everywhere in the game (shop cards, reward cards, owned-loadout
slots, detail preview, crate rewards). Weapons also show in the arena if a
tile-less version is provided (see below).

Any file that is missing just falls back to the original code art, so the game
always runs. Add files incrementally — you don't need all of them at once.

## Expected files (from the current art batch)

| Save as | Replaces |
|---|---|
| `items/armor.png` | Scrap Helmet (item) — gold armor chestplate |
| `items/coupon_leaf.png` | Coupon Leaf (item) — pink gem flower |
| `items/speed.png` | Fresh Sneakers (item) — green/cream boots |
| `items/ranged.png` | Bent Nail (item) — bent metal nail |
| `weapons/twig_wand.png` | Twig Wand (weapon) — twig with orange gem |
| `weapons/flamethrower.png` | Tin Dragon Flamethrower (weapon) — dragon-head burner |
| `mutations/steady_eye.png` | Steady Eye mutation (Eye body part) — cracked eye |

## Enemies (from the enemy sheet)

The enemy art arrived as one combined sheet, so there is a slicer for it:

```
pip install pillow
python tools/slice_enemy_sheet.py path/to/enemy_sheet.png
```

It removes the black background, auto-detects each sprite, and saves the 8 the
game uses into `enemies/` with the right filenames. Extra designs on the sheet
go to `enemies/_unmapped/` so nothing is lost.

Current mapping (grid position on the sheet -> enemy):

| Sheet | Enemy | Why |
|---|---|---|
| row 1, col 1 | `ember_glob.png` | flaming orange blob — lobs fireballs |
| row 1, col 2 | `spitter.png` | blue winged blob — ranged attacker |
| row 2, col 1 | `nibbler.png` | pink smiley blob — the basic chaser |
| row 2, col 2 | `bruiser.png` | purple angry blob — big slow tank |
| row 2, col 3 | `skitter.png` | green spiky cyclops — fast swarmer |
| row 3, col 1 | `orbiter.png` | yellow mossy blob — circle-strafer |
| row 4, col 1 | `darter.png` | angry skull-face — wind-up lunger |
| row 5, col 2 | `drummer.png` | glowing-core blob — support/aura unit |

To change a mapping, edit `MAPPING` at the top of `tools/slice_enemy_sheet.py`
and re-run it, or just rename a file from `_unmapped/` over the one you want.

**Enemy art behaviour in game:**
- Sprites stay **upright** and flip horizontally to face the player (they never
  rotate, so the faces read correctly).
- Animations: idle breathing + lean, squash-bob, white hit flash, gold wind-up
  flash and lunge-stretch for Darters, and a squash-and-fade death pop.
- All gameplay overlays still draw on top: health bars, burn glow, Drummer buff
  aura and link lines, Orbiter ring, and the buffed-enemy ring.
- Art size vs. hitbox is tuned per enemy in `ENEMY_ART_CONFIG` (`js/00-assets.js`)
  via `scale` and `yOffset` — raise `scale` if a sprite looks small for its
  hitbox, adjust `yOffset` to sit the creature on its shadow.

## Notes

- These PNGs bake in their own parchment tile + colored border + rank badge, so
  the game hides its generated tile/badge behind them (no double frame). This is
  controlled by the `.has-art-tile` CSS class.
- **Animations** applied automatically to every PNG icon: idle bob + breathing,
  a periodic light-sweep shine, hover pop + tilt, and a springy reveal pop-in
  when a card first appears.
- **Weapons in the arena:** by default the two weapon PNGs are treated as full
  cards and are shown only in menus; the actual weapon orbiting the player keeps
  its code sprite (a parchment tile spinning around the potato looks wrong). If
  you later export a **tile-less, transparent** weapon PNG, add its key to
  `ART_ARENA_WEAPON` in `js/00-assets.js` and it will render in-world too, with
  the idle breathing animation.

## To add more art

1. Save the PNG here under the right subfolder.
2. Add one line to `ART_SOURCES` in `js/00-assets.js` mapping a key to the path:
   - `"item:<upgradeId>"` for a shop item/weapon by id
   - `"weapon:<Weapon Name>"` for a weapon by display name
   - `"mutation:<part>"` for a body-part mutation (part name, lowercased)
3. If the PNG includes its own tile/border, also add its key to `ART_FULL_CARD`.

Item ids and weapon names are listed in `../GAME_SHEET.md`.
