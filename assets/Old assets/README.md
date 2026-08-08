# Old assets — superseded art, kept for reference

Nothing in this folder is loaded by the game. These are the **original** weapon sprites,
replaced by the improved tile-less cutouts that now live in `assets/items/`.

They were the old `assets/weapons/` folder. Every weapon here has a better version:

| Old file (here) | Replaced by |
|---|---|
| `spark-peashooter.png` | `assets/items/spark_weapon.png` |
| `twig-wand.png` | `assets/items/twig_wand.png` |
| `stub-club.png` | `assets/items/stub_club.png` |
| `rusty-pistol.png` | `assets/items/rusty_pistol.png` |
| `forked-slingshot.png` | `assets/items/forked_slingshot.png` |
| `scrap-revolver.png` | `assets/items/scrap_revolver.png` |
| `tin-dragon-flamethrower.png` | `assets/items/flamethrower.png` |
| `grenade-launcher.png` | `assets/items/grenade_launcher.png` |

The `-tier5` variants were a per-rank art experiment that the game never wired up.

Note the naming difference: the old files use **hyphens**, the current art uses
**underscores**. `ART_SOURCES` in `js/00-assets.js` is the single source of truth for which
file the game actually loads — if a path is not listed there, it is not used.

**Do not add new art here.** New and improved art goes in the live folders
(`items/`, `enemies/`, `characters/`, `environment/`, `mutations/`, `ui/`).
