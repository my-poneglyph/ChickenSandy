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

## Phones, tablets and Telegram

The game detects a touch device and switches to an on-screen control scheme:

* **Drag anywhere in the left half** for a floating analogue thumbstick — the stick
  appears where your thumb lands, so you never have to look for it.
* **USE / JUMP / DASH** buttons sit bottom-right under your other thumb. Holding
  JUMP still glides, and the JUMP button relabels itself `FLAP ••` → `GLIDE` as you
  spend flaps; DASH greys out while it's cooling down.
* The HUD switches to a compact layout: one thin stats row, a four-across ticket
  rail, then held-item and fryer read-outs. The rail's height is measured live, so
  the rows below it never collide with a fussy ticket.
* Camera, sound and pixel-size toggles move into the pause card (tap **❚❚**).
* Phones render at CSS resolution with a smaller shadow map and one less light.

Both orientations work, and the ticket rail is laid out differently in each.
Portrait has height to spare, so the rail runs across the top. Landscape does not —
a phone on its side is about 810x375, where a full-width rail costs a quarter of the
screen and covers the back of the kitchen — so below 470px tall the rail rotates into
a slim column down the left edge, the held-item card drops to the bottom, and the
thumbstick zone starts clear of the column. Same information, out of the play space.

Add `?ui=mobile` or `?ui=desktop` to the URL to force either layout for testing.

### Deploying as a Telegram Mini App

The game is a static site, so any HTTPS host works — GitHub Pages, Cloudflare Pages,
Netlify, Vercel, or your own server.

1. Upload either the whole folder (`index.html`, `src/`, `vendor/`) or just
   `ChickenSandy-standalone.html`, which is the entire game in one file and is the
   simplest thing to host.
2. In [@BotFather](https://t.me/BotFather): create a bot, then `/newapp` to attach a
   Mini App pointing at your HTTPS URL (or `/setmenubutton` for a menu-button app).
3. Open it from Telegram.

There is nothing to configure in the code. On load the game checks whether it is
running inside Telegram and, if so, calls `ready()`, `expand()`,
`disableVerticalSwipes()` (so dragging the thumbstick can't close the app), matches
the header and background to the game's palette, and follows Telegram's
`viewportChanged` events as the webview resizes. Jump, dash and USE also fire haptic
feedback. Outside Telegram none of that runs, and the Telegram SDK is only fetched
when the page is served over http(s) — opened from the filesystem the game makes no
network requests at all.

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

On a phone the same settings live in the pause menu (the `❚❚` button, top-left).
Phones render at 1× like the desktop; `PIXEL` there drops to 2×/3× if a slower
handset needs the frame rate back.

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

**Phones get a fourth view — Kitchen — and only that one.** The three above all fit
the room by its *width*, and a portrait screen has so little horizontal field of view
that holding that width means backing off to around 53 units, which shrank every
station plaque to an unreadable smudge and left half the screen empty. Kitchen frames
the chef and the tiles around her instead, sits a little higher (pitch 1.14 rather
than 0.88), and lets the shop scroll past underneath. There is nothing to switch, so
the VIEW button is hidden on a phone.

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

### The customers

The people you are cooking for are an assortment of small animals — a cat, a pup, a
bunny, a bear, a piglet, a fox, a frog and a mouse — and they run the whole loop in
the dining room, in view through the serving window:

1. **They arrive.** A customer appears on the porch outside, the shop bell rings, and
   they walk in through the front door in the back wall. The door sits directly
   behind the queue, so they come in and join the end of the line without a detour.
2. **They queue.** The line runs from the serving window back towards the door, and
   everyone shuffles up a place whenever the front of it clears.
3. **They order and wait.** At their spot they turn to face the window and idle.
   Under 30% patience a red `!` floats over them and they start fidgeting.
4. **They pay and leave.** A served customer does a happy hop, steps out of the line
   into its own exit lane — so they are not walking back through the queue — and
   goes out the same door. One who ran out of patience skips the hop and stomps out
   faster, shaking their head.

Species are dealt so that no two customers in the queue at once are the same animal
(until the queue is longer than the roster), and the coloured square on each ticket
is that animal's fur colour, so you can tell at a glance whose order is whose. Some
of them wear a cap, picked off their seed, so two bunnies still read as two
customers.

The whole roster lives in `CS.CRITTERS` in `src/config.js`: fur, belly and nose
colours plus an ear shape (`point` / `droop` / `tall` / `round` / `flop` / `none`)
and a tail (`up` / `wag` / `puff` / `curl` / `bush` / `none`). Body, arms and legs
are the same rig for every species, which is what lets one walk cycle drive all of
them — so adding a ninth animal is one entry in that array, as long as it keeps the
`parts` names `orders.js` expects.

### Tips

A customer served with time to spare leaves coins on the counter: the till rings, a
couple of gold coins arc onto the serving window and settle, and a gold toast names
who tipped. It is worth a bonus on top of the order, and the day-end card totals it
up on its own line.

Tipping is deliberately **not** a lottery. Below `tip.minLeft` of their patience
remaining nobody tips at all, and above it both the chance and the size scale with
how early you were — so it pays for a shop that stays ahead of its queue rather than
for luck. All four numbers are in `CS.SCORE.tip` in `src/config.js`.

#### Ideas for the happiness system

Tips are the first half of a happiness mechanic; the boosts they pay for are not
built yet. The hooks that exist today are `S.tips` and `S.tipCount` on the run state
and the per-serve `left` fraction that decides the tip. Things worth trying when it
gets picked up:

* **A happiness meter for the shop**, filled by fast serves and tips and drained by
  walkouts and burnt food. Feed it back into patience: a happy shop is a patient
  queue, which makes a good run compound and a bad one bite.
* **Spend tips between days** on things that make the next shift easier — a fourth
  fryer, a faster oil, a second plate stack, a bell that shows the next ticket early.
  That gives the tip jar somewhere to go besides the score.
* **Regulars.** A customer who was served well comes back tomorrow with a marker over
  them, tips more, and waits longer. One who walked out comes back impatient.
* **Per-species quirks** — the frog always orders sauce cups, the bear always wants
  fries, the mouse is quick to anger but tips double. The species table already has
  somewhere to hang this.
* **Decor as a multiplier.** The dining room is already dressed; let lanterns, signs
  and a swept floor raise a baseline happiness that lifts every tip a little.
* **Streak feedback in the room itself** — animals at the tables clapping, the door
  chiming more often as word gets round, a fuller queue when happiness is high.

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
  platform.js                 touch/mobile detection, viewport sizing, Telegram
  touch.js                    on-screen thumbstick and action buttons
  config.js                   map, recipes, timings, scoring, difficulty curve
  textures.js                 procedural 16x16 pixel textures (wood, oil, breading…)
  models.js                   voxel builders: chef, customers, food, signs, labels
  world.js                    kitchen construction, stations, lighting, particles
  interact.js                 item data + resolve(): the single "what does E do" rule
  orders.js                   customer lifecycle, tickets, order matching, tips
  ui.js                       ticket rail, held-item card, hint line, screens
  audio.js                    WebAudio SFX plus the four-voice music engine
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

### The music

`src/audio.js` synthesises everything; there are no audio files. The music is four
bars of **Am7 - Dm7 - G7 - Cmaj7** at 82bpm played by four voices — a swelling pad
behind a slowly-breathing lowpass, a plucked bass that walks a semitone into each
chord change, an off-beat electric-piano figure and a sparse melody on the C major
pentatonic, with a dotted-eighth delay on the two lead voices. The pad and bass are
fixed; the piano and melody are chosen per bar with rests and a random walk, so the
loop never lands the same way twice, and the melody sits out the first time round so
the shift opens quietly.

Notes are queued ahead against `ctx.currentTime` by a lookahead scheduler rather than
fired one at a time from `setInterval`, which is what keeps the timing steady — and
the queue is 1.4s deep so a backgrounded tab, where timers are throttled to roughly
one tick a second, does not punch holes in the loop.

The one-shots are synthesised the same way. `doorbell()` is the brass bell over the
shop door, rung by each arrival; `cash()` is the till — a key press, the bell inside
the drawer, the drawer hitting its stop and change rattling in — played when a
customer pays; `coins()` is the loose change of a tip landing on the counter.

To retune the music, `PROG` is the chord progression, `PENT` the melody's note pool
and `BPM` the tempo; each voice (`pad`, `bass`, `keys`, `melody`, `brush`) is a short
function of its own, and `scheduleStep` decides what plays on which sixteenth.
`CS.audio.debug()` returns the live `AudioContext` and gain nodes so the mix can be
metered with an `AnalyserNode` instead of judged by ear.

### A note on colour

The renderer deliberately does **not** apply an sRGB output encode. Every colour in
the game is authored as the value it should appear on screen, and re-encoding them
washed the reds and oranges out to pastel. If you turn `renderer.outputEncoding` back
on, expect to re-tune every colour and light in the project.

`CS.game.teleport(col, row)` is available from the browser console as a debug helper
for jumping straight to a station while testing.

## Versioning and releases

The game's version lives in exactly one place: `CS.VERSION` at the top of
`src/config.js`. It is shown quietly on the start card and the pause card, so a bug
report can say which build it came from — worth having, because `main` deploys
itself and the live site moves on.

`main` is the deploy branch, so **every merge into it is a release**, and
`.github/workflows/release.yml` tags it:

1. Read `CS.VERSION`.
2. If `vX.Y.Z` is not tagged yet, release that — you bumped it in the pull request.
   If it is, nobody bumped, so increment the patch and write it back to
   `src/config.js`. Either way this merge gets a tag of its own.
3. Rebuild `ChickenSandy-standalone.html`.
4. Commit anything that changed back to `main` with `[skip ci]` in the message,
   which is what stops the workflow retriggering itself.
5. Push an annotated tag `vX.Y.Z` and publish a GitHub Release.

So: **bump the minor by hand in a pull request that adds a feature**, and leave the
version alone for fixes and chores. The bundler is the same `build-standalone.ps1`
used locally — the workflow runs it with `shell: pwsh`, which ships on the GitHub
ubuntu runners, so there is only ever one implementation of the bundling.

Two consequences worth knowing:

* **Do not hand-commit `ChickenSandy-standalone.html`.** CI regenerates it on `main`,
  which means it can never fall behind `src/`, and keeps a 790KB generated file out
  of pull request diffs where it would conflict with every parallel branch. It is
  marked `linguist-generated` so GitHub collapses it. `build-standalone.ps1` is still
  there for building a copy locally to test.
* **A merge deploys twice** — once for the merge, once for CI's release commit. Both
  are real content changes (the version on the cards moves), and an App Platform
  static build is quick, so this is left alone rather than worked around.
* If you ever put branch protection on `main`, give the workflow a path through it
  or step 4 will fail.

### Branching

Work happens on a branch and lands through a pull request; nothing is committed
straight to `main`, because `main` ships. At the start of a session: back to `main`,
pull, then branch. Branches are named for what they do — `feature/…` for game
changes, `chore/…` for tooling and repo work.
