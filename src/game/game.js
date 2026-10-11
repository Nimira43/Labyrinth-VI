import * as THREE from 'three'
import { buildLabyrinth, shaftHoles } from '../maze/buildLabyrinth.js'
import { DIRS } from '../maze/grid.js'
import { randomSeed } from '../maze/rng.js'
import { createLevelMaterials, shared } from '../materials/surfaceMaterials.js'
import { buildGameWorld } from '../world/buildGameWorld.js'
import { makeCoords } from '../world/coords.js'
import { createPlayer } from './player.js'
import { createOverlay } from './overlay.js'
import { MAZE_WIDTH, MAZE_DEPTH, LOOP_CHANCE } from '../config.js'

// First-person game. For now: walk the labyrinth and look around.
// Lifts, keycard pickups and the escape come next.

const FOG = [0.10, 0.11, 0.125] // fog density per level: it closes in as you climb
const LEVEL_NAMES = ['Level 1', 'Level 2', 'Level 3']

export function createGame(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#000000')
  scene.fog = new THREE.FogExp2('#000000', FOG[0]) // for the non-shader objects (lifts, keycards)

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 80)

  const seed = Number(new URLSearchParams(location.search).get('seed')) || randomSeed()
  history.replaceState(null, '', `?seed=${seed}`)
  const lab = buildLabyrinth({ width: MAZE_WIDTH, depth: MAZE_DEPTH, seed, loopChance: LOOP_CHANCE })
  const coords = makeCoords(lab)

  const materials = createLevelMaterials(3)
  const world = buildGameWorld(lab, materials)
  scene.add(world.root)

  shared.uTorch.value = 1

  // You can't walk out over the hole in the floor where a lift shaft arrives from below.
  const player = createPlayer(camera, lab, coords, { blockedCells: shaftHoles(lab).floorHoles })
  const overlay = createOverlay(container, { seed })

  player.controls.addEventListener('lock', () => overlay.hideIntro())
  player.controls.addEventListener('unlock', () => overlay.showIntro())
  overlay.onEnter(() => player.controls.lock())

  let currentLevel = -1
  function enterLevel(level, cell) {
    player.spawn(level, cell)
    syncLevel()
  }
  function syncLevel() {
    if (player.level === currentLevel) return
    currentLevel = player.level
    world.setVisibleLevel(currentLevel)
    scene.fog.density = FOG[currentLevel]
    shared.uFogDensity.value = FOG[currentLevel]
    overlay.announce(LEVEL_NAMES[currentLevel])
  }

  // Dev shortcut until the lifts work: 1/2/3 jump to where you'd arrive on each floor.
  const arrivals = [lab.start, besideShaft(lab, 1, lab.lifts[0]), besideShaft(lab, 2, lab.lifts[1])]
  window.addEventListener('keydown', (e) => {
    if (!player.controls.isLocked) return
    const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code)
    if (n !== -1) enterLevel(n, arrivals[n])
  })

  enterLevel(0, lab.start)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  if (import.meta.env.DEV) {
    // Handy from the browser console: __game.enterLevel(2, __game.lab.exit)
    window.__game = { lab, player, camera, enterLevel }
  }

  const timer = new THREE.Timer()
  const viewDir = new THREE.Vector3()
  renderer.setAnimationLoop((now) => {
    timer.update(now)
    const dt = Math.min(timer.getDelta(), 0.05)
    const t = timer.getElapsed()

    player.update(dt)
    syncLevel()

    camera.getWorldDirection(viewDir)
    shared.uTime.value = t
    shared.uCameraPos.value.copy(camera.position)
    shared.uViewDir.value.copy(viewDir)
    shared.uTorchPower.value = torchFlicker(t)

    world.animate(t)
    renderer.render(scene, camera)
  })
}

// An old torch: mostly steady, with the odd stutter.
function torchFlicker(t) {
  const hum = 0.96 + 0.04 * Math.sin(t * 13.0) * Math.sin(t * 7.3)
  const stutter = Math.sin(t * 0.7) > 0.985 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 60.0)) : 1
  return hum * stutter
}

// The lift's shaft cell is a hole in the floor above, so arrive in the open cell next to it.
function besideShaft(lab, level, lift) {
  const grid = lab.floors[level]
  const walls = grid.cells[lift.z * grid.width + lift.x]
  const d = DIRS.find((dir) => !(walls & dir.bit))
  return { x: lift.x + d.dx, z: lift.z + d.dz }
}
