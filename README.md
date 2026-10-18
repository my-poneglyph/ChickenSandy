# Chicken Sandy — Sandwich Shift

An Overcooked-inspired restaurant game built with **Three.js**. You are a round
little yellow chick in chef's whites running the fry line of a castle kitchen: take
the tickets, fry the chicken and the fries, stack the toppings and sauces, and get
the plate through the window before the customer walks out.

It plays as a **campaign of days**. Day 1 is plain sandwiches and a generous clock;
each day after that adds exactly one new idea and squeezes the timings, and the
pressure also builds *inside* each shift — tickets that arrive late in a day are
fussier than the ones that opened it.

The look is a storybook fantasy kitchen: a polished marble checker floor, castle
walls of real dressed stone, honey-oak cabinets with blue-and-white tiled worktops,
stone stoves with iron skillets over glowing coals, royal-blue banners and an arched
window onto a castle on the hill. Everything is built in code from smooth primitives
— rounded boxes, ellipsoids, cylinders — with painted procedural textures,
physically-based materials and filmic tone mapping. There are no image assets, no
build step, and no network calls at runtime.

A few touches worth knowing about:

* **The floor is polished.** Glossy marble tiles that catch the lights, under a real
  planar reflection with a Fresnel falloff, so it shines most across the room and
  least at your feet. The reflection costs a second draw of the scene, so phones skip
  it; add `?mirror=1` or `?mirror=0` to the URL to force it either way.
* **The walls are built, not painted.** Every wall is courses of individual stones
  standing proud of the mortar, with a plinth along the floor and an overhanging
  coping, all baked into one mesh per wall tile. The back wall stands tall; the side
  and front walls are kept low so they never hide the stoves and trays along them.
* **Food steams.** A pan puffs steam the whole time something is frying, more as it
  nears done and going grey as it starts to catch; a burnt basket smokes. Anything
  fresh out of the oil keeps steaming for a while wherever it ends up — on a
  counter, on a plate, or in someone's arms.

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

The game goes **fullscreen the moment it opens** (`requestFullscreen()`, Bot API 8.0),
which drops Telegram's header and hands the whole screen to the kitchen. For that to
happen at once rather than seconds later, the Telegram SDK is loaded the way Telegram
asks — in the `<head>`, before any other script — so `ready()`, `expand()` and the
fullscreen request run before the 3D scene has even started building. A client still
busy opening the app can drop the request, so it is made a second time 0.6s later if
we are not fullscreen by then. It is asked for on every Telegram client, not just
phones; one that can't do it answers `fullscreenFailed` with `UNSUPPORTED`, is not
asked again, and keeps the expanded layout. Telegram then floats its close and menu
buttons over the top-right of the canvas, so the HUD is kept inside the safe region:
`safeAreaInset` (the device's notch and home indicator) and `contentSafeAreaInset`
(Telegram's own chrome) are summed into the `--sat` / `--sar` / `--sab` / `--sal` CSS
variables that `#hud` is inset by, and re-read whenever the mode changes or the phone
rotates. Add `?tgfs=0` to the URL to opt out and test the windowed layout.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Waddle around the kitchen |
| `E` | Use the highlighted station |
| `Space` | Jump — press again in the air to **flap** (two flaps per jump) |
| `Space` (held while falling) | Glide down slowly |
| `Shift` | Dash |
| `Q` | **Feather Frenzy**, once learnt (the `POWER` button on a phone) |
| Mouse click | Use a station you're standing next to |
| `C` | Switch camera — **Close** / **Overview** / **Behind** |
| `Esc` | Pause (also shows the how-to-play panel) |
| `M` | Mute |
| `P` | Cycle render resolution — full, ½ or ⅓, for a slower machine |

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

**Everyone is solid.** Sandy and her helpers bump into each other rather than walking
through one another; an overlapping pair is pushed apart with a little sideways slip,
so two of them meeting head-on in a one-tile aisle step round each other instead of
wedging. Hop and you sail over a helper. Customers in the dining room do the same
among themselves.

### Levelling up

Sandy earns **XP** for every order that goes out of the window (more for fussier
orders and for tips), and a chunk for a day that pays its way. Each level is a
**skill point**, spent in the shop under *Chef Sandy*:

| Skill | Ranks | Per rank |
| --- | --- | --- |
| Quick Feet | 3 | +8% waddle speed |
| Hot Wings | 3 | Dash recharges 18% faster |
| Extra Flap | 2 | One more flap per jump |
| Long Neck | 2 | Reach stations from further away |
| Sizzle Sense | 3 | Food sits 12% longer before it burns |
| Charming Cluck | 3 | Customers wait 6% longer |
| Golden Feathers | 3 | +15% on every tip |
| Feather Frenzy | 3 | Active power: see below |

**Feather Frenzy** (`Q`) is a burst of speed during which the queue stops getting
impatient: 7s at rank 1, up to 12s at rank 3, then a 50s recharge. Its meter sits
next to the dash and flap readout. The level and XP bar are top-right in the HUD.
Skills, like everything else, live in `src/config.js` (`CS.SKILLS`, `CS.XP`,
`CS.FRENZY`).

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
   in the oil, and red once it's ruined. The early days are kinder: on Day 1 food
   sits twice as long before it burns, easing back to normal by Day 9.
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

The people you are cooking for are fantasy-RPG regulars on their lunch break — a
moogle, a chocobo, a cactuar, a tonberry with its lantern, a bomb, a black mage, a
white mage, Cait Sith in his crown and a mandragora — and they run the whole loop in
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

Characters are dealt so that no two customers in the queue at once are the same
(until the queue is longer than the roster), and the coloured square on each ticket
is that character's colour, so you can tell at a glance whose order is whose. Each
one is sized a touch differently off their seed, so two moogles are not twins.

The roster lives in `CS.CRITTERS` in `src/config.js`: a `look` that picks the costume
in `CS.models.customer()`, body/belly/trim colours and a tail style. Body, arms and
legs are the same rig for every character, which is what lets one walk cycle drive
all of them — so adding a tenth is one entry in that array plus a `look` branch, as
long as it keeps the `parts` names `orders.js` expects.

### The castle grounds

The shop no longer floats in a void. Outside it is a lawn with a cobbled path
running right round the building, hedges and lamp posts along the walls, benches,
a fountain, market stalls, a well, trees, and the castle's curtain wall and keep in
the distance. Off-duty customers stroll the path, stop to wave at the shop, and
step round each other.

Land you have not bought yet is dressed too: a vegetable garden (with a scarecrow
and a gardener) where the Back Room goes, a little orchard where the East Wing
goes, and a pumpkin patch in the corner. Buying a wing clears its plot.

It all lives in `src/grounds.js` and is built once, outside the kitchen's rebuild,
because it sits entirely outside the full map grid. It is cheap enough for a phone:
the static scenery is merged into a handful of meshes, each stroller's limbs are
baked into one mesh per limb (about 10 draw calls instead of 40), phones get fewer
strollers, and everything is kept out of the floor reflection and the shadow pass.
Together it adds roughly 60 draw calls.

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

Each day has a length, a rent and a queue size. One to three stars depending on how
far past your outgoings you land.

The rents are set against what the kitchen can physically produce, measured by
playing it rather than guessed. One ticket is a long round trip — plates, buns, a
counter, the chicken crate, a fryer, back to the counter, maybe the potato bin and
the fryer again, then the window — and a scripted player who never overlaps anything
takes **25 to 37 seconds** per order and gets **three** of them done in a 2:30 shift.

That is the floor the curve is built on, and day 3 at three orders has to come out
positive, because someone having a bad time is exactly who must not be taxed into a
corner. It clears about $5. Five orders clears about $20, eight about $42.

Everything that lifts you off the floor is a real decision: overlapping your trips
(start a basket, fetch the plate while it cooks), a Vented Basket, or hiring Spud to
take the whole fries loop off you.

**You never lose money you have already earned.** Whatever is left after rent and
wages goes in the wallet; a day that does not cover them simply banks nothing and
never reaches into the wallet to take what is already there. At closing you choose:
carry on to tomorrow, or run the same day again to bank a bit more first. Neither is
a punishment, and the shop is never taken off you — `NEW SHOP` on the title screen is
the only thing that starts over, and only when you ask for it.

(This used to be pass-or-fail, and it was a trap: miss the rent and the whole day's
takings evaporated, so the player who most needed an upgrade was exactly the one who
could never bank enough to buy one.)

The menu grows **one ingredient at a time**, so the first days are about learning to
cook, not surviving. Day 1 is one customer at a time with two minutes of patience;
each later day adds a single new thing, and the day card shows a one-line *How to*
for it. A level's `tops`, `sauces` and `cups` lists say which ingredients a ticket
may ask for, and `grace` stretches the burn timer while you are new.

| Day | Name | Length | Rent | Tickets | What's new |
| --- | --- | --- | --- | --- | --- |
| 1 | Opening Day | 2:30 | $4 | 1 | Plain chicken sandwiches |
| 2 | Finding Your Feet | 2:30 | $6 | 2 | A second ticket |
| 3 | Fries Are Up | 2:40 | $8 | 2 | French fries |
| 4 | Garden Fresh | 2:40 | $10 | 2 | Lettuce |
| 5 | Salad Days | 2:45 | $12 | 3 | Tomato, pickles |
| 6 | Sauce Boss | 2:50 | $14 | 3 | Mayo, BBQ sauce |
| 7 | Turn Up the Heat | 2:50 | $16 | 3 | Hot sauce |
| 8 | Sides Please | 2:55 | $18 | 3 | Ketchup cups |
| 9 | Dip Into It | 3:00 | $21 | 3 | BBQ and hot sauce cups |
| **10** | **Castle boss: Grumbold** | 3:30 | none | 3 | See *The castle bosses* below |

Within a single day the spawn interval and customer patience interpolate from the
day's `spawn[0]`/`limit[0]` to `spawn[1]`/`limit[1]`, and ticket complexity ramps
with them — so the last minute of a day is a very different shift from the first.

### Chapters

After the nine learning days the campaign runs in **chapters of ten**: nine ordinary
days, then a castle boss on every tenth (Day 10, 20, 30…). Inside a chapter the
difficulty and the rent **hold still**. You get nine days at one level of pressure
to bank money, hire and train the crew and kit out the kitchen, so you walk into
the boss stronger than you walked out of the last one. The difficulty only steps up
once the boss is fed. The first day of each chapter lists what got harder, and every
day card counts down to the next boss.

| Days | Chapter | Rent | Tickets | Tougher because |
| --- | --- | --- | --- | --- |
| 11–19 | Market Season I–IX | $25 | 4 | A fourth ticket, shorter tempers |
| 21–29 | Tournament Season | $30 | 4 | Fully loaded sandwiches, faster arrivals |
| 31+ | Harvest Festival, The Long Winter… | +$8 a chapter | 4–5 | Faster arrivals, shorter tempers, a fifth ticket from Day 41 |

All of it is `CS.CHAPTERS` and `CS.levelFor()` in `src/config.js`.

### The castle bosses

Every tenth day one of the castle's residents comes down to the shop to be fed.
There are no ordinary customers that day. The boss lands in the dining room, and
its **courses** go onto the rail a few at a time as gold tickets. Each one you serve
flies over the counter into its mouth and fills its **hunger meter**. Let a course go
cold and it roars, shakes the kitchen, and gets hungrier: the meter drops by one.

* **Fill the meter before closing** and it celebrates, pays a **bounty** on top of
  the day's takings, and the first time round leaves a **trophy**: a permanent
  perk, like a piece of equipment. Then the next chapter opens.
* **Run out of time** and it is still hungry. You keep every penny you took (there
  is no rent on a boss day), and go back to the shop to get stronger and try again.
  The way past a boss is to feed it.

From the play camera the boss stands behind the kitchen's tall back wall, so the
hunger panel (bottom right; under the rail on a phone) carries a live **boss cam**:
a second camera that sees only the boss, drawn into the HUD the same way as the
plate inspector. Its head turns to follow Sandy round the kitchen.

| Day | Boss | Twist | Courses | Bounty | Trophy |
| --- | --- | --- | --- | --- | --- |
| 10 | **Grumbold**, the Gatehouse Ogre | *Big Appetite*: plain food, fries with everything, three at once | 8 | $120 | The Gatehouse Key: customers wait 8% longer |
| 20 | **Ignatia**, the Ember Wyrm of the Keep | *Dragonfire*: fryers 30% faster but burn 40% sooner; hot sauce on every sandwich | 10 | $200 | An Ember Scale: fryers 8% faster |
| 30 | **Lord Morrowgast**, the Lantern Lich | *Exacting Taste*: fully loaded with side cups; patient, but his chill slows the fryers 20% | 10 | $300 | The Lich's Hourglass: food sits 15% longer |
| 40 | **The Brass Colossus** | *Clockwork*: four on the rail at once, short fuses | 12 | $400 | The Clockwork Heart: one more customer in the queue |
| 50 | **Count Cockatrix**, the Shadow Rooster | *Stone Glare*: turns a station to stone for a few seconds; fully loaded, four at once | 14 | $600 | The Golden Comb: customers wait 10% longer, food sits 10% longer |

Each has a backstory on its day card. Grumbold has waited three hundred years for a
hot lunch. Morrowgast was the royal chef before you. Cockatrix is Sandy's uncle, the
black sheep of the family. After Day 50 they come round again **Ascended**: three more
courses a lap, shorter fuses and a bigger bounty.

Every boss is built in code like everything else (`src/bosses.js`) and baked to a
few dozen draw calls. Each one wears a napkin. They arrive in their own way: the ogre
and the Colossus drop from the sky with a thud, the dragon flies in, and the lich
rises out of the floor. A reveal camera swings round to watch the boss land while
you read its card, and again when it is full. The music adds timpani and brass for
the day. A station under the Shadow Rooster's glare refuses the chef and the helpers
alike until the stone cracks, and the glare never picks a fryer with food in it.

The bosses, their numbers and their lines are all in `CS.BOSSES` in `src/config.js`.

---

## The money

The till is the score. Every item has a price on the menu board and that is what it
fetches, every time — being quick does not make a sandwich cost more. What speed buys
you is **throughput** (more customers through the door before closing) and **tips**.

| | |
| --- | --- |
| Chicken sandwich | $5.50 |
| Each topping | $0.50 |
| Each sauce | $0.40 |
| French fries | $2.20 |
| Sauce cup | $1.00 |

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
* **Helpers** — listed first, since hiring is the biggest decision before a day. See
  below.
* **Chef Sandy** — spend skill points; see *Levelling up*.

Everything is saved to `localStorage` under `chickenSandy.shop.v1` the moment it
changes, so the shop is still there when you come back. Telegram webviews can clear
storage, so treat it as durable rather than permanent. `NEW SHOP` on the title screen
wipes it.

### Hiring

Five helpers, each with a trade, and all with the sense to help out beyond it.
A thought bubble over each one's head shows what they are working on, and turns
amber if they are stood holding something with nowhere to put it. Whoever is on the
payroll is named on the day card before you open.

| | Hire | Wage | Makes |
| --- | --- | --- | --- |
| **Spud** the fry cook | $85 | 7% of takings, min $1.50 | Fries (chicken with training) |
| **Dollop** the prep hand | $65 | 5% of takings, min $1.00 | Plates with the bun on, ketchup cups (BBQ and hot with training) |
| **Clucky** the grill cook | $95 | 7% of takings, min $1.50 | Fried chicken onto waiting buns (fries with training) |
| **Sprout** the garnish hand | $120 | 6% of takings, min $1.25 | Toppings on plated sandwiches (sandwich sauces with training) |
| **Button** the runner | $150 | 8% of takings, min $2.00 | Carries any plate that matches a ticket out of the window |

The wage is **a share of the day's takings**, not a flat fee. A flat wage punished
exactly the days you could least afford it — a slow shift still owed the full amount.
Now they earn their keep out of what they helped bring in: cheap while the shop is
small, worth real money once it is busy, and never the reason a bad day gets worse.

In order of urgency, a hand will:

1. **Save a basket before it burns** — anybody's, yours included — a beat after it
   dings, unless you are stood right by it with your wings free. An empty-handed hand
   drops whatever errand it is on to do this, and one minding its own basket will go
   too if its own has plenty of time left.
2. **Bin anything burnt**, in a pan or on a counter, so a fryer is never left blocked.
3. **Make what the tickets are short of** in their trade.

Finished food goes **straight onto a plate** on a counter when a ticket wants it
there, and otherwise onto the free counter nearest the serving window, so you always
know where to look. Between them they can put together a whole plate — Dollop sets
out the bun, Clucky drops the chicken on it, Sprout dresses it, Dollop adds the cups
and Button carries it out — though a full crew costs real wages.

The rules that keep them out of your way:

* **Nothing is ever put down on top of something else, and nothing good is ever
  thrown away.** A counter or fryer is checked again the moment a hand arrives,
  because you may well have used it while they were walking over; if it is taken
  they find another. A hand with nowhere to put food keeps hold of it and waits.
* **Every plate is built for one ticket.** Each plate in the kitchen — yours first,
  then any in a helper's arms, then the counters — is paired with the open ticket it
  is closest to becoming, and no two plates share a ticket. A hand only adds what
  *that* ticket still wants, so one mayo order means mayo on one sandwich, not on
  every bun on the pass. A bare plate (no bun) is set out for a fries-and-dips order.
* **Raw food never goes on a counter.** If the fryer a hand was heading for gets
  taken, they wait for another, and if none comes free they put the chicken or
  potatoes back in the crate (no cost).
* **Loose food gets plated.** Fries, chicken or a filled cup left on a counter are
  carried onto the plate whose ticket wants them, so the counters never silt up.
* They never take the last free counter for anything that is not urgent. Only the
  runner touches the serving window, and only the garnish hand puts toppings or
  sandwich sauces on — and only ones an open ticket is still asking for.

Work is **demand-driven**: a hand reads the live ticket rail and nets it against
everything already in the pipeline — on the counters, in the fryers, in your wings,
in another hand's arms, or already on a plate — and only starts a job if the shop is
actually short. So two hands never cook the same portion of fries, and nobody cooks a
second one because you plated the first. Counters and fryers are claimed by whoever
is heading for them, so two hands never race for the same spot.

Training widens the remit — Dollop can learn BBQ and hot sauce, Spud can learn the
chicken fryer — or makes them quicker on their feet or at a station. The wage does not
go up, so training is usually better value than a second hire.

Paths are a breadth-first flood over open floor, recomputed per trip rather than
cached, because the layout is editable and a cached graph would go stale the moment
you moved a counter.

Helpers keep out of each other's way. Each has an idle spot of its own, never next
to a station, and walks back to it along a proper path. A hand picks a side of a
station nobody else is planted on. A waypoint counts as reached once a hand is near
it, so two helpers following the same route don't shove each other off it forever.
If a hand stops making progress, it replans around everyone in the way. If there
is no way round, the one carrying nothing (or the later hire) steps aside, and the
chef always has right of way.

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
  textures.js                 procedural painted textures (stone, oak, oil, breading…)
  models.js                   smooth-primitive builders: chef, customers, staff, food, signs
  mirror.js                   the polished floor: a planar reflection with Fresnel falloff
  world.js                    kitchen construction, stations, lighting, sparks and steam
  interact.js                 item data + resolve(): the single "what does E do" rule
  orders.js                   customer lifecycle, tickets, order matching, tips
  staff.js                    assistant pathfinding and the job board
  bosses.js                   the castle bosses: models, reactions, hunger meter, boss cam
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

`src/audio.js` synthesises everything; there are no audio files. The music is
**Castle Town**, an original eight-bar piece written in the style of a 16-bit
fantasy RPG town theme. The tune is new; only the style is borrowed:

* a **harp** running rising arpeggios across two octaves, each half-bar starting a
  chord tone higher so the bar climbs rather than repeats;
* a breathy **flute** carrying the melody, with a slow-onset vibrato and a puff of
  breath noise on each note;
* **pizzicato bass** and a soft, detuned **string pad**;
* a progression that leans on major sevenths and the Lydian colour of IV(add9):
  **Cmaj7 - F(add9) - Em7 - Am7 - Dm7 - G7 - Abmaj7 - Bbmaj7**. It turns home through
  the **bVI - bVII - I** cadence, the move that makes anything sound like a victory;
* a **glockenspiel** doubling the melody an octave up on alternate passes.

It has two moods and never restarts when switching between them. **Calm** plays in
the shop, on the day card and at the menus: no brushes, and the flute sits out every
other pass. **Shift** plays during the day and adds everything, including a light
brushed backbeat. The first time round the flute rests, so each shift opens quietly.

Notes are queued ahead against `ctx.currentTime` by a lookahead scheduler rather than
fired one at a time from `setInterval`, which is what keeps the timing steady — and
the queue is 1.4s deep so a backgrounded tab, where timers are throttled to roughly
one tick a second, does not punch holes in the loop.

### The castle grounds' sound

Under the music, on its own quiet bus, the grounds have an ambience: the **fountain**
trickling (looped, band-limited noise that slowly breathes), the odd **droplet**, and
**birdsong**, phrases of two to five chirps every few seconds.

Every kind of customer has a **voice**:

| Character | Call |
| --- | --- |
| Chocobo | "kweh!" |
| Moogle | "kupo" |
| Cactuar | a "pew pew" |
| Tonberry | the glint of a knife |
| Bomb | a fizzing fuse |
| Black Mage | a crackle of fire magic |
| White Mage | a gentle healing chime |
| Cait Sith | a meow |
| Mandragora | a squeak |

A stroller calls out when they stop to wave at the shop, quieter the further they
are from the camera. A served customer calls out happily as they leave. Calls are
rate-limited, so a crowd never turns into a choir.

### Jingles

The one-shots are synthesised the same way:

* `doorbell()` is the brass bell over the shop door, rung by each arrival.
* `cash()` is the till: a key press, the bell inside the drawer, the drawer hitting
  its stop and change rattling in. It plays when a customer pays.
* `coins()` is the loose change of a tip landing on the counter.
* `victory()` ends a day that paid its way: a quick climb, a held chord, then the
  bVII - I turn home.
* `levelUp()` is a harp glissando and a bell, for a level-up or a skill learnt.
* `spell()` is a rising rush of air under shimmering bells, for Feather Frenzy.

To retune the music, `PROG` is the progression, `TUNE` the flute's melody and `BPM`
the tempo; each instrument (`strings`, `harp`, `pizz`, `flute`, `glock`, `brush`) is
a short function of its own, and `scheduleStep` decides what plays on which
sixteenth. The voices are in `VOICES`. `CS.audio.debug()` returns the live
`AudioContext` and gain nodes so the mix can be metered with an `AnalyserNode`
instead of judged by ear.

### Draw calls

Phones are limited by how many separate meshes they draw per frame, so the game
merges meshes wherever it can (see the top of `src/models.js`):

* **`CS.batchStatic`** runs at the end of every kitchen build and merges every
  opaque mesh that shares a material into one, wherever it sits. The only things it
  skips are the fryer glow and coals and the hearth flames, which animate. The
  kitchen went from ~600 meshes to under 100.
* **`CS.bake`** merges meshes that share a parent and a material. The chef,
  customers, helpers and every food item go through it. Each limb is still its own
  pivot and keeps its own materials, so nothing looks or animates any differently.
* Baked geometry is not shared, so **`CS.dispose`** returns it to the GPU wherever a
  model is thrown away: a plate served, a customer gone, the kitchen rebuilt.
* Because the kitchen's meshes are merged, a mouse click no longer raycasts to a
  station's mesh. It is met with the worktop plane (y = 1) and goes to the nearest
  station instead.

Altogether a phone frame went from about 1,200 draw calls to about 270.

### A note on colour

The renderer deliberately does **not** apply an sRGB output encode. Every colour in
the game is authored as the value it should appear on screen, and re-encoding them
washed the reds and oranges out to pastel. If you turn `renderer.outputEncoding` back
on, expect to re-tune every colour and light in the project.

`CS.game.teleport(col, row)` is available from the browser console as a debug helper
for jumping straight to a station while testing.
