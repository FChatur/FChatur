# Manny's knockback: design spec (v0.8.0, proposal)

Status: **proposal for the owner's approval.** Not implemented in the game. The battle-screen concept
currently shows the old, wrong behaviour (enemies thrown sideways off the road); it will follow this
spec once approved.

## 1. The rule

Manny's punch knocks every enemy in its area **backward along the route**: their path progress goes
down, toward the spawn. They fly through the air, tumble, land on the road at the new position, recover
briefly, then walk on as normal. Gameplay position is always a point on the route; only the drawing
leaves the road during the flight.

## 2. Distance

Knockback is measured in **tiles of route distance**, not in percent of the route. A percentage would
make Manny stronger on long maps and weaker on short ones, against the multi-map balance rule (PLAN.md
section 6). The equivalent percentage on the current map is shown for reference.

```
landing = max(routeStart, progress − distance)
distance = baseTiles[level] × weightFactor[enemy] × repeatFactor[enemy]
           (then capped at maxRouteFraction × route length)
```

| Setting | Proposed value | On Switchback (38-tile route) |
| --- | --- | --- |
| `baseTiles` by level | 2.5 · 3.0 · 3.5 tiles | 6.6% · 7.9% · 9.2% (60% → 53.4% at level 1) |
| `maxRouteFraction` | 0.12 | 4.6 tiles; protects very short maps |
| `weightFactor` | light 1.0 (Goblin, Wolf) · medium 0.7 · heavy 0.45 (Armored Orc) · boss 0.2 (Ogre Warlord) | |
| `repeatFactor` (diminishing returns) | 1st knock 1.0 · 2nd 0.6 · 3rd 0.35 · then 0.2. Resets after 6 s without a knock. | |

Your example (60% → 45%) would be about 5.7 tiles here. That's possible as a level 3 or upgrade value,
but at level 1 it would stall goblins almost indefinitely; see section 5.

**New data:** each enemy gets a `weight` class in `config/enemies.ts` (light, medium, heavy or boss), so
future enemies only need a class. All numbers live in `config/towers.ts` under Manny's entry, and every
map uses the same values.

## 3. States and timing

```
walking ──punch──▶ airborne ──land──▶ dazed ──▶ walking
                     │                  │
               untargetable       targetable, not moving
```

| State | Duration | Rules |
| --- | --- | --- |
| **Airborne** | `0.35 s + 0.12 s × tiles` (≈0.65 s at 2.5 tiles) | Progress is set to the landing value at once (the simulation's truth). The enemy can't be targeted, damaged, blocked or counted as leaking. Homing projectiles already chasing it retarget by their tower's mode, or fizzle if nothing is left. |
| **Dazed** | light 0.35 s · medium 0.3 s · heavy 0.2 s · boss 0 s | On the road, targetable, not moving. Stars circle overhead. |
| **Boss stagger** | ~0.3 s | Bosses are not launched. They skid back along the road, by the reduced distance, with a flinch. |

Speed effects (Frost slow) keep running on their own timers during these states.

## 4. Edge cases

- **Corners and U-bends.** The flight is drawn as a straight arc in screen space from the take-off point
  to the landing point, both on the road. At a bend it cuts across the grass, which reads as flying.
  - The arc height is at least ~40 px, so even a short hop around a U-bend reads as a launch.
  - When the landing point is behind Manny, the enemy sails over him.
  - The shadow follows the straight line on the ground.
- **Several enemies at once.** Each gets its own distance (weight, repeat history), so a group stays
  roughly together and keeps its order.
  - Landings are staggered by 0–80 ms so the group doesn't move as one block.
  - The existing sideways spread keeps them from stacking.
  - If two land on the same progress (for example both clamped at the start), they're spaced ±0.15
    tiles apart.
- **Near the start.** The landing is clamped to the route start; the knock just loses its excess.
- **Different speeds.** The distance is the same for everyone, so fast enemies lose less time per knock.
  That's intended: Manny is crowd control for the slow horde, not a counter to wolves. The time lost per
  punch at level 1 is in section 5.
- **Determinism.** Knockback is part of the simulation (`src/core`), runs on its fixed time step, and
  uses no randomness. Tumble spin, landing jitter and hit-stop are drawing only. Hit-stop is shortened at
  2× and 3× speed.
- **Events.** `enemyKnocked {enemy, fromProgress, toProgress, airTime}` and `enemyLanded {enemy}` drive
  the drawing and the sounds, as other game events do.

## 5. Balance check (level 1)

Time an enemy loses per punch = walk-back time + airborne + dazed:

| Enemy (speed) | Distance | Lost per punch |
| --- | --- | --- |
| Goblin (1.5 tiles/s) | 2.5 tiles | 1.7 + 0.65 + 0.35 ≈ **2.7 s** |
| Wolf (2.6 tiles/s) | 2.5 tiles | 1.0 + 0.65 + 0.35 ≈ **2.0 s** |
| Armored Orc (1.0 tiles/s, heavy) | 1.1 tiles | 1.1 + 0.48 + 0.2 ≈ **1.8 s** |
| Ogre Warlord (0.75 tiles/s, boss) | 0.5 tiles (stagger) | 0.67 + 0.3 ≈ **1.0 s** |

**Why the repeat rule matters:**
- Manny punches every 2.3 s. Without the repeat rule, a goblin knocked 2.7 s back would be punched
  again the moment it walked back into range, forever.
- With the rule, the second and third punches push it 1.5 and 0.9 tiles, so it gets through after about
  three knocks. Manny still buys a lot of time for the other heroes.
- All values are starting points, to be tuned with the balance harness: wave reach with and without
  Manny, on every map, before release.

## 6. Tests (when implemented)

- **Unit:**
  - progress always stays within the route;
  - the landing clamps at the start;
  - weight factors, the repeat factors and their reset;
  - the boss stagger has no airborne state;
  - airborne enemies can't be targeted, damaged or leak;
  - homing projectiles retarget;
  - state timings at 1×, 2× and 3×.
- **Invariants and fuzz:** knockback in random runs never puts an enemy off the route.
- **End-to-end:** a launched enemy lands on the road and walks on.
