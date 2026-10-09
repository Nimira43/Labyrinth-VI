import { createGrid, DIRS, index, inBounds, carve, hasWall } from './grid.js'

// Carves one maze floor with an iterative recursive backtracker.
// That gives long, winding corridors with plenty of dead ends.
//
// `loopChance` then knocks out a few extra walls so the maze has loops.
// Loops matter for a horror maze: the player can't simply "follow the left
// wall" and they'll come back to places they've already been.

export function generateFloor(width, depth, rng, { loopChance = 0.06 } = {}) {
  const grid = createGrid(width, depth)
  const visited = new Uint8Array(width * depth)

  const startX = rng.int(width)
  const startZ = rng.int(depth)
  const stack = [[startX, startZ]]
  visited[index(grid, startX, startZ)] = 1

  while (stack.length) {
    const [x, z] = stack[stack.length - 1]

    const options = DIRS.filter((d) => {
      const nx = x + d.dx
      const nz = z + d.dz
      return inBounds(grid, nx, nz) && !visited[index(grid, nx, nz)]
    })

    if (options.length === 0) {
      stack.pop()
      continue
    }

    const dir = rng.pick(options)
    carve(grid, x, z, dir)
    const nx = x + dir.dx
    const nz = z + dir.dz
    visited[index(grid, nx, nz)] = 1
    stack.push([nx, nz])
  }

  // Braid: open some extra interior walls to create loops.
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      if (!rng.chance(loopChance)) continue
      const walls = DIRS.filter(
        (d) => hasWall(grid, x, z, d.bit) && inBounds(grid, x + d.dx, z + d.dz),
      )
      if (walls.length) carve(grid, x, z, rng.pick(walls))
    }
  }

  return grid
}
