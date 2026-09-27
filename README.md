# Chicken Sandy — Sandwich Shift

An Overcooked-inspired pixel-art restaurant game built with **Three.js**. You are a
chicken in a chef's hat running the fry line: take the tickets, fry the chicken and
the fries, stack the toppings and sauces, and get the plate through the window
before the customer walks out.

It plays as a **campaign of days**. Day 1 is plain sandwiches and a generous clock;
each day after that adds exactly one new idea and squeezes the timings, and the
pressure also builds *inside* each shift — tickets that arrive late in a day are
fussier than the ones that opened it.

Everything is voxel geometry with 16×16 procedurally-generated pixel textures — there
are no image assets, no build step, and no network calls at runtime. Minecraft-style
directional face shading is baked into the shared box geometry as vertex colours, so
every block in the game gets bright tops, mid-tone fronts and darker sides for free.

---

## Running it

**Just double-click `index.html`.** It opens in your browser and plays. No Node, no
Python, no server required — Three.js is vendored in `vendor/` and every texture is
drawn in-canvas at load time.

If your browser is locked down and refuses to load local scripts, use the
single-file build instead:

```
ChickenSandy-standalone.html
```

Same game, with Three.js and all ten source files inlined into one 693 KB HTML file.
Regenerate it after editing the source with:

```bash
powershell -ExecutionPolicy Bypass -File build-standalone.ps1
```

There is also an optional local web server (uses the built-in Windows
`HttpListener`, no dependencies) if you'd rather play over `http://localhost`:

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

---

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Waddle around the kitchen |
| `E` | Use the highlighted station |
| `Space` | Jump — press again in the air to **flap** (two flaps per jump) |
| `Space` (held while falling) | Glide down slowly |
| `Shift` | Dash |
| Mouse click | Use a station you're standing next to |
| `C` | Switch camera — **Close** / **Overview** / **Behind** |
| `Esc` | Pause (also shows the how-to-play panel) |
| `M` | Mute |
| `P` | Cycle pixel size — 1× crisp, 2× / 3× chunky retro downscale |

### Getting around

The chef is a chicken, so she moves like one. **Dash** (`Shift`) is a short burst
along your current heading with a ~1s cooldown — the fastest way across the kitchen
when three tickets are burning down. **Jump** (`Space`) clears roughly a counter's
height, and a second `Space` in mid-air is a **wing flap** that gives you more lift;
holding `Space` on the way down turns a drop into a flutter.

This is not just decoration: **counters are landable**. Collision is height-aware —
you only bump into a tile whose top surface is above your feet — so a well-timed hop
puts you on the island counter and lets you cut straight across the middle instead of
walking round. Walls are treated as infinitely tall, so no amount of flapping gets
you out of the shop.

The dash cooldown and your remaining flaps are shown in the bottom-left panel.

### Camera views

* **Close** (default) — third-person follow at a fixed angle, so the chef is the
  focus and you can actually see the food. Movement stays screen-relative.
* **Overview** — the whole kitchen and the queue in one fixed shot. Easiest to read
  when four tickets are live.
* **Behind** — true over-the-shoulder. The camera swings round behind the chef and
  `W` means "forward" rather than "north".

All three auto-fit to your window's aspect ratio and are clamped to the shop, so the
camera never drifts off into empty space when you're working a wall. Whatever the
view, the fryer gauges on the right always tell you what is in the oil.

The yellow outline shows which station `E` will act on, and the bar at the bottom of
the screen always spells out exactly what will happen — including *why* an action is
blocked ("Add a bun first", "That is burnt — bin it").

---

## How the line works

You can carry **one thing at a time**, exactly like Overcooked. Counters in the
middle of the kitchen are where you park a plate while your wings are busy.

1. **Plates** — grab an empty plate from the stack.
2. **Buns** — add a bun to the plate; this starts a sandwich.
3. **Chicken crate → Fryer** — raw chicken fries in about 7.5s, then you have ~7s
   before it burns. **Potato bin → Fryer** for fries: ~5.5s, then ~6s of grace.
   A floating bar above the fryer goes green while cooking, amber while it's sitting
   in the oil, and red once it's ruined.
4. **Toppings** — lettuce, tomato, pickles (hold the plate, press `E` at the tray).
5. **Sauces** — mayo, BBQ, hot sauce squeeze onto the sandwich. Ketchup is
   cup-only.
6. **Cup dispenser** — take an empty cup, fill it at a BBQ / hot sauce / ketchup
   bottle, then add it to a plate for a side of sauce.
7. **Serving window** — hand the plate over. It's matched against every open ticket
   and scored against the one closest to running out.
8. **Trash** — bin anything burnt or wrong.

The 3D inset in the bottom-left corner shows the plate you're carrying, rotating, so
you can see the stack you've actually built.

### The days

Each day has a length, a points target and a queue size. Hit the target and you move
on; miss it and you retry that day. One to three stars depending on how far past the
target you land, and a career total across the run.

| Day | Name | Length | Target | Tickets | What's new |
| --- | --- | --- | --- | --- | --- |
| 1 | Opening Day | 2:00 | 400 | 2 | Plate, bun, fried chicken — nothing else |
| 2 | Fries Are Up | 2:20 | 750 | 2 | French fries |
| 3 | Garden Fresh | 2:30 | 1050 | 3 | Lettuce, tomato, pickles |
| 4 | Sauce Boss | 2:40 | 1350 | 3 | Mayo, BBQ, hot sauce |
| 5 | Sides Please | 2:50 | 1650 | 3 | Sauce cups to go |
| 6 | Lunch Rush | 3:00 | 2050 | 4 | A fourth ticket, shorter tempers |
| 7 | The Works | 3:10 | 2500 | 4 | Fully loaded sandwiches |
| 8+ | Overtime *n* | 3:10 | +520/day | 4 | Endless: faster arrivals, less patience |

Within a single day the spawn interval and customer patience interpolate from the
day's `spawn[0]`/`limit[0]` to `spawn[1]`/`limit[1]`, and ticket complexity ramps
with them — so the last minute of Day 7 is a very different shift from the first.

### Scoring

* Base value per ticket (sandwich + each extra + fries + each cup).
* Up to **+60%** for serving with time to spare.
* **Combo multiplier** climbs by 0.25 per correct serve, up to 4×; a customer
  walking out resets it and costs 40 points.

A plate only matches a ticket if it's **exact** — same toppings, same sauces, same
number and kind of sauce cups, fries present or not.

---

## Project layout

```
index.html                    page, HUD markup and all the CSS
vendor/three.min.js           Three.js r128 (vendored so it runs offline)
src/
  config.js                   map, recipes, timings, scoring, difficulty curve
  textures.js                 procedural 16x16 pixel textures (wood, oil, breading…)
  models.js                   voxel builders: chef, customers, food, signs, labels
  world.js                    kitchen construction, stations, lighting, particles
  interact.js                 item data + resolve(): the single "what does E do" rule
  orders.js                   customer queue, ticket generation, order matching
  ui.js                       ticket rail, held-item card, hint line, screens
  audio.js                    WebAudio chiptune SFX and music loop
  game.js                     renderer, camera, player, main loop, scoring
build-standalone.ps1          bundles everything into one HTML file
serve.ps1                     optional zero-dependency local server
index.prototype-backup.html   your earlier prototype page, kept just in case
```

### Tweaking it

Nearly everything worth changing lives in `src/config.js`:

* `CS.LEVELS` — the whole campaign, one object per day: length, target, queue size,
  spawn and patience ramps, and which ingredients are allowed to appear. Add a day,
  reorder them, or change what unlocks when, all in one place. `CS.levelFor(day)`
  generates the endless Overtime days past the end of the list.
* `CS.MAP` — the kitchen layout as ASCII art. Each character is one tile; the legend
  is in the comment right above it. Move a fryer, add a counter, widen the room —
  the world, collision, station labels and camera framing all derive from this.
* `CS.COOK` — fry times and burn grace periods.
* `CS.SCORE` / `CS.STARS` — payouts, combo behaviour, star thresholds.

Movement feel lives at the top of `src/game.js`: `GRAVITY`, `JUMP_V`, `FLAP_V`,
`MAX_FLAPS`, `GLIDE_FALL`, `DASH_SPEED`, `DASH_TIME`, `DASH_CD`. The chef's poses are
all in one function, `animateChef()`, which blends standing, walking, sprinting,
airborne and flapping.

### A note on colour

The renderer deliberately does **not** apply an sRGB output encode. Every colour in
the game is authored as the value it should appear on screen, and re-encoding them
washed the reds and oranges out to pastel. If you turn `renderer.outputEncoding` back
on, expect to re-tune every colour and light in the project.

`CS.game.teleport(col, row)` is available from the browser console as a debug helper
for jumping straight to a station while testing.
