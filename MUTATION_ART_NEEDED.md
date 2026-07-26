# Mutation Art Still Needed — Spud Survivors

Mutations ("body upgrades") are the between-wave body-part rewards. Only **Eye** has real
art so far (`assets/mutations/steady_eye.png`); the other 14 parts still use code/pixel art.

## Export format (same as items/enemies — these keyed perfectly)
Each as a **clean cutout on a plain solid white background**, NO card frame / border / rank
badge, thick dark cartoon outline, small margin, no drop shadow on the background. The game
draws the tier-colored outline itself. Roughly square framing, subject centered.

## Wiring
- Save each as `assets/mutations/<part>.png` (lowercase, shown in the table).
- Then add one line to `ART_SOURCES` in `js/00-assets.js`:
  `"mutation:<part>": "assets/mutations/<part>.png",`
  (The `mutation:eye` line is the existing example.)
- Art is keyed by **part**, so both mutations that share a part (Heart, Eye) reuse one image.

## Parts still needing art (14)
| Save as | Part | Mutation name(s) in game | What it boosts | Art idea |
|---|---|---|---|---|
| `assets/mutations/heart.png`   | Heart   | Reinforced Heart / Steady Heartbeat | Max HP / HP regen | a plump cartoon heart-organ |
| `assets/mutations/veins.png`   | Veins   | Hungry Veins        | Lifesteal        | red pulsing veins / vessels |
| `assets/mutations/muscles.png` | Muscles | Knotted Muscles     | Damage %         | a flexed potato-arm muscle |
| `assets/mutations/hands.png`   | Hands   | Heavy Hands         | Melee damage     | chunky cartoon fists |
| `assets/mutations/nerves.png`  | Nerves  | Hot Nerves          | Elemental damage | glowing/sparking nerve strands |
| `assets/mutations/tendons.png` | Tendons | Twitch Tendons      | Attack speed     | taut springy tendons |
| `assets/mutations/brain.png`   | Brain   | Sharp Instinct      | Crit chance      | a small cartoon brain |
| `assets/mutations/fingers.png` | Fingers | Tool Sense          | Engineering      | nimble fingers / a pointing finger |
| `assets/mutations/arms.png`    | Arms    | Longer Arms         | Range            | a long stretchy arm |
| `assets/mutations/skin.png`    | Skin    | Thicker Skin        | Armor            | a tough potato-skin patch/hide |
| `assets/mutations/ankles.png`  | Ankles  | Loose Ankles        | Dodge            | a springy ankle/foot joint |
| `assets/mutations/legs.png`    | Legs    | Quicker Legs        | Speed            | speedy little potato legs |
| `assets/mutations/mole.png`    | Mole    | Lucky Mole          | Luck             | a cute lucky mole (spot or animal) |
| `assets/mutations/thumb.png`   | Thumb   | Greener Thumb       | Harvesting       | a green (literally) thumb with a sprout |

## DONE
| `assets/mutations/steady_eye.png` | Eye | Steady Eye | Ranged damage | (already wired) |

Total: **14 images** to complete the mutation set.
