# Brotato Prototype — Art & Feature Checklist

Living checklist. Order matters: finish art swaps before new mechanics.

## In progress — current art swap
- [x] Group A clean cutouts wired + cropped + verified in-game
      (twig_wand, spark_weapon, royal_whetstone, heart, rusty_pistol,
       scrap_revolver, slot_machine, recycling_clamp)
- [x] Group B stripped to transparent cutouts + wired + verified in-game:
      armor, coupon_leaf (gem flower), extra_arm (NEW arm `07_33_40 PM.png`),
      speed+dodge (boots), forked_slingshot, mutation:eye (steady_eye.png)
- [ ] flamethrower — card-strip FAILS: the sprite has large LIGHT-GRAY regions (fuel
      tank, dragon head) that the color-keyer can't distinguish from the cream tile, so
      the fill either keeps the tile or erases the sprite to a white silhouette. Same for
      bent nail (silver metal). Color-keying can't fix this class. RESOLUTION: LEON will
      export both as CLEAN CUTOUTS (transparent/near-white bg, NO baked frame) like the
      slimes; then normal keyBackground + crop + wire.
- [x] "Bent Nail" is NOT a new item — it's the display name of existing id `ranged`
      (+2 Ranged Damage). So the bent-nail art → save as `ranged.png`. Already registered
      as item:ranged. Waiting on the clean cutout export.

## Outstanding features (added 8 Aug 2026)

Three deferred features, in the order they make sense to build. Each has real code
already in place, so none of them start from zero.

- [ ] **Fill out the Monster Compendium.** Currently a button + WIP badge only: clicking
      it flashes a "coming soon" toast (`js/09-main.js` ~line 225). The button already
      shows/hides correctly (shop + reward screens only) and sits top-right under the
      HUD. Original ask was "show enemies registering when killed", i.e. a bestiary that
      fills in as you meet each enemy.
      Needs: per-enemy discovered flag on `state` (persisted or per-run — decide which),
      a panel UI, and entries for all 15 `enemyTypes` including the three Clown sizes and
      the split-only ones. Art already exists for every enemy, so it is UI + state only.
      NOTE: the arena is a canvas but every other panel (shop/reward/pause) is DOM —
      follow the DOM pattern, not a canvas overlay.

- [ ] **Implement the Fortune Cookie effect.** Drop, pickup, art and floater all work
      (`killEnemy` + `updateFortuneCookies` in `js/07-combat.js`); it is a flat 1% drop
      from any enemy, deliberately NOT luck-scaled. Collecting it currently grants
      nothing and says "(coming soon)".
      BLOCKED: the effect has never been decided. Do not invent one — ask first.

- [ ] **Add achievements.** Nothing exists yet; this is the only one of the three that
      is genuinely from scratch. `state.runStats` already tracks kills, time, scrap and
      damage taken, and `js/00-gravestone.js` + the run summary already show end-of-run
      data, so those are the natural hooks.
      Decide first: per-run only, or persisted across runs via localStorage (settings
      already persist there, so the pattern exists). Persisted needs a versioned save
      shape or it will break every time the achievement list changes.

## Repeat-art to differentiate LATER (tracked debt)
- [ ] BOOTS art is used for BOTH `speed` and `dodge` (prev AI was lazy). Make two
      distinct icons so the items don't look identical.
- [ ] twig_wand and spark_weapon each arrived as two source files — using one each;
      confirm no other item is silently sharing art.

## Tier-based borders (LATER)
- [ ] Item card border color should vary by tier. Engine already rank-colors the tile;
      confirm/extend so borders differentiate tiers. This is why Group B borders were
      stripped rather than kept.

## Next: Crates (after art swap done)
- [ ] Crates spawn randomly in the arena and give crate items when opened.
      3 crate art files exist (`Downloads/...03_48_42 PM (1..3).png`): plain, gear-lock,
      open-with-loot. Wire art + add spawn + open-reward mechanic.

## Next: finish all remaining item art (after crates)
- [ ] Replace every old/bad placeholder asset. Audit all 34 item ids + 8 weapons +
      enemies + mutations; hunt down the remaining un-replaced ones. Goal: zero old art.

## Then: new game mechanics
- [ ] Only once no asset is old/bad. (e.g. muzzle flash / recoil on ranged firing —
      still absent; noted from earlier session.)

## Slimes — DONE
- [x] 8 slime enemy sprites (separate cutouts, Jul 20 batch) keyed + cropped + wired +
      verified rendering in the arena. Mapping (confirmed by LEON):
      purple-brawler→Bruiser, orange-zoom→Darter, pink-bongo→Drummer, flame→Ember Glob,
      red-fang→Nibbler, yellow-ring→Orbiter, green-legs→Skitter, blue-spit→Spitter.
