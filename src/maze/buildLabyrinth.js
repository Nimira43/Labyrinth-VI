import { createRng } from './rng.js'
import { generateFloor } from './generateFloor.js'
import { bfs, pathTo } from './bfs.js'
import { isDeadEnd, cellOf, index } from './grid.js'

export const LEVEL_COUNT = 3

export function buildLabyrinth({
  width = 15,
  depth = 15,
  seed = 1,
  loopChance = 0.06,
} = {}) {
  const rng = createRng(seed)
  const floors = Array.from({ length: LEVEL_COUNT }, () =>
    generateFloor(width, depth, rng, { loopChance }),
  )
  const [f1, f2, f3] = floors

  const randomCell = { x: rng.int(width), z: rng.int(depth) }
  const start = bfs(f1, randomCell).farthest
  const fromStart = bfs(f1, start)
  const lift1 = fromStart.farthest
  const fromLift1OnF1 = bfs(f1, lift1)
  const keycard1 = placeKeycard(f1, fromStart, fromLift1OnF1, [start, lift1])

  const fromLift1OnF2 = bfs(f2, lift1)
  const lift2 = fromLift1OnF2.farthest
  const fromLift2OnF2 = bfs(f2, lift2)
  const keycard2 = placeKeycard(f2, fromLift1OnF2, fromLift2OnF2, [
    lift1,
    lift2,
  ])

  const fromLift2OnF3 = bfs(f3, lift2)
  const exit = fromLift2OnF3.farthest

  const fromKey1 = bfs(f1, keycard1)
  const fromKey2 = bfs(f2, keycard2)
  const routes = [
    [
      ...pathTo(f1, fromStart, keycard1),
      ...pathTo(f1, fromKey1, lift1).slice(1),
    ],
    [
      ...pathTo(f2, fromLift1OnF2, keycard2),
      ...pathTo(f2, fromKey2, lift2).slice(1),
    ],
    pathTo(f3, fromLift2OnF3, exit),
  ]

  return {
    seed,
    width,
    depth,
    floors,
    start: { level: 0, ...start },
    lifts: [
      { id: 1, x: lift1.x, z: lift1.z, fromLevel: 0, toLevel: 1, keycard: 1 },
      { id: 2, x: lift2.x, z: lift2.z, fromLevel: 1, toLevel: 2, keycard: 2 },
    ],
    keycards: [
      { id: 1, level: 0, ...keycard1 },
      { id: 2, level: 1, ...keycard2 },
    ],
    exit: { level: 2, ...exit },
    routes,
  }
}

function placeKeycard(grid, fromA, fromB, avoid) {
  const avoidIdx = new Set(avoid.map((c) => index(grid, c.x, c.z)))
  let best = -1
  let bestScore = -1
  let fallback = -1
  let fallbackScore = -1

  for (let i = 0; i < grid.cells.length; i++) {
    if (avoidIdx.has(i)) continue
    const score = fromA.dist[i] + fromB.dist[i]
    if (score > fallbackScore) {
      fallbackScore = score
      fallback = i
    }
    if (isDeadEnd(grid, i) && score > bestScore) {
      bestScore = score
      best = i
    }
  }

  return cellOf(grid, best !== -1 ? best : fallback)
}

export function shaftHoles(lab) {
  const floorHoles = lab.floors.map(() => new Set())
  const ceilingHoles = lab.floors.map(() => new Set())
  for (const lift of lab.lifts) {
    const i = lift.z * lab.width + lift.x
    ceilingHoles[lift.fromLevel].add(i)
    floorHoles[lift.toLevel].add(i)
  }
  return { floorHoles, ceilingHoles }
}
