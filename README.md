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

On phones the game also asks for **fullscreen** (`requestFullscreen()`, Bot API 8.0),
which drops Telegram's header and hands the whole screen to the kitchen. Telegram
then floats its close and menu buttons over the top-right of the canvas, so the HUD
is kept inside the safe region: `safeAreaInset` (the device's notch and home
indicator) and `contentSafeAreaInset` (Telegram's own chrome) are summed into the
`--sat` / `--sar` / `--sab` / `--sal` CSS variables that `#hud` is inset by, and
re-read whenever the mode changes or the phone rotates. Desktop and web Telegram
clients don't support fullscreen — they answer with `fullscreenFailed` and keep the
expanded layout. Add `?tgfs=0` to the URL to opt out and test the windowed layout.

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
for luck. All four numbers are in `CS.TIP` in `src/config.js`.

The tip is also the only place the **combo** still shows up: it multiplies what you
are tipped, not what you are paid.

#### Ideas still on the shelf

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

Each day has a length, a rent and a queue size. Clear the rent (and any wages) and
you bank the profit and move on; fall short and you retry that day having lost
nothing but the time. One to three stars depending on how far past your outgoings you
land.

| Day | Name | Length | Rent | Tickets | What's new |
| --- | --- | --- | --- | --- | --- |
| 1 | Opening Day | 2:00 | $18 | 2 | Plate, bun, fried chicken — nothing else |
| 2 | Fries Are Up | 2:20 | $32 | 2 | French fries |
| 3 | Garden Fresh | 2:30 | $46 | 3 | Lettuce, tomato, pickles |
| 4 | Sauce Boss | 2:40 | $60 | 3 | Mayo, BBQ, hot sauce |
| 5 | Sides Please | 2:50 | $74 | 3 | Sauce cups to go |
| 6 | Lunch Rush | 3:00 | $90 | 4 | A fourth ticket, shorter tempers |
| 7 | The Works | 3:10 | $108 | 4 | Fully loaded sandwiches |
| 8+ | Overtime *n* | 3:10 | +$18/day | 4 | Endless: faster arrivals, less patience |

Within a single day the spawn interval and customer patience interpolate from the
day's `spawn[0]`/`limit[0]` to `spawn[1]`/`limit[1]`, and ticket complexity ramps
with them — so the last minute of Day 7 is a very different shift from the first.

---

## The money

The till is the score. Every item has a price on the menu board and that is what it
fetches, every time — being quick does not make a sandwich cost more. What speed buys
you is **throughput** (more customers through the door before closing) and **tips**.

| | |
| --- | --- |
| Chicken sandwich | $4.50 |
| Each topping | $0.40 |
| Each sauce | $0.30 |
| French fries | $1.80 |
| Sauce cup | $0.75 |

Money also goes *out*. Food you bin was bought with real money, so a burnt basket
costs you the stock as well as the time, and a customer who walks out takes the prep
that was already in flight with them. Anything still sitting on a counter when the
shutters come down is written off too. All of it is in `CS.PRICES`, `CS.FOOD_COST`
and `CS.WALKOUT_COST`.

A plate only matches a ticket if it's **exact** — same toppings, same sauces, same
number and kind of sauce cups, fries present or not.

At closing time you get an itemised receipt: sales by line, tips, waste, then rent
and wages off the bottom. Where the money came from is the thing that tells you what
to buy next.

## The shop

Between days you are in the shop, spending the profit. Four kinds of thing to buy:

* **Equipment** — fitted the moment you buy it. Vented Baskets and Twin Burners take
  15% off the fryer clock each (and compound); a Thermostat buys you half again as
  long before a basket burns; a Waiting Bench makes customers 12% more patient; Deep
  Trays fit a fourth sauce cup on a plate; a Roadside Sign adds a customer to the
  queue.
* **Kit** — a fryer, a prep counter, a sauce bottle. Buying one drops it in the tray;
  you place it yourself in the kitchen editor.
* **The building** — the Back Room adds two rows, the East Wing four columns. The
  wall moves out and anything mounted on it slides out with it.
* **Staff** — see below.

Everything is saved to `localStorage` under `chickenSandy.shop.v1` the moment it
changes, so the shop is still there when you come back. Telegram webviews can clear
storage, so treat it as durable rather than permanent. `NEW SHOP` on the title screen
wipes it.

### Hiring

Two assistants, each of whom does exactly one job and refuses to do anything else.
That is the point: you should be able to glance at the potato and know what it is
about to do.

| | Hire | Wage | Does |
| --- | --- | --- | --- |
| **Spud** the fry cook | $150 | $8/day | Potato bin → fryer → prep counter |
| **Dollop** the sauce hand | $120 | $6/day | Cup dispenser → ketchup → prep counter |

They never assemble a plate and never touch the serving window. Deciding what goes on
the plate stays your job — they just keep you in stock, and you pick their output up
off a prep counter the same way you'd pick up anything else.

Work is **demand-driven**: a hand reads the live ticket rail, nets it against what is
already on the counters, in the fryers and in another hand's arms, and only starts a
job if the shop is actually short. So two hands never cook the same portion of fries,
and nobody fills your counters with cups nobody ordered. They also leave you a free
counter to work on. Spud stands over a basket and lifts it the moment it dings, which
is most of what you are paying for; a basket that burns anyway goes straight in the
bin rather than onto a counter.

Training widens the remit — Dollop can learn BBQ and hot sauce, Spud can learn the
chicken fryer — or makes them quicker on their feet or at a station. The wage does not
go up, so training is usually better value than a second hire.

Paths are a breadth-first flood over open floor, recomputed per trip rather than
cached, because the layout is editable and a cached graph would go stale the moment
you moved a counter.

### The kitchen editor

`KITCHEN` in the shop opens a flat grid of the whole floor. Tap something to pick it
up, tap a tile to set it down; legal tiles light up green while you are holding
something. Wall-mounted kit (fryers, crates, trays, bottles, the serving window) goes
on a boundary wall, prep counters and plate stacks go on open floor, and a bin is
happy either way. Move the serving window and the queue and the front door move with
it.

Nothing is written until you press `DONE`, and `DONE` stays locked while the layout is
unplayable — if you wall yourself off from the fryers it tells you how many tiles are
stranded instead of letting you save it. `CANCEL` puts everything back.

Land you have not bought is `~` in the grid: solid, and drawn as nothing at all. The
grid is always the same size whatever you own, which is what keeps the world origin
(and every constant derived from it) still when a wing opens up.

---

## Project layout

```
index.html                    page, HUD markup and all the CSS
vendor/three.min.js           Three.js r128 (vendored so it runs offline)
src/
  platform.js                 touch/mobile detection, viewport sizing, Telegram
  touch.js                    on-screen thumbstick and action buttons
  config.js                   base map, recipes, timings, prices, shop catalogue
  layout.js                   the live editable grid: bounds, expansion, validation
  economy.js                  wallet, daily ledger, upgrade modifiers, the save file
  textures.js                 procedural 16x16 pixel textures (wood, oil, breading…)
  models.js                   voxel builders: chef, customers, staff, food, signs
  world.js                    kitchen construction, stations, lighting, particles
  interact.js                 item data + resolve(): the single "what does E do" rule
  orders.js                   customer lifecycle, tickets, order matching, tips
  staff.js                    assistant pathfinding and the one-job-each AI
  ui.js                       ticket rail, held-item card, hint line, screens
  shop.js                     the between-days buy screen
  editor.js                   the drag-and-drop kitchen grid
  audio.js                    WebAudio SFX plus the four-voice music engine
  game.js                     renderer, camera, player, main loop, the till
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
