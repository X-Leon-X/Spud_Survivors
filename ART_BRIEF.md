# Art brief — new enemies, weapons and items

Generate these PNGs, then tell me and I'll crop, register and code everything.

## Shared style rules (match the existing art)

- **Cartoon, thick dark outline** (~#111722), chunky shapes, saturated colours, soft interior shading.
- **Square canvas**, 1024×1024 is ideal (I downscale to 512×512).
- **Plain flat background** — any solid colour, as long as it does NOT appear inside the artwork. I flood-fill it away to transparency from the borders. A mid-grey works well.
- **Don't** bake in a drop shadow, ground shadow, frame, tile, border or text label. The game draws its own shadows and health bars.
- Leave a little breathing room around the subject; I crop tight automatically.

## Naming (exact — the loader is case- and separator-sensitive)

Enemies use **hyphens**, items and weapons use **underscores**.

---

## Enemies → `assets/enemies/`

Front-facing potato/vegetable-blob creatures, matching the existing slime-ish cast.

| File | Name | Look |
|---|---|---|
| `husk.png` | Husk | Small, dry, cracked brown-grey potato. Hollow and brittle — visibly looks like it would split open. Faint seams down the body. |
| `thistle.png` | Thistle | Small and **rooted** — a spiky thistle-pod on a short stalk gripping the ground. Purple-green, bristling with spines. It never moves, so give it a planted, anchored base. |
| `blight-sac.png` | Blight Sac | Medium, bloated, translucent sickly-green sac. Visibly swollen with toxic fluid, bulging and unstable. Looks like it will burst. |
| `gravebloom.png` | Gravebloom | Large, dark corpse-flower growing out of a potato body. Deep purple petals, drooping head, small pods clustered at the base (the things it summons). Ominous. |
| `clown.png` | Clown | Large round potato clown. Bright motley colours, red nose, frizzy hair, wide unsettling grin. Should look **inflated and ready to pop**. |
| `clown-mid.png` | Clown (mid) | The same clown, clearly **smaller and simpler** — same palette and face so it reads as the same creature scaled down. |
| `clown-small.png` | Clown (small) | Smallest version. Tiny, simple, same colours. Barely more than a nose and a grin. |

**Keep the Bruiser the visual heavyweight.** Gravebloom and the base Clown are large, but shouldn't out-bulk a big purple Bruiser.

**The three clowns must read as one family** — same palette, same face, just progressively smaller and simpler. Ideally generate them together so they stay consistent.

---

## Weapons → `assets/items/`

Tile-less cutouts on transparent background — a single weapon object, no card frame, no rank badge.

**Orientation matters: draw each weapon pointing to the RIGHT, roughly horizontal.** Weapons rotate to follow the aim, so a diagonal pose will visibly point off-target in game.

| File | Name | Look |
|---|---|---|
| `potato_masher.png` | Potato Masher | Kitchen masher as a club. Wooden handle, heavy perforated metal mashing head. Dented, well-used. |
| `seed_shotgun.png` | Seed Shotgun | Improvised short double-barrel shotgun built from garden junk. Wide flared barrels, wooden stock, seed-pod shells. |
| `thorn_lasher.png` | Thorn Lasher | **A whip** — a long coiled leather-and-vine whip studded with thorns. Handle at the left, the lash curling out to the right. Green-brown, wicked barbs. |
| `frost_bow.png` | Frost Bow | **A crossbow** made of pale frozen wood and ice. Icy blue-white, frost crystals along the limbs, an icicle bolt loaded. Must read clearly as **ice/cold**. |
| `shuriken.png` | Shuriken | A four-pointed throwing star. Dark steel with a bright honed edge, a little worn. Clean and sharp. (Symmetrical, so orientation is flexible.) |

---

## Items → `assets/items/`

Small object icons, same cartoon style. No frame or tile — the game draws the card behind them.

| File | Name | Look |
|---|---|---|
| `fun_hat.png` | Fun Hat | A colourful knitted **beanie cap with a propeller** on top. Cheerful, stripey, slightly goofy. The propeller should be clearly visible. |
| `flint_steel.png` | Flint & Steel | A flint stone and a curved steel striker, with a few bright **sparks** flying off where they meet. Warm orange sparks against grey stone. |
| `useful_glasses.png` | Useful Glasses | Spectacle **frames only — no lenses, no glass**. Empty round wire rims you can see straight through. Thin metal frame, slightly bent. This is the joke, so make the emptiness obvious. |

---

## When you're done

Drop them anywhere (Downloads is fine) and tell me. I'll handle: background removal → tight crop → 512×512 → `ART_SOURCES` registration → all stats, behaviours and balance.

If any single sprite is awkward to generate, send the rest — I can start on everything else and slot the last one in later.
