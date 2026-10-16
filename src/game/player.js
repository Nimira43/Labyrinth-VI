import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import { DIRS } from '../maze/grid.js'
import { LEVEL_HEIGHT } from '../config.js'
import { resolveCollisions } from './collision.js'

const EYE = 1.6
const RADIUS = 0.45
const WALK = 3.0
const RUN = 5.2
const ACCEL = 10

const MOVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
}

export function createPlayer(
  camera,
  lab,
  coords,
  { blockedCells, onStep = () => {} },
) {
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
  let ride = null
  let frozen = false

  const down = (name) => MOVE_KEYS[name].some((k) => keys.has(k))

  window.addEventListener('keydown', (e) => keys.add(e.code))
  window.addEventListener('keyup', (e) => keys.delete(e.code))
  window.addEventListener('blur', () => keys.clear())

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
    if (frozen) return

    if (ride) {
      const k = 1 - Math.exp(-dt * 3)
      pos.x += (ride.x - pos.x) * k
      pos.z += (ride.z - pos.z) * k
      vel.set(0, 0, 0)
      const rattle = ride.moving ? (Math.random() - 0.5) * 0.014 : 0
      camera.position.set(pos.x + rattle * 0.5, ride.y + EYE + rattle, pos.z)
      return
    }

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
    if (wish.lengthSq() > 0)
      wish.normalize().multiplyScalar(down('run') ? RUN : WALK)
    vel.lerp(wish, 1 - Math.exp(-dt * ACCEL))

    pos.addScaledVector(vel, dt)
    resolveCollisions(
      lab.floors[level],
      pos,
      RADIUS,
      coords,
      blockedCells[level],
    )

    const speed = Math.hypot(vel.x, vel.z)
    const prevStride = Math.floor(bob / Math.PI)
    bob += dt * speed * 2.1
    if (Math.floor(bob / Math.PI) !== prevStride && speed > 0.6) onStep(speed)
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
    setRide(r) {
      ride = r
    },
    setLevel(l) {
      level = l
    },
    freeze() {
      frozen = true
    },
    get riding() {
      return ride !== null
    },
    get cell() {
      return { x: coords.gx(pos.x), z: coords.gz(pos.z) }
    },
    get level() {
      return level
    },
    get position() {
      return pos
    },
  }
}
