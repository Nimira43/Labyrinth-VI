import { DIRS, index, cellOf } from './grid.js'

// Breadth-first search from one cell across a single floor.
// Returns every cell's walking distance from the start, plus the farthest cell.
// "Farthest" is what we use to place lifts, keycards and the exit, so routes are always long.

export function bfs(grid, from) {
  const total = grid.width * grid.depth
  const dist = new Int32Array(total).fill(-1)
  const prev = new Int32Array(total).fill(-1)
  const queue = new Int32Array(total)

  const startIdx = index(grid, from.x, from.z)
  dist[startIdx] = 0
  let head = 0
  let tail = 0
  queue[tail++] = startIdx
  let farthest = startIdx

  while (head < tail) {
    const i = queue[head++]
    if (dist[i] > dist[farthest]) farthest = i
    const { x, z } = cellOf(grid, i)
    const walls = grid.cells[i]

    for (const d of DIRS) {
      if (walls & d.bit) continue
      const n = index(grid, x + d.dx, z + d.dz)
      if (dist[n] !== -1) continue
      dist[n] = dist[i] + 1
      prev[n] = i
      queue[tail++] = n
    }
  }

  return { dist, prev, farthest: cellOf(grid, farthest), maxDist: dist[farthest] }
}

// Walk the `prev` chain back from `to` to recover the actual route.
export function pathTo(grid, search, to) {
  const path = []
  let i = index(grid, to.x, to.z)
  if (search.dist[i] === -1) return path
  while (i !== -1) {
    path.push(cellOf(grid, i))
    i = search.prev[i]
  }
  return path.reverse()
}
