import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import { DIRS } from '../maze/grid.js'
import { LEVEL_HEIGHT } from '../config.js'
import { resolveCollisions } from './collision.js'

// First-person player: mouse-look (pointer lock), WASD movement, wall collision, head bob.

const EYE = 1.6        // eye height above the floor
const RADIUS = 0.45    // how close you can get to a wall
const WALK = 3.0       // m/s
const RUN = 5.2
const ACCEL = 10       // higher = snappier starts and stops

const MOVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
}

export function createPlayer(camera, lab, coords, { blockedCells }) {
  const controls = new PointerLockControls(camera, document.body)
  const keys = new Set()
  const pos = new THREE.Vector3()
  const vel = new THREE.Vector3()
  const wish = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const right = new THREE.Vector3()
  const UP = new THREE.Vector3(0, 1, 0)
  let level = 0
  let bob = 0

  const down = (name) => MOVE_KEYS[name].some((k) => keys.has(k))

  window.addEventListener('keydown', (e) => keys.add(e.code))
  window.addEventListener('keyup', (e) => keys.delete(e.code))
  window.addEventListener('blur', () => keys.clear())

  // Place the player in a cell, facing down an open corridor.
  function spawn(newLevel, cell) {
    level = newLevel
    pos.set(coords.cx(cell.x), 0, coords.cz(cell.z))
    vel.set(0, 0, 0)
    const grid = lab.floors[level]
    const walls = grid.cells[cell.z * grid.width + cell.x]
    const open = DIRS.find((d) => !(walls & d.bit)) ?? DIRS[0]
    const eyeY = level * LEVEL_HEIGHT + EYE
    camera.position.set(pos.x, eyeY, pos.z)
    camera.lookAt(pos.x + open.dx, eyeY, pos.z + open.dz)
  }

  function update(dt) {
    let ix = 0
    let iz = 0
    if (controls.isLocked) {
      if (down('forward')) iz += 1
      if (down('back')) iz -= 1
      if (down('right')) ix += 1
      if (down('left')) ix -= 1
    }

    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    right.crossVectors(fwd, UP)

    wish.set(0, 0, 0).addScaledVector(fwd, iz).addScaledVector(right, ix)
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(down('run') ? RUN : WALK)
    vel.lerp(wish, 1 - Math.exp(-dt * ACCEL))

    pos.addScaledVector(vel, dt)
    resolveCollisions(lab.floors[level], pos, RADIUS, coords, blockedCells[level])

    // Head bob: a vertical dip twice per stride, a gentle sideways sway once.
    const speed = Math.hypot(vel.x, vel.z)
    bob += dt * speed * 2.1
    const amp = Math.min(speed / WALK, 1.4) * 0.05
    camera.position.set(
      pos.x + right.x * Math.cos(bob) * amp * 0.5,
      level * LEVEL_HEIGHT + EYE + Math.abs(Math.sin(bob)) * amp - amp * 0.5,
      pos.z + right.z * Math.cos(bob) * amp * 0.5,
    )
  }

  return {
    controls,
    spawn,
    update,
    get level() {
      return level
    },
    get position() {
      return pos
    },
  }
}
