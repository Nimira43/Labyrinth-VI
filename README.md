# Labyrinth VI

A first-person horror labyrinth on three floors, built with **Three.js**, **GLSL** and **Vite**.

You wake on the lowest floor of a living maze. Its walls breathe, its veins glow, and somewhere above you a heart is beating. Find the keycards, power the lifts, climb through three floors and walk into the light.

Every load builds a brand-new labyrinth. There's no map.

---

## Getting started

```bash
npm install
npm run dev
```

Open the local address Vite prints, usually `http://localhost:5173`, and click the title screen to enter.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Build a production version into `dist/` |
| `npm run preview` | Serve the production build locally |

**Requirements:** Node.js 20.19+ or 22.12+ (needed by Vite 8), and a browser with WebGL and Web Audio (any recent Chrome, Edge, Firefox or Safari).

---

## How to play

| Key | Action |
| --- | --- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / arrow keys | Move |
| <kbd>Shift</kbd> | Run |
| Mouse | Look |
| <kbd>E</kbd> | Ride or call a lift |
| <kbd>Esc</kbd> | Pause (volume sliders are on the pause screen) |

**The route out:**

1. **Level 1:** find **keycard 1**. It powers **lift 1**.
2. Ride lift 1 up to **Level 2** and find **keycard 2**, which powers **lift 2**.
3. Ride lift 2 up to **Level 3** and walk into the **shimmering light** falling through the roof.

**Tips:**

- Lifts start dead, sputtering red. Once a lift is powered it glows, and you can ride it in either direction as often as you like.
- If a lift is on the other floor, stand next to its shaft and press <kbd>E</kbd> to call it. Then wait.
- Keycards hide in dead ends. Look for a warm golden glow on the stone, and listen for a faint glassy hum that pans towards the card.
- On Level 3, the light makes the only warm, consonant sound in the whole labyrinth. Follow it.

---

## The three floors

| Floor | Colour | Rhythm | Sound |
| --- | --- | --- | --- |
| **Level 1** | Cold, drowned blue | Slow breathing | A hollow drone and a draught |
| **Level 2** | Dark green and mustard, bleeding together | Two out-of-sync rhythms churning | A seasick, wobbling drone |
| **Level 3** | Deep blood red, wet | A heartbeat (68 BPM) rippling out from the centre | A heartbeat in sync with the walls, louder towards the middle |

The higher you climb, the more the walls bulge, the closer the fog presses in, and the more alive everything feels.

---

## Seeds

Each load picks a random **seed**, and the whole labyrinth is built from it: all three mazes, the lifts, the keycards and the exit.

- **Refresh** for a new labyrinth.
- The seed is shown on the title screen as a link. Bookmark it to keep a maze you like.
- Add `?seed=1234` to the URL to play a particular labyrinth.
- On the escape screen, **Replay this one** pins the current seed, and **Enter a new labyrinth** gives you a fresh one.

---

## Generator view

Add `?debug` to the URL (for example `?debug&seed=1234`) to see the generator. It shows all three floors floating in a stack, joined by the lift shafts, with the start, keycards, exit and intended route marked.

| Key | Action |
| --- | --- |
| <kbd>R</kbd> | New maze |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Show one floor |
| <kbd>0</kbd> | Show all floors |
| <kbd>E</kbd> | Explode or collapse the stack |
| <kbd>P</kbd> | Toggle the route |
| <kbd>C</kbd> | Toggle Level 3's roof |

**Dev shortcuts.** These only work in `npm run dev`, never in a production build:

- <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> jump to a floor.
- <kbd>K</kbd> gives you both keycards.

---

## How it works

### Maze generation (`src/maze/`)

- **One grid, three floors.** Every floor is a 15 × 15 grid of cells. Each cell stores its four walls as a bitmask. All floors share the same grid, so a lift shaft is simply the same cell on two floors.
- **Carving.** Each floor is carved with an iterative recursive backtracker. A few extra walls are then knocked out (`LOOP_CHANCE`) to create loops, so the maze can't be solved by following one wall.
- **Placement by distance.** A breadth-first search measures walking distance across each floor:
  - the start goes at one end of Level 1's longest route
  - each lift goes on the cell farthest from where you arrive on that floor
  - the exit goes on the cell farthest from where you arrive on Level 3
  - each keycard goes in the dead end that's the biggest detour from the direct route
- **Seeded randomness.** A small seeded generator (mulberry32) makes every maze reproducible from its seed.

### Shaders (`src/shaders/`)

Everything is procedural. There are no textures.

- **`surface.vert`** makes the walls **breathe**. The big faces bulge outwards in time with their level's pulse, and the bulge fades to zero at the panel edges so the walls stay sealed.
- **`surface.frag`** paints walls, floors and ceilings using:
  - simplex noise and fractal noise for grime and stains
  - ridged noise for the **veins**, which drift slowly through the stone and glow on their own
  - a torch beam that lights the stone and fully **wakes** the veins it touches, while veins in the dark only smoulder
  - a golden spill of light around an uncollected keycard
  - a wet sheen on Level 3 that catches the heartbeat
  - exponential fog that closes in towards black
- **`common/pulse.glsl`** holds each floor's rhythm. Level 3's heartbeat starts at the maze centre and ripples outwards.
- **`beam.vert` / `beam.frag`** draw the exit light: a soft column with shimmering bands and drifting motes.

### Gameplay (`src/game/`)

- **`player.js`:** mouse look (pointer lock), WASD movement with smooth acceleration, head bob and footstep timing.
- **`collision.js`:** the player is a circle that is pushed out of thin wall boxes, testing only the 3 × 3 cells around them.
- **`lifts.js`:** a small state machine, `bottom → moving up → top → moving down`. A shaft is only walkable on the floor where its platform is resting; everywhere else it's an open drop.
- **`game.js`:** ties it together, covering keycards, lift interaction, the escape and the main loop.
- **`overlay.js`:** the title and pause screen, level banners, keycard slots, prompts, story messages and the escape screen.

### Audio (`src/audio/`)

- **`engine.js`:** a Web Audio context with separate **music** and **effects** channels, a generated stone-room reverb, a limiter, and **ducking**, which dips the music for big moments. Volumes are remembered between visits.
- **`music.js`:**
  - `title_screen.mp3` loops on the title screen.
  - In the game, all five tracks play as a shuffled, endless playlist with 4-second crossfades.
- **`sfx.js`:** every sound effect is **synthesised**, with no audio files:
  - floor drones and the Level 3 heartbeat, beat-for-beat with the shader
  - footsteps
  - lift clunks, motor and grind, muffled through floors
  - dead-lift buzz
  - keycard chime and hum
  - torch crackle
  - the warm chord of the exit light

Browsers block audio until the player clicks. If the title music can't start on load, the first click says **"Click to begin"** and starts the sound, and the second click enters.

---

## Project structure

```
labyrinth-vi/
├── index.html
├── vite.config.js            # vite-plugin-glsl, so shaders can be imported and #included
├── public/
│   ├── TheFavicon.png
│   └── sounds/               # title_screen.mp3, track_1.mp3 … track_4.mp3
└── src/
    ├── main.js               # boots the game, or the generator view with ?debug
    ├── config.js             # cell size, wall height, maze size, loop chance
    ├── css/main.css
    ├── maze/                 # rng, grid, floor carving, BFS, labyrinth assembly
    ├── world/                # builds the 3D world from a labyrinth
    ├── materials/            # shared shader materials and uniforms
    ├── shaders/              # GLSL: surfaces, exit beam, noise, per-level pulses
    ├── game/                 # player, collision, lifts, overlay, main game
    ├── audio/                # engine, music playlist, synthesised effects
    └── debug/                # the stacked-floors generator view
```

---

## Tuning

Most of the feel is a few numbers:

| What | Where |
| --- | --- |
| Maze size, corridor width, wall height, loops | `src/config.js` |
| Floor colours, vein size and drift | `levelPalette()` in `src/shaders/surface.frag` |
| Pulse rhythms and heartbeat BPM | `src/shaders/common/pulse.glsl`. If you change the BPM, also change `HEART_BPM` in `src/audio/sfx.js` so the sound stays in sync. |
| How much each floor's walls breathe | `BREATH` in `src/materials/surfaceMaterials.js` |
| Fog per floor | `FOG` in `src/game/game.js` |
| Lift speed | `TRAVEL` in `src/game/lifts.js` |
| Walk and run speed | `WALK` / `RUN` in `src/game/player.js` |
| Default music and effects volume | `DEFAULT_MUSIC` / `DEFAULT_SFX` in `src/audio/engine.js` |

---

## Built with

- [Three.js](https://threejs.org/), for 3D rendering
- [Vite](https://vite.dev/), for the dev server and build
- [vite-plugin-glsl](https://github.com/UstymUkhman/vite-plugin-glsl), for importing shaders with `#include`
- Simplex noise by Ashima Arts and Stefan Gustavson (MIT), [webgl-noise](https://github.com/ashima/webgl-noise)
- The Web Audio API, for all sound effects

The sixth in the Labyrinth series. *"That's it, no more."* We'll see.
