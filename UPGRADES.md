# Current Upgrade Pool

Editable design sheet: `GAME_SHEET.md`

Prices now use a Brotato-style shop formula:

`Final Price = base price + wave + base price * 0.1 * wave`, then a small Luck-based shop discount is applied.

Rerolls use wave-based pricing. Each reroll in the same shop gets more expensive, then resets next wave.

## Ranked Weapons

These can combine with the same weapon at the same rank, up to Rank 4.

- Spark Peashooter: ranged weapon
- Twig Wand: elemental weapon
- Stub Club: melee weapon

## Weapon Mods / Weapon Upgrades

- Fidget Trigger: +12% Attack Speed
- Forked Barrel: +1 projectile, -5% Damage
- Long Straw: +70 Range
- Bent Nail: +3 Ranged Damage
- Sharpened Tooth: +5% Crit Chance
- Training Gloves: +3 Melee Damage
- Static Seed: +3 Elemental Damage

## Items

- Bigger Sparks: +10% Damage
- Fresh Sneakers: +8% Speed
- Lunchbox Heart: +12 Max HP and heal 20
- Pocket Magnet: +40 Pickup Range
- Bandage Sprout: +2 HP Regen
- Vampiric Straw: +3% Life Steal
- Scrap Helmet: +3 Armor
- Nimble Boots: +6% Dodge
- Lucky Button: +10 Luck
- Compost Kit: +6 Harvesting
- Coupon Leaf: -6% shop prices
- Recycling Clamp: +12% crate recycle value
- Garden Shears: easier tree breaking, +4 Luck, +4% Damage
- Toolbox Charm: +3 Engineering

## New Flow

- Wave ends.
- Pick one body-part style stat upgrade. Luck can improve its rarity.
- Open any crate rewards from broken trees.
- For each crate item, take it or recycle it for scrap.
- Enter the shop.

## Current Systems

- Pregame character select:
  - Sprout: balanced starter
  - Chunk: high HP/Armor, lower Speed/Attack Speed
  - Zip: high Speed/Luck, lower HP/Damage
- Luck affects shop rarity, crate reward rarity, body upgrade rarity, bonus scrap, and shop prices.
- Shop rolls follow early weapon guarantees: early shops lean toward weapons, later shops mix items and weapons.
- Shop cards show rarity, type, ownership, and combine hints.
- Hover shop cards or owned gear for detailed descriptions, recycle values, and combine actions.
- Buying out all 4 shop slots grants 1 free reroll in that shop.
- Trees spawn each wave. Breaking a tree queues a crate reward and drops a little scrap.
- Healing bulbs spawn each wave. Breaking one restores HP immediately.
- Crate recycling returns about 35% of the item's current shop value so taking the item and taking scrap are both viable.
- Weapon ranks directly improve weapon power.
- Small enemies are faster, more common, deal less damage, and drop less scrap.
- Large enemies are slower, rarer, deal more damage, and drop more scrap.
- Orange Darters flash briefly before committing to a longer lunge.
- Wave progression is now mostly enemy count/spawn-rate pressure. Enemy stats only improve a tiny amount each wave.
- Damage, Attack Speed, and Speed use Brotato-style percent scaling.
- Armor reduces incoming hit damage with an effective-health curve.
- Dodge rolls per hit and is capped at 60%.
- HP Regen heals 1 HP on a stat-based interval.
- Life Steal can heal 1 HP on weapon hit with a short cooldown.
- Harvesting pays out after each wave and grows by 5%.
