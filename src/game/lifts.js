import { LEVEL_HEIGHT } from '../config.js'

const TRAVEL = 4.5
const DEPART_DELAY = 0.8

const ease = (k) => k * k * (3 - 2 * k)

export function createLifts(lab, world) {
  const list = lab.lifts.map((l, i) => ({
    i,
    id: l.id,
    x: l.x,
    z: l.z,
    cellIndex: l.z * lab.width + l.x,
    fromLevel: l.fromLevel,
    toLevel: l.toLevel,
    bottomY: l.fromLevel * LEVEL_HEIGHT,
    topY: l.toLevel * LEVEL_HEIGHT,
    y: l.fromLevel * LEVEL_HEIGHT,
    at: 'bottom',
    moving: null,
    progress: 0,
    wait: 0,
    rider: false,
    powered: false,
  }))

  const restingLevel = (lift) =>
    lift.at === 'bottom'
      ? lift.fromLevel
      : lift.at === 'top'
        ? lift.toLevel
        : null

  function send(lift, withRider) {
    if (!lift.powered || lift.moving) return false
    lift.moving = lift.at === 'bottom' ? 'up' : 'down'
    lift.at = null
    lift.progress = 0
    lift.wait = DEPART_DELAY
    lift.rider = withRider
    return true
  }

  function power(lift) {
    lift.powered = true
    world.setLiftPowered(lift.i)
  }

  function update(dt, onArrive) {
    for (const lift of list) {
      if (!lift.moving) continue
      if (lift.wait > 0) {
        lift.wait -= dt
        continue
      }
      lift.progress = Math.min(1, lift.progress + dt / TRAVEL)
      const k = ease(lift.progress)
      const [a, b] =
        lift.moving === 'up'
          ? [lift.bottomY, lift.topY]
          : [lift.topY, lift.bottomY]
      lift.y = a + (b - a) * k
      world.setPlatformY(lift.i, lift.y)

      if (lift.progress >= 1) {
        lift.at = lift.moving === 'up' ? 'top' : 'bottom'
        lift.moving = null
        const hadRider = lift.rider
        lift.rider = false
        onArrive(lift, hadRider)
      }
    }
  }

  function updateBlocked(blocked) {
    for (const lift of list) {
      const bottom = blocked[lift.fromLevel]
      const top = blocked[lift.toLevel]
      if (lift.at === 'bottom') bottom.delete(lift.cellIndex)
      else bottom.add(lift.cellIndex)
      if (lift.at === 'top') top.delete(lift.cellIndex)
      else top.add(lift.cellIndex)
    }
  }

  return { list, restingLevel, send, power, update, updateBlocked }
}
