import * as THREE from 'three'
import { buildLabyrinth } from '../maze/buildLabyrinth.js'
import { DIRS } from '../maze/grid.js'
import { randomSeed } from '../maze/rng.js'
import { createLevelMaterials, shared } from '../materials/surfaceMaterials.js'
import { buildGameWorld } from '../world/buildGameWorld.js'
import { makeCoords } from '../world/coords.js'
import { createPlayer } from './player.js'
import { createLifts } from './lifts.js'
import { createOverlay } from './overlay.js'
import { MAZE_WIDTH, MAZE_DEPTH, LOOP_CHANCE } from '../config.js'

const FOG = [0.1, 0.11, 0.125] 
const LEVEL_NAMES = ['Level 1', 'Level 2', 'Level 3']
const PICKUP_RANGE = 1.3
const EXIT_RANGE = 1.0

const CARD_MESSAGES = {
  1: 'Keycard 1. Somewhere, a lift shudders into life.',
  2: 'Keycard 2. The way up is open.',
}

export function createGame(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#000000')
  scene.fog = new THREE.FogExp2('#000000', FOG[0])

  const camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.05,
    80,
  )

  const seed =
    Number(new URLSearchParams(location.search).get('seed')) || randomSeed()
  history.replaceState(null, '', `?seed=${seed}`)
  const lab = buildLabyrinth({
    width: MAZE_WIDTH,
    depth: MAZE_DEPTH,
    seed,
    loopChance: LOOP_CHANCE,
  })
  const coords = makeCoords(lab)

  const materials = createLevelMaterials(3)
  const world = buildGameWorld(lab, materials)
  scene.add(world.root)
  shared.uTorch.value = 1

  const blocked = lab.floors.map(() => new Set())
  const lifts = createLifts(lab, world)
  lifts.updateBlocked(blocked)

  const player = createPlayer(camera, lab, coords, { blockedCells: blocked })
  const overlay = createOverlay(container, { seed })

  const state = {
    level: -1,
    riding: null,
    keycards: new Set(),
    escaped: false,
    escapeTime: 0,
    playTime: 0,
    interaction: null,
  }

  player.controls.addEventListener('lock', () => overlay.hideIntro())
  player.controls.addEventListener('unlock', () => {
    if (!state.escaped) overlay.showIntro()
  })
  overlay.onEnter(() => player.controls.lock())

  function enterLevel(level, cell) {
    player.spawn(level, cell)
    syncLevel()
  }

  function syncLevel() {
    if (player.level === state.level) return
    state.level = player.level
    world.setVisibleLevel(state.level)
    scene.fog.density = FOG[state.level]
    shared.uFogDensity.value = FOG[state.level]
    overlay.announce(LEVEL_NAMES[state.level])
  }

  function checkKeycards() {
    const p = player.position
    for (const card of lab.keycards) {
      if (state.keycards.has(card.id) || card.level !== player.level) continue
      const d = Math.hypot(p.x - coords.cx(card.x), p.z - coords.cz(card.z))
      if (d < PICKUP_RANGE) takeKeycard(card.id)
    }
  }

  function takeKeycard(id) {
    if (state.keycards.has(id)) return
    state.keycards.add(id)
    world.collectKeycard(id)
    lifts.power(lifts.list[id - 1])
    overlay.setKeycards([...state.keycards])
    overlay.message(CARD_MESSAGES[id])
  }

  function findInteraction() {
    if (player.riding || state.escaped) return null
    const level = player.level
    const cell = player.cell
    const grid = lab.floors[level]
    const walls = grid.cells[cell.z * grid.width + cell.x]

    for (const lift of lifts.list) {
      if (level !== lift.fromLevel && level !== lift.toLevel) continue
      const inShaft = cell.x === lift.x && cell.z === lift.z
      const dir = DIRS.find(
        (d) => cell.x + d.dx === lift.x && cell.z + d.dz === lift.z,
      )
      const beside = dir && !(walls & dir.bit)
      if (!inShaft && !beside) continue

      if (!lift.powered)
        return {
          lift,
          kind: 'dead',
          text: `The lift is dead. It needs keycard ${lift.id}.`,
        }
      if (lift.moving)
        return { lift, kind: 'busy', text: 'The lift is moving…' }
      if (lifts.restingLevel(lift) === level) {
        if (!inShaft) return null
        const up = level === lift.fromLevel
        return {
          lift,
          kind: up ? 'up' : 'down',
          text: up ? 'E  ·  go up' : 'E  ·  go down',
        }
      }
      return { lift, kind: 'call', text: 'E  ·  call the lift' }
    }
    return null
  }

  function interact() {
    const it = state.interaction
    if (!it) return
    const { lift } = it

    if (it.kind === 'up' || it.kind === 'down') {
      if (!lifts.send(lift, true)) return
      state.riding = lift
      player.setRide({
        x: coords.cx(lift.x),
        z: coords.cz(lift.z),
        y: lift.y,
        moving: false,
      })
      world.setVisibleLevels([lift.fromLevel, lift.toLevel])
    } else if (it.kind === 'call') {
      if (!lifts.send(lift, false)) return
      overlay.message(
        player.level === lift.toLevel
          ? 'Far below, something begins to climb.'
          : 'Above you, something begins to descend.',
      )
    }
  }

  function onLiftArrive(lift, hadRider) {
    if (!hadRider) return
    player.setLevel(lift.at === 'top' ? lift.toLevel : lift.fromLevel)
    player.setRide(null)
    state.riding = null
    syncLevel()
  }

  function checkExit() {
    if (player.level !== lab.exit.level) return
    const p = player.position
    const d = Math.hypot(
      p.x - coords.cx(lab.exit.x),
      p.z - coords.cz(lab.exit.z),
    )
    if (d < EXIT_RANGE) escape()
  }

  function escape() {
    state.escaped = true
    player.freeze()
    overlay.prompt(null)
    overlay.startEscape({ time: state.playTime, seed })
    setTimeout(() => document.exitPointerLock?.(), 1400)
  }

  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  function animateEscape(dt) {
    state.escapeTime += dt
    euler.setFromQuaternion(camera.quaternion)
    euler.x += (1.25 - euler.x) * (1 - Math.exp(-dt * 0.9))
    camera.quaternion.setFromEuler(euler)
    camera.position.y += dt * (0.15 + state.escapeTime * 0.25)
  }

  window.addEventListener('keydown', (e) => {
    if (!player.controls.isLocked || state.escaped) return
    if (e.code === 'KeyE') interact()

    if (import.meta.env.DEV) {
      const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code)
      if (n !== -1 && !player.riding) enterLevel(n, arrivals[n])
      if (e.code === 'KeyK') lab.keycards.forEach((c) => takeKeycard(c.id))
    }
  })
  const arrivals = [
    lab.start,
    besideShaft(lab, 1, lab.lifts[0]),
    besideShaft(lab, 2, lab.lifts[1]),
  ]

  enterLevel(0, lab.start)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  if (import.meta.env.DEV) {
    window.__game = {
      lab,
      player,
      camera,
      lifts,
      state,
      enterLevel,
      takeKeycard,
      interact,
      findInteraction,
    }
  }

  const timer = new THREE.Timer()
  const viewDir = new THREE.Vector3()
  renderer.setAnimationLoop((now) => {
    timer.update(now)
    const dt = Math.min(timer.getDelta(), 0.05)
    const t = timer.getElapsed()

    lifts.update(dt, onLiftArrive)
    lifts.updateBlocked(blocked)

    if (state.riding) {
      const lift = state.riding
      player.setRide({
        x: coords.cx(lift.x),
        z: coords.cz(lift.z),
        y: lift.y,
        moving: lift.wait <= 0,
      })
    }

    if (state.escaped) {
      animateEscape(dt)
    } else {
      player.update(dt)
      syncLevel()
      checkKeycards()
      checkExit()
      if (player.controls.isLocked) state.playTime += dt
    }

    state.interaction = findInteraction()
    overlay.prompt(state.interaction?.text ?? null)

    camera.getWorldDirection(viewDir)
    shared.uTime.value = t
    shared.uCameraPos.value.copy(camera.position)
    shared.uViewDir.value.copy(viewDir)
    shared.uTorchPower.value = torchFlicker(t)

    world.animate(t, dt)
    renderer.render(scene, camera)
  })
}

function torchFlicker(t) {
  const hum = 0.96 + 0.04 * Math.sin(t * 13.0) * Math.sin(t * 7.3)
  const stutter =
    Math.sin(t * 0.7) > 0.985 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 60.0)) : 1
  return hum * stutter
}

function besideShaft(lab, level, lift) {
  const grid = lab.floors[level]
  const walls = grid.cells[lift.z * grid.width + lift.x]
  const d = DIRS.find((dir) => !(walls & dir.bit))
  return { x: lift.x + d.dx, z: lift.z + d.dz }
}
